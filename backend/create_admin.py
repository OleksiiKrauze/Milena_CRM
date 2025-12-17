"""
Script to create an admin user
Usage: python create_admin.py
"""
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.orm import Session
from app.db import SessionLocal, engine, Base
from app.models.user import User, Role, user_roles
from app.services.auth_service import get_password_hash


def create_admin():
    """Create admin user with active status and admin role"""
    db: Session = SessionLocal()

    try:
        # Check if admin role exists
        admin_role = db.query(Role).filter(Role.name == "admin").first()
        if not admin_role:
            print("Creating admin role...")
            admin_role = Role(name="admin", description="Администратор системы")
            db.add(admin_role)
            db.commit()
            db.refresh(admin_role)

        # Check if admin user already exists
        admin_email = "admin@example.com"
        existing_admin = db.query(User).filter(User.email == admin_email).first()

        if existing_admin:
            print(f"Admin user already exists: {admin_email}")
            print(f"Status: {existing_admin.status}")

            # Update status to active if needed
            if existing_admin.status != "active":
                existing_admin.status = "active"
                db.commit()
                print("Status updated to 'active'")

            # Add admin role if not present
            if admin_role not in existing_admin.roles:
                existing_admin.roles.append(admin_role)
                db.commit()
                print("Admin role added")

            print(f"\nYou can login with:")
            print(f"Email: {admin_email}")
            print(f"Password: (use the password you set)")
            return

        # Create new admin user
        print("Creating new admin user...")
        admin_password = "admin123"  # Default password

        admin_user = User(
            last_name="Адміністратор",
            first_name="Системний",
            middle_name=None,
            phone="+380999999999",
            email=admin_email,
            city="Київ",
            status="active",
            password_hash=get_password_hash(admin_password),
            comment="Системний адміністратор"
        )

        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)

        # Add admin role
        admin_user.roles.append(admin_role)
        db.commit()

        print(f"\n✅ Admin user created successfully!")
        print(f"\nLogin credentials:")
        print(f"Email: {admin_email}")
        print(f"Password: {admin_password}")
        print(f"\n⚠️  IMPORTANT: Change the password after first login!")

    except Exception as e:
        print(f"❌ Error creating admin: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 50)
    print("Admin User Creation Script")
    print("=" * 50)
    create_admin()
