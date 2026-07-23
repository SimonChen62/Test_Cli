from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np


IMAGE_FILES = {
    "binary": "binary.png",
    "skeleton": "skeleton.png",
    "stroke_width": "stroke_width.png",
    "ink_density": "ink_density.png",
    "void_candidates": "void_candidates.png",
    "mask": "mask.png",
    "height": "height.png",
    "thumbnail": "thumbnail.png",
}


def read_image(path: Path) -> np.ndarray:
    data = np.fromfile(str(path), dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Could not read image: {path}")
    return image


def write_image(path: Path, image: np.ndarray) -> None:
    ext = path.suffix or ".png"
    ok, encoded = cv2.imencode(ext, image)
    if not ok:
        raise RuntimeError(f"Could not encode image: {path}")
    encoded.tofile(str(path))


def build_ink_mask(image: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, ink_mask = cv2.threshold(
        blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )
    kernel = np.ones((3, 3), np.uint8)
    ink_mask = cv2.morphologyEx(ink_mask, cv2.MORPH_OPEN, kernel, iterations=1)
    ink_mask = cv2.morphologyEx(ink_mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    return gray, ink_mask


def make_binary(ink_mask: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(255 - ink_mask, cv2.COLOR_GRAY2BGR)


def make_skeleton(ink_mask: np.ndarray) -> np.ndarray:
    mask = (ink_mask > 0).astype(np.uint8) * 255
    skel = np.zeros(mask.shape, np.uint8)
    element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))

    while cv2.countNonZero(mask) > 0:
        opened = cv2.morphologyEx(mask, cv2.MORPH_OPEN, element)
        temp = cv2.subtract(mask, opened)
        eroded = cv2.erode(mask, element)
        skel = cv2.bitwise_or(skel, temp)
        mask = eroded

    skeleton = np.full((*skel.shape, 3), 255, dtype=np.uint8)
    skeleton[skel > 0] = (20, 20, 20)
    return skeleton


def make_stroke_width(ink_mask: np.ndarray) -> np.ndarray:
    dist = cv2.distanceTransform(ink_mask, cv2.DIST_L2, 5)
    dist_norm = cv2.normalize(dist, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    heat = cv2.applyColorMap(dist_norm, cv2.COLORMAP_TURBO)
    heat[ink_mask == 0] = (245, 245, 245)
    return heat


def make_ink_density(gray: np.ndarray, ink_mask: np.ndarray) -> np.ndarray:
    darkness = 255 - gray
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(darkness)
    enhanced = cv2.bitwise_and(enhanced, enhanced, mask=ink_mask)
    density = cv2.applyColorMap(enhanced, cv2.COLORMAP_MAGMA)
    density[ink_mask == 0] = (245, 245, 245)
    return density


def make_mask_rgba(ink_mask: np.ndarray) -> np.ndarray:
    h, w = ink_mask.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., 0] = 24
    rgba[..., 1] = 22
    rgba[..., 2] = 19
    rgba[..., 3] = ink_mask
    return rgba


def normalize_ink_values(values: np.ndarray) -> np.ndarray:
    if values.size == 0:
        return values.astype(np.float32)
    low, high = np.percentile(values, [2, 98])
    if high <= low:
        low, high = float(values.min()), float(values.max())
    if high <= low:
        return np.zeros_like(values, dtype=np.float32)
    return np.clip((values.astype(np.float32) - low) / (high - low), 0.0, 1.0)


def make_height_map(gray: np.ndarray, ink_mask: np.ndarray) -> np.ndarray:
    ink = ink_mask > 0
    if not np.any(ink):
        return np.zeros_like(gray, dtype=np.uint8)

    darkness = (255 - gray).astype(np.float32)
    ink_strength = np.zeros_like(darkness, dtype=np.float32)
    ink_strength[ink] = normalize_ink_values(darkness[ink])
    ink_strength = cv2.GaussianBlur(ink_strength, (0, 0), 1.05)

    distance = cv2.distanceTransform(ink_mask, cv2.DIST_L2, 5)
    distance_values = distance[ink]
    max_distance = float(np.percentile(distance_values, 99)) if distance_values.size else 0.0
    if max_distance <= 0:
        max_distance = float(distance.max())
    dome = np.clip(distance / max(max_distance, 1.0), 0.0, 1.0)
    dome = np.power(dome, 0.58)
    dome = cv2.GaussianBlur(dome, (0, 0), 0.95)

    soft_edge = cv2.GaussianBlur(ink_mask.astype(np.float32) / 255.0, (0, 0), 2.0)
    relief = (0.58 * ink_strength + 0.42 * dome) * (0.5 + 0.5 * dome) * soft_edge
    relief[~ink] = 0.0
    relief = cv2.GaussianBlur(relief, (0, 0), 1.65)
    relief = np.clip(relief, 0.0, 1.0)
    cap = float(np.percentile(relief[ink], 99.2))
    if cap > 0:
        relief = np.clip(relief / cap, 0.0, 1.0)
    return np.round(relief * 245).astype(np.uint8)


def make_thumbnail(image: np.ndarray, width: int = 1200) -> np.ndarray:
    h, w = image.shape[:2]
    target_w = min(width, w)
    target_h = max(1, int(h * target_w / w))
    return cv2.resize(image, (target_w, target_h), interpolation=cv2.INTER_AREA)


def make_void_candidates(image: np.ndarray, ink_mask: np.ndarray) -> np.ndarray:
    h, w = ink_mask.shape
    overlay = image.copy()

    background = cv2.bitwise_not(ink_mask)
    clearance = cv2.distanceTransform(background, cv2.DIST_L2, 5)
    threshold = max(10, int(min(h, w) * 0.018))
    open_space = (clearance > threshold).astype(np.uint8) * 255

    kernel_w = max(9, int(w * 0.006))
    kernel_h = max(9, int(h * 0.035))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_w, kernel_h))
    open_space = cv2.morphologyEx(open_space, cv2.MORPH_CLOSE, kernel, iterations=1)
    open_space = cv2.morphologyEx(open_space, cv2.MORPH_OPEN, kernel, iterations=1)

    labels_count, labels, stats, _ = cv2.connectedComponentsWithStats(open_space, 8)
    min_area = max(120, int(h * w * 0.0008))
    max_area = int(h * w * 0.08)

    candidates: list[tuple[int, int, int, int, int]] = []
    for idx in range(1, labels_count):
        x, y, bw, bh, area = stats[idx]
        if area < min_area or area > max_area:
            continue
        if bw < w * 0.006 or bh < h * 0.04:
            continue
        candidates.append((x, y, bw, bh, area))

    candidates = sorted(candidates, key=lambda item: item[4], reverse=True)[:24]
    for x, y, bw, bh, _area in candidates:
        cv2.rectangle(overlay, (x, y), (x + bw, y + bh), (62, 180, 92), -1)
        cv2.rectangle(image, (x, y), (x + bw, y + bh), (30, 120, 60), 2)

    return cv2.addWeighted(overlay, 0.28, image, 0.72, 0)


