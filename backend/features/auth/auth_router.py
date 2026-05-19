from fastapi import APIRouter, Depends, Header, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
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
limiter = Limiter(key_func=get_remote_address)


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
@limiter.limit("10/minute")
def session_login(request: Request, user_id: str = Depends(get_current_user_id)):
    """Call immediately after Supabase sign-in to register this session and invalidate others."""
    token = generate_session_token()
    set_session_token(user_id, token)
    return {"session_token": token}


@router.post("/ping-session", response_model=dict)
@limiter.limit("20/minute")
def ping_session(request: Request, user_id: str = Depends(verify_session)):
    """Lightweight endpoint polled every 5 min to detect concurrent session invalidation."""
    return {"ok": True}


@router.put("/update-profile", response_model=dict)
@limiter.limit("10/minute")
def update(
    request: Request,
    body:    UpdateProfileRequest,
    db:      Session = Depends(get_db),
    user_id: str     = Depends(verify_session),
):
    return update_profile(user_id, body, db)


@router.put("/change-password", response_model=dict)
@limiter.limit("5/minute")
def change_pw(
    request: Request,
    body:    ChangePasswordRequest,
    db:      Session = Depends(get_db),
    user_id: str     = Depends(verify_session),
):
    return change_password(user_id, body, db)


@router.delete("/delete-account", response_model=dict)
@limiter.limit("5/minute")
def delete(
    request: Request,
    db:      Session = Depends(get_db),
    user_id: str     = Depends(verify_session),
):
    return delete_account(user_id, db)


@router.post("/upgrade-to-business", response_model=dict)
@limiter.limit("5/minute")
def upgrade(
    request: Request,
    user_id: str = Depends(verify_session),
):
    return upgrade_to_business(user_id)