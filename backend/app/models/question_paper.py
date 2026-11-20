import json
from datetime import datetime
from app.extensions import db

class QuestionPaper(db.Model):
    __tablename__ = 'question_papers'

    id = db.Column(db.Integer, primary_key=True)
    hod_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    hod_name = db.Column(db.String(255))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id', ondelete='SET NULL'), nullable=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id', ondelete='SET NULL'), nullable=True)
    course_name = db.Column(db.String(255))
    course_code = db.Column(db.String(50))
    title = db.Column(db.String(255), nullable=False) # e.g. "Mid Term 1 Examination"
    academic_year = db.Column(db.String(50)) # e.g. "2024-25"
    sem = db.Column(db.Integer)
    total_marks = db.Column(db.Integer, default=50)
    duration = db.Column(db.String(50), default="2 Hours")
    paper_schema = db.Column(db.Text) # JSON string with configuration
    generated_content = db.Column(db.Text, nullable=False) # JSON string with structured sections & questions
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.Integer, default=1)

    # Security & Password Protection fields
    is_password_protected = db.Column(db.Boolean, default=False)
    original_pdf_path = db.Column(db.String(500), nullable=True)
    protected_pdf_path = db.Column(db.String(500), nullable=True)
    protected_at = db.Column(db.DateTime, nullable=True)
    protected_by_id = db.Column(db.Integer, nullable=True)
    protected_by_name = db.Column(db.String(255), nullable=True)

    branch = db.relationship('Branch', backref=db.backref('question_papers', lazy=True), foreign_keys=[branch_id])
    course = db.relationship('Course', backref=db.backref('question_papers', lazy=True), foreign_keys=[course_id])

    def to_dict(self, user_id=None):
        content = {}
        if self.generated_content:
            try:
                content = json.loads(self.generated_content)
            except Exception:
                content = {'raw': self.generated_content}

        schema_obj = {}
        if self.paper_schema:
            try:
                schema_obj = json.loads(self.paper_schema)
            except Exception:
                schema_obj = {}

        shared_count = 0
        is_shared_with_me = False
        try:
            if hasattr(self, 'shared_recipients') and self.shared_recipients:
                shared_count = len(self.shared_recipients)
                if user_id:
                    is_shared_with_me = any(r.faculty_user_id == user_id for r in self.shared_recipients)
        except Exception:
            shared_count = 0

        return {
            'id': self.id,
            'hod_id': self.hod_id,
            'hod_name': self.hod_name,
            'branch_id': self.branch_id,
            'branch_name': self.branch.branch_name if self.branch else None,
            'branch_code': self.branch.branch_code if self.branch else None,
            'course_id': self.course_id,
            'course_name': self.course_name or (self.course.course_name if self.course else None),
            'course_code': self.course_code or (self.course.course_code if self.course else None),
            'title': self.title,
            'academic_year': self.academic_year,
            'sem': self.sem,
            'total_marks': self.total_marks,
            'duration': self.duration,
            'paper_schema': schema_obj,
            'generated_content': content,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'status': self.status,
            'is_password_protected': bool(self.is_password_protected),
            'protected_at': self.protected_at.strftime('%Y-%m-%d %H:%M:%S') if self.protected_at else None,
            'protected_by_name': self.protected_by_name,
            'shared_count': shared_count,
            'is_shared_with_me': is_shared_with_me
        }
