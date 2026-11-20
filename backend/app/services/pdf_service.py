import os
import json
import secrets
import fitz  # PyMuPDF
import re
from typing import Dict, Any, Optional, Tuple

def get_vault_directory() -> str:
    """
    Returns the absolute path to the secure question paper vault directory.
    Creates it if it does not exist.
    """
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'uploads', 'qp_vault'))
    os.makedirs(base_dir, exist_ok=True)
    return base_dir

def protect_question_paper(input_pdf: str, output_pdf: str, user_password: str) -> str:
    """
    Encrypts a finalized question paper PDF using AES-256 standard via PyMuPDF.

    Requirements:
    1. Opens the existing finalized question paper PDF.
    2. Generates a separate, cryptographically strong random owner password.
    3. Encrypts the PDF using AES-256.
    4. Sets user_password as the open password.
    5. Sets owner_password as the permission password.
    6. Restricts modification while allowing printing and accessibility.
    7. Saves as a separate file (never overwrites the original).
    8. Closes document properly.
    9. Verifies that the encrypted PDF requires user_password.
    10. Returns the encrypted output file path.
    """
    if not os.path.exists(input_pdf):
        raise FileNotFoundError(f"Source question paper PDF not found at {input_pdf}")

    if not user_password or len(str(user_password).strip()) < 12:
        raise ValueError("User password must be at least 12 characters long.")

    if len(str(user_password)) > 40:
        raise ValueError("User password cannot exceed 40 characters for standard PDF encryption.")

    # 32-character hexadecimal owner password (within 40-char PyMuPDF limit)
    owner_password = secrets.token_hex(16)

    doc = fitz.open(input_pdf)
    try:
        doc.save(
            output_pdf,
            encryption=fitz.PDF_ENCRYPT_AES_256,
            user_pw=str(user_password).strip(),
            owner_pw=owner_password,
            permissions=fitz.PDF_PERM_PRINT | fitz.PDF_PERM_ACCESSIBILITY  # Allows authorized printing, restricts modification
        )
    finally:
        doc.close()

    # Verification: Ensure PDF requires password and authenticates successfully
    verify_doc = fitz.open(output_pdf)
    try:
        if not verify_doc.is_encrypted:
            raise RuntimeError("Verification failed: Output PDF is not encrypted.")
        if not verify_doc.needs_pass:
            raise RuntimeError("Verification failed: Output PDF does not require a password to open.")
        auth_status = verify_doc.authenticate(str(user_password).strip())
        if auth_status <= 0:
            raise RuntimeError("Verification failed: Output PDF failed authentication with the specified password.")
    finally:
        verify_doc.close()

    return output_pdf

def verify_pdf_password(pdf_path: str, candidate_password: str) -> bool:
    """
    Verifies if candidate_password can decrypt and open the encrypted PDF.
    Does not log or store the password.
    """
    if not os.path.exists(pdf_path):
        return False
    try:
        doc = fitz.open(pdf_path)
        try:
            if not doc.is_encrypted:
                return True
            status = doc.authenticate(str(candidate_password).strip())
            return status > 0
        finally:
            doc.close()
    except Exception:
        return False

def measure_text_height(text: str, width: float = 333.0, fontsize: float = 9.0, line_height: float = 13.0) -> float:
    """
    Accurately measures the rendered bounding box height for wrapped text in Times-Roman (tiro).
    Guarantees that PyMuPDF's insert_textbox has ample room and never drops overflow text.
    """
    if not text:
        return 22.0
    paragraphs = str(text).split('\n')
    total_lines = 0
    space_w = fitz.get_text_length(' ', fontname='tiro', fontsize=fontsize)
    for para in paragraphs:
        cleaned = para.strip()
        if not cleaned:
            total_lines += 1
            continue
        words = cleaned.split()
        current_w = 0.0
        lines = 1
        for w in words:
            word_w = fitz.get_text_length(w, fontname='tiro', fontsize=fontsize)
            if current_w + word_w > width:
                lines += 1
                current_w = word_w + space_w
            else:
                current_w += word_w + space_w
        total_lines += lines
    return max(22.0, total_lines * line_height + 10.0)

