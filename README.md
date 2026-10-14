# QP Management System

A full-stack question paper management portal built using **React + Vite** on the frontend and **Python Flask REST API** on the backend, connecting to an existing PostgreSQL database (`qpdb`).

---

## Technical Stack

* **Frontend:** React, Vite, Axios, React Router v6
* **Backend:** Python Flask REST API, Flask-SQLAlchemy (ORM)
* **Database:** PostgreSQL 18
* **Authentication:** PyJWT (Secure token-based JWT)
* **CORS:** Flask-CORS enabled

---

## Directory Layout

```text
qpmanagement/
├── backend/
│   ├── app/
│   │   ├── __init__.py         # App factory
│   │   ├── config.py           # Configuration manager
│   │   ├── extensions.py       # SQLAlchemy & CORS instances
│   │   ├── models/             # Database tables mappings
│   │   └── routes/             # REST blueprints
│   ├── run.py                  # Entrypoint server script
│   └── requirements.txt        # Backend dependencies
│
├── frontend/
│   ├── src/
│   │   ├── components/         # Layout & reusable widgets
│   │   ├── context/            # AuthContext global state
│   │   ├── pages/              # Master & Mapping screens
│   │   ├── router/             # AppRouter layout definitions
│   │   ├── services/           # Axios API services
│   │   └── utils/              # Validators & constants
│   ├── vite.config.js          # Vite config
│   └── package.json            # Node dependencies
```

---

## Setup & Running

### 1. Database Connection
Ensure PostgreSQL is running locally and contains the `qpdb` database. Read the database password from `backend/.env`.

### 2. Run Flask Backend
Navigate to the `backend/` directory:

```bash
cd backend
```

Create a virtual environment (optional) and install dependencies:
```bash
python -m pip install -r requirements.txt
```

Run the backend server:
```bash
python run.py
```
The REST API runs on `http://127.0.0.1:5000`.

### 3. Run React Frontend
Open a new terminal window, and navigate to the `frontend/` directory:

```bash
cd frontend
```

Install dependencies:
```bash
npm install
```

Start the Vite development server:
```bash
npm run dev
```
The client dashboard opens on `http://localhost:5173`.

---

## Default Login Credentials

If the `login_users` table in your database is empty, the backend will automatically seed a default administrator on login submission:
* **Username:** `admin`
* **Password:** `admin`
* **Role:** `Admin`

*Note: Passwords are automatically hashed using Werkzeug secure PBKDF2 hashing.*
