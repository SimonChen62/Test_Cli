from __future__ import annotations

from pydantic import BaseModel, Field


class WorkInfo(BaseModel):
    id: str
    title: str
    artist: str = ""
    dynasty: str = ""
    date: str = ""
    script_type: str = ""
    museum: str = ""
    description: str = ""
    thumbnail: str = "thumbnail.png"
    status: str = "ready"
    source: str = ""
    source_url: str = ""
    tags: list[str] = Field(default_factory=list)


class WorksIndex(BaseModel):
    defaultWorkId: str
    works: list[WorkInfo]

