import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class BaseConfig:
    """Base configuration shared across all environments."""
    SECRET_KEY = os.getenv('SECRET_KEY')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')

    # Access token: returned in response body, stored in-memory by frontend
    # Refresh token: stored in httpOnly cookie — never accessible to JavaScript
    JWT_TOKEN_LOCATION = ['headers', 'cookies']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'

    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    # Cookie settings for the refresh token
    JWT_COOKIE_HTTPONLY = True
    JWT_COOKIE_CSRF_PROTECT = False   # SameSite + HTTPS provides CSRF protection
    JWT_REFRESH_COOKIE_NAME = 'refresh_token_cookie'
    JWT_REFRESH_COOKIE_PATH = '/api/auth'  # Scope cookie to auth routes only

    # Database
    database_url = os.getenv("DATABASE_URL")
    if database_url and database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    SQLALCHEMY_DATABASE_URI = database_url or "postgresql://localhost:5432/rise_feedback_dev"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'poolclass': __import__('sqlalchemy.pool', fromlist=['NullPool']).NullPool,
        'connect_args': {
            'connect_timeout': 10,
            'keepalives': 1,
            'keepalives_idle': 30,
            'keepalives_interval': 10,
            'keepalives_count': 5,
        },
    }

    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(',')


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_ECHO = False

    # In development, requests go through the Vite proxy so frontend and
    # backend are effectively same-origin. Use Lax (no Secure required for HTTP).
    JWT_COOKIE_SECURE = False
    JWT_COOKIE_SAMESITE = 'Lax'

    # Tighter expiry even in dev for safety
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)


class ProductionConfig(BaseConfig):
    DEBUG = False
    SQLALCHEMY_ECHO = False

    SECRET_KEY = os.environ.get('SECRET_KEY')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')

    # Fail fast if secrets are missing
    if not SECRET_KEY:
        raise ValueError("CRITICAL: SECRET_KEY not set in production environment")
    if not JWT_SECRET_KEY:
        raise ValueError("CRITICAL: JWT_SECRET_KEY not set in production environment")
    if not SQLALCHEMY_DATABASE_URI:
        raise ValueError("CRITICAL: DATABASE_URL not set in production environment")

    # Tighter token expiry in production
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=2)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)

    # FIX (CRITICAL): httpOnly refresh cookie — SameSite=None required for
    # cross-origin Render deployments (frontend/backend on different subdomains).
    # Requires HTTPS (Secure=True), which Render provides by default.
    JWT_COOKIE_SECURE = True
    JWT_COOKIE_SAMESITE = 'None'

    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    RATELIMIT_STORAGE_URI = os.environ.get('REDIS_URL', 'memory://')


class TestingConfig(BaseConfig):
    TESTING = True
    SECRET_KEY = 'testing-secret-key'
    JWT_SECRET_KEY = 'testing-jwt-key'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    JWT_COOKIE_SECURE = False
    JWT_COOKIE_SAMESITE = 'Lax'


config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
}
