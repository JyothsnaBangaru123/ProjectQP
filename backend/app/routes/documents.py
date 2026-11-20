import os
import fitz # PyMuPDF
from flask import Blueprint, request, jsonify, g, send_file, current_app
from werkzeug.utils import secure_filename
from app.models.course_document import CourseDocument
from app.models.course import Course
from app.models.user import User
from app.models.branch import Branch
from app.extensions import db
from app.routes.auth import token_required

documents_bp = Blueprint('documents', __name__)

ALLOWED_EXTENSIONS = {'pdf', 'txt', 'docx', 'doc'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_upload_folder():
    folder = os.path.join(current_app.root_path, '..', 'uploads')
    folder = os.path.abspath(folder)
    os.makedirs(folder, exist_ok=True)
    return folder

def extract_text_from_file(file_path, file_type):
    extracted_text = ""
    try:
        if file_type == 'pdf':
            try:
                doc = fitz.open(file_path)
                ocr_engine = None
                for page in doc:
                    page_text = page.get_text()
                    # If page text is very short (e.g. scanned image/photo syllabus), run RapidOCR
                    if len(page_text.strip()) < 30:
                        try:
                            from rapidocr_onnxruntime import RapidOCR
                            if ocr_engine is None:
                                ocr_engine = RapidOCR()
                            pix = page.get_pixmap(dpi=200)
                            res, _ = ocr_engine(pix.tobytes('png'))
                            if res:
                                page_text = "\n".join([item[1] for item in res])
                        except Exception as ocr_err:
                            print(f"RapidOCR fallback error: {ocr_err}")
                    extracted_text += page_text + "\n"
                doc.close()
            except Exception as pdf_err:
                print(f"PDF extraction error: {pdf_err}")
        elif file_type in ['txt', 'text']:
            for enc in ['utf-8', 'latin-1', 'cp1252']:
                try:
                    with open(file_path, 'r', encoding=enc, errors='ignore') as f:
                        extracted_text = f.read()
                    break
                except Exception:
                    continue
        elif file_type in ['docx', 'doc']:
            try:
                import docx
                doc = docx.Document(file_path)
                parts = []
                for p in doc.paragraphs:
                    if p.text.strip():
                        parts.append(p.text.strip())
                for table in doc.tables:
                    for row in table.rows:
                        row_vals = [c.text.strip() for c in row.cells if c.text.strip()]
                        if row_vals:
                            parts.append(" | ".join(row_vals))
                extracted_text = "\n".join(parts)
            except Exception as docx_err:
                print(f"DOCX extraction fallback: {docx_err}")
    except Exception as e:
        print(f"Text extraction error for {file_path}: {e}")
    return extracted_text.strip()
@documents_bp.route('/extract', methods=['POST'])
@token_required
def extract_file_text():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file uploaded'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'success': False, 'message': 'Only PDF, TXT, and DOCX files are supported'}), 400

    raw_filename = file.filename or 'temp.pdf'
    file_ext = raw_filename.rsplit('.', 1)[1].lower() if '.' in raw_filename else 'txt'
    clean_filename = secure_filename(raw_filename) or f"temp_{os.urandom(4).hex()}.{file_ext}"

    upload_dir = get_upload_folder()
    temp_filename = f"temp_extract_{os.urandom(6).hex()}_{clean_filename}"
    temp_path = os.path.join(upload_dir, temp_filename)
    
    try:
        file.save(temp_path)
        extracted = extract_text_from_file(temp_path, file_ext)
        file_size = os.path.getsize(temp_path) if os.path.exists(temp_path) else 0
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

        return jsonify({
            'success': True,
            'filename': raw_filename,
            'file_type': file_ext,
            'file_size': file_size,
            'extracted_text': extracted,
            'character_count': len(extracted),
            'word_count': len(extracted.split()) if extracted else 0
        })
    except Exception as e:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        return jsonify({'success': False, 'message': f"Extraction error: {str(e)}"}), 500

@documents_bp.route('/upload', methods=['POST'])
@token_required
def upload_document():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file uploaded'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'success': False, 'message': 'Only PDF, TXT, and DOCX files are supported'}), 400

    course_id = request.form.get('course_id')
    title = request.form.get('title')

    if not course_id:
        return jsonify({'success': False, 'message': 'Course selection is required'}), 400

    try:
        course_id_int = int(course_id)
    except (ValueError, TypeError):
        return jsonify({'success': False, 'message': 'Invalid course ID'}), 400

    course = Course.query.get(course_id_int)
    if not course:
        return jsonify({'success': False, 'message': 'Selected course not found'}), 404

    # Determine user & department
    user_id = g.current_user.id
    user_name = g.current_user.user_name or 'Faculty Member'
    branch_id = g.current_user.branch_id

    # Verify if user_id exists in users table (to satisfy FK constraint)
    existing_user = User.query.get(user_id) if user_id else None
    if not existing_user:
        first_user = User.query.first()
        if first_user:
            user_id = first_user.id

    # If user has no branch, fallback to course's branch or first available branch
    if not branch_id:
        try:
            if course.pb and course.pb.branch_id:
                branch_id = course.pb.branch_id
        except Exception:
            pass
        if not branch_id:
            first_branch = Branch.query.first()
            branch_id = first_branch.id if first_branch else None

    raw_filename = file.filename or 'document.pdf'
    file_ext = raw_filename.rsplit('.', 1)[1].lower() if '.' in raw_filename else 'txt'
    clean_filename = secure_filename(raw_filename)
    if not clean_filename:
        clean_filename = f"upload_{os.urandom(4).hex()}.{file_ext}"

    unique_filename = f"doc_{user_id}_{course_id_int}_{os.urandom(4).hex()}_{clean_filename}"
    
    upload_dir = get_upload_folder()
    saved_path = os.path.join(upload_dir, unique_filename)
    file.save(saved_path)

    file_size = os.path.getsize(saved_path) if os.path.exists(saved_path) else 0
    extracted_text = extract_text_from_file(saved_path, file_ext)

    doc_record = CourseDocument(
        user_id=user_id,
        user_name=user_name,
        branch_id=branch_id,
        course_id=course_id_int,
        title=title.strip() if title else clean_filename,
        file_name=clean_filename,
        file_type=file_ext,
        file_size=file_size,
        file_path=unique_filename,
        extracted_text=extracted_text,
        status=1
    )

    try:
        db.session.add(doc_record)
        db.session.commit()
        return jsonify({
            'success': True,
            'message': 'Document uploaded and indexed successfully',
            'data': doc_record.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': f"Database error: {str(e)}"}), 500

@documents_bp.route('', methods=['GET'])
@token_required
def get_documents():
    try:
        query = CourseDocument.query.filter_by(status=1)
        
        user_role = (g.current_user.role or g.current_user.type or '').lower()
        user_branch = g.current_user.branch_id

        # Role-based scoping:
        # HOD: sees all documents uploaded for their department branch
        if 'hod' in user_role and user_branch:
            query = query.filter(CourseDocument.branch_id == user_branch)
        # Faculty: sees documents they uploaded or in their branch
        elif 'faculty' in user_role:
            filter_mode = request.args.get('filter', 'my')
            if filter_mode == 'my':
                query = query.filter(CourseDocument.user_id == g.current_user.id)
            elif user_branch:
                query = query.filter(CourseDocument.branch_id == user_branch)
        # Admin: can filter by branch_id or course_id or see all
        
        if request.args.get('branch_id'):
            query = query.filter(CourseDocument.branch_id == int(request.args.get('branch_id')))
        if request.args.get('course_id'):
            query = query.filter(CourseDocument.course_id == int(request.args.get('course_id')))

        documents = query.order_by(CourseDocument.id.desc()).all()
        return jsonify({'success': True, 'data': [d.to_dict() for d in documents]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@documents_bp.route('/course/<int:course_id>', methods=['GET'])
@token_required
def get_course_documents(course_id):
    try:
        docs = CourseDocument.query.filter_by(course_id=course_id, status=1).order_by(CourseDocument.id.desc()).all()
        return jsonify({'success': True, 'data': [d.to_dict() for d in docs]})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@documents_bp.route('/<int:id>', methods=['GET'])
@token_required
def get_document(id):
    doc = CourseDocument.query.get(id)
    if not doc:
        return jsonify({'success': False, 'message': 'Document not found'}), 404
    
    # Auto-repair extracted_text if empty or missing
    if not doc.extracted_text or len(doc.extracted_text.strip()) < 30:
        upload_dir = get_upload_folder()
        fpath = os.path.join(upload_dir, doc.file_path) if not os.path.isabs(doc.file_path) else doc.file_path
        if not os.path.exists(fpath):
            candidate = os.path.join(upload_dir, doc.file_name)
            if os.path.exists(candidate):
                fpath = candidate
        if os.path.exists(fpath):
            re_extracted = extract_text_from_file(fpath, doc.file_type)
            if re_extracted and len(re_extracted) > len(doc.extracted_text or ''):
                doc.extracted_text = re_extracted
                try:
                    db.session.commit()
                except Exception as commit_err:
                    db.session.rollback()
                    print(f"Failed to save auto-repaired text: {commit_err}")

    d = doc.to_dict()
    d['extracted_text'] = doc.extracted_text
    d['extracted_text_preview'] = (doc.extracted_text[:1000] + '...') if doc.extracted_text and len(doc.extracted_text) > 1000 else doc.extracted_text
    return jsonify({'success': True, 'data': d})

@documents_bp.route('/download/<int:id>', methods=['GET'])
@token_required
def download_document(id):
    doc = CourseDocument.query.get(id)
    if not doc:
        return jsonify({'success': False, 'message': 'Document not found'}), 404

    upload_dir = get_upload_folder()
    file_path = os.path.join(upload_dir, doc.file_path) if not os.path.isabs(doc.file_path) else doc.file_path
    
    if not os.path.exists(file_path):
        candidate = os.path.join(upload_dir, doc.file_name)
        if os.path.exists(candidate):
            file_path = candidate
        else:
            # Try finding by suffix of clean_filename
            matched_file = None
            for fname in os.listdir(upload_dir):
                if fname.endswith(doc.file_name) or fname == doc.file_path:
                    matched_file = os.path.join(upload_dir, fname)
                    break
            if matched_file and os.path.exists(matched_file):
                file_path = matched_file
            else:
                return jsonify({'success': False, 'message': f"File '{doc.file_name}' not found on server"}), 404

    return send_file(
        file_path,
        as_attachment=True,
        download_name=doc.file_name,
        mimetype='application/octet-stream'
    )

@documents_bp.route('/<int:id>', methods=['DELETE'])
@token_required
def delete_document(id):
    doc = CourseDocument.query.get(id)
    if not doc:
        return jsonify({'success': False, 'message': 'Document not found'}), 404

    try:
        upload_dir = get_upload_folder()
        file_path = os.path.join(upload_dir, doc.file_path)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass

        db.session.delete(doc)
        db.session.commit()
        return jsonify({'success': True, 'message': 'Document deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
