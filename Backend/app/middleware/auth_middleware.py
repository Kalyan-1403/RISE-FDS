import logging
from functools import wraps
from flask import request, jsonify, g
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from ..models.user import User

logger = logging.getLogger(__name__)


def require_auth(fn):
    """Middleware to require a valid JWT token and load the active user."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()

            user = User.query.filter_by(user_id=user_id, is_active=True).first()
            if not user:
                return jsonify({"error": "User account not found or deactivated", "code": "INVALID_TOKEN"}), 401

            g.current_user = user
            return fn(*args, **kwargs)
        except Exception as e:
            logger.warning(f"Auth failed for {request.path}: {e}")
            return jsonify({"error": "Authentication required", "code": "INVALID_TOKEN"}), 401
    return wrapper


def require_role(allowed_roles):
    """Middleware to enforce Role-Based Access Control (RBAC)."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                verify_jwt_in_request()
                user_id = get_jwt_identity()

                user = User.query.filter_by(user_id=user_id, is_active=True).first()
                if not user:
                    return jsonify({"error": "User account not found or deactivated", "code": "INVALID_TOKEN"}), 401

                if user.role not in allowed_roles:
                    logger.warning(f"RBAC denied: user={user_id}, role={user.role}, required={allowed_roles}")
                    return jsonify({"error": "Access forbidden: insufficient permissions"}), 403

                g.current_user = user
                return fn(*args, **kwargs)
            except Exception as e:
                logger.warning(f"Auth failed for {request.path}: {e}")
                return jsonify({"error": "Authentication required", "code": "INVALID_TOKEN"}), 401
        return wrapper
    return decorator