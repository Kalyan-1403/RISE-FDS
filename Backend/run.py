from app import create_app
from app.extensions import db
from app.models.user import User

app = create_app()


def seed_admin():
    """Seed default admin account if none exists."""
    with app.app_context():
        admin = User.query.filter_by(role='admin').first()
        if not admin:
            admin = User(
                user_id='ADMIN',
                name='Master Admin',
                role='admin',
                email='admin@rise.edu',
            )
            admin.set_password('admin@123')
            db.session.add(admin)
            db.session.commit()
            print('✅ Default admin created: ADMIN / admin@123')
        else:
            print('ℹ️ Admin already exists')


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        seed_admin()
    app.run(host='0.0.0.0', port=5000, debug=True)