import bcrypt
from datetime import datetime, timezone

class User:
    COLLECTION = 'users'

    @staticmethod
    def set_password(password):
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    @staticmethod
    def check_password(password, hashed_password):
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

    @staticmethod
    def to_dict(doc_id, data):
        user_id = data.get('user_id', '')
        role = data.get('role', '')
        
        admin_title = None
        if role == 'admin' and user_id:
            if user_id.startswith('PRINCIPAL-'):
                admin_title = 'Principal'
            elif user_id.startswith('DIRECTOR-'):
                admin_title = 'Director'
            elif user_id.startswith('CHAIRMAN-'):
                admin_title = 'Chairman'

        return {
            'id': doc_id,
            'userId': user_id,
            'name': data.get('name', ''),
            'role': role,
            'adminTitle': admin_title,
            'college': data.get('college', ''),
            'department': data.get('department', ''),
            'username': data.get('name', ''),
            'email': data.get('email', ''),
            'isActive': data.get('is_active', True),
            'createdAt': data.get('created_at').isoformat() if data.get('created_at') else None
        }