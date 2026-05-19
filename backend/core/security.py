import jwt as pyjwt
from jose import jwt, JWTError
from datetime import datetime, timedelta
import bcrypt
import base64
import json
import urllib.request
import jwt as pyjwt
from jwt.algorithms import ECAlgorithm
from pathlib import Path
from dotenv import load_dotenv
from itsdangerous import URLSafeTimedSerializer
import base64
import json
import requests as req
import os

env_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

SECRET_KEY                  = os.getenv("SECRET_KEY")
ALGORITHM                   = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 30))
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
SUPABASE_PROJECT_REF = os.getenv("SUPABASE_PROJECT_REF")

if not SECRET_KEY:
    raise ValueError("SECRET_KEY not found in .env")

if not SUPABASE_PROJECT_REF:
    raise ValueError("SUPABASE_PROJECT_REF not found in .env")

def generate_session_token() -> str:
    import secrets
    return secrets.token_hex(32)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_token(user_id: str, email: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": email, "user_id": user_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None





_JWT_SECRET = os.getenv("JWT_SECRET")
if not _JWT_SECRET:
    raise ValueError("JWT_SECRET not found in .env")


def generate_verification_token(email: str) -> str:
    s = URLSafeTimedSerializer(_JWT_SECRET)
    return s.dumps(email, salt="email-verify")


def confirm_verification_token(token: str, expiration=86400):
    s = URLSafeTimedSerializer(_JWT_SECRET)
    try:
        email = s.loads(token, salt="email-verify", max_age=expiration)
    except Exception:
        return None
    return email


# ── Supabase JWT (ES256 with JWKS) ───────────────────────────────────────────
import time

_jwks_cache: dict | None = None          # Cache JWKS to avoid a network hit on every request
_jwks_cache_ts: float = 0.0              # Unix timestamp of last successful fetch
_JWKS_TTL: float = 3600.0               # Re-fetch after 1 hour

def decode_supabase_token(token: str) -> dict | None:
    global _jwks_cache, _jwks_cache_ts
    try:
        # ── Try ES256 via JWKS first ──────────────────────────────────────────
        if _jwks_cache is None or (time.time() - _jwks_cache_ts) > _JWKS_TTL:
            jwks_url = f"https://{SUPABASE_PROJECT_REF}.supabase.co/auth/v1/.well-known/jwks.json"
            try:
                with urllib.request.urlopen(jwks_url, timeout=5) as response:
                    _jwks_cache = json.loads(response.read())
                    _jwks_cache_ts = time.time()
            except Exception as e:
                print(f"⚠️  JWKS fetch failed: {e}")
                # Don't cache on failure — retry next request
                _jwks_cache = None

        if _jwks_cache:
            header = pyjwt.get_unverified_header(token)
            kid = header.get("kid")
            alg = header.get("alg", "")

            if alg == "ES256":
                for key in _jwks_cache["keys"]:
                    if key.get("kid") == kid:
                        public_key = ECAlgorithm.from_jwk(json.dumps(key))
                        payload = pyjwt.decode(
                            token, public_key, algorithms=["ES256"],
                            options={"verify_aud": False},
                            leeway=timedelta(seconds=60),
                        )
                        return payload

        # ── Fallback: HS256 with SUPABASE_JWT_SECRET (local dev / older projects) ──
        if SUPABASE_JWT_SECRET:
            try:
                payload = pyjwt.decode(
                    token, SUPABASE_JWT_SECRET, algorithms=["HS256"],
                    options={"verify_aud": False},
                    leeway=timedelta(seconds=60),
                )
                return payload
            except Exception:
                pass

        return None
    except Exception as e:
        print(f"⚠️  Token decode error: {e}")
        return None


def get_supabase_user_id(token: str) -> str | None:
    payload = decode_supabase_token(token)
    if not payload:
        return None
    return payload.get("sub")