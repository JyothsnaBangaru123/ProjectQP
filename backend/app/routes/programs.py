from flask import Blueprint, request, jsonify
from app.models.program import Program
from app.extensions import db
from app.routes.auth import token_required

programs_bp = Blueprint('programs', __name__)

@programs_bp.route('', methods=['GET'])
@token_required
def get_programs():
    try:
        programs = Program.query.order_by(Program.id.asc()).all()
        return jsonify({'success': True, 'data': [p.to_dict() for p in programs]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@programs_bp.route('/<int:id>', methods=['GET'])
@token_required
def get_program(id):
    program = Program.query.get(id)
    if not program:
        return jsonify({'success': False, 'message': 'Program not found'}), 404
    return jsonify({'success': True, 'data': program.to_dict()})

@programs_bp.route('', methods=['POST'])
@token_required
def create_program():
    data = request.get_json() or {}
    if 'name' not in data or not data['name']:
        return jsonify({'success': False, 'message': 'Program name is required'}), 400

    try:
        # Check duplicate
        existing = Program.query.filter_by(name=data['name']).first()
        if existing:
            return jsonify({'success': False, 'message': f"Program '{data['name']}' already exists"}), 409

        program = Program(
            name=data['name'],
            status=int(data.get('status', 1))
        )
        db.session.add(program)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Program created successfully', 'data': program.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@programs_bp.route('/<int:id>', methods=['PUT'])
@token_required
def update_program(id):
    program = Program.query.get(id)
    if not program:
        return jsonify({'success': False, 'message': 'Program not found'}), 404

    data = request.get_json() or {}
    try:
        if 'name' in data:
            if not data['name']:
                return jsonify({'success': False, 'message': 'Program name is required'}), 400
            # Check duplicate
            existing = Program.query.filter_by(name=data['name']).first()
            if existing and existing.id != id:
                return jsonify({'success': False, 'message': f"Program '{data['name']}' already exists"}), 409
            program.name = data['name']
        
        if 'status' in data:
            program.status = int(data['status'])
            if program.status == 0:
                from app.models.pbmapping import PBMapping
                from app.models.bcmapping import BCMapping
                pb_mappings = PBMapping.query.filter_by(prog_id=id).all()
                pb_ids = [pb.id for pb in pb_mappings]
                db.session.query(PBMapping).filter(PBMapping.prog_id == id).update({PBMapping.status: 0})
                if pb_ids:
                    db.session.query(BCMapping).filter(BCMapping.pb_id.in_(pb_ids)).update({BCMapping.status: 0}, synchronize_session='fetch')

        db.session.commit()
        return jsonify({'success': True, 'message': 'Program updated successfully', 'data': program.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@programs_bp.route('/<int:id>', methods=['DELETE'])
@token_required
def delete_program(id):
    program = Program.query.get(id)
    if not program:
        return jsonify({'success': False, 'message': 'Program not found'}), 404

    try:
        db.session.delete(program)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Program deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