def parse_section2_question(q_raw_text: str) -> Tuple[str, str, str, str]:
    """
    Splits an internal choice question containing [OR] into its two options
    and extracts sub-questions (a) and (b) for both options.
    """
    or_parts = re.split(r'\s*(?:\[OR\]|\(OR\))\s*', str(q_raw_text or ''), flags=re.IGNORECASE)
    part1 = or_parts[0].strip() if len(or_parts) > 0 else ''
    part2 = or_parts[1].strip() if len(or_parts) > 1 else ''

    def extract_subparts(text: str) -> Tuple[str, str]:
        lines = [l.strip() for l in text.split('\n') if l.strip()]
        a_text = ''
        b_text = ''
        current = None
        for line in lines:
            if re.match(r'^\s*(?:\(?a\)?|\ba\))\s*[\.\)]', line, re.IGNORECASE):
                current = 'a'
                a_text = re.sub(r'^\s*(?:\(?a\)?|\ba\))\s*[\.\)]?\s*', '', line, flags=re.IGNORECASE)
            elif re.match(r'^\s*(?:\(?b\)?|\bb\))\s*[\.\)]', line, re.IGNORECASE):
                current = 'b'
                b_text = re.sub(r'^\s*(?:\(?b\)?|\bb\))\s*[\.\)]?\s*', '', line, flags=re.IGNORECASE)
            elif current == 'a':
                a_text += ' ' + line
            elif current == 'b':
                b_text += ' ' + line
            elif not a_text:
                a_text = line
        return a_text.strip(), b_text.strip()

    p1_a, p1_b = extract_subparts(part1)
    p2_a, p2_b = extract_subparts(part2)
    return p1_a, p1_b, p2_a, p2_b

def format_rbt(rbt: Any) -> str:
    if not rbt: return 'Understand'
    s = str(rbt).strip().lower()
    if 'rememb' in s or s == 'l1': return 'Remember'
    if 'underst' in s or s == 'l2': return 'Understand'
    if 'apply' in s or s == 'l3': return 'Apply'
    if 'analy' in s or s == 'l4': return 'Analyze'
    if 'eval' in s or s == 'l5': return 'Evaluate'
    if 'creat' in s or s == 'l6': return 'Create'
    return str(rbt).capitalize()

def format_co(co: Any) -> str:
    if not co: return '1'
    m = re.search(r'\d+', str(co))
    return m.group(0) if m else str(co)

