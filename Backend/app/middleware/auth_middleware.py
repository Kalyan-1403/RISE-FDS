from functools import wraps
from flask import request, jsonify, g
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from ..models.user import User

def require_auth(fn):
    """Middleware to require valid JWT token and load active user."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            
            user = User.query.filter_by(user_id=user_id, is_active=True).first()
            if not user:
                return jsonify({"error": "User account not found or deactivated"}), 401
            
            # PERFORMANCE UPGRADE: Store the loaded user in Flask's 'g' object.
            # This allows your routes to access 'g.current_user' instantly 
            # without having to query the PostgreSQL database a second time!
            g.current_user = user
            
            return fn(*args, **kwargs)
        except Exception as e:
            # Added str(e) during development to help debug token errors (expired, invalid signature)
            return jsonify({"error": "Authentication required", "details": str(e)}), 401
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
                    return jsonify({"error": "User account not found or deactivated"}), 401
                
                # SECURITY UPGRADE: Automatically block unauthorized roles
                if user.role not in allowed_roles:
                    return jsonify({"error": f"Access forbidden: Requires one of {allowed_roles}"}), 403
                
                g.current_user = user
                return fn(*args, **kwargs)
            except Exception as e:
                return jsonify({"error": "Authentication required"}), 401
        return wrapper
    return decorator