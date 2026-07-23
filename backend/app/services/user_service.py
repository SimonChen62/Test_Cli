from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from . import db_service


PBKDF2_ITERATIONS = 220_000
TOKEN_DAYS = 14


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_username(username: str) -> str:
    return username.strip().lower()


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    salt_text = base64.urlsafe_b64encode(salt).decode("ascii")
    digest_text = base64.urlsafe_b64encode(digest).decode("ascii")
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt_text}${digest_text}"


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_text, expected_text = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.urlsafe_b64decode(salt_text.encode("ascii"))
        expected = base64.urlsafe_b64decode(expected_text.encode("ascii"))
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iterations_text))
        return hmac.compare_digest(digest, expected)
    except Exception:
        return False


def _public_user(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "username": row["username"],
        "role": row.get("role", "user"),
        "created_at": row.get("created_at", ""),
    }


def init_db() -> None:
    db_service.create_schema()


def register(username: str, password: str) -> dict[str, Any]:
    init_db()
    username = _normalize_username(username)
    if len(username) < 3 or len(username) > 32:
        raise ValueError("用户名长度需要在 3 到 32 个字符之间。")
    if len(password) < 6:
        raise ValueError("密码至少需要 6 个字符。")

    created_at = _now()
    with db_service.connect() as connection:
        try:
            cursor = connection.execute(
                f"INSERT INTO users (username, password_hash, role, created_at) VALUES ({db_service.placeholders(4)})",
                (username, _hash_password(password), "user", created_at),
            )
        except Exception as exc:
            message = str(exc).lower()
            if "unique" in message or "duplicate" in message:
                raise ValueError("这个用户名已经存在。") from exc
            raise
        user_id = getattr(cursor, "lastrowid", None)
        if not user_id:
            row = connection.execute(
                f"SELECT id, username, role, created_at FROM users WHERE username = {db_service.placeholders(1)}",
                (username,),
            ).fetchone()
            user_id = db_service.row_to_dict(row)["id"]
    return login(username, password)


def login(username: str, password: str) -> dict[str, Any]:
    init_db()
    username = _normalize_username(username)
    with db_service.connect() as connection:
        row = connection.execute(
            f"SELECT id, username, password_hash, role, created_at FROM users WHERE username = {db_service.placeholders(1)}",
            (username,),
        ).fetchone()
        user = db_service.row_to_dict(row)
        if not user or not _verify_password(password, user["password_hash"]):
            raise ValueError("用户名或密码不正确。")
        token = secrets.token_urlsafe(32)
        created_at = _now()
        expires_at = (datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS)).isoformat()
        connection.execute(
            f"INSERT INTO auth_tokens (token, user_id, created_at, expires_at) VALUES ({db_service.placeholders(4)})",
            (token, user["id"], created_at, expires_at),
        )
    return {"token": token, "user": _public_user(user)}


def user_from_token(token: str | None) -> dict[str, Any] | None:
    init_db()
    if not token:
        return None
    with db_service.connect() as connection:
        row = connection.execute(
            f"""
            SELECT users.id, users.username, users.role, users.created_at
            FROM auth_tokens
            JOIN users ON users.id = auth_tokens.user_id
            WHERE auth_tokens.token = {db_service.placeholders(1)}
              AND auth_tokens.expires_at > {db_service.placeholders(1)}
            """,
            (token, _now()),
        ).fetchone()
    return db_service.row_to_dict(row)


def require_user(token: str | None) -> dict[str, Any]:
    user = user_from_token(token)
    if not user:
        raise ValueError("请先登录。")
    return user


def start_session(token: str | None, work_id: str, user_agent: str = "") -> dict[str, Any]:
    user = require_user(token)
    session = {
        "id": uuid.uuid4().hex,
        "user_id": user["id"],
        "work_id": work_id,
        "started_at": _now(),
        "user_agent": user_agent[:500],
    }
    with db_service.connect() as connection:
        connection.execute(
            f"INSERT INTO work_sessions (id, user_id, work_id, started_at, user_agent) VALUES ({db_service.placeholders(5)})",
            (session["id"], session["user_id"], session["work_id"], session["started_at"], session["user_agent"]),
        )
    return {"session": session, "user": _public_user(user)}


def save_first_look(token: str | None, work_id: str, overall: str, motion: str, density: str) -> dict[str, Any]:
    user = require_user(token)
    record = {
        "id": uuid.uuid4().hex,
        "user_id": user["id"],
        "work_id": work_id,
        "overall": overall.strip(),
        "motion": motion.strip(),
        "density": density.strip(),
        "created_at": _now(),
        "updated_at": _now(),
    }
    with db_service.connect() as connection:
        connection.execute(
            f"""
            INSERT INTO first_looks
            (id, user_id, work_id, overall, motion, density, created_at, updated_at)
            VALUES ({db_service.placeholders(8)})
            """,
            (
                record["id"],
                record["user_id"],
                record["work_id"],
                record["overall"],
                record["motion"],
                record["density"],
                record["created_at"],
                record["updated_at"],
            ),
        )
    return {"first_look": record, "user": _public_user(user)}


