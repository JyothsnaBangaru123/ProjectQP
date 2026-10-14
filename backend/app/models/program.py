from app.extensions import db

class Program(db.Model):
    __tablename__ = 'programs'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255))
    status = db.Column(db.SmallInteger) # smallint in postgres (0 or 1)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'status': self.status
        }
