from datetime import datetime
from app.extensions import db

class PaperSharedRecipient(db.Model):
    __tablename__ = 'paper_shared_recipients'

    id = db.Column(db.Integer, primary_key=True)
    question_paper_id = db.Column(db.Integer, db.ForeignKey('question_papers.id', ondelete='CASCADE'), nullable=False)
    faculty_user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    recipient_email = db.Column(db.String(255), nullable=False)
    recipient_name = db.Column(db.String(255), nullable=True)
    shared_by_hod_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    shared_by_hod_name = db.Column(db.String(255), nullable=True)
    shared_at = db.Column(db.DateTime, default=datetime.utcnow)
    email_status = db.Column(db.String(50), default='sent')  # 'sent' or 'failed'
    email_sent_at = db.Column(db.DateTime, default=datetime.utcnow)
    error_message = db.Column(db.Text, nullable=True)

    # Relationships
    question_paper = db.relationship('QuestionPaper', backref=db.backref('shared_recipients', lazy=True, cascade='all, delete-orphan'))
    faculty_user = db.relationship('User', foreign_keys=[faculty_user_id])

    def to_dict(self):
        return {
            'id': self.id,
            'question_paper_id': self.question_paper_id,
            'faculty_user_id': self.faculty_user_id,
            'faculty_name': self.recipient_name or (self.faculty_user.user_name if self.faculty_user else 'Faculty Member'),
            'recipient_email': self.recipient_email,
            'shared_by_hod_id': self.shared_by_hod_id,
            'shared_by_hod_name': self.shared_by_hod_name,
            'shared_at': self.shared_at.strftime('%Y-%m-%d %H:%M:%S') if self.shared_at else None,
            'email_status': self.email_status,
            'email_sent_at': self.email_sent_at.strftime('%Y-%m-%d %H:%M:%S') if self.email_sent_at else None,
            'error_message': self.error_message
        }

