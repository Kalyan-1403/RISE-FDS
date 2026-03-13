import os
from app import create_app
from app.extensions import db
from app.models.user import User

app = create_app()


def seed_admin():
    """Seed default admin account if none exists. Password MUST come from environment."""
    with app.app_context():
        admin = User.query.filter_by(role='admin').first()
        if not admin:
            admin_password = os.environ.get('ADMIN_PASSWORD')
            if not admin_password:
                print('⚠️  ADMIN_PASSWORD not set in environment. Skipping admin seed.')
                print('   Set ADMIN_PASSWORD env variable and restart to create the admin account.')
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
            print('✅ Default admin account created (user: ADMIN)')
        else:
            print('ℹ️  Admin account already exists')


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_admin()

    is_dev = os.getenv('FLASK_ENV', 'development') == 'development'
    app.run(
        host='127.0.0.1' if is_dev else '0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        debug=is_dev,
    )