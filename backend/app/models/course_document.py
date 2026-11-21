from datetime import datetime
from app.extensions import db

class CourseDocument(db.Model):
    __tablename__ = 'course_documents'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    user_name = db.Column(db.String(255))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id', ondelete='SET NULL'), nullable=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(50)) # 'pdf', 'txt', 'docx'
    file_size = db.Column(db.BigInteger) # bytes
    file_path = db.Column(db.String(500), nullable=False)
    extracted_text = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.Integer, default=1)

    # Relationships for convenience
    user = db.relationship('User', backref=db.backref('documents', lazy=True, cascade='all, delete-orphan'), foreign_keys=[user_id])
    branch = db.relationship('Branch', backref=db.backref('documents', lazy=True), foreign_keys=[branch_id])
    course = db.relationship('Course', backref=db.backref('documents', lazy=True, cascade='all, delete-orphan'), foreign_keys=[course_id])

    def to_dict(self, include_full_text=True):
        preview = (self.extracted_text[:300] + '...') if self.extracted_text and len(self.extracted_text) > 300 else (self.extracted_text or '')
        d = {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user_name or (self.user.user_name if self.user else 'Unknown'),
            'branch_id': self.branch_id,
            'branch_name': self.branch.branch_name if self.branch else None,
            'branch_code': self.branch.branch_code if self.branch else None,
            'course_id': self.course_id,
            'course_name': self.course.course_name if self.course else None,
            'course_code': self.course.course_code if self.course else None,
            'title': self.title,
            'file_name': self.file_name,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'file_path': self.file_path,
            'has_extracted_text': bool(self.extracted_text),
            'text_length': len(self.extracted_text) if self.extracted_text else 0,
            'extracted_text_preview': preview,
            'extracted_text': self.extracted_text if include_full_text else preview,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'status': self.status
        }
        return d
