from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator


PROJECT_ROOT = Path(__file__).resolve().parents[3]
LOCAL_DB_DIR = PROJECT_ROOT / "backend" / "data"
LOCAL_DB_PATH = LOCAL_DB_DIR / "callilens.db"


def database_url() -> str:
    return os.environ.get("DATABASE_URL", "").strip()


def using_postgres() -> bool:
    url = database_url()
    return url.startswith("postgres://") or url.startswith("postgresql://")


@contextmanager
def connect() -> Iterator[Any]:
    if using_postgres():
        import psycopg
        from psycopg.rows import dict_row

        with psycopg.connect(database_url(), row_factory=dict_row) as connection:
            yield connection
        return

    LOCAL_DB_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(LOCAL_DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def row_to_dict(row: Any | None) -> dict[str, Any] | None:
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    return dict(row)


def placeholders(count: int) -> str:
    marker = "%s" if using_postgres() else "?"
    return ", ".join([marker] * count)


def create_schema() -> None:
    if using_postgres():
        statements = [
            """
            CREATE TABLE IF NOT EXISTS users (
                id BIGSERIAL PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS auth_tokens (
                token TEXT PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS work_sessions (
                id TEXT PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                work_id TEXT NOT NULL,
                started_at TEXT NOT NULL,
                user_agent TEXT NOT NULL DEFAULT ''
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS first_looks (
                id TEXT PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                work_id TEXT NOT NULL,
                overall TEXT NOT NULL,
                motion TEXT NOT NULL,
                density TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS reflections (
                id TEXT PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                work_id TEXT NOT NULL,
                annotation_id TEXT NOT NULL,
                reflection_type TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """,
        ]
    else:
        statements = [
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS auth_tokens (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS work_sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                work_id TEXT NOT NULL,
                started_at TEXT NOT NULL,
                user_agent TEXT NOT NULL DEFAULT ''
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS first_looks (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                work_id TEXT NOT NULL,
                overall TEXT NOT NULL,
                motion TEXT NOT NULL,
                density TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS reflections (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                work_id TEXT NOT NULL,
                annotation_id TEXT NOT NULL,
                reflection_type TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """,
        ]

    with connect() as connection:
        for statement in statements:
            connection.execute(statement)


def status() -> dict[str, object]:
    return {
        "driver": "postgresql" if using_postgres() else "sqlite",
        "path": "" if using_postgres() else str(LOCAL_DB_PATH),
        "configured": bool(database_url()),
    }
