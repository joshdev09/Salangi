import os
import json
import urllib.request
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from dotenv import load_dotenv
from backend.core.security import get_supabase_user_id
from backend.core.email import send_listing_approved_email

load_dotenv()

SUPABASE_URL              = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

router = APIRouter(prefix="/api/listings", tags=["Listings"])


# ── Dependency ─────────────────────────────────────────────────────────────────

def get_admin_user_id(authorization: str = Header(...)) -> str:
    token   = authorization.replace("Bearer ", "").strip()
    user_id = get_supabase_user_id(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    url = f"{SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=role"
    req = urllib.request.Request(url, method="GET", headers={
        "apikey":        SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    })
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read())
        if not data or data[0].get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required.")
    return user_id


# ── Schema ─────────────────────────────────────────────────────────────────────

class ApproveListing(BaseModel):
    listing_id: int


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/approve", response_model=dict)
def approve_listing(
    body: ApproveListing,
    authorization: str = Header(...),
):
    get_admin_user_id(authorization)

    listing_id = body.listing_id

    # ── Step 1: Fetch listing (name + email + user_id) ────────────────────────
    url = f"{SUPABASE_URL}/rest/v1/listings?id=eq.{listing_id}&select=id,name,email,user_id,verified"
    req = urllib.request.Request(url, method="GET", headers={
        "apikey":        SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    })
    with urllib.request.urlopen(req) as res:
        rows = json.loads(res.read())

    if not rows:
        raise HTTPException(status_code=404, detail="Listing not found.")

    listing       = rows[0]
    business_name = listing.get("name", "Your Business")
    owner_email   = listing.get("email")

    # ── Step 2: Update verified = true ────────────────────────────────────────
    patch_url = f"{SUPABASE_URL}/rest/v1/listings?id=eq.{listing_id}"
    payload   = json.dumps({"verified": True}).encode("utf-8")
    patch_req = urllib.request.Request(patch_url, data=payload, method="PATCH", headers={
        "Content-Type":  "application/json",
        "apikey":        SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Prefer":        "return=minimal",
    })
    with urllib.request.urlopen(patch_req):
        pass

    # ── Step 3: Fall back to account email via user_id ────────────────────────
    if not owner_email:
        user_id = listing.get("user_id")
        if user_id:
            user_url = f"{SUPABASE_URL}/rest/v1/users?user_id=eq.{user_id}&select=email"
            user_req = urllib.request.Request(user_url, method="GET", headers={
                "apikey":        SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            })
            try:
                with urllib.request.urlopen(user_req) as res:
                    user_rows = json.loads(res.read())
                    if user_rows:
                        owner_email = user_rows[0].get("email")
            except Exception as e:
                print(f"⚠️  Could not fetch user email for user_id {user_id}: {e}")

    # ── Step 4: Send approval email (best-effort) ─────────────────────────────
    email_sent = False
    if owner_email:
        try:
            send_listing_approved_email(owner_email, business_name)
            email_sent = True
            print(f"✅ Approval email sent to {owner_email} for listing '{business_name}'")
        except Exception as e:
            print(f"⚠️  Approval email failed for listing {listing_id}: {e}")

    return {
        "message":    "Listing approved successfully.",
        "listing_id": listing_id,
        "email_sent": email_sent,
    }