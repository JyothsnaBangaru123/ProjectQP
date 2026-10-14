import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'qp_management_secret_key_12345')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'qp_jwt_secret_key_54321')
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
