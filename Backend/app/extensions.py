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
# Production should use Redis backend (configured in config.py)
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per minute"])