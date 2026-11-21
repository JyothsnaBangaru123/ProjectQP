import logging
from flask import Flask, jsonify
from app.config import Config
from app.extensions import db, cors

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})

    # Register blueprints
    from app.routes import (
        auth_bp, users_bp, login_users_bp, programs_bp, branches_bp,
        regulations_bp, courses_bp, blooms_bp, qlevel_bp, mappings_bp,
        pbmappings_bp, bcmappings_bp, roles_bp, documents_bp, qp_generator_bp,
        students_bp
    )

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(users_bp, url_prefix='/api/faculty', name='faculty_users')
    app.register_blueprint(roles_bp, url_prefix='/api/roles')
    app.register_blueprint(documents_bp, url_prefix='/api/documents')
    app.register_blueprint(qp_generator_bp, url_prefix='/api/qp')
    app.register_blueprint(qp_generator_bp, url_prefix='/api/question-papers', name='qp_generator_alias')
    app.register_blueprint(students_bp, url_prefix='/api/students')
    app.register_blueprint(login_users_bp, url_prefix='/api/login-users')
    app.register_blueprint(programs_bp, url_prefix='/api/programs')
    app.register_blueprint(branches_bp, url_prefix='/api/branches')
    app.register_blueprint(regulations_bp, url_prefix='/api/regulations')
    app.register_blueprint(courses_bp, url_prefix='/api/courses')
    app.register_blueprint(blooms_bp, url_prefix='/api/blooms')
    app.register_blueprint(qlevel_bp, url_prefix='/api/qlevel')
    app.register_blueprint(mappings_bp, url_prefix='/api/mappings')
    app.register_blueprint(pbmappings_bp, url_prefix='/api/pbmappings')
    app.register_blueprint(bcmappings_bp, url_prefix='/api/bcmappings')

    import os
    upload_folder = os.path.join(app.root_path, '..', 'uploads')
    os.makedirs(upload_folder, exist_ok=True)

    with app.app_context():
        try:
            db.create_all()
            from sqlalchemy import text
            try:
                db.session.execute(text("ALTER TABLE question_papers ADD COLUMN IF NOT EXISTS protected_pdf_base64 TEXT;"))
                db.session.commit()
            except Exception:
                db.session.rollback()

            from app.models.role import Role
            if Role.query.count() == 0:
                default_roles = ['Admin', 'Faculty', 'Registrar', 'Staff', 'Moderator', 'HOD']
                for r in default_roles:
                    db.session.add(Role(role_name=r, status=1))
                db.session.commit()
        except Exception as e:
            logging.warning(f"Database initialization warning: {e}")

    # Global Error Handlers
    @app.errorhandler(404)
    def not_found_error(error):
        return jsonify({'success': False, 'message': 'Resource not found'}), 404

    @app.errorhandler(500)
    def internal_error(error):
        db.session.rollback()
        return jsonify({'success': False, 'message': 'Internal server error'}), 500

    # Add a health check and connection tester
    @app.route('/api/health', methods=['GET'])
    def health_check():
        try:
            # Simple query to test DB connection
            db.session.execute(db.text('SELECT 1'))
            return jsonify({
                'success': True, 
                'status': 'healthy', 
                'database': 'connected'
            }), 200
        except Exception as e:
            return jsonify({
                'success': False, 
                'status': 'unhealthy', 
                'database_error': str(e)
            }), 500

    return app
