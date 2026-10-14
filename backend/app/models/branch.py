from app.extensions import db

class Branch(db.Model):
    __tablename__ = 'branches'

    id = db.Column(db.Integer, primary_key=True)
    branch_code = db.Column(db.Integer, nullable=False)
    branch_name = db.Column(db.String(255))
    status = db.Column(db.SmallInteger)
    branch_desc = db.Column(db.String(255))

    def to_dict(self):
        return {
            'id': self.id,
            'branch_code': self.branch_code,
            'branch_name': self.branch_name,
            'status': self.status,
            'branch_desc': self.branch_desc
        }