def save_reflection(
    token: str | None,
    work_id: str,
    annotation_id: str,
    reflection_type: str,
    content: str,
) -> dict[str, Any]:
    user = require_user(token)
    record = {
        "id": uuid.uuid4().hex,
        "user_id": user["id"],
        "work_id": work_id,
        "annotation_id": annotation_id or "free_reflection",
        "reflection_type": reflection_type or "reflection",
        "content": content.strip(),
        "created_at": _now(),
    }
    if not record["content"]:
        raise ValueError("反思内容不能为空。")
    with db_service.connect() as connection:
        connection.execute(
            f"""
            INSERT INTO reflections
            (id, user_id, work_id, annotation_id, reflection_type, content, created_at)
            VALUES ({db_service.placeholders(7)})
            """,
            (
                record["id"],
                user["id"],
                record["work_id"],
                record["annotation_id"],
                record["reflection_type"],
                record["content"],
                record["created_at"],
            ),
        )
    return {"reflection": record, "user": _public_user(user)}


def admin_records(limit: int = 80) -> dict[str, Any]:
    init_db()
    limit = max(1, min(limit, 200))
    with db_service.connect() as connection:
        users = [
            db_service.row_to_dict(row)
            for row in connection.execute(
                "SELECT id, username, role, created_at FROM users ORDER BY id DESC"
            ).fetchall()
        ]
        sessions = [
            db_service.row_to_dict(row)
            for row in connection.execute(
                f"""
                SELECT work_sessions.id, users.username, work_sessions.work_id, work_sessions.started_at
                FROM work_sessions
                JOIN users ON users.id = work_sessions.user_id
                ORDER BY work_sessions.started_at DESC
                LIMIT {db_service.placeholders(1)}
                """,
                (limit,),
            ).fetchall()
        ]
        first_looks = [
            db_service.row_to_dict(row)
            for row in connection.execute(
                f"""
                SELECT first_looks.id, users.username, first_looks.work_id, first_looks.overall,
                       first_looks.motion, first_looks.density, first_looks.created_at
                FROM first_looks
                JOIN users ON users.id = first_looks.user_id
                ORDER BY first_looks.created_at DESC
                LIMIT {db_service.placeholders(1)}
                """,
                (limit,),
            ).fetchall()
        ]
        reflections = [
            db_service.row_to_dict(row)
            for row in connection.execute(
                f"""
                SELECT reflections.id, users.username, reflections.work_id, reflections.annotation_id,
                       reflections.reflection_type, reflections.content, reflections.created_at
                FROM reflections
                JOIN users ON users.id = reflections.user_id
                ORDER BY reflections.created_at DESC
                LIMIT {db_service.placeholders(1)}
                """,
                (limit,),
            ).fetchall()
        ]
    return {
        "database": db_service.status(),
        "users": users,
        "sessions": sessions,
        "first_looks": first_looks,
        "reflections": reflections,
    }


def my_records(token: str | None, limit: int = 40) -> dict[str, Any]:
    user = require_user(token)
    init_db()
    limit = max(1, min(limit, 100))
    with db_service.connect() as connection:
        sessions = [
            db_service.row_to_dict(row)
            for row in connection.execute(
                f"""
                SELECT id, work_id, started_at
                FROM work_sessions
                WHERE user_id = {db_service.placeholders(1)}
                ORDER BY started_at DESC
                LIMIT {db_service.placeholders(1)}
                """,
                (user["id"], limit),
            ).fetchall()
        ]
        first_looks = [
            db_service.row_to_dict(row)
            for row in connection.execute(
                f"""
                SELECT id, work_id, overall, motion, density, created_at, updated_at
                FROM first_looks
                WHERE user_id = {db_service.placeholders(1)}
                ORDER BY updated_at DESC
                LIMIT {db_service.placeholders(1)}
                """,
                (user["id"], limit),
            ).fetchall()
        ]
        reflections = [
            db_service.row_to_dict(row)
            for row in connection.execute(
                f"""
                SELECT id, work_id, annotation_id, reflection_type, content, created_at
                FROM reflections
                WHERE user_id = {db_service.placeholders(1)}
                ORDER BY created_at DESC
                LIMIT {db_service.placeholders(1)}
                """,
                (user["id"], limit),
            ).fetchall()
        ]
    return {
        "user": user,
        "sessions": sessions,
        "first_looks": first_looks,
        "reflections": reflections,
    }
