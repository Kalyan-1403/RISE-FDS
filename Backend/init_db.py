from app import create_app
from models import db
from seeds.demo_users import seed_demo_users

def init_database():
    """Initialize database with tables and seed data"""
    app = create_app('development')
    
    with app.app_context():
        print("🗄️  Creating database tables...")
        db.create_all()
        print("✅ Database tables created successfully!")
        
        print("\n👥 Seeding demo users...")
        seed_demo_users(app)
        print("✅ Database initialization complete!")
        
        print("\n" + "="*60)
        print("🎉 BACKEND SETUP COMPLETE!")
        print("="*60)
        print("\n📋 Demo Credentials:")
        print("-" * 60)
        print("Admin Login:")
        print("  User ID: ADMIN_MASTER")
        print("  Password: admin@123")
        print("\nHoD Logins (format: {DEPT}-{G/P}_HOD / hod@123):")
        print("  Examples:")
        print("    - CSE-G_HOD / hod@123 (Gandhi CSE)")
        print("    - CSE-P_HOD / hod@123 (Prakasam CSE)")
        print("    - SH-G_HOD / hod@123 (Gandhi S&H)")
        print("-" * 60)
        print("\n🚀 Start backend: python app.py")
        print("🌐 Backend URL: http://localhost:5000")
        print("="*60 + "\n")

if __name__ == '__main__':
    init_database()
