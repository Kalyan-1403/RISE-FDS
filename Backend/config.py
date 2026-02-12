import os
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()

class Config:
    """Base configuration - Production Safe"""
    
    # CRITICAL: These MUST be set via environment variables in production
    # No default fallbacks for security-critical values
    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        raise ValueError("No SECRET_KEY set for Flask application. Set it as environment variable.")
    
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Database Configuration
    DB_HOST = os.environ.get('DB_HOST')
    DB_PORT = os.environ.get('DB_PORT', '5432')
    DB_NAME = os.environ.get('DB_NAME')
    DB_USER = os.environ.get('DB_USER')
    DB_PASSWORD = os.environ.get('DB_PASSWORD')
    
    # Validate database config in production
    if not all([DB_HOST, DB_NAME, DB_USER]):
        raise ValueError("Database configuration incomplete. Set DB_HOST, DB_NAME, DB_USER environment variables.")
    
    SQLALCHEMY_DATABASE_URI = f'postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
    
    # JWT Configuration - CRITICAL: Must be strong and unique
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
    if not JWT_SECRET_KEY:
        raise ValueError("No JWT_SECRET_KEY set. Set it as environment variable.")
    
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)  # Reduced from 24 hours
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)
    JWT_HEADER_TYPE = 'Bearer'
    
    # CORS - Strict origins in production
    CORS_ORIGINS = os.environ.get('FRONTEND_URL', 'http://localhost:5173').split(',')
    
    # Rate Limiting - Use Redis in production
    RATELIMIT_STORAGE_URL = os.environ.get('REDIS_URL', 'memory://')
    RATELIMIT_DEFAULT = "200 per day"
    RATELIMIT_HEADERS_ENABLED = True
    
    # File Upload
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'uploads')
    
    # Email Configuration
    SMTP_SERVER = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
    SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
    SMTP_USERNAME = os.environ.get('SMTP_USERNAME')
    SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
    SMTP_USE_TLS = True
    
    # SMS Configuration
    SMS_API_KEY = os.environ.get('SMS_API_KEY')
    SMS_API_URL = os.environ.get('SMS_API_URL')
    SMS_SENDER_ID = os.environ.get('SMS_SENDER_ID', 'RISEFDS')
    
    # Security Settings
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    
    # Login Security
    MAX_LOGIN_ATTEMPTS = 5
    LOGIN_LOCKOUT_DURATION = timedelta(minutes=15)
    
    # OTP Security
    OTP_MAX_ATTEMPTS = 3
    OTP_EXPIRY_MINUTES = 10


class DevelopmentConfig(Config):
    """Development configuration - ONLY for local development"""
    DEBUG = True
    TESTING = False
    
    # Override strict checks for development only
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-NEVER-USE-IN-PRODUCTION')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'dev-jwt-key-NEVER-USE-IN-PRODUCTION')
    
    # Allow local database defaults
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_PORT = os.environ.get('DB_PORT', '5432')
    DB_NAME = os.environ.get('DB_NAME', 'rise_fds')
    DB_USER = os.environ.get('DB_USER', 'postgres')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', '')
    
    SQLALCHEMY_DATABASE_URI = f'postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}'
    
    # Relaxed security for development
    SESSION_COOKIE_SECURE = False
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000']


class ProductionConfig(Config):
    """Production configuration - Maximum security"""
    DEBUG = False
    TESTING = False
    
    # Ensure HTTPS in production
    SESSION_COOKIE_SECURE = True
    PREFERRED_URL_SCHEME = 'https'
    
    # Stricter rate limiting
    RATELIMIT_DEFAULT = "100 per day"


class TestingConfig(Config):
    """Testing configuration"""
    DEBUG = True
    TESTING = True
    SECRET_KEY = 'test-secret-key'
    JWT_SECRET_KEY = 'test-jwt-key'
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SESSION_COOKIE_SECURE = False


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

def get_config():
    """Get configuration based on FLASK_ENV"""
    env = os.environ.get('FLASK_ENV', 'development')
    return config.get(env, DevelopmentConfig)