from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    mobile = db.Column(db.String(15), unique=True, nullable=False)
    college = db.Column(db.String(50))  # NULL for admin
    department = db.Column(db.String(50))  # NULL for admin
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='hod')  # 'admin' or 'hod'
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    faculty_added = db.relationship('Faculty', backref='added_by_user', lazy='dynamic')
    batches_created = db.relationship('Batch', backref='creator', lazy='dynamic')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'email': self.email,
            'mobile': self.mobile,
            'college': self.college,
            'department': self.department,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<User {self.user_id}>'


class Faculty(db.Model):
    __tablename__ = 'faculty'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    subject = db.Column(db.String(100), nullable=False)
    code = db.Column(db.String(20), nullable=False)
    year = db.Column(db.String(5), nullable=False)  # 'I', 'II', 'III', 'IV'
    branch = db.Column(db.String(50), nullable=False)
    semester = db.Column(db.String(5), nullable=False)  # 'I', 'II'
    section = db.Column(db.String(10), nullable=False)
    college = db.Column(db.String(50), nullable=False)
    department = db.Column(db.String(50), nullable=False)
    added_by = db.Column(db.String(50), db.ForeignKey('users.user_id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    feedback_responses = db.relationship('FeedbackResponse', backref='faculty', lazy='dynamic')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'subject': self.subject,
            'code': self.code,
            'year': self.year,
            'branch': self.branch,
            'semester': self.semester,
            'section': self.section,
            'college': self.college,
            'department': self.department,
            'added_by': self.added_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<Faculty {self.name} - {self.code}>'


class Batch(db.Model):
    __tablename__ = 'batches'
    
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.String(200), unique=True, nullable=False, index=True)
    college = db.Column(db.String(50), nullable=False)
    department = db.Column(db.String(50), nullable=False)
    branch = db.Column(db.String(50), nullable=False)
    year = db.Column(db.String(5), nullable=False)
    semester = db.Column(db.String(5), nullable=False)
    section = db.Column(db.String(10), nullable=False)
    slot_number = db.Column(db.Integer, nullable=False)  # 1 or 2
    slot_start_date = db.Column(db.Date, nullable=False)
    slot_end_date = db.Column(db.Date, nullable=False)
    slot_label = db.Column(db.String(100))
    created_by = db.Column(db.String(50), db.ForeignKey('users.user_id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    faculty = db.relationship('Faculty', secondary='batch_faculty', backref='batches')
    feedback_responses = db.relationship('FeedbackResponse', backref='batch', lazy='dynamic')
    
    def to_dict(self, include_faculty=False):
        data = {
            'id': self.id,
            'batch_id': self.batch_id,
            'college': self.college,
            'department': self.department,
            'branch': self.branch,
            'year': self.year,
            'semester': self.semester,
            'section': self.section,
            'slot_number': self.slot_number,
            'slot_start_date': self.slot_start_date.isoformat() if self.slot_start_date else None,
            'slot_end_date': self.slot_end_date.isoformat() if self.slot_end_date else None,
            'slot_label': self.slot_label,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
        
        if include_faculty:
            data['faculty'] = [f.to_dict() for f in self.faculty]
        
        return data
    
    def __repr__(self):
        return f'<Batch {self.batch_id}>'


# Junction table for many-to-many relationship between Batch and Faculty
batch_faculty = db.Table('batch_faculty',
    db.Column('id', db.Integer, primary_key=True),
    db.Column('batch_id', db.String(200), db.ForeignKey('batches.batch_id'), nullable=False),
    db.Column('faculty_id', db.Integer, db.ForeignKey('faculty.id'), nullable=False),
    db.UniqueConstraint('batch_id', 'faculty_id', name='unique_batch_faculty')
)


class FeedbackResponse(db.Model):
    __tablename__ = 'feedback_responses'
    
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.String(200), db.ForeignKey('batches.batch_id'), nullable=False)
    faculty_id = db.Column(db.Integer, db.ForeignKey('faculty.id'), nullable=False)
    slot_number = db.Column(db.Integer, nullable=False)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 15 rating parameters (1-10 scale)
    param1_rating = db.Column(db.Integer, nullable=False)  # Knowledge of subject
    param2_rating = db.Column(db.Integer, nullable=False)  # Coming well prepared
    param3_rating = db.Column(db.Integer, nullable=False)  # Clear explanations
    param4_rating = db.Column(db.Integer, nullable=False)  # Command of language
    param5_rating = db.Column(db.Integer, nullable=False)  # Clear voice
    param6_rating = db.Column(db.Integer, nullable=False)  # Holding attention
    param7_rating = db.Column(db.Integer, nullable=False)  # More than textbooks
    param8_rating = db.Column(db.Integer, nullable=False)  # Clear doubts
    param9_rating = db.Column(db.Integer, nullable=False)  # Encourage participation
    param10_rating = db.Column(db.Integer, nullable=False)  # Appreciating students
    param11_rating = db.Column(db.Integer, nullable=False)  # Help outside class
    param12_rating = db.Column(db.Integer, nullable=False)  # Return papers on time
    param13_rating = db.Column(db.Integer, nullable=False)  # Punctuality
    param14_rating = db.Column(db.Integer, nullable=False)  # Coverage of syllabus
    param15_rating = db.Column(db.Integer, nullable=False)  # Impartial
    
    comments = db.Column(db.Text)
    student_ip = db.Column(db.String(45))  # Optional tracking
    
    __table_args__ = (
        db.CheckConstraint('param1_rating >= 1 AND param1_rating <= 10', name='check_param1_range'),
        db.CheckConstraint('param2_rating >= 1 AND param2_rating <= 10', name='check_param2_range'),
        db.CheckConstraint('param3_rating >= 1 AND param3_rating <= 10', name='check_param3_range'),
        db.CheckConstraint('param4_rating >= 1 AND param4_rating <= 10', name='check_param4_range'),
        db.CheckConstraint('param5_rating >= 1 AND param5_rating <= 10', name='check_param5_range'),
        db.CheckConstraint('param6_rating >= 1 AND param6_rating <= 10', name='check_param6_range'),
        db.CheckConstraint('param7_rating >= 1 AND param7_rating <= 10', name='check_param7_range'),
        db.CheckConstraint('param8_rating >= 1 AND param8_rating <= 10', name='check_param8_range'),
        db.CheckConstraint('param9_rating >= 1 AND param9_rating <= 10', name='check_param9_range'),
        db.CheckConstraint('param10_rating >= 1 AND param10_rating <= 10', name='check_param10_range'),
        db.CheckConstraint('param11_rating >= 1 AND param11_rating <= 10', name='check_param11_range'),
        db.CheckConstraint('param12_rating >= 1 AND param12_rating <= 10', name='check_param12_range'),
        db.CheckConstraint('param13_rating >= 1 AND param13_rating <= 10', name='check_param13_range'),
        db.CheckConstraint('param14_rating >= 1 AND param14_rating <= 10', name='check_param14_range'),
        db.CheckConstraint('param15_rating >= 1 AND param15_rating <= 10', name='check_param15_range'),
    )
    
    def get_average_rating(self):
        """Calculate average rating across all parameters"""
        ratings = [
            self.param1_rating, self.param2_rating, self.param3_rating,
            self.param4_rating, self.param5_rating, self.param6_rating,
            self.param7_rating, self.param8_rating, self.param9_rating,
            self.param10_rating, self.param11_rating, self.param12_rating,
            self.param13_rating, self.param14_rating, self.param15_rating
        ]
        return sum(ratings) / len(ratings)
    
    def to_dict(self):
        return {
            'id': self.id,
            'batch_id': self.batch_id,
            'faculty_id': self.faculty_id,
            'slot_number': self.slot_number,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'ratings': {
                'param1': self.param1_rating,
                'param2': self.param2_rating,
                'param3': self.param3_rating,
                'param4': self.param4_rating,
                'param5': self.param5_rating,
                'param6': self.param6_rating,
                'param7': self.param7_rating,
                'param8': self.param8_rating,
                'param9': self.param9_rating,
                'param10': self.param10_rating,
                'param11': self.param11_rating,
                'param12': self.param12_rating,
                'param13': self.param13_rating,
                'param14': self.param14_rating,
                'param15': self.param15_rating,
            },
            'comments': self.comments,
            'average_rating': self.get_average_rating()
        }
    
    def __repr__(self):
        return f'<FeedbackResponse {self.id} for Faculty {self.faculty_id}>'


class OTP(db.Model):
    __tablename__ = 'otps'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    mobile = db.Column(db.String(15), nullable=False)
    otp_code = db.Column(db.String(255), nullable=False)  # Changed: Store hashed OTP (SHA256)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    
    def __repr__(self):
        return f'<OTP {self.user_id}>'