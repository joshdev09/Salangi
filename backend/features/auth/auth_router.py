from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.features.auth.auth_schema import UpdateProfileRequest, ChangePasswordRequest
from backend.features.auth.auth_service import (
    update_profile,
    change_password,
    delete_account,
    upgrade_to_business,
    set_session_token,
    get_session_token,
)
from backend.core.security import get_supabase_user_id, generate_session_token

router = APIRouter(prefix="/api/auth", tags=["Auth"])


# ─── Dependency ───────────────────────────────────────────────────────────────

def get_current_user_id(authorization: str = Header(...)) -> str:
    token   = authorization.replace("Bearer ", "").strip()
    user_id = get_supabase_user_id(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return user_id


def verify_session(
    authorization:    str = Header(...),
    x_session_token:  str = Header(...),
) -> str:
    """Rejects requests whose session token no longer matches the DB — i.e. a newer login exists."""
    token   = authorization.replace("Bearer ", "").strip()
    user_id = get_supabase_user_id(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    stored = get_session_token(user_id)
    if stored != x_session_token:
        raise HTTPException(status_code=401, detail="Session expired. You've been logged in from another device.")
    return user_id


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/session-login", response_model=dict)
def session_login(user_id: str = Depends(get_current_user_id)):
    """Call immediately after Supabase sign-in to register this session and invalidate others."""
    token = generate_session_token()
    set_session_token(user_id, token)
    return {"session_token": token}


@router.post("/ping-session", response_model=dict)
def ping_session(user_id: str = Depends(verify_session)):
    """Lightweight endpoint polled every 5 min to detect concurrent session invalidation."""
    return {"ok": True}


@router.put("/update-profile", response_model=dict)
def update(
    request: UpdateProfileRequest,
    db:      Session = Depends(get_db),
    user_id: str     = Depends(verify_session),
):
    return update_profile(user_id, request, db)


@router.put("/change-password", response_model=dict)
def change_pw(
    request: ChangePasswordRequest,
    db:      Session = Depends(get_db),
    user_id: str     = Depends(verify_session),
):
    return change_password(user_id, request, db)


@router.delete("/delete-account", response_model=dict)
def delete(
    db:      Session = Depends(get_db),
    user_id: str     = Depends(verify_session),
):
    return delete_account(user_id, db)


@router.post("/upgrade-to-business", response_model=dict)
def upgrade(
    user_id: str = Depends(get_current_user_id),
):
    return upgrade_to_business(user_id)