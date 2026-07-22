from __future__ import annotations

import json
import shutil
from pathlib import Path

import cv2
import numpy as np

AUTO_SCROLL_DIR = "full_scroll_glyphs"


def _read_image(path: Path) -> np.ndarray:
    data = np.fromfile(str(path), dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"无法读取图片：{path}")
    return image


def _write_image(path: Path, image: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ok, encoded = cv2.imencode(path.suffix or ".png", image)
    if not ok:
        raise RuntimeError(f"无法写入图片：{path}")
    encoded.tofile(str(path))


def _ink_mask_and_height(image: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, mask = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)

    height = _make_relief_height(gray, mask)
    return gray, mask, height


def _normalize_ink_values(values: np.ndarray) -> np.ndarray:
    if values.size == 0:
        return values.astype(np.float32)
    low, high = np.percentile(values, [2, 98])
    if high <= low:
        low, high = float(values.min()), float(values.max())
    if high <= low:
        return np.zeros_like(values, dtype=np.float32)
    return np.clip((values.astype(np.float32) - low) / (high - low), 0.0, 1.0)


def _make_relief_height(gray: np.ndarray, mask: np.ndarray) -> np.ndarray:
    ink = mask > 0
    if not np.any(ink):
        return np.zeros_like(gray, dtype=np.uint8)

    darkness = (255 - gray).astype(np.float32)
    ink_strength = np.zeros_like(darkness, dtype=np.float32)
    ink_strength[ink] = _normalize_ink_values(darkness[ink])
    ink_strength = cv2.GaussianBlur(ink_strength, (0, 0), 1.05)

    distance = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    distance_values = distance[ink]
    max_distance = float(np.percentile(distance_values, 99)) if distance_values.size else 0.0
    if max_distance <= 0:
        max_distance = float(distance.max())
    dome = np.clip(distance / max(max_distance, 1.0), 0.0, 1.0)
    dome = np.power(dome, 0.58)
    dome = cv2.GaussianBlur(dome, (0, 0), 0.95)

    soft_edge = cv2.GaussianBlur(mask.astype(np.float32) / 255.0, (0, 0), 2.0)
    relief = (0.58 * ink_strength + 0.42 * dome) * (0.5 + 0.5 * dome) * soft_edge
    relief[~ink] = 0.0
    relief = cv2.GaussianBlur(relief, (0, 0), 1.65)
    relief = np.clip(relief, 0.0, 1.0)
    cap = float(np.percentile(relief[ink], 99.2))
    if cap > 0:
        relief = np.clip(relief / cap, 0.0, 1.0)
    return np.round(relief * 245).astype(np.uint8)


def _clean_crop_mask(mask: np.ndarray) -> np.ndarray:
    cleaned = mask.copy()
    labels_count, labels, stats, _centroids = cv2.connectedComponentsWithStats(cleaned, 8)
    min_area = max(10, int(cleaned.shape[0] * cleaned.shape[1] * 0.0012))
    keep = np.zeros(cleaned.shape, dtype=np.uint8)
    for idx in range(1, labels_count):
        if stats[idx, cv2.CC_STAT_AREA] >= min_area:
            keep[labels == idx] = 255
    kernel = np.ones((2, 2), np.uint8)
    return cv2.morphologyEx(keep, cv2.MORPH_CLOSE, kernel, iterations=1)


def _glyph_mask_rgba(crop: np.ndarray, mask: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    darkness = np.clip(255 - gray, 0, 255)
    rgba = np.zeros((*mask.shape, 4), dtype=np.uint8)
    ink_tone = np.clip(42 - (darkness * 0.07), 12, 42).astype(np.uint8)
    rgba[..., 0] = ink_tone
    rgba[..., 1] = np.clip(ink_tone * 0.88, 10, 38).astype(np.uint8)
    rgba[..., 2] = np.clip(ink_tone * 0.74, 8, 34).astype(np.uint8)
    rgba[..., 3] = cv2.GaussianBlur(mask, (0, 0), 0.45)
    return rgba


def _glyph_height(mask: np.ndarray) -> np.ndarray:
    distance = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    if distance.max() > 0:
        height = cv2.normalize(distance, None, 0, 255, cv2.NORM_MINMAX)
    else:
        height = distance
    height = height.astype(np.uint8)
    height[mask == 0] = 0
    return height


def _pad_box(
    box: tuple[int, int, int, int],
    image_width: int,
    image_height: int,
    padding: int,
) -> dict[str, int]:
    x, y, width, height = box
    left = max(0, x - padding)
    top = max(0, y - padding)
    right = min(image_width, x + width + padding)
    bottom = min(image_height, y + height + padding)
    return {"x": left, "y": top, "width": right - left, "height": bottom - top}


def _sort_scroll_boxes(boxes: list[dict[str, int]]) -> list[dict[str, int]]:
    return sorted(boxes, key=lambda box: (-box["x"], box["y"], box["width"] * box["height"]))


def _boolean_runs(active: np.ndarray) -> list[tuple[bool, int, int]]:
    runs: list[tuple[bool, int, int]] = []
    index = 0
    while index < active.size:
        state = bool(active[index])
        start = index
        while index < active.size and bool(active[index]) == state:
            index += 1
        runs.append((state, start, index))
    return runs


def _fill_tiny_projection_gaps(active: np.ndarray, max_gap: int) -> np.ndarray:
    if active.size == 0 or max_gap <= 0:
        return active
    closed = active.copy()
    for state, start, end in _boolean_runs(active):
        if not state and end - start <= max_gap:
            closed[start:end] = True
    return closed


def _projection_threshold(values: np.ndarray) -> float:
    nonzero = values[values > 0]
    if nonzero.size == 0:
        return 1.0
    return max(1.0, min(float(values.max()) * 0.08, float(np.percentile(nonzero, 55)) * 0.55))


def _adaptive_gap_threshold(gaps: list[int], min_gap: int, sensitivity: float = 1.0) -> float:
    usable = np.array([gap for gap in gaps if gap >= min_gap], dtype=np.float32)
    if usable.size == 0:
        return float(min_gap)
    median = float(np.median(usable))
    p75 = float(np.percentile(usable, 75))
    p90 = float(np.percentile(usable, 90))
    return max(float(min_gap), median * 1.55 * sensitivity, p75 * 1.18 * sensitivity, p90 * 0.78 * sensitivity)


def _projection_runs(values: np.ndarray, min_gap: int, min_run: int, sensitivity: float = 1.0) -> list[tuple[int, int]]:
    if values.size == 0:
        return []
    values = values.astype(np.float32)
    if values.size >= 9:
        values = cv2.GaussianBlur(values.reshape(1, -1), (1, 9), 0).reshape(-1)

    active = values > _projection_threshold(values)
    active = _fill_tiny_projection_gaps(active, max(1, min_gap // 2))

    ink_runs = [(start, end) for state, start, end in _boolean_runs(active) if state]
    if not ink_runs:
        return []
    if len(ink_runs) == 1:
        start, end = ink_runs[0]
        return [(start, end)] if end - start >= min_run else []

    gaps: list[tuple[int, int, int]] = []
    for left, right in zip(ink_runs, ink_runs[1:]):
        gap_start = left[1]
        gap_end = right[0]
        if gap_end > gap_start:
            gaps.append((gap_start, gap_end, gap_end - gap_start))
    split_threshold = _adaptive_gap_threshold([gap for _start, _end, gap in gaps], min_gap, sensitivity=sensitivity)

    split_points: list[int] = []
    overall_start = ink_runs[0][0]
    overall_end = ink_runs[-1][1]
    for gap_start, gap_end, gap in gaps:
        left_span = gap_start - overall_start
        right_span = overall_end - gap_end
        if left_span < min_run or right_span < min_run:
            continue
        local_left = next((end - start for start, end in reversed(ink_runs) if end <= gap_start), min_run)
        local_right = next((end - start for start, end in ink_runs if start >= gap_end), min_run)
        neighbor_gate = max(float(min_gap), min(local_left, local_right) * 0.32 * sensitivity)
        if gap >= split_threshold or gap >= neighbor_gate:
            split_points.append((gap_start + gap_end) // 2)

    if not split_points:
        return [(overall_start, overall_end)] if overall_end - overall_start >= min_run else []

    runs: list[tuple[int, int]] = []
    start = overall_start
    for split in split_points:
        if split - start >= min_run:
            runs.append((start, split))
        start = split
    if overall_end - start >= min_run:
        runs.append((start, overall_end))
    return runs


def _split_box_by_projection(ink_mask: np.ndarray, box: tuple[int, int, int, int], scale: float) -> list[tuple[int, int, int, int]]:
    x, y, width, height = box
    crop = ink_mask[y : y + height, x : x + width]
    if crop.size == 0:
        return [box]

    min_gap = max(4, int(round(5 * scale)))
    min_run = max(15, int(round(18 * scale)))
    slender_vertical = height / max(1, width) >= 1.75

    if height > max(86, width * 1.35):
        row_min_gap = max(3, int(round((3 if slender_vertical else 5) * scale)))
        row_min_run = max(12, int(round((13 if slender_vertical else 18) * scale)))
        row_sensitivity = 0.72 if slender_vertical else 1.0
        row_runs = _projection_runs(
            np.count_nonzero(crop, axis=1),
            min_gap=row_min_gap,
            min_run=row_min_run,
            sensitivity=row_sensitivity,
        )
        if len(row_runs) > 1:
            split_boxes = [(x, y + start, width, end - start) for start, end in row_runs]
            return [item for child in split_boxes for item in _split_box_by_projection(ink_mask, child, scale)]

    if width > max(90, height * 1.45):
        col_runs = _projection_runs(np.count_nonzero(crop, axis=0), min_gap=min_gap, min_run=min_run)
        if len(col_runs) > 1:
            split_boxes = [(x + start, y, end - start, height) for start, end in col_runs]
            return [item for child in split_boxes for item in _split_box_by_projection(ink_mask, child, scale)]

    return [box]


def _detect_scroll_boxes(ink_mask: np.ndarray) -> list[dict[str, int]]:
    height, width = ink_mask.shape
    scale = max(1.0, min(width, height) / 1600)
    kernel_size = max(5, int(round(15 * scale)))
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
    merged = cv2.morphologyEx(ink_mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    labels_count, _labels, stats, _centroids = cv2.connectedComponentsWithStats(merged, 8)

    boxes: list[dict[str, int]] = []
    min_area = max(180, int(width * height * 0.000006))
    max_area = int(width * height * 0.035)
    max_box_size = max(360, int(min(width, height) * 0.42))
    for idx in range(1, labels_count):
        x, y, box_width, box_height, area = [int(value) for value in stats[idx]]
        if area < min_area or area > max_area:
            continue
        if box_width < 14 or box_height < 18:
            continue
        if box_width > max_box_size or box_height > max_box_size:
            continue
        aspect = box_width / max(1, box_height)
        if aspect < 0.12 or aspect > 4.2:
            continue
        for split_box in _split_box_by_projection(ink_mask, (x, y, box_width, box_height), scale):
            split_x, split_y, split_width, split_height = split_box
            if split_width < 14 or split_height < 18:
                continue
            split_aspect = split_width / max(1, split_height)
            if split_aspect < 0.1 or split_aspect > 4.5:
                continue
            boxes.append(_pad_box(split_box, width, height, padding=max(5, int(8 * scale))))

    if boxes:
        return boxes

    points = cv2.findNonZero(ink_mask)
    if points is None:
        return []
    x, y, box_width, box_height = cv2.boundingRect(points)
    return [_pad_box((x, y, box_width, box_height), width, height, padding=max(8, int(12 * scale)))]


def _write_scroll_detection_preview(source: np.ndarray, boxes: list[dict[str, int]], output_path: Path) -> None:
    preview = source.copy()
    for box in boxes:
        x, y, width, height = box["x"], box["y"], box["width"], box["height"]
        cv2.rectangle(preview, (x, y), (x + width, y + height), (40, 70, 230), 2)
    if preview.shape[1] > 2600:
        preview_height = int(round(preview.shape[0] * 2600 / preview.shape[1]))
        preview = cv2.resize(preview, (2600, preview_height), interpolation=cv2.INTER_AREA)
    _write_image(output_path, preview)


def _generate_scroll_glyph_assets(work_dir: Path, image: np.ndarray, mask: np.ndarray) -> list[str]:
    output_dir = work_dir / AUTO_SCROLL_DIR
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    boxes = _sort_scroll_boxes(_detect_scroll_boxes(mask))[:1200]
    records: list[dict[str, object]] = []
    web_dir = f"data/{work_dir.name}/{AUTO_SCROLL_DIR}"
    for index, box in enumerate(boxes, start=1):
        glyph_id = f"glyph_{index:04d}"
        x, y, width, height = box["x"], box["y"], box["width"], box["height"]
        crop = image[y : y + height, x : x + width]
        crop_mask = _clean_crop_mask(mask[y : y + height, x : x + width])
        mask_file = f"{glyph_id}_mask.png"
        height_file = f"{glyph_id}_height.png"
        _write_image(output_dir / mask_file, _glyph_mask_rgba(crop, crop_mask))
        _write_image(output_dir / height_file, _glyph_height(crop_mask))
        records.append(
            {
                "id": glyph_id,
                "char": glyph_id,
                "scroll_x": int(x),
                "scroll_y": int(y),
                "width": int(width),
                "height": int(height),
                "img_path": f"{web_dir}/{mask_file}",
                "height_path": f"{web_dir}/{height_file}",
            }
        )

    (work_dir / "full_scroll_3d_data.json").write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    _write_scroll_detection_preview(image, boxes, work_dir / "full_scroll_detection_preview.png")
    return ["full_scroll_3d_data.json", "full_scroll_detection_preview.png", AUTO_SCROLL_DIR]


def process_work_dir(work_dir: Path) -> dict[str, object]:
    original = work_dir / "original.png"
    if not original.exists():
        raise FileNotFoundError(f"缺少作品原图：{original}")

    image = _read_image(original)
    height_px, width_px = image.shape[:2]
    gray, mask, height = _ink_mask_and_height(image)

    mask_rgba = np.zeros((height_px, width_px, 4), dtype=np.uint8)
    mask_rgba[..., 0] = 26
    mask_rgba[..., 1] = 22
    mask_rgba[..., 2] = 18
    mask_rgba[..., 3] = mask

    binary = cv2.cvtColor(255 - mask, cv2.COLOR_GRAY2BGR)
    density = cv2.applyColorMap(height, cv2.COLORMAP_BONE)
    density[mask == 0] = (246, 241, 231)

    thumb_width = min(1200, width_px)
    thumb_height = max(1, int(height_px * thumb_width / width_px))
    thumbnail = cv2.resize(image, (thumb_width, thumb_height), interpolation=cv2.INTER_AREA)

    _write_image(work_dir / "mask.png", mask_rgba)
    _write_image(work_dir / "height.png", height)
    _write_image(work_dir / "binary.png", binary)
    _write_image(work_dir / "ink_density.png", density)
    _write_image(work_dir / "thumbnail.png", thumbnail)
    scroll_outputs = _generate_scroll_glyph_assets(work_dir, image, mask)

    report = {
        "source": "OpenCV 本地图像处理",
        "width": width_px,
        "height": height_px,
        "ink_pixels": int(np.count_nonzero(mask)),
        "ink_ratio": round(float(np.count_nonzero(mask)) / float(width_px * height_px), 4),
        "outputs": ["thumbnail.png", "mask.png", "height.png", "binary.png", "ink_density.png", *scroll_outputs],
    }
    (work_dir / "processing-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    floating = {
        "type": "floating_scroll",
        "scroll_size": {"width": width_px, "height": height_px},
        "paper_texture": "original.png",
        "mask": "mask.png",
        "height": "height.png",
        "displacement": {"scale": 0.42, "bias": 0.08},
        "note": "墨迹深浅转换为平滑浮雕高度；不代表真实笔顺或书法水平判断。",
    }
    (work_dir / "floating_3d_data.json").write_text(
        json.dumps(floating, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return report
