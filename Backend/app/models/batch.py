from datetime import datetime, timezone
from ..extensions import db


class Batch(db.Model):
    __tablename__ = 'batches'

    id = db.Column(
        db.Integer,
        primary_key=True,
    )
    batch_id = db.Column(
        db.String(200),
        unique=True,
        nullable=False,
        index=True,
    )
    college = db.Column(
        db.String(100),
        nullable=False,
    )
    department = db.Column(
        db.String(50),
        nullable=False,
    )
    branch = db.Column(
        db.String(50),
        nullable=False,
    )
    year = db.Column(
        db.String(10),
        nullable=False,
    )
    semester = db.Column(
        db.String(10),
        nullable=False,
    )
    section = db.Column(
        db.String(20),
        nullable=False,
    )
    slot = db.Column(
        db.Integer,
        nullable=False,
        default=1,
    )
    slot_start_date = db.Column(
        db.Date,
        nullable=True,
    )
    slot_end_date = db.Column(
        db.Date,
        nullable=True,
    )
    slot_label = db.Column(
        db.String(100),
        nullable=True,
    )
    total_students = db.Column(
        db.Integer,
        nullable=True,
        default=0,
    )
    created_by = db.Column(
        db.Integer,
        db.ForeignKey('users.id'),
        nullable=True,
    )
    is_active = db.Column(
        db.Boolean,
        default=True,
        nullable=False,
    )
    created_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    faculty_list = db.relationship(
        'BatchFaculty',
        backref='batch',
        lazy=True,
        cascade='all, delete-orphan',
    )
    submissions = db.relationship(
        'FeedbackSubmission',
        backref='batch',
        lazy=True,
        cascade='all, delete-orphan',
    )

    __table_args__ = (
        db.Index(
            'idx_batch_college_dept',
            'college',
            'department',
        ),
    )

    def to_dict(self):
        return {
            'id': self.batch_id,
            'college': self.college,
            'dept': self.department,
            'branch': self.branch,
            'year': self.year,
            'sem': self.semester,
            'sec': self.section,
            'slot': self.slot,
            'slotStartDate': (
                self.slot_start_date.isoformat()
                if self.slot_start_date
                else None
            ),
            'slotEndDate': (
                self.slot_end_date.isoformat()
                if self.slot_end_date
                else None
            ),
            'slotLabel': self.slot_label,
            'totalStudents': self.total_students or 0,
            'created': (
                self.created_at.strftime('%m/%d/%Y')
                if self.created_at
                else None
            ),
            'createdTimestamp': (
                int(
                    self.created_at.timestamp()
                    * 1000
                )
                if self.created_at
                else 0
            ),
            'faculty': [
                bf.faculty.to_dict()
                for bf in self.faculty_list
                if bf.faculty
            ],
            'responseCount': len(self.submissions),
            'isActive': self.is_active,
        }

    def __repr__(self):
        return f'<Batch {self.batch_id}>'


class BatchFaculty(db.Model):
    __tablename__ = 'batch_faculty'

    id = db.Column(
        db.Integer,
        primary_key=True,
    )
    batch_id = db.Column(
        db.Integer,
        db.ForeignKey(
            'batches.id',
            ondelete='CASCADE',
        ),
        nullable=False,
    )
    faculty_id = db.Column(
        db.Integer,
        db.ForeignKey(
            'faculty.id',
            ondelete='CASCADE',
        ),
        nullable=False,
    )

    faculty = db.relationship(
        'Faculty',
        backref='batch_assignments',
        lazy=True,
    )

    __table_args__ = (
        db.UniqueConstraint(
            'batch_id',
            'faculty_id',
            name='uq_batch_faculty',
        ),
    )

    def __repr__(self):
        return (
            f'<BatchFaculty '
            f'batch={self.batch_id} '
            f'faculty={self.faculty_id}>'
        )
