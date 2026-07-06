from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np


IMAGE_FILES = {
    "binary": "binary.png",
    "skeleton": "skeleton.png",
    "stroke_width": "stroke_width.png",
    "ink_density": "ink_density.png",
    "void_candidates": "void_candidates.png",
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
    }

    for key, filename in IMAGE_FILES.items():
        write_image(work_dir / filename, outputs[key])
        print(f"Wrote {work_dir / filename}")


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
