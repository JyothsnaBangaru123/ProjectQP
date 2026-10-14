from app.extensions import db

class BCMapping(db.Model):
    __tablename__ = 'bcmappings'

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'))
    status = db.Column(db.SmallInteger)
    reg_id = db.Column(db.Integer, db.ForeignKey('regulations.id'))
    pb_id = db.Column(db.Integer, db.ForeignKey('pbmappings.id'))

    course = db.relationship('Course', backref='bcmappings')
    regulation = db.relationship('Regulation', backref='bcmappings')
    pb_mapping = db.relationship('PBMapping', backref='bcmappings')

    def to_dict(self):
        program_name = None
        branch_name = None
        if self.pb_mapping:
            if self.pb_mapping.program:
                program_name = self.pb_mapping.program.name
            if self.pb_mapping.branch:
                branch_name = self.pb_mapping.branch.branch_name

        return {
            'id': self.id,
            'course_id': self.course_id,
            'course_name': self.course.course_name if self.course else None,
            'course_code': self.course.course_code if self.course else None,
            'reg_id': self.reg_id,
            'reg_name': self.regulation.reg if self.regulation else None,
            'pb_id': self.pb_id,
            'program_name': program_name,
            'branch_name': branch_name,
            'status': self.status
        }
