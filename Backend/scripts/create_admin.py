#!/usr/bin/env python
"""
Production Admin Creation Script
Run this ONCE in production to create the first admin user
"""
import sys
import os
import getpass

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models import db, User
from utils.validators import validate_email_format, validate_mobile_format, validate_password_strength

def create_admin():
    """Interactively create admin user"""
    
    print("\n" + "="*60)
    print("🔐 RISE-FDS Production Admin Creation")
    print("="*60 + "\n")
    
    # Check if running in production
    env = os.environ.get('FLASK_ENV', 'development')
    if env != 'production':
        print("⚠️  WARNING: Not running in production mode!")
        proceed = input("Continue anyway? (yes/no): ").lower()
        if proceed != 'yes':
            print("Aborted.")
            return
    
    app = create_app(env)
    
    with app.app_context():
        # Check if admin already exists
        existing_admin = User.query.filter_by(role='admin').first()
        if existing_admin:
            print(f"❌ Admin user already exists: {existing_admin.user_id}")
            print("Delete existing admin first if you want to create a new one.")
            return
        
        print("Please enter admin details:\n")
        
        # User ID
        while True:
            user_id = input("User ID (e.g., ADMIN001): ").strip()
            if not user_id:
                print("❌ User ID is required")
                continue
            if User.query.filter_by(user_id=user_id).first():
                print("❌ User ID already exists")
                continue
            break
        
        # Name
        name = input("Full Name: ").strip()
        if not name:
            print("❌ Name is required")
            return
        
        # Email
        while True:
            email = input("Email: ").strip()
            valid, msg = validate_email_format(email)
            if not valid:
                print(f"❌ {msg}")
                continue
            if User.query.filter_by(email=email).first():
                print("❌ Email already exists")
                continue
            break
        
        # Mobile
        while True:
            mobile = input("Mobile (10 digits): ").strip()
            valid, msg = validate_mobile_format(mobile)
            if not valid:
                print(f"❌ {msg}")
                continue
            if User.query.filter_by(mobile=mobile).first():
                print("❌ Mobile already exists")
                continue
            break
        
        # Password
        while True:
            password = getpass.getpass("Password: ")
            confirm_password = getpass.getpass("Confirm Password: ")
            
            if password != confirm_password:
                print("❌ Passwords don't match")
                continue
            
            valid, msg = validate_password_strength(password)
            if not valid:
                print(f"❌ {msg}")
                continue
            break
        
        # Create admin user
        admin = User(
            user_id=user_id,
            name=name,
            email=email,
            mobile=mobile,
            college=None,
            department=None,
            role='admin'
        )
        admin.set_password(password)
        
        try:
            db.session.add(admin)
            db.session.commit()
            
            print("\n" + "="*60)
            print("✅ Admin user created successfully!")
            print("="*60)
            print(f"User ID: {user_id}")
            print(f"Name: {name}")
            print(f"Email: {email}")
            print("="*60 + "\n")
            print("    Password has been securely hashed and stored.")
            print("🚀 You can now log in to the admin panel.")
            
        except Exception as e:
            db.session.rollback()
            print(f"\n❌ Error creating admin: {str(e)}")


if __name__ == '__main__':
    create_admin()