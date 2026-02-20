from datetime import datetime
from ..extensions import db


class Faculty(db.Model):
    __tablename__ = 'faculty'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(30), nullable=False, index=True)
    name = db.Column(db.String(150), nullable=False)
    subject = db.Column(db.String(200), nullable=False)
    year = db.Column(db.String(10), nullable=False)
    semester = db.Column(db.String(10), nullable=False)
    section = db.Column(db.String(20), nullable=False)
    branch = db.Column(db.String(50), nullable=False)
    department = db.Column(db.String(50), nullable=False, index=True)
    college = db.Column(db.String(100), nullable=False, index=True)
    added_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    added_by_user = db.relationship('User', backref='added_faculty', lazy=True)
    feedback_ratings = db.relationship('FeedbackRating', backref='faculty', lazy=True, cascade='all, delete-orphan')

    __table_args__ = (
        db.Index('idx_faculty_college_dept', 'college', 'department'),
        db.Index('idx_faculty_lookup', 'college', 'department', 'year', 'semester', 'section'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'code': self.code,
            'name': self.name,
            'subject': self.subject,
            'year': self.year,
            'sem': self.semester,
            'sec': self.section,
            'branch': self.branch,
            'dept': self.department,
            'college': self.college,
            'addedDate': self.created_at.strftime('%m/%d/%Y') if self.created_at else None,
            'isActive': self.is_active,
        }