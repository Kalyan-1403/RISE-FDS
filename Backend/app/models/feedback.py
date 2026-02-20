from datetime import datetime
from ..extensions import db


class FeedbackSubmission(db.Model):
    __tablename__ = 'feedback_submissions'

    id = db.Column(db.Integer, primary_key=True)
    batch_db_id = db.Column(db.Integer, db.ForeignKey('batches.id', ondelete='CASCADE'), nullable=False)
    slot = db.Column(db.Integer, nullable=False, default=1)
    comments = db.Column(db.Text, nullable=True)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    ip_address = db.Column(db.String(50), nullable=True)

    # Relationships
    ratings = db.relationship('FeedbackRating', backref='submission', lazy=True, cascade='all, delete-orphan')

    __table_args__ = (
        db.Index('idx_submission_batch', 'batch_db_id'),
    )


class FeedbackRating(db.Model):
    __tablename__ = 'feedback_ratings'

    id = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(db.Integer, db.ForeignKey('feedback_submissions.id', ondelete='CASCADE'), nullable=False)
    faculty_id = db.Column(db.Integer, db.ForeignKey('faculty.id', ondelete='CASCADE'), nullable=False)
    parameter = db.Column(db.String(200), nullable=False)
    rating = db.Column(db.Integer, nullable=False)

    __table_args__ = (
        db.Index('idx_rating_faculty', 'faculty_id'),
        db.Index('idx_rating_submission', 'submission_id'),
        db.CheckConstraint('rating >= 1 AND rating <= 10', name='chk_rating_range'),
    )