from __future__ import annotations

from pydantic import BaseModel, Field


class AskRequest(BaseModel):
    work_id: str = Field(default="work_003")
    question: str = Field(min_length=1)
    use_llm: bool = False
    ask_mode: str = Field(default="local")


class Source(BaseModel):
    title: str
    source: str = ""
    url: str = ""
    work_id: str = "global"


class AskResponse(BaseModel):
    answer: str
    sources: list[Source]
    mode: str = "local_rag"
