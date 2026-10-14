from app.extensions import db

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    per_no = db.Column(db.Integer, nullable=False)
    honorific = db.Column(db.String(255))
    user_name = db.Column(db.String(255))
    branch_id = db.Column(db.Integer)
    contact = db.Column(db.BigInteger)
    user_type = db.Column(db.Integer)
    status = db.Column(db.Boolean) # PostgreSQL uses boolean for users.status
    password = db.Column(db.String(255))
    email = db.Column(db.String(255), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'per_no': self.per_no,
            'honorific': self.honorific,
            'user_name': self.user_name,
            'branch_id': self.branch_id,
            'contact': self.contact,
            'user_type': self.user_type,
            'status': self.status,
            'password': self.password,
            'email': self.email
        }
