import os
import sys
from dotenv import load_dotenv

sys.path.append(os.path.dirname(__file__))
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from app import create_app
from app.extensions import db
from sqlalchemy import text

app = create_app()

def migrate():
    with app.app_context():
        print("Running database migrations for HOD-Controlled Question Paper Encryption...")

        # 1. Add columns to question_papers
        alter_statements = [
            "ALTER TABLE question_papers ADD COLUMN IF NOT EXISTS is_password_protected BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE question_papers ADD COLUMN IF NOT EXISTS original_pdf_path VARCHAR(500);",
            "ALTER TABLE question_papers ADD COLUMN IF NOT EXISTS protected_pdf_path VARCHAR(500);",
            "ALTER TABLE question_papers ADD COLUMN IF NOT EXISTS protected_at TIMESTAMP;",
            "ALTER TABLE question_papers ADD COLUMN IF NOT EXISTS protected_by_id INTEGER;",
            "ALTER TABLE question_papers ADD COLUMN IF NOT EXISTS protected_by_name VARCHAR(255);"
        ]

        for stmt in alter_statements:
            db.session.execute(text(stmt))

        # 2. Create paper_shared_recipients table
        create_table_stmt = """
        CREATE TABLE IF NOT EXISTS paper_shared_recipients (
            id SERIAL PRIMARY KEY,
            question_paper_id INTEGER NOT NULL REFERENCES question_papers(id) ON DELETE CASCADE,
            faculty_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            recipient_email VARCHAR(255) NOT NULL,
            recipient_name VARCHAR(255),
            shared_by_hod_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            shared_by_hod_name VARCHAR(255),
            shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            email_status VARCHAR(50) DEFAULT 'sent',
            email_sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            error_message TEXT
        );
        """
        db.session.execute(text(create_table_stmt))

        # Create index on (question_paper_id, faculty_user_id)
        db.session.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_paper_shared_recipients_qp_faculty 
            ON paper_shared_recipients(question_paper_id, faculty_user_id);
        """))

        db.session.commit()
        print("✓ Database migration completed successfully!")

if __name__ == '__main__':
    migrate()

