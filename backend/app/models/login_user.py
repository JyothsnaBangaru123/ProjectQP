from app.extensions import db
from werkzeug.security import generate_password_hash, check_password_hash

class LoginUser(db.Model):
    __tablename__ = 'login_users'

    id = db.Column(db.Integer, primary_key=True)
    user_name = db.Column(db.String(255), nullable=False, unique=True)
    password = db.Column(db.String(255))
    type = db.Column(db.String(255))

    def set_password(self, plaintext_password):
        self.password = generate_password_hash(plaintext_password)

    def check_password(self, plaintext_password):
        if not self.password:
            return False
        return check_password_hash(self.password, plaintext_password)

    def to_dict(self):
        return {
            'id': self.id,
            'user_name': self.user_name,
            'type': self.type
        }
