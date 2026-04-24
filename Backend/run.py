import os
from datetime import datetime, timezone
from app import create_app
from app.extensions import db
from app.models.user import User

app = create_app()

def seed_admin():
    """Seed default admin account if none exists in Firestore."""
    with app.app_context():
        try:
            users_ref = db.collection(User.COLLECTION)
            admin_docs = users_ref.where('role', '==', 'admin').limit(1).stream()
            
            if not any(admin_docs):
                admin_password = os.environ.get('ADMIN_PASSWORD')
                if not admin_password:
                    print('⚠️ ADMIN_PASSWORD not set. Skipping admin seed.')
                    return

                new_admin = {
                    'user_id': 'ADMIN',
                    'name': 'Master Admin',
                    'role': 'admin',
                    'email': os.environ.get('ADMIN_EMAIL', 'admin@rise.edu'),
                    'password_hash': User.set_password(admin_password),
                    'is_active': True,
                    'created_at': datetime.now(timezone.utc)
                }
                
                users_ref.add(new_admin)
                print('✅ Default admin created in Firestore')
            else:
                print('ℹ️ Admin already exists in Firestore')
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f"Firestore seed failed: {e}")

if __name__ == "__main__":
    seed_admin()
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
    )
else:
    # Running under gunicorn
    seed_admin()