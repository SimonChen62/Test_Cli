from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from . import llm_service


def _work_context(work: dict[str, Any]) -> str:
    return (
        f"作品名称：{work.get('title') or '未填写'}\n"
        f"作者：{work.get('artist') or '未填写'}\n"
        f"朝代/年代：{work.get('dynasty') or work.get('date') or '未填写'}\n"
        f"书体：{work.get('script_type') or '未填写'}\n"
        f"馆藏/出处：{work.get('museum') or work.get('source') or '未填写'}\n"
        f"资料来源 URL：{work.get('source_url') or '未填写'}\n"
        f"简介：{work.get('description') or '未填写'}\n"
        f"背景：{work.get('background') or '未填写'}\n"
        f"关键词：{', '.join(work.get('tags') or []) if isinstance(work.get('tags'), list) else work.get('tags') or '未填写'}"
    )


def _missing_quality_fields(work: dict[str, Any]) -> list[str]:
    missing: list[str] = []
    if not (work.get("artist") or "").strip():
        missing.append("作者")
    if not ((work.get("dynasty") or "").strip() or (work.get("date") or "").strip()):
        missing.append("年代")
    source = (work.get("source") or "").strip()
    generic_source = "管理员" in source or "上传" in source
    if not ((work.get("source_url") or "").strip() or (work.get("museum") or "").strip() or (source and not generic_source)):
        missing.append("资料来源")
    return missing


def _local_question_suggestions(work: dict[str, Any]) -> list[str]:
    title = work.get("title") or "这件作品"
    script_type = work.get("script_type") or "书体"
    questions = [
        f"《{title}》目前有哪些已上传资料？",
        f"可以从哪些角度观察《{title}》？",
        f"什么是{script_type}？" if script_type != "书体" else "可以怎样理解不同书体的基本特点？",
        "可以怎样观察墨色、飞白和留白？",
        "OpenCV 在这件作品的 3D 浮雕处理中做了什么？",
        "如果作品资料不足，RAG 会怎样回答？",
    ]
    if work.get("artist"):
        questions.insert(1, f"{work.get('artist')}和这件作品有什么关系？")
    return questions[:6]


def _parse_question_list(text: str, fallback: list[str]) -> list[str]:
    if not text:
        return fallback
    try:
        match = re.search(r"\[[\s\S]*\]", text)
        if match:
            payload = json.loads(match.group(0))
            if isinstance(payload, list):
                parsed = [str(item).strip() for item in payload if str(item).strip()]
                if parsed:
                    return parsed[:8]
    except json.JSONDecodeError:
        pass

    questions: list[str] = []
    for line in text.splitlines():
        cleaned = re.sub(r"^\s*[-*•\d.、)）]+\s*", "", line).strip().strip('"“”')
        if cleaned and ("?" in cleaned or "？" in cleaned):
            questions.append(cleaned)
    return questions[:8] or fallback


