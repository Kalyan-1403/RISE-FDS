"""
Demo user seeder - ONLY FOR DEVELOPMENT
Production: Create admin via secure admin creation script
"""
from models import db, User
import os

def seed_demo_users(app):
    """Seed demo users - ONLY run in development"""
    
    # Check environment
    if os.environ.get('FLASK_ENV') == 'production':
        print("⚠️  WARNING: Cannot seed demo users in production!")
        print("Use the admin creation script instead.")
        return
    
    print("🌱 Seeding development users...")
    
    # Check if users already exist
    if User.query.count() > 0:
        print("✅ Users already exist. Skipping seed.")
        return
    
    # Admin user (development only)
    admin = User(
        user_id='DEV_ADMIN',
        name='Development Admin',
        email='admin@dev.local',
        mobile='9999999999',
        college=None,
        department=None,
        role='admin'
    )
    admin.set_password('DevAdmin@123')  # Change in .env
    
    # Development HoD users
    hods = [
        # Gandhi College
        {'user_id': 'DEV-CSE-G', 'name': 'CSE HoD Gandhi', 'email': 'cse.g@dev.local', 'mobile': '9000000001', 'college': 'Gandhi', 'department': 'CSE'},
        {'user_id': 'DEV-ECE-G', 'name': 'ECE HoD Gandhi', 'email': 'ece.g@dev.local', 'mobile': '9000000002', 'college': 'Gandhi', 'department': 'ECE'},
        {'user_id': 'DEV-EEE-G', 'name': 'EEE HoD Gandhi', 'email': 'eee.g@dev.local', 'mobile': '9000000003', 'college': 'Gandhi', 'department': 'EEE'},
        {'user_id': 'DEV-MECH-G', 'name': 'MECH HoD Gandhi', 'email': 'mech.g@dev.local', 'mobile': '9000000004', 'college': 'Gandhi', 'department': 'MECH'},
        {'user_id': 'DEV-CIVIL-G', 'name': 'CIVIL HoD Gandhi', 'email': 'civil.g@dev.local', 'mobile': '9000000005', 'college': 'Gandhi', 'department': 'CIVIL'},
        {'user_id': 'DEV-SH-G', 'name': 'S&H HoD Gandhi', 'email': 'sh.g@dev.local', 'mobile': '9000000006', 'college': 'Gandhi', 'department': 'S&H'},
        
        # Prakasam College
        {'user_id': 'DEV-CSE-P', 'name': 'CSE HoD Prakasam', 'email': 'cse.p@dev.local', 'mobile': '9000000011', 'college': 'Prakasam', 'department': 'CSE'},
        {'user_id': 'DEV-ECE-P', 'name': 'ECE HoD Prakasam', 'email': 'ece.p@dev.local', 'mobile': '9000000012', 'college': 'Prakasam', 'department': 'ECE'},
        {'user_id': 'DEV-EEE-P', 'name': 'EEE HoD Prakasam', 'email': 'eee.p@dev.local', 'mobile': '9000000013', 'college': 'Prakasam', 'department': 'EEE'},
        {'user_id': 'DEV-MECH-P', 'name': 'MECH HoD Prakasam', 'email': 'mech.p@dev.local', 'mobile': '9000000014', 'college': 'Prakasam', 'department': 'MECH'},
    ]
    
    # Get dev password from environment or use default
    dev_password = os.environ.get('DEV_PASSWORD', 'DevHod@123')
    
    db.session.add(admin)
    
    for hod_data in hods:
        hod = User(**hod_data, role='hod')
        hod.set_password(dev_password)
        db.session.add(hod)
    
    try:
        db.session.commit()
        print(f"✅ Created 1 admin and {len(hods)} HoD users")
        print("\n" + "="*60)
        print("🔑 DEVELOPMENT CREDENTIALS")
        print("="*60)
        print(f"Admin: DEV_ADMIN / {dev_password}")
        print(f"HoDs: DEV-<DEPT>-<G/P> / {dev_password}")
        print("="*60)
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error seeding users: {str(e)}")