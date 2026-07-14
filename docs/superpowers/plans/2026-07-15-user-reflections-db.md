# User Reflections Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add simple user accounts and database-backed records for work sessions, first-look answers, and reflection text.

**Architecture:** Keep the existing demo flow intact. Users can browse without logging in, but logged-in users sync records to the backend. The backend uses SQLite locally and switches to PostgreSQL when `DATABASE_URL` is configured.

**Tech Stack:** FastAPI, Python stdlib `sqlite3`, optional `psycopg`, browser JavaScript, localStorage fallback.

---

### Task 1: Backend Database Layer

**Files:**
- Create: `backend/app/services/db_service.py`
- Create: `backend/app/services/user_service.py`
- Modify: `requirements.txt`

- [x] Add SQLite as the default database at `backend/data/callilens.db`.
- [x] Add PostgreSQL switching through `DATABASE_URL`.
- [x] Create tables for `users`, `auth_tokens`, `work_sessions`, `first_looks`, and `reflections`.
- [x] Store password hashes with PBKDF2 instead of plaintext passwords.

### Task 2: FastAPI Endpoints

**Files:**
- Modify: `backend/app/main.py`

- [x] Add `POST /api/auth/register`.
- [x] Add `POST /api/auth/login`.
- [x] Add `GET /api/auth/me`.
- [x] Add `POST /api/sessions/start`.
- [x] Add `POST /api/first-look`.
- [x] Add `POST /api/reflections`.
- [x] Add `GET /api/admin/user-records`.

### Task 3: Frontend Integration

**Files:**
- Modify: `web/index.html`
- Modify: `web/app.js`
- Modify: `web/styles.css`

- [x] Add a compact user login/register card on the entry page.
- [x] Keep localStorage saving as fallback.
- [x] Start a session when a logged-in user opens a work.
- [x] Sync first-look answers when logged in.
- [x] Sync reflection submissions when logged in.
- [x] Add an admin “用户记录” tab.

### Task 4: Tests And Docs

**Files:**
- Create: `tests/test_user_service.py`
- Create: `docs/USER_DATABASE_GUIDE.md`
- Modify: `README.md`

- [x] Test registration, login, session start, first-look saving, reflection saving, and admin record reading.
- [x] Document local SQLite behavior.
- [x] Document Render PostgreSQL switching through `DATABASE_URL`.

### Verification Commands

```powershell
python -m unittest tests.test_user_service
python -m unittest tests.test_rag_service tests.test_extract_glyphs tests.test_user_service
python -m py_compile backend\app\main.py backend\app\services\db_service.py backend\app\services\user_service.py backend\app\services\rag_service.py backend\app\services\llm_service.py scripts\process_work.py
node --check web\app.js
```
