from app.extensions import db

class QLevel(db.Model):
    __tablename__ = 'qlevel'

    id = db.Column(db.Integer, primary_key=True)
    level = db.Column(db.String(255), nullable=False)
    status = db.Column(db.Integer) # integer in postgres for qlevel.status

    def to_dict(self):
        return {
            'id': self.id,
            'level': self.level,
            'status': self.status
        }
