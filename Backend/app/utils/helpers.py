from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from ..models.user import User


def role_required(required_role):
    """Decorator to enforce role-based access."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.filter_by(user_id=user_id, is_active=True).first()
            if not user:
                return jsonify({"error": "User not found"}), 404
            if user.role != required_role:
                return jsonify({"error": "Insufficient permissions"}), 403
            return fn(user, *args, **kwargs)
        return wrapper
    return decorator


def get_current_user():
    """Get current authenticated user from JWT."""
    verify_jwt_in_request()
    user_id = get_jwt_identity()
    return User.query.filter_by(user_id=user_id, is_active=True).first()