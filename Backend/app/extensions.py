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
import os

TOKEN_BLOCKLIST: set = set()
_redis_client = None

def _get_redis():
    global _redis_client
    if _redis_client is None:
        redis_url = os.environ.get('REDIS_URL')
        if redis_url:
            try:
                import redis as _redis_lib
                client = _redis_lib.from_url(redis_url, decode_responses=True)
                client.ping()
                _redis_client = client
            except Exception:
                _redis_client = None
    return _redis_client

# TTL matches JWT_ACCESS_TOKEN_EXPIRES (default 1 hour)
_TOKEN_TTL = int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRES', 3600))


def add_to_blocklist(jti: str) -> None:
    """Mark a token as revoked. Redis if available, in-memory fallback."""
    r = _get_redis()
    if r:
        try:
            r.setex(f'bl:{jti}', _TOKEN_TTL, '1')
            return
        except Exception:
            pass
    TOKEN_BLOCKLIST.add(jti)


def is_token_revoked(jti: str) -> bool:
    """Return True if the token has been explicitly revoked."""
    r = _get_redis()
    if r:
        try:
            return bool(r.get(f'bl:{jti}'))
        except Exception:
            pass
    return jti in TOKEN_BLOCKLIST