def generate_question_paper_pdf(qp_data: Dict[str, Any], output_path: str) -> str:
    """
    Generates a publication-grade academic question paper PDF using PyMuPDF.
    Adheres strictly to the authentic autonomous university examination format (Image 2):
    - Full academic header & instructions ONLY on Page 1 (Never on Page 2 or later!)
    - SECTION-I: 7 Short Answer Questions (a to g) with full RBT words (Remember) and CO digits (1)
    - SECTION-II: 4 Long Answer Pairs (Q2 to Q9) with sub-questions (a) and (b), centered [ OR ] rows
    - Solid black borders and crisp typography
    - Multi-page pagination with footers
    """
    doc = fitz.open()

    page_w, page_h = 595.0, 842.0
    margin = 36.0
    content_w = page_w - (2 * margin)

    # Section I Column widths (4 columns: No, Questions, RBT Level, COs)
    # Total = 40 + 343 + 85 + 55 = 523.0
    s1_w_no = 40.0
    s1_w_q = 343.0
    s1_w_rbt = 85.0
    s1_w_co = 55.0

    s1_x_no = margin
    s1_x_q = s1_x_no + s1_w_no
    s1_x_rbt = s1_x_q + s1_w_q
    s1_x_co = s1_x_rbt + s1_w_rbt
    s1_x_end = margin + content_w

    # Section II Column widths (5 columns: No, Questions, RBT Level, COs, Marks)
    # Total = 40 + 303 + 85 + 45 + 50 = 523.0
    s2_w_no = 40.0
    s2_w_q = 303.0
    s2_w_rbt = 85.0
    s2_w_co = 45.0
    s2_w_m = 50.0

    s2_x_no = margin
    s2_x_q = s2_x_no + s2_w_no
    s2_x_rbt = s2_x_q + s2_w_q
    s2_x_co = s2_x_rbt + s2_w_rbt
    s2_x_m = s2_x_co + s2_w_co
    s2_x_end = margin + content_w

    # Question Paper Metadata
    title = qp_data.get('title') or qp_data.get('exam_title') or "SEMESTER END EXAMINATIONS (AR23)"
    inst_name = qp_data.get('institution_name') or "GMR INSTITUTE OF TECHNOLOGY (AUTONOMOUS)"
    course_code = qp_data.get('course_code') or ""
    course_name = qp_data.get('course_name') or "Subject Course"
    reg_code = qp_data.get('regulation') or "AR23"
    program_str = qp_data.get('program') or qp_data.get('degree') or "B.Tech. (CSE)"
    sem_val = qp_data.get('semester') or qp_data.get('sem') or 1
    duration = qp_data.get('duration') or "3 Hours"
    total_marks = qp_data.get('total_marks') or 70

    def start_page(d, is_first_page=False):
        p = d.new_page(width=page_w, height=page_h)
        cur_y = margin

        if is_first_page:
            # Main academic header banner (STRICTLY ONLY ON PAGE 1!)
            header_h = 76.0
            p.draw_rect(fitz.Rect(margin, cur_y, margin + content_w, cur_y + header_h), color=(0, 0, 0), width=1.2)
            
            p.insert_text(fitz.Point(margin + 12, cur_y + 18), str(inst_name).upper(), fontsize=12.0, fontname='tibo', color=(0, 0, 0))
            p.insert_text(fitz.Point(margin + 12, cur_y + 35), str(title).upper(), fontsize=10.0, fontname='tibo', color=(0, 0, 0))
            p.insert_text(fitz.Point(margin + 12, cur_y + 51), f"Course: {course_name} ({course_code})   |   {program_str}   |   Reg: {reg_code}", fontsize=9.0, fontname='tiro', color=(0, 0, 0))
            p.insert_text(fitz.Point(margin + 12, cur_y + 66), f"Duration: {duration}   |   Max. Marks: {total_marks}   |   Semester: {sem_val}", fontsize=9.0, fontname='tiro', color=(0, 0, 0))
            cur_y += header_h + 10.0

            # General instructions (STRICTLY ONLY ON PAGE 1!)
            inst_text = [
                "1. Answer ALL questions from SECTION-I and ANY FOUR questions from SECTION-II.",
                "2. All parts of the question must be answered in one place only.",
                "3. Assume suitable data if necessary."
            ]
            for l in inst_text:
                p.insert_text(fitz.Point(margin + 4, cur_y + 9), l, fontsize=8.0, fontname='tiit', color=(0.15, 0.15, 0.15))
                cur_y += 12.0
            cur_y += 6.0
        # When is_first_page is False, NO UNIVERSITY BANNER OR INSTRUCTIONS ARE DRAWN AT ALL!

        return p, cur_y

    def draw_sec1_headers(p, cur_y):
        th_h = 20.0
        p.draw_rect(fitz.Rect(margin, cur_y, s1_x_end, cur_y + th_h), color=(0, 0, 0), fill=(0.96, 0.96, 0.96), width=1.0)
        p.insert_text(fitz.Point(s1_x_no + 12, cur_y + 14), "No.", fontsize=9.0, fontname='tibo')
        p.insert_text(fitz.Point(s1_x_q + 8, cur_y + 14), "Questions (a to g)", fontsize=9.0, fontname='tibo')
        p.insert_text(fitz.Point(s1_x_rbt + 15, cur_y + 14), "RBT Level", fontsize=9.0, fontname='tibo')
        p.insert_text(fitz.Point(s1_x_co + 14, cur_y + 14), "COs", fontsize=9.0, fontname='tibo')
        for x in (s1_x_q, s1_x_rbt, s1_x_co):
            p.draw_line(fitz.Point(x, cur_y), fitz.Point(x, cur_y + th_h), color=(0, 0, 0), width=0.6)
        return cur_y + th_h

    def draw_sec2_headers(p, cur_y):
        th_h = 20.0
        p.draw_rect(fitz.Rect(margin, cur_y, s2_x_end, cur_y + th_h), color=(0, 0, 0), fill=(0.96, 0.96, 0.96), width=1.0)
        p.insert_text(fitz.Point(s2_x_no + 12, cur_y + 14), "No.", fontsize=9.0, fontname='tibo')
        p.insert_text(fitz.Point(s2_x_q + 8, cur_y + 14), "Questions (2 to 9)", fontsize=9.0, fontname='tibo')
        p.insert_text(fitz.Point(s2_x_rbt + 15, cur_y + 14), "RBT Level", fontsize=9.0, fontname='tibo')
        p.insert_text(fitz.Point(s2_x_co + 12, cur_y + 14), "COs", fontsize=9.0, fontname='tibo')
        p.insert_text(fitz.Point(s2_x_m + 8, cur_y + 14), "Marks", fontsize=9.0, fontname='tibo')
        for x in (s2_x_q, s2_x_rbt, s2_x_co, s2_x_m):
            p.draw_line(fitz.Point(x, cur_y), fitz.Point(x, cur_y + th_h), color=(0, 0, 0), width=0.6)
        return cur_y + th_h

    # ================= PAGE 1 =================
    page, cur_y = start_page(doc, is_first_page=True)

    sections = qp_data.get('sections', [])
    sec1 = sections[0] if len(sections) > 0 else {}
    sec2 = sections[1] if len(sections) > 1 else {}

    # SECTION-I Header Bar (Image 2 style)
    p1_bar_h = 20.0
    page.insert_text(fitz.Point(margin + 4, cur_y + 14), "SECTION-I", fontsize=10.0, fontname='tibo')
    page.insert_text(fitz.Point(s1_x_end - 110, cur_y + 14), "7 x 2 = 14 Marks", fontsize=9.5, fontname='tibo')
    cur_y += p1_bar_h

    cur_y = draw_sec1_headers(page, cur_y)

    for q_idx, q in enumerate(sec1.get('questions', [])):
        label = chr(97 + q_idx) if q_idx < 26 else str(q_idx + 1)
        q_text = str(q.get('question') or q.get('text') or '').strip()
        # Clean out inline tags if present
        q_text = re.sub(r'^\s*(?:\([a-z]\)|[a-z]\))\s*', '', q_text, flags=re.IGNORECASE)
        q_text = re.sub(r'\[\d+\s*M\]', '', q_text, flags=re.IGNORECASE)
        q_text = re.sub(r'\[CO\d+\]', '', q_text, flags=re.IGNORECASE).strip()

        rbt = format_rbt(q.get('bloom_level') or q.get('bloom'))
        co = format_co(q.get('co'))

        h = measure_text_height(q_text, width=s1_w_q - 16, fontsize=9.0)
        
        # Row outer border
        page.draw_rect(fitz.Rect(margin, cur_y, s1_x_end, cur_y + h), color=(0, 0, 0), width=0.6)

        # Vertical column lines
        for x in (s1_x_q, s1_x_rbt, s1_x_co):
            page.draw_line(fitz.Point(x, cur_y), fitz.Point(x, cur_y + h), color=(0, 0, 0), width=0.6)

        # Cell text
        page.insert_text(fitz.Point(s1_x_no + 16, cur_y + 15), label, fontsize=9.0, fontname='tibo')
        page.insert_textbox(fitz.Rect(s1_x_q + 6, cur_y + 3, s1_x_rbt - 6, cur_y + h - 2), q_text, fontsize=9.0, fontname='tiro')
        page.insert_text(fitz.Point(s1_x_rbt + 15, cur_y + 15), rbt, fontsize=8.5, fontname='tiro')
        page.insert_text(fitz.Point(s1_x_co + 20, cur_y + 15), co, fontsize=9.0, fontname='tibo')

        cur_y += h

    # Bottom line of Section I table
    page.draw_line(fitz.Point(margin, cur_y), fitz.Point(s1_x_end, cur_y), color=(0, 0, 0), width=1.2)

    # ================= SECTION-II (CONTINUES ON PAGE 1 LIKE REAL-WORLD QUESTION PAPER) =================
    cur_y += 14.0  # Spacing between Section I and Section II

    sec2_questions = sec2.get('questions', [])
    pair1_h = 120.0
    if sec2_questions:
        q0 = sec2_questions[0]
        p1_a, p1_b, p2_a, p2_b = parse_section2_question(q0.get('question', ''))
        pair1_h = sum(
            measure_text_height(txt, width=s2_w_q - 16, fontsize=9.0)
            for txt in [f"(a) {p1_a}", f"(b) {p1_b}", f"(a) {p2_a}", f"(b) {p2_b}"]
        ) + 16.0  # 16.0 for [ OR ] row

    # Only break to a new page if Section II headers and the first question pair cannot fit on Page 1
    sec2_header_h = p1_bar_h + 20.0
    if cur_y + sec2_header_h + pair1_h > page_h - margin - 15:
        page, cur_y = start_page(doc, is_first_page=False)

    # SECTION-II Header Bar (Image 2 style)
    page.insert_text(fitz.Point(margin + 4, cur_y + 14), "SECTION-II", fontsize=10.0, fontname='tibo')
    page.insert_text(fitz.Point(s2_x_end - 120, cur_y + 14), "4 x 14 = 56 Marks", fontsize=9.5, fontname='tibo')
    cur_y += p1_bar_h

    cur_y = draw_sec2_headers(page, cur_y)

    for pair_idx, q in enumerate(sec2_questions):
        base_num = 2 + pair_idx * 2
        p1_a, p1_b, p2_a, p2_b = parse_section2_question(q.get('question', ''))

        co_1a = format_co(q.get('q1_co_a') or q.get('co') or '1')
        co_1b = format_co(q.get('q1_co_b') or q.get('co') or '2')
        co_2a = format_co(q.get('q2_co_a') or q.get('co') or '1')
        co_2b = format_co(q.get('q2_co_b') or q.get('co') or '2')

        rbt_1a = format_rbt(q.get('q1_bloom_a') or q.get('bloom_level') or 'Understand')
        rbt_1b = format_rbt(q.get('q1_bloom_b') or q.get('bloom_level') or 'Apply')
        rbt_2a = format_rbt(q.get('q2_bloom_a') or q.get('bloom_level') or 'Understand')
        rbt_2b = format_rbt(q.get('q2_bloom_b') or q.get('bloom_level') or 'Apply')

        m_a = f"{q.get('p1_marks', 8)}M"
        m_b = f"{q.get('p2_marks', 6)}M"

        rows = [
            (str(base_num), f"(a) {p1_a}", rbt_1a, co_1a, m_a),
            ("", f"(b) {p1_b}", rbt_1b, co_1b, m_b),
            ("OR", None, None, None, None),
            (str(base_num + 1), f"(a) {p2_a}", rbt_2a, co_2a, m_a),
            ("", f"(b) {p2_b}", rbt_2b, co_2b, m_b)
        ]

        # Check total height of this pair
        pair_h = sum(measure_text_height(r[1], width=s2_w_q - 16, fontsize=9.0) if r[0] != 'OR' else 16.0 for r in rows)
        if cur_y + pair_h > page_h - margin - 15:
            # Break to next page cleanly (NO HEADER BANNER on subsequent pages!)
            page, cur_y = start_page(doc, is_first_page=False)
            cur_y = draw_sec2_headers(page, cur_y)

        for q_num_str, text_str, rbt_str, co_str, marks_str in rows:
            if q_num_str == "OR":
                or_h = 16.0
                page.draw_rect(fitz.Rect(margin, cur_y, s2_x_end, cur_y + or_h), color=(0, 0, 0), fill=(0.95, 0.95, 0.95), width=0.6)
                page.insert_text(fitz.Point(margin + content_w / 2 - 12, cur_y + 11), "[ OR ]", fontsize=8.5, fontname='tibo', color=(0.2, 0.2, 0.2))
                cur_y += or_h
                continue

            h = measure_text_height(text_str, width=s2_w_q - 16, fontsize=9.0)
            
            # Row box
            page.draw_rect(fitz.Rect(margin, cur_y, s2_x_end, cur_y + h), color=(0, 0, 0), width=0.6)

            # Vertical dividers
            for x in (s2_x_q, s2_x_rbt, s2_x_co, s2_x_m):
                page.draw_line(fitz.Point(x, cur_y), fitz.Point(x, cur_y + h), color=(0, 0, 0), width=0.6)

            # Cell text
            if q_num_str:
                page.insert_text(fitz.Point(s2_x_no + 14, cur_y + 16), q_num_str, fontsize=9.5, fontname='tibo')
            page.insert_textbox(fitz.Rect(s2_x_q + 6, cur_y + 3, s2_x_rbt - 6, cur_y + h - 2), text_str, fontsize=9.0, fontname='tiro')
            page.insert_text(fitz.Point(s2_x_rbt + 15, cur_y + 15), rbt_str, fontsize=8.5, fontname='tiro')
            page.insert_text(fitz.Point(s2_x_co + 14, cur_y + 15), co_str, fontsize=9.0, fontname='tibo')
            page.insert_text(fitz.Point(s2_x_m + 8, cur_y + 15), marks_str, fontsize=9.0, fontname='tibo')

            cur_y += h

        # Heavy solid line between question pairs
        page.draw_line(fitz.Point(margin, cur_y), fitz.Point(s2_x_end, cur_y), color=(0, 0, 0), width=1.5)

    # Page Footers on all pages
    total_p = len(doc)
    for p_idx, p in enumerate(doc):
        foot = f"Page {p_idx + 1} of {total_p}   •   GMRIT Autonomous Examination System   •   Confidential"
        p.insert_text(fitz.Point(margin + content_w / 2 - 80, page_h - margin + 14), foot, fontsize=8.0, fontname='tiro', color=(0.4, 0.4, 0.4))

    doc.save(output_path)
    doc.close()
    return output_path

