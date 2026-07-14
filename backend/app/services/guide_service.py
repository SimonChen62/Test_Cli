from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from . import llm_service


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
            "label": "AI候选：重墨与转折",
            "formal": "系统根据墨迹高度图找到一处墨色较重、视觉重量较集中的区域。",
            "perception": "这里可以作为观察墨色厚薄和转折停顿的候选位置。",
            "aesthetic": "这是 AI/算法候选导览，不等同于专家判断；管理员需要结合原图确认后再作为正式导览。",
            "concept": "墨色",
        },
        {
            "id": "ai_qi_1",
            "type": "qi_flow",
            "label": "AI候选：走势承接",
            "formal": "系统根据墨迹分布推测这里可能适合观察上下或左右的视觉承接。",
            "perception": "观众可以顺着该区域观察笔势是否形成连续的观看路径。",
            "aesthetic": "这里只能称为候选观察点，不能说系统自动识别了真实气脉或笔顺。",
            "concept": "走势",
        },
        {
            "id": "ai_void_1",
            "type": "void_solid",
            "label": "AI候选：留白关系",
            "formal": "系统根据墨迹稀疏和周边结构给出一处可观察留白关系的候选区域。",
            "perception": "这里适合观察空白如何影响停顿、疏密和观看节奏。",
            "aesthetic": "留白解释仍需要人工判断；AI 只提供可复核的候选入口。",
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
        "这是上传作品的 AI 候选导览草稿。系统根据作品资料和 OpenCV 墨迹高度图生成候选观察点；"
        "这些内容需要管理员确认后才能作为正式导览。"
    )
    summary, provider = llm_service.enhance_answer(
        "请为这件书法作品生成一段简短的候选导览说明，强调需要人工确认。",
        context,
        fallback,
    )
    draft = {
        "status": "ai_draft",
        "provider": provider,
        "title": f"{title} AI候选导览草稿",
        "guideText": summary,
        "warning": "AI/算法候选导览，仅用于辅助管理员初筛；不代表专家判断，不自动识别真实笔顺、气脉或书法水平。",
        "annotations": annotations,
    }
    (work_dir / "ai-guide-draft.json").write_text(
        json.dumps(draft, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return draft
