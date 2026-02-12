from models import db, User
from werkzeug.security import generate_password_hash

def seed_demo_users(app):
    """Seed database with demo users"""
    
    with app.app_context():
        # Check if admin already exists
        if User.query.filter_by(user_id='ADMIN_MASTER').first():
            print("✅ Demo users already exist!")
            return
        
        # Create Admin
        admin = User(
            user_id='ADMIN_MASTER',
            name='Master Admin',
            email='admin@rise.edu.in',
            mobile='9999999999',
            college=None,
            department=None,
            role='admin'
        )
        admin.set_password('admin@123')
        db.session.add(admin)
        
        # Create HoDs
        hods = [
            # Gandhi College
            {'college': 'Gandhi', 'dept': 'CSE', 'userId': 'CSE-G_HOD', 'password': 'hod@123', 'name': 'Gandhi CSE HoD', 'email': 'cse.gandhi@rise.edu.in', 'mobile': '9000000001'},
            {'college': 'Gandhi', 'dept': 'ECE', 'userId': 'ECE-G_HOD', 'password': 'hod@123', 'name': 'Gandhi ECE HoD', 'email': 'ece.gandhi@rise.edu.in', 'mobile': '9000000002'},
            {'college': 'Gandhi', 'dept': 'S&H', 'userId': 'SH-G_HOD', 'password': 'hod@123', 'name': 'Gandhi S&H HoD', 'email': 'sh.gandhi@rise.edu.in', 'mobile': '9000000003'},
            
            # Prakasam College
            {'college': 'Prakasam', 'dept': 'S&H', 'userId': 'SH-P_HOD', 'password': 'hod@123', 'name': 'Prakasam S&H HoD', 'email': 'sh.prakasam@rise.edu.in', 'mobile': '9000000004'},
            {'college': 'Prakasam', 'dept': 'CSE', 'userId': 'CSE-P_HOD', 'password': 'hod@123', 'name': 'Prakasam CSE HoD', 'email': 'cse.prakasam@rise.edu.in', 'mobile': '9000000005'},
            {'college': 'Prakasam', 'dept': 'ECE', 'userId': 'ECE-P_HOD', 'password': 'hod@123', 'name': 'Prakasam ECE HoD', 'email': 'ece.prakasam@rise.edu.in', 'mobile': '9000000006'},
            {'college': 'Prakasam', 'dept': 'EEE', 'userId': 'EEE-P_HOD', 'password': 'hod@123', 'name': 'Prakasam EEE HoD', 'email': 'eee.prakasam@rise.edu.in', 'mobile': '9000000007'},
            {'college': 'Prakasam', 'dept': 'CIVIL', 'userId': 'CIVIL-P_HOD', 'password': 'hod@123', 'name': 'Prakasam CIVIL HoD', 'email': 'civil.prakasam@rise.edu.in', 'mobile': '9000000008'},
            {'college': 'Prakasam', 'dept': 'MECH', 'userId': 'MECH-P_HOD', 'password': 'hod@123', 'name': 'Prakasam MECH HoD', 'email': 'mech.prakasam@rise.edu.in', 'mobile': '9000000009'},
            {'college': 'Prakasam', 'dept': 'MBA', 'userId': 'MBA-P_HOD', 'password': 'hod@123', 'name': 'Prakasam MBA HoD', 'email': 'mba.prakasam@rise.edu.in', 'mobile': '9000000010'},
            {'college': 'Prakasam', 'dept': 'MCA', 'userId': 'MCA-P_HOD', 'password': 'hod@123', 'name': 'Prakasam MCA HoD', 'email': 'mca.prakasam@rise.edu.in', 'mobile': '9000000011'},
            {'college': 'Prakasam', 'dept': 'M.TECH', 'userId': 'MTECH-P_HOD', 'password': 'hod@123', 'name': 'Prakasam M.TECH HoD', 'email': 'mtech.prakasam@rise.edu.in', 'mobile': '9000000012'},
        ]
        
        for hod_data in hods:
            hod = User(
                user_id=hod_data['userId'],
                name=hod_data['name'],
                email=hod_data['email'],
                mobile=hod_data['mobile'],
                college=hod_data['college'],
                department=hod_data['dept'],
                role='hod'
            )
            hod.set_password(hod_data['password'])
            db.session.add(hod)
        
        db.session.commit()
        print("✅ Demo users created successfully!")
        print("\n📋 Login Credentials:")
        print("Admin: ADMIN_MASTER / admin@123")
        print("HoDs: {DEPT}-{G/P}_HOD / hod@123")
