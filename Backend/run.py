import os
from app import create_app
from app.extensions import db
from app.models.user import User

app = create_app()

def seed_admin():
    """Seed default admin account if none exists."""
    with app.app_context():
        admin = User.query.filter_by(role='admin').first()
        if not admin:
            admin_password = os.environ.get('ADMIN_PASSWORD')
            if not admin_password:
                print('⚠️ ADMIN_PASSWORD not set. Skipping admin seed.')
                return

            admin = User(
                user_id='ADMIN',
                name='Master Admin',
                role='admin',
                email=os.environ.get('ADMIN_EMAIL', 'admin@rise.edu'),
            )
            admin.set_password(admin_password)
            db.session.add(admin)
            db.session.commit()
            print('✅ Default admin created')
        else:
            print('ℹ️ Admin already exists')


if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        seed_admin()
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
    )
else:
    # Running under gunicorn — run migrations once in app context
    # but don't block worker startup
    import threading
    def _init_db():
        with app.app_context():
            try:
                db.create_all()
                seed_admin()
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"DB init failed: {e}")
    t = threading.Thread(target=_init_db, daemon=True)
    t.start()