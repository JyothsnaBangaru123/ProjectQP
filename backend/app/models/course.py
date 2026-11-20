from app.extensions import db

class Course(db.Model):
    __tablename__ = 'courses'

    id = db.Column(db.Integer, primary_key=True)
    course_code = db.Column(db.String(255))
    year = db.Column(db.Integer)
    sem = db.Column(db.Integer)
    course_type = db.Column(db.String(255))
    elective_type = db.Column(db.String(255))
    credits = db.Column(db.Integer)
    pb_id = db.Column(db.Integer) # No FK constraint in DB
    reg_id = db.Column(db.Integer) # No FK constraint in DB
    status = db.Column(db.SmallInteger)
    course_name = db.Column(db.String(255))
    course_desc = db.Column(db.String(255))

    @property
    def pb(self):
        if not self.pb_id:
            return None
        from app.models.pbmapping import PBMapping
        return PBMapping.query.get(self.pb_id)

    @property
    def regulation(self):
        if not self.reg_id:
            return None
        from app.models.regulation import Regulation
        return Regulation.query.get(self.reg_id)

    def to_dict(self):
        return {
            'id': self.id,
            'course_code': self.course_code,
            'year': self.year,
            'sem': self.sem,
            'course_type': self.course_type,
            'elective_type': self.elective_type,
            'credits': self.credits,
            'pb_id': self.pb_id,
            'reg_id': self.reg_id,
            'status': self.status,
            'course_name': self.course_name,
            'course_desc': self.course_desc
        }

