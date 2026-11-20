import json
from datetime import datetime
from app.extensions import db

class Student(db.Model):
    __tablename__ = 'students'

    id = db.Column(db.Integer, primary_key=True)
    jntu_no = db.Column(db.String(100), nullable=False, index=True)
    student_name = db.Column(db.String(255), nullable=True)
    regulation_id = db.Column(db.Integer, db.ForeignKey('regulations.id', ondelete='SET NULL'), nullable=True)
    regulation = db.Column(db.String(50), nullable=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id', ondelete='SET NULL'), nullable=True)
    course_code = db.Column(db.String(50), nullable=True)
    course_name = db.Column(db.String(255), nullable=True)
    question_paper_id = db.Column(db.Integer, db.ForeignKey('question_papers.id', ondelete='SET NULL'), nullable=True)
    paper_title = db.Column(db.String(255), nullable=True)
    academic_year = db.Column(db.String(50), nullable=True)
    sem = db.Column(db.Integer, nullable=True)
    faculty_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    faculty_name = db.Column(db.String(255), nullable=True)
    attempted_count = db.Column(db.Integer, default=0)
    total_questions = db.Column(db.Integer, default=0)
    total_marks_obtained = db.Column(db.Float, default=0.0)
    max_total_marks = db.Column(db.Float, default=0.0)
    percentage = db.Column(db.Float, default=0.0)
    evaluation_data = db.Column(db.Text, nullable=True) # JSON array of question evaluations
    remarks = db.Column(db.Text, nullable=True)
    status = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    regulation_ref = db.relationship('Regulation', backref=db.backref('students', lazy=True), foreign_keys=[regulation_id])
    course_ref = db.relationship('Course', backref=db.backref('students', lazy=True), foreign_keys=[course_id])
    question_paper_ref = db.relationship('QuestionPaper', backref=db.backref('students', lazy=True), foreign_keys=[question_paper_id])
    faculty_ref = db.relationship('User', backref=db.backref('student_evaluations', lazy=True), foreign_keys=[faculty_id])

    def to_dict(self):
        eval_list = []
        if self.evaluation_data:
            try:
                eval_list = json.loads(self.evaluation_data)
            except Exception:
                eval_list = []

        return {
            'id': self.id,
            'jntu_no': self.jntu_no,
            'student_name': self.student_name,
            'regulation_id': self.regulation_id,
            'regulation': self.regulation or (self.regulation_ref.reg if self.regulation_ref else None),
            'course_id': self.course_id,
            'course_code': self.course_code or (self.course_ref.course_code if self.course_ref else None),
            'course_name': self.course_name or (self.course_ref.course_name if self.course_ref else None),
            'question_paper_id': self.question_paper_id,
            'paper_title': self.paper_title or (self.question_paper_ref.title if self.question_paper_ref else None),
            'academic_year': self.academic_year,
            'sem': self.sem,
            'faculty_id': self.faculty_id,
            'faculty_name': self.faculty_name or (self.faculty_ref.user_name if self.faculty_ref else None),
            'attempted_count': self.attempted_count,
            'total_questions': self.total_questions,
            'total_marks_obtained': self.total_marks_obtained,
            'max_total_marks': self.max_total_marks,
            'percentage': round(self.percentage, 2) if self.percentage is not None else 0.0,
            'evaluation_data': eval_list,
            'remarks': self.remarks,
            'status': self.status,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None
        }
