from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np


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
    ink_strength = cv2.GaussianBlur(ink_strength, (0, 0), 1.35)

    distance = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    distance_values = distance[ink]
    max_distance = float(np.percentile(distance_values, 99)) if distance_values.size else 0.0
    if max_distance <= 0:
        max_distance = float(distance.max())
    dome = np.clip(distance / max(max_distance, 1.0), 0.0, 1.0)
    dome = np.power(dome, 0.62)
    dome = cv2.GaussianBlur(dome, (0, 0), 1.15)

    soft_edge = cv2.GaussianBlur(mask.astype(np.float32) / 255.0, (0, 0), 2.4)
    relief = (0.46 * ink_strength + 0.54 * dome) * (0.42 + 0.58 * dome) * soft_edge
    relief[~ink] = 0.0
    relief = cv2.GaussianBlur(relief, (0, 0), 2.2)
    relief = np.clip(relief, 0.0, 1.0)
    cap = float(np.percentile(relief[ink], 99.4))
    if cap > 0:
        relief = np.clip(relief / cap, 0.0, 1.0)
    return np.round(relief * 225).astype(np.uint8)


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

    report = {
        "source": "OpenCV 本地图像处理",
        "width": width_px,
        "height": height_px,
        "ink_pixels": int(np.count_nonzero(mask)),
        "ink_ratio": round(float(np.count_nonzero(mask)) / float(width_px * height_px), 4),
        "outputs": ["thumbnail.png", "mask.png", "height.png", "binary.png", "ink_density.png"],
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
