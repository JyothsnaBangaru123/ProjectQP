from app.extensions import db

class Mapping(db.Model):
    __tablename__ = 'mappings'

    id = db.Column(db.Integer, primary_key=True)
    faculty_id = db.Column(db.Integer) # No FK constraint in DB, logical only
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'))
    status = db.Column(db.SmallInteger)
    year = db.Column(db.Integer)
    sem = db.Column(db.Integer)
    accyear = db.Column(db.String(255))
    course_type = db.Column(db.String(255))
    elective_type = db.Column(db.String(255))

    course = db.relationship('Course', backref='mappings')
    # Logical relationship to User (faculty)
    faculty = db.relationship(
        'User', 
        foreign_keys=[faculty_id], 
        primaryjoin='Mapping.faculty_id == User.id',
        backref='mappings'
    )

    def to_dict(self):
        return {
            'id': self.id,
            'faculty_id': self.faculty_id,
            'faculty_name': self.faculty.user_name if self.faculty else None,
            'faculty_per_no': self.faculty.per_no if self.faculty else None,
            'course_id': self.course_id,
            'course_name': self.course.course_name if self.course else None,
            'course_code': self.course.course_code if self.course else None,
            'status': self.status,
            'year': self.year,
            'sem': self.sem,
            'accyear': self.accyear,
            'course_type': self.course_type,
            'elective_type': self.elective_type
        }
