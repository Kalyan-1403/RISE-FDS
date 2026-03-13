import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()


class BaseConfig:
    """Base configuration shared across all environments."""
    SECRET_KEY = os.getenv('SECRET_KEY')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'

    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'postgresql://localhost:5432/rise_feedback_dev')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 10,
        'pool_recycle': 300,
        'pool_pre_ping': True,
        'max_overflow': 20,
    }

    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')

    # CORS: Restrict allowed origins
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(',')


class DevelopmentConfig(BaseConfig):
    DEBUG = True
    SQLALCHEMY_ECHO = False


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

    # Secure cookies
    JWT_COOKIE_SECURE = True
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    # Use Redis for rate limiting in production
    RATELIMIT_STORAGE_URI = os.environ.get('REDIS_URL', 'memory://')


class TestingConfig(BaseConfig):
    TESTING = True
    SECRET_KEY = 'testing-secret-key'
    JWT_SECRET_KEY = 'testing-jwt-key'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'


config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
}