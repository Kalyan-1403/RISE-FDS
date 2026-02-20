import bcrypt
from datetime import datetime
from ..extensions import db


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(150), nullable=False)
    role = db.Column(db.String(20), nullable=False, index=True)  # 'admin' or 'hod'
    college = db.Column(db.String(100), nullable=True)
    department = db.Column(db.String(50), nullable=True)
    mobile = db.Column(db.String(15), nullable=True)
    email = db.Column(db.String(150), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Unique constraint: one HoD per college+department
    __table_args__ = (
        db.UniqueConstraint('college', 'department', name='uq_college_department_hod'),
    )

    def set_password(self, password):
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def check_password(self, password):
        return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))

    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'name': self.name,
            'role': self.role,
            'college': self.college or '',
            'department': self.department or '',
            'username': self.name,
            'email': self.email or '',
            'isActive': self.is_active,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }