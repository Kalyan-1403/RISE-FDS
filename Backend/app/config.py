import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class BaseConfig:
    """Base configuration for Google Cloud / Firebase."""
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'dev-jwt-key')

    # Firebase / Google Cloud Project Info
    GCP_PROJECT_ID = os.getenv('GOOGLE_CLOUD_PROJECT', 'rise-fds')

    JWT_TOKEN_LOCATION = ['headers', 'cookies']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'

    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=2)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)

    JWT_COOKIE_HTTPONLY = True
    JWT_COOKIE_CSRF_PROTECT = False 
    JWT_REFRESH_COOKIE_NAME = 'refresh_token_cookie'
    JWT_REFRESH_COOKIE_PATH = '/api/auth'

    FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    CORS_ORIGINS = os.getenv(
        'CORS_ORIGINS',
        'http://localhost:5173,https://rise-fds.web.app,https://rise-fds.firebaseapp.com'
    ).split(',')

class DevelopmentConfig(BaseConfig):
    DEBUG = True
    JWT_COOKIE_SECURE = False
    JWT_COOKIE_SAMESITE = 'Lax'

class ProductionConfig(BaseConfig):
    DEBUG = False
    # CRITICAL for Cloud Run: Secure must be True for HTTPS
    JWT_COOKIE_SECURE = True
    JWT_COOKIE_SAMESITE = 'None' 
    
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
}