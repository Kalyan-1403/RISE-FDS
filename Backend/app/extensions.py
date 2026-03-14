from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman

db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
talisman = Talisman()

# Default rate limit: 200 requests/minute per IP
# Production should use Redis backend (configured in config.py via REDIS_URL)
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per minute"])

# ─── JWT Token Blocklist ──────────────────────────────────────────────────────
# In-memory set of revoked token JTIs. Works correctly for single-process
# Render deployments (Free / Starter tier).
#
# IMPORTANT: If you scale to multiple Gunicorn workers or multiple instances,
# replace this with a Redis-backed store:
#   import redis, os
#   _redis = redis.from_url(os.environ.get('REDIS_URL'))
#   def add_to_blocklist(jti, ttl_seconds): _redis.setex(f'bl:{jti}', ttl_seconds, '1')
#   def is_token_revoked(jti): return bool(_redis.get(f'bl:{jti}'))
#
TOKEN_BLOCKLIST: set = set()


def add_to_blocklist(jti: str) -> None:
    """Mark a token as revoked by its JTI (JWT ID)."""
    TOKEN_BLOCKLIST.add(jti)


def is_token_revoked(jti: str) -> bool:
    """Return True if the token has been explicitly revoked."""
    return jti in TOKEN_BLOCKLIST
