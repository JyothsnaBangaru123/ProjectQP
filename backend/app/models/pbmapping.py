from app.extensions import db

class PBMapping(db.Model):
    __tablename__ = 'pbmappings'

    id = db.Column(db.Integer, primary_key=True)
    prog_id = db.Column(db.Integer, db.ForeignKey('programs.id'))
    branch_id = db.Column(db.Integer, db.ForeignKey('branches.id'))
    status = db.Column(db.SmallInteger)

    program = db.relationship('Program', backref='pbmappings')
    branch = db.relationship('Branch', backref='pbmappings')

    def to_dict(self):
        return {
            'id': self.id,
            'prog_id': self.prog_id,
            'program_name': self.program.name if self.program else None,
            'branch_id': self.branch_id,
            'branch_name': self.branch.branch_name if self.branch else None,
            'branch_code': self.branch.branch_code if self.branch else None,
            'status': self.status
        }
