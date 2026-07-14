from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from .paths import DATA_DIR, KNOWLEDGE_DIR
from . import llm_service


@dataclass
class Chunk:
    id: str
    work_id: str
    title: str
    text: str
    source: str = "项目知识库"
    source_url: str = ""
    tags: tuple[str, ...] = ()


def _load_json_chunks(path: Path) -> list[Chunk]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    items = data if isinstance(data, list) else data.get("chunks", [])
    chunks: list[Chunk] = []
    for item in items:
        chunks.append(
            Chunk(
                id=str(item.get("id", path.stem)),
                work_id=str(item.get("work_id", "global")),
                title=str(item.get("title", "")),
                text=str(item.get("text", "")),
                source=str(item.get("source", "项目知识库")),
                source_url=str(item.get("source_url", item.get("url", ""))),
                tags=tuple(item.get("tags", [])),
            )
        )
    return chunks


def _load_markdown_chunks(path: Path) -> list[Chunk]:
    if not path.exists():
        return []
    text = path.read_text(encoding="utf-8")
    source = "项目知识库"
    source_url = ""
    source_match = re.search(r"^source:\s*(.+)$", text, re.MULTILINE)
    url_match = re.search(r"^source_url:\s*(.+)$", text, re.MULTILINE)
    if source_match:
        source = source_match.group(1).strip()
    if url_match:
        source_url = url_match.group(1).strip()

    parts = re.split(r"(?m)^##\s+", text)
    chunks: list[Chunk] = []
    for idx, part in enumerate(parts):
        part = part.strip()
        if not part or part.startswith("#"):
            continue
        lines = part.splitlines()
        title = lines[0].strip()
        body = "\n".join(lines[1:]).strip()
        if body:
            chunks.append(
                Chunk(
                    id=f"{path.stem}_{idx}",
                    work_id="global" if path.stem != "guangfu-tower-record" else "work_003",
                    title=title,
                    text=body,
                    source=source,
                    source_url=source_url,
                    tags=tuple(re.findall(r"[\u4e00-\u9fff]{2,}|[A-Za-z0-9]+", title)),
                )
            )
    return chunks


def load_chunks() -> list[Chunk]:
    chunks: list[Chunk] = []
    for path in sorted(KNOWLEDGE_DIR.glob("*.md")):
        chunks.extend(_load_markdown_chunks(path))
    for path in sorted(DATA_DIR.glob("work_*/knowledge.json")):
        chunks.extend(_load_json_chunks(path))
    return [chunk for chunk in chunks if chunk.text.strip()]


def _terms(value: str) -> set[str]:
    value = value.lower()
    words = set(re.findall(r"[a-z0-9]+", value))
    for run in re.findall(r"[\u4e00-\u9fff]{2,}", value):
        words.add(run)
        for size in (2, 3, 4):
            if len(run) >= size:
                words.update(run[index : index + size] for index in range(len(run) - size + 1))
    return words


def _technical_overlap_bonus(question: str, haystack: str) -> float:
    question_lower = question.lower()
    haystack_lower = haystack.lower()
    bonus = 0.0
    for term in ("opencv", "three", "three.js", "rag", "api", "key", "webxr", "inkverse"):
        if term in question_lower and term in haystack_lower:
            bonus += 5.0
    return bonus


