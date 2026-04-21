from datetime import datetime, timezone
from ..extensions import db

class DepartmentSection(db.Model):
    __tablename__ = 'department_sections'

    id = db.Column(db.Integer, primary_key=True)
    college = db.Column(db.String(100), nullable=False)
    department = db.Column(db.String(50), nullable=False)
    year = db.Column(db.String(10), nullable=False)
    section_name = db.Column(db.String(50), nullable=False)  # e.g. "A", "CSE-DS", "AI&ML"
    branch = db.Column(db.String(50), nullable=True, default='')
    strength = db.Column(db.Integer, nullable=False, default=0)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
         db.UniqueConstraint('college', 'department', 'year', 'branch', 'section_name',
                            name='uq_dept_section'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'college': self.college,
            'department': self.department,
            'year': self.year,
            'sectionName': self.section_name,
	        'branch': self.branch or '',
            'strength': self.strength,
            'isActive': self.is_active,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<DepartmentSection {self.college}/{self.department} Y{self.year}-{self.section_name}>'