
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'qp_management_secret_key_12345'
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'qp_jwt_secret_key_54321'

    db_url = os.environ.get('DATABASE_URL')

    if db_url:
        if db_url.startswith('postgres://'):
            db_url = db_url.replace(
                'postgres://',
                'postgresql+psycopg2://',
                1
            )
        elif db_url.startswith('postgresql://'):
            db_url = db_url.replace(
                'postgresql://',
                'postgresql+psycopg2://',
                1
            )
        elif db_url.startswith('postgresql+psycopg://'):
            db_url = db_url.replace(
                'postgresql+psycopg://',
                'postgresql+psycopg2://',
                1
            )

    SQLALCHEMY_DATABASE_URI = db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