def process_work(work_dir: Path) -> None:
    source = work_dir / "original.png"
    if not source.exists():
        raise FileNotFoundError(
            f"Missing {source}. Put the cropped calligraphy image there first."
        )

    image = read_image(source)
    gray, ink_mask = build_ink_mask(image)

    outputs = {
        "binary": make_binary(ink_mask),
        "skeleton": make_skeleton(ink_mask),
        "stroke_width": make_stroke_width(ink_mask),
        "ink_density": make_ink_density(gray, ink_mask),
        "void_candidates": make_void_candidates(image.copy(), ink_mask),
        "mask": make_mask_rgba(ink_mask),
        "height": make_height_map(gray, ink_mask),
        "thumbnail": make_thumbnail(image),
    }

    for key, filename in IMAGE_FILES.items():
        write_image(work_dir / filename, outputs[key])
        print(f"Wrote {work_dir / filename}")

    h, w = ink_mask.shape
    floating = {
        "type": "floating_scroll",
        "scroll_size": {"width": w, "height": h},
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
    report = {
        "width": w,
        "height": h,
        "ink_pixels": int(cv2.countNonZero(ink_mask)),
        "ink_ratio": round(int(cv2.countNonZero(ink_mask)) / float(w * h), 4),
        "outputs": list(IMAGE_FILES.values()) + ["floating_3d_data.json"],
    }
    (work_dir / "processing-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {work_dir / 'floating_3d_data.json'}")
    print(f"Wrote {work_dir / 'processing-report.json'}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate OpenCV evidence layers for one CalliLens work."
    )
    parser.add_argument(
        "--work",
        default="data/work_001",
        type=Path,
        help="Work directory containing original.png.",
    )
    args = parser.parse_args()
    process_work(args.work)


if __name__ == "__main__":
    main()