def search(question: str, work_id: str = "work_003", limit: int = 5) -> list[Chunk]:
    query_terms = _terms(question)
    scored: list[tuple[float, Chunk]] = []
    for chunk in load_chunks():
        if chunk.work_id not in {work_id, "global"}:
            continue
        haystack = " ".join([chunk.title, chunk.text, " ".join(chunk.tags)]).lower()
        title_terms = _terms(chunk.title)
        text_terms = _terms(haystack)
        score = 0.0
        score += len(query_terms & title_terms) * 3.0
        score += len(query_terms & text_terms)
        score += _technical_overlap_bonus(question, haystack)
        for tag in chunk.tags:
            if tag and tag.lower() in question.lower():
                score += 4.0
        relevance_score = score
        if chunk.work_id == work_id:
            score += 0.6
        normalized_question = re.sub(r"\s+", "", question)
        normalized_title = re.sub(r"\s+", "", chunk.title)
        if normalized_title and normalized_title in normalized_question:
            score += 12.0
            relevance_score += 12.0
        if "谁" in question and "赵孟頫" in question and "赵孟頫" in chunk.title:
            score += 8.0
            relevance_score += 8.0
        if "什么" in question and "光福重建塔记" in question and "光福重建塔记" in chunk.title:
            score += 8.0
            relevance_score += 8.0
        if relevance_score >= 2.0:
            scored.append((score, chunk))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [chunk for _, chunk in scored[:limit]]


def answer(question: str, work_id: str = "work_003", ask_mode: str = "local", llm_available: bool = False) -> dict[str, object]:
    ask_mode = ask_mode if ask_mode in {"local", "ai_rag", "ai_free"} else "local"
    ai_requested = ask_mode in {"ai_rag", "ai_free"}
    chunks = search(question, work_id=work_id)
    if not chunks:
        if ask_mode == "ai_free" and llm_available:
            answer_text, provider = llm_service.general_answer(question, "")
            return {
                "answer": f"（AI 补充回答：当前本地 RAG 没有匹配到明确资料，以下内容不是本地知识库来源。）\n\n{answer_text}",
                "sources": [
                    {
                        "title": "AI 模型补充（非本地知识库来源）",
                        "source": provider,
                        "url": "",
                        "work_id": "ai",
                    }
                ],
                "mode": f"ai_free_{provider}",
            }
        if ai_requested and not llm_available:
            return {
                "answer": "AI 未启用或不可用；本地 RAG 也没有查询到对应资料。请先在管理员后台配置可用的 AI 接口，或补充作品资料后再提问。",
                "sources": [],
                "mode": "ai_requested_unavailable",
            }
        return {
            "answer": "当前资料不足，无法给出有依据的回答。请补充作品说明、背景资料或术语解释后再提问。",
            "sources": [],
            "mode": "local_rag",
        }

    lead = chunks[0]
    supporting = "；".join(chunk.title for chunk in chunks[1:3])
    answer_text = (
        f"根据当前资料，{lead.text.strip()}\n\n"
        "需要注意：系统只依据本地知识库回答，不会自动评价书法水平，也不会恢复真实笔顺。"
    )
    if supporting:
        answer_text += f"\n\n相关资料还包括：{supporting}。"
    mode = "local_rag"
    if ai_requested and not llm_available:
        answer_text = f"（AI 未启用或不可用，以下为本地 RAG 检索结果。）\n\n{answer_text}"
        mode = "ai_requested_unavailable"
    elif ask_mode == "ai_rag" and llm_available:
        context = "\n\n".join(
            f"资料标题：{chunk.title}\n来源：{chunk.source}\n正文：{chunk.text}"
            for chunk in chunks
        )
        answer_text, provider = llm_service.enhance_answer(question, context, answer_text)
        mode = f"llm_{provider}" if provider != "local_rag" else "local_rag"
    elif ask_mode == "ai_free" and llm_available:
        context = "\n\n".join(
            f"资料标题：{chunk.title}\n来源：{chunk.source}\n正文：{chunk.text}"
            for chunk in chunks
        )
        answer_text, provider = llm_service.general_answer(question, context)
        answer_text = f"（AI 补充回答：优先参考下方本地资料；若资料不足，模型会补充一般性说明。）\n\n{answer_text}"
        mode = f"ai_free_{provider}"
    return {
        "answer": answer_text,
        "sources": [
            {
                "title": chunk.title,
                "source": chunk.source,
                "url": chunk.source_url,
                "work_id": chunk.work_id,
            }
            for chunk in chunks
        ],
        "mode": mode,
    }
