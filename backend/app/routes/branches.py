from flask import Blueprint, request, jsonify
from app.models.branch import Branch
from app.extensions import db
from app.routes.auth import token_required

branches_bp = Blueprint('branches', __name__)

@branches_bp.route('', methods=['GET'])
@token_required
def get_branches():
    try:
        branches = Branch.query.order_by(Branch.id.asc()).all()
        return jsonify({'success': True, 'data': [b.to_dict() for b in branches]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@branches_bp.route('/<int:id>', methods=['GET'])
@token_required
def get_branch(id):
    branch = Branch.query.get(id)
    if not branch:
        return jsonify({'success': False, 'message': 'Branch not found'}), 404
    return jsonify({'success': True, 'data': branch.to_dict()})

@branches_bp.route('', methods=['POST'])
@token_required
def create_branch():
    data = request.get_json() or {}
    if 'branch_code' not in data or data['branch_code'] is None:
        return jsonify({'success': False, 'message': 'Branch code is required'}), 400

    try:
        # Check duplicate
        branch_code = int(data['branch_code'])
        existing = Branch.query.filter_by(branch_code=branch_code).first()
        if existing:
            return jsonify({'success': False, 'message': f"Branch with code {branch_code} already exists"}), 409

        branch = Branch(
            branch_code=branch_code,
            branch_name=data.get('branch_name'),
            branch_desc=data.get('branch_desc'),
            status=int(data.get('status', 1))
        )
        db.session.add(branch)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Branch created successfully', 'data': branch.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@branches_bp.route('/<int:id>', methods=['PUT'])
@token_required
def update_branch(id):
    branch = Branch.query.get(id)
    if not branch:
        return jsonify({'success': False, 'message': 'Branch not found'}), 404

    data = request.get_json() or {}
    try:
        if 'branch_code' in data:
            if data['branch_code'] is None:
                return jsonify({'success': False, 'message': 'Branch code is required'}), 400
            
            branch_code = int(data['branch_code'])
            existing = Branch.query.filter_by(branch_code=branch_code).first()
            if existing and existing.id != id:
                return jsonify({'success': False, 'message': f"Branch with code {branch_code} already exists"}), 409
            branch.branch_code = branch_code

        if 'branch_name' in data:
            branch.branch_name = data['branch_name']
        if 'branch_desc' in data:
            branch.branch_desc = data['branch_desc']
        if 'status' in data:
            branch.status = int(data['status'])
            if branch.status == 0:
                from app.models.pbmapping import PBMapping
                from app.models.bcmapping import BCMapping
                pb_mappings = PBMapping.query.filter_by(branch_id=id).all()
                pb_ids = [pb.id for pb in pb_mappings]
                db.session.query(PBMapping).filter(PBMapping.branch_id == id).update({PBMapping.status: 0})
                if pb_ids:
                    db.session.query(BCMapping).filter(BCMapping.pb_id.in_(pb_ids)).update({BCMapping.status: 0}, synchronize_session='fetch')

        db.session.commit()
        return jsonify({'success': True, 'message': 'Branch updated successfully', 'data': branch.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

@branches_bp.route('/<int:id>', methods=['DELETE'])
@token_required
def delete_branch(id):
    branch = Branch.query.get(id)
    if not branch:
        return jsonify({'success': False, 'message': 'Branch not found'}), 404

    try:
        db.session.delete(branch)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Branch deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
