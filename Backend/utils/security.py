"""
Security utilities for RISE-FDS
Production-ready security functions
"""
import secrets
import string
import hashlib
import hmac
from datetime import datetime, timedelta
from flask import current_app

# In-memory token store (use Redis in production)
reset_tokens = {}


def generate_secure_otp(length=6):
    """Generate cryptographically secure OTP"""
    return ''.join(secrets.choice(string.digits) for _ in range(length))


def generate_reset_token(user_id):
    """Generate a secure password reset token"""
    token = secrets.token_urlsafe(32)
    expiry = datetime.utcnow() + timedelta(minutes=15)
    
    # Store token with expiry
    reset_tokens[user_id] = {
        'token': hashlib.sha256(token.encode()).hexdigest(),
        'expiry': expiry
    }
    
    return token


def verify_reset_token(user_id, token):
    """Verify password reset token"""
    if user_id not in reset_tokens:
        return False
    
    stored = reset_tokens[user_id]
    
    # Check expiry
    if datetime.utcnow() > stored['expiry']:
        del reset_tokens[user_id]
        return False
    
    # Verify token
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    if not hmac.compare_digest(token_hash, stored['token']):
        return False
    
    # Token is valid - delete it (one-time use)
    del reset_tokens[user_id]
    return True


def sanitize_input(value, max_length=255):
    """Sanitize user input"""
    if not value:
        return value
    
    # Convert to string and strip
    value = str(value).strip()
    
    # Limit length
    if len(value) > max_length:
        value = value[:max_length]
    
    return value


def hash_ip_address(ip_address):
    """Hash IP address for privacy-preserving logging"""
    if not ip_address:
        return 'unknown'
    return hashlib.sha256(ip_address.encode()).hexdigest()[:16]