def ensure_original_question_paper_pdf(qp_id: int, qp_obj: Any, force_regenerate: bool = False) -> str:
    """
    Ensures that an original unencrypted PDF exists in the vault for a question paper.
    If it does not exist or force_regenerate is True, generates it from the stored JSON content.
    Returns the absolute path to the original PDF.
    """
    vault_dir = get_vault_directory()
    original_pdf_path = os.path.join(vault_dir, f"qp_{qp_id}_original.pdf")

    if force_regenerate or not os.path.exists(original_pdf_path):
        content = {}
        if hasattr(qp_obj, 'generated_content') and qp_obj.generated_content:
            try:
                content = json.loads(qp_obj.generated_content) if isinstance(qp_obj.generated_content, str) else qp_obj.generated_content
            except Exception:
                content = {}
        
        # Merge top-level metadata into content dictionary
        content['title'] = getattr(qp_obj, 'title', None) or content.get('title')
        content['course_name'] = getattr(qp_obj, 'course_name', None) or content.get('course_name')
        content['course_code'] = getattr(qp_obj, 'course_code', None) or content.get('course_code')
        content['academic_year'] = getattr(qp_obj, 'academic_year', None) or content.get('academic_year')
        content['semester'] = getattr(qp_obj, 'sem', None) or content.get('semester')
        content['total_marks'] = getattr(qp_obj, 'total_marks', None) or content.get('total_marks', 70)
        content['duration'] = getattr(qp_obj, 'duration', None) or content.get('duration', '3 Hours')

        generate_question_paper_pdf(content, original_pdf_path)

    return original_pdf_path
