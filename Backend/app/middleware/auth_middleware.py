import logging
from functools import wraps
from flask import request, jsonify, g
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from ..extensions import db
from ..models.user import User

logger = logging.getLogger(__name__)

def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
        except Exception as e:
            logger.warning(f"JWT verification failed for {request.path}: {e}")
            return jsonify({"error": "Authentication required", "code": "INVALID_TOKEN"}), 401
        
        try:
            user_id = get_jwt_identity()
            docs = db.collection(User.COLLECTION).where('user_id', '==', user_id).where('is_active', '==', True).limit(1).stream()
            
            user_data = None
            for doc in docs:
                user_data = doc.to_dict()
                user_data['id'] = doc.id
                break
                
            if not user_data:
                return jsonify({"error": "User account not found or deactivated", "code": "INVALID_TOKEN"}), 401
                
            g.current_user = user_data
            return fn(*args, **kwargs)
        except Exception as e:
            logger.error(f"DB error during auth for {request.path}: {e}")
            return jsonify({"error": "Service temporarily unavailable", "code": "DB_ERROR"}), 503
    return wrapper

def require_role(allowed_roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                verify_jwt_in_request()
            except Exception as e:
                logger.warning(f"JWT verification failed for {request.path}: {e}")
                return jsonify({"error": "Authentication required", "code": "INVALID_TOKEN"}), 401
            
            try:
                user_id = get_jwt_identity()
                docs = db.collection(User.COLLECTION).where('user_id', '==', user_id).where('is_active', '==', True).limit(1).stream()
                
                user_data = None
                for doc in docs:
                    user_data = doc.to_dict()
                    user_data['id'] = doc.id
                    break
                    
                if not user_data:
                    return jsonify({"error": "User account not found or deactivated", "code": "INVALID_TOKEN"}), 401
                    
                if user_data.get('role') not in allowed_roles:
                    logger.warning(f"RBAC denied: user={user_id}, role={user_data.get('role')}, required={allowed_roles}")
                    return jsonify({"error": "Access forbidden: insufficient permissions"}), 403
                    
                g.current_user = user_data
                return fn(*args, **kwargs)
            except Exception as e:
                logger.error(f"DB error during auth for {request.path}: {e}")
                return jsonify({"error": "Service temporarily unavailable", "code": "DB_ERROR"}), 503
        return wrapper
    return decorator