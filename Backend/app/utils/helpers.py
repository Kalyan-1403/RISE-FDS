import logging
from functools import wraps
from flask import jsonify, g
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from ..extensions import db
from ..models.user import User

logger = logging.getLogger(__name__)

def role_required(required_role):
    """
    Decorator to enforce single-role access using Firestore.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            try:
                verify_jwt_in_request()
                user_id = get_jwt_identity()
                
                docs = db.collection(User.COLLECTION).where('user_id', '==', user_id).where('is_active', '==', True).limit(1).stream()
                
                user_data = None
                for doc in docs:
                    user_data = doc.to_dict()
                    user_data['id'] = doc.id
                    break

                if not user_data:
                    return jsonify({"error": "User not found", "code": "INVALID_TOKEN"}), 401

                if user_data.get('role') != required_role:
                    logger.warning(f"RBAC denied: user={user_id}, role={user_data.get('role')}, required={required_role}")
                    return jsonify({"error": "Insufficient permissions"}), 403

                g.current_user = user_data
                return fn(user_data, *args, **kwargs)
            except Exception as e:
                logger.warning(f"Auth failed in role_required: {e}")
                return jsonify({"error": "Authentication required", "code": "INVALID_TOKEN"}), 401
        return wrapper
    return decorator