def create_question_draft(work_dir: Path | None, work: dict[str, Any]) -> dict[str, Any]:
    fallback_questions = _local_question_suggestions(work)
    context = _work_context(work)
    fallback = "\n".join(f"{index}. {question}" for index, question in enumerate(fallback_questions, start=1))
    prompt = (
        "请根据资料为管理员生成 5-6 个“推荐提问”草稿，返回 JSON 数组即可。\n"
        "要求：问题必须服务于书法作品导览；不要生成和作品无关的闲聊问题；"
        "资料缺少作者、年代或来源时，不要编造事实，可以生成“当前资料有哪些/还缺什么”的问题；"
        "不要把 AI 推测当作馆藏事实。"
    )
    answer, provider = llm_service.enhance_answer(prompt, context, fallback)
    questions = _parse_question_list(answer, fallback_questions)
    draft = {
        "status": "ai_question_draft" if provider != "local_rag" else "local_question_draft",
        "provider": provider,
        "questions": questions,
        "missing_fields": _missing_quality_fields(work),
        "warning": "这是推荐提问草稿，需管理员确认保存后才会展示给用户。",
    }
    if work_dir is not None:
        (work_dir / "question-draft.json").write_text(
            json.dumps(draft, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return draft


def create_appreciation_draft(work_dir: Path | None, work: dict[str, Any]) -> dict[str, Any]:
    report = {}
    report_path = work_dir / "processing-report.json" if work_dir is not None else None
    if report_path and report_path.exists():
        try:
            report = json.loads(report_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            report = {}
    context = (
        f"{_work_context(work)}\n"
        f"图像尺寸：{report.get('width') or '未记录'}x{report.get('height') or '未记录'}\n"
        f"墨迹占比：{report.get('ink_ratio') or '未记录'}"
    )
    fallback = (
        "这是一段管理员待确认的全文赏析草稿。可以从作品整体布局、墨色轻重、飞白细线、留白关系和 3D 浮雕展示方式入手理解。"
        "当前资料不足时，应明确说明哪些内容来自已上传资料，哪些只是一般性观察建议。"
    )
    answer, provider = llm_service.enhance_answer(
        "请生成一段 120-180 字的书法作品全文赏析导览草稿。要求：面向普通观众；只根据资料和可观察图像处理信息表达；不要判断真伪、不要评价书法好坏、不要声称恢复笔顺；如果资料不足要说明。",
        context,
        fallback,
    )
    draft = {
        "status": "ai_appreciation_draft" if provider != "local_rag" else "local_appreciation_draft",
        "provider": provider,
        "guideText": answer,
        "missing_fields": _missing_quality_fields(work),
        "warning": "这是全文赏析草稿，需管理员确认保存后才会展示给用户。",
    }
    if work_dir is not None:
        (work_dir / "appreciation-draft.json").write_text(
            json.dumps(draft, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return draft


def save_manual_annotation(work_dir: Path, work: dict[str, Any], annotations_json: str = "", guide_text: str = "") -> list[str]:
    annotations: list[dict[str, Any]] = []
    if annotations_json.strip():
        loaded = json.loads(annotations_json)
        if not isinstance(loaded, list):
            raise ValueError("manual_annotations_json must be a list")
        annotations = loaded
    if not annotations and not guide_text.strip():
        return []
    payload = {
        "workId": work.get("id"),
        "title": work.get("title") or work.get("id") or "上传作品",
        "style": " / ".join(str(part) for part in [work.get("dynasty"), work.get("script_type")] if part),
        "source": "管理员人工标注",
        "images": {
            "original": "original.png",
            "binary": "binary.png",
            "skeleton": "skeleton.png",
            "strokeWidth": "ink_density.png",
            "inkDensity": "ink_density.png",
            "voidCandidates": "mask.png",
        },
        "guideText": guide_text.strip() or "管理员已为该上传作品保存人工框选导览点。请先看整体，再逐个查看观察点。",
        "guideKind": "admin_manual",
        "annotations": annotations,
    }
    (work_dir / "annotation.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return ["annotation.json"]


def _read_gray(path: Path) -> np.ndarray | None:
    data = np.fromfile(str(path), dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_GRAYSCALE)
    return image


def _box_from_contour(contour: np.ndarray, width: int, height: int, padding: float = 0.018) -> dict[str, float]:
    x, y, w, h = cv2.boundingRect(contour)
    pad_x = int(width * padding)
    pad_y = int(height * padding)
    x = max(0, x - pad_x)
    y = max(0, y - pad_y)
    w = min(width - x, w + pad_x * 2)
    h = min(height - y, h + pad_y * 2)
    return {
        "x": round(x / width * 100, 2),
        "y": round(y / height * 100, 2),
        "width": round(w / width * 100, 2),
        "height": round(h / height * 100, 2),
    }


def _candidate_boxes(work_dir: Path) -> list[dict[str, float]]:
    mask = _read_gray(work_dir / "height.png")
    if mask is None:
        return []
    height, width = mask.shape[:2]
    _, binary = cv2.threshold(mask, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    min_area = max(64, width * height * 0.00018)
    contours = [contour for contour in contours if cv2.contourArea(contour) >= min_area]
    contours.sort(key=cv2.contourArea, reverse=True)
    boxes = [_box_from_contour(contour, width, height) for contour in contours[:3]]
    if not boxes:
        boxes = [
            {"x": 38.0, "y": 32.0, "width": 18.0, "height": 18.0},
            {"x": 58.0, "y": 26.0, "width": 16.0, "height": 22.0},
            {"x": 46.0, "y": 58.0, "width": 24.0, "height": 18.0},
        ]
    return boxes


def _base_annotations(boxes: list[dict[str, float]]) -> list[dict[str, Any]]:
    templates = [
        {
            "id": "ai_brush_1",
            "type": "brush_ink",
            "label": "AI候选：重墨区域",
            "formal": "系统根据墨迹高度图找到一处墨色较重、视觉重量较集中的候选区域。",
            "perception": "这里可以用来观察重墨、转折或停顿感，但仍需要对照原图复核。",
            "aesthetic": "这是 AI/算法候选导览，不等同于专家判断；管理员确认前不能作为正式导览。",
            "concept": "墨色",
        },
        {
            "id": "ai_light_1",
            "type": "brush_ink",
            "label": "AI候选：细线与飞白",
            "formal": "系统根据墨迹高度和局部明暗变化找到一处较细、较轻或可能存在飞白的候选区域。",
            "perception": "这里可以用来观察轻重变化、干湿变化或笔画边缘的细节。",
            "aesthetic": "AI 只提示可观察的图像线索，不判断真实用笔力度，也不恢复笔顺。",
            "concept": "飞白",
        },
        {
            "id": "ai_void_1",
            "type": "void_solid",
            "label": "AI候选：留白关系",
            "formal": "系统根据墨迹稀疏和周边结构给出一处可观察留白关系的候选区域。",
            "perception": "这里适合观察疏密、行距、字距或视觉停顿。",
            "aesthetic": "留白解释仍需要人工判断；AI 只提供可复核的候选入口，不自动评价章法水平。",
            "concept": "留白",
        },
    ]
    annotations: list[dict[str, Any]] = []
    for template, box in zip(templates, boxes):
        annotations.append(
            {
                **template,
                "box": box,
                "evidenceLayers": ["original", "inkDensity", "strokeWidth"],
                "reflection": {
                    "concept": template["concept"],
                    "prompt": "请对照原图判断这个候选点是否真的适合讲解。",
                    "expertFeedback": "这是 AI 候选草稿，正式展示前需要管理员确认、修改或删除。",
                },
            }
        )
    return annotations


def create_ai_guide_draft(work_dir: Path, work: dict[str, Any], report: dict[str, Any]) -> dict[str, Any]:
    boxes = _candidate_boxes(work_dir)
    annotations = _base_annotations(boxes)
    title = work.get("title") or work.get("id") or "上传作品"
    context = (
        f"作品名称：{title}\n"
        f"作者：{work.get('artist') or '未填写'}\n"
        f"书体：{work.get('script_type') or '未填写'}\n"
        f"简介：{work.get('description') or '未填写'}\n"
        f"背景：{work.get('background') or '未填写'}\n"
        f"图像尺寸：{report.get('width')}x{report.get('height')}\n"
        f"墨迹占比：{report.get('ink_ratio')}"
    )
    fallback = (
        "这是上传作品的 AI 候选导览草稿。系统只根据作品资料、OpenCV 墨迹高度图和候选区域生成重墨、细线/飞白、留白等观察入口；"
        "这些内容需要管理员确认后才能作为正式导览。"
    )
    summary, provider = llm_service.enhance_answer(
        "请为这件书法作品生成一段简短的候选导览说明。只讲可观察的重墨、细线/飞白、留白和整体风格，不要声称识别气脉、笔顺、真伪或书法水平；强调需要人工确认。",
        context,
        fallback,
    )
    draft = {
        "status": "ai_draft",
        "provider": provider,
        "title": f"{title} AI候选导览草稿",
        "guideText": summary,
        "warning": "AI/算法候选导览，仅用于辅助管理员初筛；不代表专家判断，不自动识别真实笔顺、气脉、真伪或书法水平。",
        "annotations": annotations,
    }
    (work_dir / "ai-guide-draft.json").write_text(
        json.dumps(draft, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return draft
