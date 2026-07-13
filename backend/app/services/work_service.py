from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .paths import DATA_DIR


WORKS_PATH = DATA_DIR / "works.json"


def read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def load_works_index() -> dict[str, Any]:
    return read_json(WORKS_PATH, {"defaultWorkId": "work_003", "works": []})


def save_works_index(index: dict[str, Any]) -> None:
    write_json(WORKS_PATH, index)


def get_work(work_id: str) -> dict[str, Any] | None:
    for work in load_works_index().get("works", []):
        if work.get("id") == work_id:
            detail = read_json(DATA_DIR / work_id / "work-info.json", {})
            return {**work, **detail}
    return None


def next_work_id() -> str:
    used = {
        int(match.group(1))
        for item in load_works_index().get("works", [])
        if (match := re.match(r"work_(\d+)$", item.get("id", "")))
    }
    value = 1
    while value in used:
        value += 1
    return f"work_{value:03d}"


def upsert_work(work: dict[str, Any]) -> None:
    index = load_works_index()
    works = index.setdefault("works", [])
    for idx, item in enumerate(works):
        if item.get("id") == work.get("id"):
            works[idx] = {**item, **work}
            break
    else:
        works.append(work)
    if not index.get("defaultWorkId"):
        index["defaultWorkId"] = work["id"]
    save_works_index(index)


def work_dir(work_id: str) -> Path:
    return DATA_DIR / work_id

