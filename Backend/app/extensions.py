import os
from firebase_admin import credentials, firestore, initialize_app, _apps
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman

# Initialize Firebase Admin SDK
# On Google Cloud Run, it automatically uses the built-in Service Account
if not _apps:
    initialize_app()

db = firestore.client()  # This is now your primary Database gateway
jwt = JWTManager()
cors = CORS()
talisman = Talisman()

# Rate Limiter (Stay on Memory for free tier unless you add Redis later)
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per minute"])

# --- JWT Blocklist Logic (Cleaned up) ---
TOKEN_BLOCKLIST: set = set()

def add_to_blocklist(jti: str) -> None:
    TOKEN_BLOCKLIST.add(jti)

def is_token_revoked(jti: str) -> bool:
    return jti in TOKEN_BLOCKLIST