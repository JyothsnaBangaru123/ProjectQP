from app.extensions import db

class Regulation(db.Model):
    __tablename__ = 'regulations'

    id = db.Column(db.Integer, primary_key=True)
    reg = db.Column(db.String(255))
    status = db.Column(db.SmallInteger)

    def to_dict(self):
        return {
            'id': self.id,
            'reg': self.reg,
            'status': self.status
        }
