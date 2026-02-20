from functools import wraps
from flask import request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from ..models.user import User


def require_auth(fn):
    """Middleware to require valid JWT token."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.filter_by(user_id=user_id, is_active=True).first()
            if not user:
                return jsonify({"error": "User account not found or deactivated"}), 401
            return fn(*args, **kwargs)
        except Exception as e:
            return jsonify({"error": "Authentication required"}), 401
    return wrapper