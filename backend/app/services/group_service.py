from __future__ import annotations

import random
import string
import time
from typing import Any
from . import db_service


def _generate_invite_code(connection: Any) -> str:
    chars = string.ascii_uppercase + string.digits
    placeholder = "%s" if db_service.using_postgres() else "?"
    while True:
        code = "".join(random.choices(chars, k=6))
        cursor = connection.execute(
            f"SELECT id FROM groups WHERE invite_code = {placeholder}",
            (code,),
        )
        if not cursor.fetchone():
            return code


def create_group(name: str, creator_id: int) -> dict[str, Any]:
    if not name.strip():
        raise ValueError("小组名称不能为空")

    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    
    with db_service.connect() as conn:
        invite_code = _generate_invite_code(conn)
        
        # Insert group
        p_name = "%s" if db_service.using_postgres() else "?"
        p_code = "%s" if db_service.using_postgres() else "?"
        p_creator = "%s" if db_service.using_postgres() else "?"
        p_time = "%s" if db_service.using_postgres() else "?"
        
        sql = f"""
        INSERT INTO groups (name, invite_code, creator_id, created_at)
        VALUES ({p_name}, {p_code}, {p_creator}, {p_time})
        """
        cursor = conn.execute(sql, (name.strip(), invite_code, creator_id, now))
        
        # Get group ID
        group_id = cursor.lastrowid
        if not group_id and db_service.using_postgres():
            c2 = conn.execute("SELECT id FROM groups WHERE invite_code = %s", (invite_code,))
            row = c2.fetchone()
            group_id = row["id"] if row else None
            
        if not group_id:
            raise RuntimeError("无法创建小组纪录")
            
        # Add creator to group_members
        sql_member = f"""
        INSERT INTO group_members (group_id, user_id, joined_at)
        VALUES ({p_name}, {p_code}, {p_creator})
        """
        conn.execute(sql_member, (group_id, creator_id, now))
        
        return {
            "id": group_id,
            "name": name.strip(),
            "invite_code": invite_code,
            "creator_id": creator_id,
            "created_at": now,
        }


def join_group(invite_code: str, user_id: int) -> dict[str, Any]:
    code = invite_code.strip().upper()
    if not code:
        raise ValueError("邀请码不能为空")

    p = "%s" if db_service.using_postgres() else "?"
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    with db_service.connect() as conn:
        # Find group
        cursor = conn.execute(
            f"SELECT * FROM groups WHERE invite_code = {p}",
            (code,),
        )
        row = cursor.fetchone()
        if not row:
            raise ValueError("邀请码无效，请确认后重试")
        group = db_service.row_to_dict(row)
        assert group is not None
        group_id = group["id"]

        # Check existing member
        cursor_mem = conn.execute(
            f"SELECT 1 FROM group_members WHERE group_id = {p} AND user_id = {p}",
            (group_id, user_id),
        )
        if cursor_mem.fetchone():
            return group

        # Join member
        conn.execute(
            f"INSERT INTO group_members (group_id, user_id, joined_at) VALUES ({p}, {p}, {p})",
            (group_id, user_id, now),
        )
        return group


def get_user_groups(user_id: int) -> list[dict[str, Any]]:
    p = "%s" if db_service.using_postgres() else "?"
    sql = f"""
    SELECT g.* FROM groups g
    JOIN group_members m ON g.id = m.group_id
    WHERE m.user_id = {p}
    ORDER BY g.id DESC
    """
    with db_service.connect() as conn:
        cursor = conn.execute(sql, (user_id,))
        return [db_service.row_to_dict(r) for r in cursor.fetchall() if r]


def is_group_member(group_id: int, user_id: int) -> bool:
    p = "%s" if db_service.using_postgres() else "?"
    sql = f"SELECT 1 FROM group_members WHERE group_id = {p} AND user_id = {p}"
    with db_service.connect() as conn:
        cursor = conn.execute(sql, (group_id, user_id))
        return bool(cursor.fetchone())


def get_group_details(group_id: int, user_id: int) -> dict[str, Any]:
    if not is_group_member(group_id, user_id):
        raise ValueError("您不属于该学习小组，无权查看信息。")

    p = "%s" if db_service.using_postgres() else "?"
    
    with db_service.connect() as conn:
        # Get group info
        cursor_g = conn.execute("SELECT * FROM groups WHERE id = " + p, (group_id,))
        group_row = cursor_g.fetchone()
        if not group_row:
            raise ValueError("小组不存在")
        group = db_service.row_to_dict(group_row)
        assert group is not None

        # Get members list
        sql_m = """
        SELECT u.id, u.username, m.joined_at FROM users u
        JOIN group_members m ON u.id = m.user_id
        WHERE m.group_id = %s
        ORDER BY m.joined_at ASC
        """ if db_service.using_postgres() else """
        SELECT u.id, u.username, m.joined_at FROM users u
        JOIN group_members m ON u.id = m.user_id
        WHERE m.group_id = ?
        ORDER BY m.joined_at ASC
        """
        cursor_m = conn.execute(sql_m, (group_id,))
        members = [db_service.row_to_dict(r) for r in cursor_m.fetchall() if r]

        return {
            "group": group,
            "members": members,
        }
