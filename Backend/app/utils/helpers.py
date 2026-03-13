import logging
from functools import wraps
from flask import jsonify, g
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from ..models.user import User

logger = logging.getLogger(__name__)


def role_required(required_role):
    """
    Decorator to enforce single-role access.
    For multi-role support, use require_role() from auth_middleware instead.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                verify_jwt_in_request()
                user_id = get_jwt_identity()
                user = User.query.filter_by(user_id=user_id, is_active=True).first()

                if not user:
                    return jsonify({"error": "User not found", "code": "INVALID_TOKEN"}), 401

                if user.role != required_role:
                    logger.warning(f"RBAC denied: user={user_id}, role={user.role}, required={required_role}")
                    return jsonify({"error": "Insufficient permissions"}), 403

                g.current_user = user
                return fn(user, *args, **kwargs)
            except Exception as e:
                logger.warning(f"Auth failed in role_required: {e}")
                return jsonify({"error": "Authentication required", "code": "INVALID_TOKEN"}), 401
        return wrapper
    return decorator