from app.extensions import db

class Role(db.Model):
    __tablename__ = 'roles'

    id = db.Column(db.Integer, primary_key=True)
    role_name = db.Column(db.String(255), nullable=False, unique=True)
    status = db.Column(db.Integer, default=1)

    def to_dict(self):
        return {
            'id': self.id,
            'role': self.role_name,
            'role_name': self.role_name,
            'status': self.status
        }
