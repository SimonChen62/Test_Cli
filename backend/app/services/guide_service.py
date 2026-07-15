from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from . import llm_service


GUIDE_TYPES = {"qi_flow", "void_solid", "brush_ink"}


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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


def load_guide_state(work_dir: Path) -> dict[str, Any]:
    official = _read_json(work_dir / "annotation.json", None)
    draft = _read_json(work_dir / "ai-guide-draft.json", None)
    return {
        "has_official": bool(official),
        "has_ai_draft": bool(draft),
        "official": official,
        "draft": draft,
    }


def _normalize_box(box: Any) -> dict[str, float] | None:
    if not isinstance(box, dict):
        return None
    try:
        x = float(box.get("x", 0))
        y = float(box.get("y", 0))
        width = float(box.get("width", 0))
        height = float(box.get("height", 0))
    except (TypeError, ValueError):
        return None
    width = max(0.2, min(width, 100.0))
    height = max(0.2, min(height, 100.0))
    x = max(0.0, min(x, 100.0 - width))
    y = max(0.0, min(y, 100.0 - height))
    return {
        "x": round(x, 2),
        "y": round(y, 2),
        "width": round(width, 2),
        "height": round(height, 2),
    }


def _normalize_annotation(raw: dict[str, Any], index: int) -> dict[str, Any]:
    guide_type = raw.get("type") if raw.get("type") in GUIDE_TYPES else "brush_ink"
    label = str(raw.get("label") or f"观察点 {index + 1}").strip()
    box = _normalize_box(raw.get("box")) or {"x": 8.0, "y": 8.0, "width": 18.0, "height": 18.0}
    annotation_id = str(raw.get("id") or f"manual_{index + 1:03d}").strip()
    if not annotation_id:
        annotation_id = f"manual_{index + 1:03d}"
    reflection = raw.get("reflection") if isinstance(raw.get("reflection"), dict) else {}
    concept = str(reflection.get("concept") or {"qi_flow": "气脉", "void_solid": "虚实", "brush_ink": "笔墨"}[guide_type])
    return {
        "id": annotation_id,
        "type": guide_type,
        "label": label,
        "evidenceLayers": raw.get("evidenceLayers") or ["original", "inkDensity", "strokeWidth"],
        "box": box,
        "formal": str(raw.get("formal") or "管理员已框选该区域，请结合原图观察墨迹、留白或结构变化。").strip(),
        "perception": str(raw.get("perception") or "该区域可作为观众观察作品视觉节奏的入口。").strip(),
        "aesthetic": str(raw.get("aesthetic") or "该解释来自管理员确认，不自动判断书法水平、真伪或真实笔顺。").strip(),
        "reflection": {
            "concept": concept,
            "prompt": str(reflection.get("prompt") or "你在这个区域重新注意到了什么？").strip(),
            "expertFeedback": str(reflection.get("expertFeedback") or "请用可见证据描述，不把候选观察点夸大为唯一结论。").strip(),
        },
    }


def save_official_guide(work_dir: Path, work: dict[str, Any], guide_text: str, annotations: list[dict[str, Any]]) -> dict[str, Any]:
    normalized = [_normalize_annotation(item, index) for index, item in enumerate(annotations)]
    title = work.get("title") or work.get("id") or "上传作品"
    annotation = {
        "workId": work.get("id") or work_dir.name,
        "title": title,
        "style": work.get("script_type") or work.get("style") or "书法作品",
        "source": "管理员确认导览。AI 候选如被采用，已经过管理员审核。",
        "images": {
            "original": "original.png",
            "binary": "binary.png",
            "skeleton": "binary.png",
            "strokeWidth": "height.png",
            "inkDensity": "ink_density.png",
            "voidCandidates": "binary.png",
        },
        "guideText": guide_text.strip()
        or "该作品导览由管理员确认生成。系统只展示可见墨迹、留白和结构观察点，不自动评价书法水平。",
        "guideKind": "admin_confirmed",
        "annotations": normalized,
    }
    _write_json(work_dir / "annotation.json", annotation)
    return annotation
