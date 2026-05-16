from sqlalchemy.orm import Session
from sqlalchemy import Column, String
from backend.db.database import Base
from fastapi import HTTPException
from pathlib import Path
from dotenv import load_dotenv
import urllib.request
import json
import os

env_path = Path(__file__).resolve().parent.parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

SUPABASE_URL              = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


# ─── ORM Model ────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    user_id     = Column(String, primary_key=True, index=True)
    first_name  = Column(String, nullable=False)
    last_name   = Column(String, nullable=False)
    email       = Column(String, unique=True, nullable=False)
    profile_pic = Column(String, nullable=True)


# ─── Supabase Admin Helpers ───────────────────────────────────────────────────

def set_session_token(user_id: str, token: str):
    """Write the new session token to profiles table, invalidating any prior session."""
    url     = f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}"
    payload = json.dumps({"session_token": token}).encode("utf-8")
    req = urllib.request.Request(
        url, data=payload, method="PATCH",
        headers={
            "Content-Type":  "application/json",
            "apikey":         SUPABASE_SERVICE_ROLE_KEY,
            "Authorization":  f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        },
    )
    with urllib.request.urlopen(req):
        pass


def get_session_token(user_id: str) -> str | None:
    """Fetch the stored session token from profiles."""
    url = f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=session_token"
    req = urllib.request.Request(
        url, method="GET",
        headers={
            "apikey":         SUPABASE_SERVICE_ROLE_KEY,
            "Authorization":  f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        },
    )
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read())
        return data[0]["session_token"] if data else None


def update_supabase_metadata(user_id: str, first_name: str, last_name: str):
    """Update auth.users user_metadata via Supabase Admin API."""
    try:
        url     = f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}"
        payload = json.dumps({
            "user_metadata": {
                "first_name": first_name,
                "last_name":  last_name,
            }
        }).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            method="PUT",
            headers={
                "Content-Type": "application/json",
                "apikey":        SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
        )
        with urllib.request.urlopen(req) as res:
            print(f"✅ Supabase metadata updated: {res.status}")
    except Exception as e:
        print(f"⚠️  Supabase metadata update failed: {e}")


def delete_supabase_user(user_id: str):
    """Delete user from Supabase Auth via Admin API."""
    try:
        url = f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}"
        req = urllib.request.Request(
            url,
            method="DELETE",
            headers={
                "apikey":        SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            },
        )
        with urllib.request.urlopen(req) as res:
            print(f"✅ Supabase user deleted: {res.status}")
    except Exception as e:
        print(f"⚠️  Supabase user deletion failed: {e}")


def upgrade_supabase_role(user_id: str) -> bool:
    """
    Update profiles.role → 'business' using the Supabase REST API
    with the service role key, which bypasses RLS entirely.

    Returns True on success, raises HTTPException on failure.
    """
    try:
        # Supabase REST API: upsert so users with no profiles row get one created
        url     = f"{SUPABASE_URL}/rest/v1/profiles"
        payload = json.dumps({"id": user_id, "role": "business"}).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=payload,
            method="POST",
            headers={
                "Content-Type":  "application/json",
                "apikey":         SUPABASE_SERVICE_ROLE_KEY,
                "Authorization":  f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                # on conflict (id already exists) update the role column only
                "Prefer":         "return=representation,resolution=merge-duplicates",
            },
        )

        with urllib.request.urlopen(req) as res:
            body = json.loads(res.read().decode("utf-8"))
            print(f"✅ Role upgraded for user {user_id}: {body}")

            if not body:
                raise HTTPException(
                    status_code=400,
                    detail="Role upgrade failed — upsert returned no rows.",
                )

            updated_role = body[0].get("role")
            if updated_role != "business":
                raise HTTPException(
                    status_code=400,
                    detail=f"Role upgrade failed — unexpected role value: {updated_role}",
                )

            return True

    except HTTPException:
        # Re-raise our own HTTPExceptions as-is
        raise
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print(f"❌ Supabase role upgrade HTTP error {e.code}: {error_body}")
        raise HTTPException(
            status_code=500,
            detail=f"Supabase error during role upgrade: {error_body}",
        )
    except Exception as e:
        print(f"❌ Role upgrade failed: {e}")
        raise HTTPException(
            status_code=500,
            detail="Unexpected error during role upgrade. Please try again.",
        )


# ─── Service Functions ────────────────────────────────────────────────────────

def update_profile(user_id: str, request, db: Session):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    if request.email:
        existing = db.query(User).filter(
            User.email    == request.email,
            User.user_id  != user_id,
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use.")

    if request.first_name is not None:
        user.first_name = request.first_name
    if request.last_name is not None:
        user.last_name = request.last_name
    if request.email is not None:
        user.email = request.email

    db.commit()
    db.refresh(user)

    update_supabase_metadata(user_id, user.first_name, user.last_name)

    return {
        "message":    "Profile updated successfully.",
        "first_name": user.first_name,
        "last_name":  user.last_name,
        "email":      user.email,
        "profile_pic": user.profile_pic,
    }


def change_password(user_id: str, request, db: Session):
    raise HTTPException(
        status_code=400,
        detail="Password changes are handled by Supabase. Use supabase.auth.updateUser() on the frontend.",
    )


def delete_account(user_id: str, db: Session):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    db.delete(user)
    db.commit()

    delete_supabase_user(user_id)

    return {"message": "Account deleted successfully."}


def upgrade_to_business(user_id: str):
    """
    Upgrade a user's role from 'user' → 'business'.
    Uses the service role key via the Supabase REST API,
    which bypasses RLS — safe because user_id is extracted
    from the verified JWT on the backend, not trusted from the client.
    """
    upgrade_supabase_role(user_id)
    return {"message": "Account upgraded to business successfully."}