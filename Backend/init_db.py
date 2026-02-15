"""
Database initialization script
- Development: Seeds demo users
- Production: Instructions to create admin
"""
from app import create_app
from models import db
import os

def init_database():
    """Initialize database with tables"""
    env = os.environ.get('FLASK_ENV', 'development')
    app = create_app(env)
    
    with app.app_context():
        print("\n" + "="*60)
        print(f"🗄️  Initializing database ({env} mode)")
        print("="*60 + "\n")
        
        print("Creating database tables...")
        db.create_all()
        print("✅ Database tables created successfully!")
        
        if env == 'development':
            # Seed demo users in development
            print("\n👥 Seeding development users...")
            from seeds.demo_users import seed_demo_users
            seed_demo_users(app)
            
            print("\n" + "="*60)
            print("🎉 DEVELOPMENT SETUP COMPLETE!")
            print("="*60)
            print("\n📋 Demo Credentials:")
            print("-" * 60)
            print("Admin: DEV_ADMIN / DevAdmin@123")
            print("HoD: DEV-<DEPT>-<G/P> / DevHod@123")
            print("-" * 60)
            print("\n🚀 Start backend: python app.py")
            print("🌐 Backend URL: http://localhost:5000")
        
        else:
            # Production mode
            print("\n" + "="*60)
            print("🔐 PRODUCTION MODE")
            print("="*60)
            print("\n⚠️  No demo users created in production!")
            print("\n📋 Next Steps:")
            print("-" * 60)
            print("1. Create admin user:")
            print("   python scripts/create_admin.py")
            print("\n2. Start production server:")
            print("   gunicorn -c gunicorn.conf.py app:application")
            print("\n3. Access API at: https://your-domain.com")
            print("-" * 60)
        
        print("="*60 + "\n")


if __name__ == '__main__':
    init_database()