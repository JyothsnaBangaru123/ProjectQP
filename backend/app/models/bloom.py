from app.extensions import db

class Bloom(db.Model):
    __tablename__ = 'blooms'

    id = db.Column(db.Integer, primary_key=True)
    taxonomy = db.Column(db.String(255), nullable=False)
    status = db.Column(db.Integer) # integer in postgres for blooms.status

    def to_dict(self):
        return {
            'id': self.id,
            'taxonomy': self.taxonomy,
            'status': self.status
        }
