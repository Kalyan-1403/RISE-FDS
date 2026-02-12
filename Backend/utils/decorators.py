from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from models import User

def jwt_required_custom(fn):
    """Custom JWT required decorator"""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        return fn(*args, **kwargs)
    return wrapper

def role_required(*allowed_roles):
    """Decorator to check user role"""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.filter_by(user_id=user_id).first()
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            if user.role not in allowed_roles:
                return jsonify({'error': 'Access denied. Insufficient permissions.'}), 403
            
            return fn(*args, **kwargs)
        return wrapper
    return decorator

def get_current_user():
    """Get current logged-in user"""
    user_id = get_jwt_identity()
    return User.query.filter_by(user_id=user_id).first()
