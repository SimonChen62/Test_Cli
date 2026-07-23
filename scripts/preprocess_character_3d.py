from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

import cv2
import numpy as np


Point = tuple[int, int]


def read_image(path: Path, flags: int = cv2.IMREAD_COLOR) -> np.ndarray:
    data = np.fromfile(str(path), dtype=np.uint8)
    image = cv2.imdecode(data, flags)
    if image is None:
        raise RuntimeError(f"Could not read image: {path}")
    return image


def write_image(path: Path, image: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ok, encoded = cv2.imencode(path.suffix or ".png", image)
    if not ok:
        raise RuntimeError(f"Could not encode image: {path}")
    encoded.tofile(str(path))


def percent_box_to_pixels(box: dict[str, float], width: int, height: int) -> tuple[int, int, int, int]:
    x = int(round(box["x"] / 100 * width))
    y = int(round(box["y"] / 100 * height))
    bw = int(round(box["width"] / 100 * width))
    bh = int(round(box["height"] / 100 * height))
    x = max(0, min(width - 1, x))
    y = max(0, min(height - 1, y))
    bw = max(4, min(width - x, bw))
    bh = max(4, min(height - y, bh))
    return x, y, bw, bh


def load_glyph_box(work_dir: Path, glyph_id: str) -> dict[str, Any]:
    config_path = work_dir / "glyphs" / "glyph-boxes.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    for glyph in config.get("glyphs", []):
        if glyph.get("id") == glyph_id:
            return glyph
    raise KeyError(f"Glyph id {glyph_id!r} not found in {config_path}")


def build_ink_mask(image: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    _, mask = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=1)
    return gray, mask


def keep_significant_components(mask: np.ndarray) -> np.ndarray:
    labels_count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    min_area = max(10, int(mask.shape[0] * mask.shape[1] * 0.0014))
    cleaned = np.zeros(mask.shape, dtype=np.uint8)
    for idx in range(1, labels_count):
        if stats[idx, cv2.CC_STAT_AREA] >= min_area:
            cleaned[labels == idx] = 255
    return cleaned


def zhang_suen_thinning(mask: np.ndarray) -> np.ndarray:
    img = (mask > 0).astype(np.uint8)
    changed = True
    while changed:
        changed = False
        for step in (0, 1):
            to_remove: list[Point] = []
            rows, cols = img.shape
            for y in range(1, rows - 1):
                for x in range(1, cols - 1):
                    if img[y, x] == 0:
                        continue
                    p2, p3, p4 = img[y - 1, x], img[y - 1, x + 1], img[y, x + 1]
                    p5, p6, p7 = img[y + 1, x + 1], img[y + 1, x], img[y + 1, x - 1]
                    p8, p9 = img[y, x - 1], img[y - 1, x - 1]
                    neighbors = [p2, p3, p4, p5, p6, p7, p8, p9]
                    count = int(sum(neighbors))
                    if count < 2 or count > 6:
                        continue
                    transitions = sum(
                        1 for a, b in zip(neighbors, neighbors[1:] + neighbors[:1]) if a == 0 and b == 1
                    )
                    if transitions != 1:
                        continue
                    if step == 0:
                        if p2 * p4 * p6 != 0 or p4 * p6 * p8 != 0:
                            continue
                    else:
                        if p2 * p4 * p8 != 0 or p2 * p6 * p8 != 0:
                            continue
                    to_remove.append((x, y))
            if to_remove:
                changed = True
                for x, y in to_remove:
                    img[y, x] = 0
    return (img * 255).astype(np.uint8)


def thin_mask(mask: np.ndarray) -> np.ndarray:
    ximgproc = getattr(cv2, "ximgproc", None)
    if ximgproc is not None and hasattr(ximgproc, "thinning"):
        return ximgproc.thinning(mask)
    return zhang_suen_thinning(mask)


def neighbors(point: Point, pixels: set[Point]) -> list[Point]:
    x, y = point
    result: list[Point] = []
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dx == 0 and dy == 0:
                continue
            candidate = (x + dx, y + dy)
            if candidate in pixels:
                result.append(candidate)
    return result


def trace_skeleton_paths(skeleton: np.ndarray) -> list[list[Point]]:
    ys, xs = np.where(skeleton > 0)
    pixels = set(zip(xs.tolist(), ys.tolist()))
    if not pixels:
        return []

    degree = {point: len(neighbors(point, pixels)) for point in pixels}
    starts = sorted([p for p, deg in degree.items() if deg <= 1], key=lambda p: (p[1], p[0]))
    if not starts:
        starts = [min(pixels, key=lambda p: (p[1], p[0]))]

    visited_edges: set[tuple[Point, Point]] = set()
    paths: list[list[Point]] = []

    def edge(a: Point, b: Point) -> tuple[Point, Point]:
        return (a, b) if a <= b else (b, a)

    def walk(start: Point, nxt: Point) -> list[Point]:
        path = [start, nxt]
        prev, current = start, nxt
        visited_edges.add(edge(prev, current))
        while True:
            current_neighbors = [p for p in neighbors(current, pixels) if p != prev]
            unvisited = [p for p in current_neighbors if edge(current, p) not in visited_edges]
            if not unvisited or degree[current] != 2:
                break
            next_point = min(unvisited, key=lambda p: (abs(p[0] - current[0]) + abs(p[1] - current[1]), p[1], p[0]))
            visited_edges.add(edge(current, next_point))
            prev, current = current, next_point
            path.append(current)
        return path

    for start in starts + sorted(pixels, key=lambda p: (p[1], p[0])):
        for nxt in neighbors(start, pixels):
            if edge(start, nxt) in visited_edges:
                continue
            path = walk(start, nxt)
            if len(path) >= 4:
                paths.append(path)

    paths = sorted(paths, key=lambda path: (min(p[1] for p in path), min(p[0] for p in path), -len(path)))
    return paths


def resample_path(path: list[Point], max_points: int = 80) -> list[Point]:
    if len(path) <= max_points:
        return path
    indices = np.linspace(0, len(path) - 1, max_points).round().astype(int)
    return [path[int(i)] for i in indices]


def build_points(paths: list[list[Point]], distance: np.ndarray, depth_scale: float) -> list[dict[str, float | int]]:
    sampled_paths = [resample_path(path) for path in paths if len(path) >= 4]
    total_points = sum(len(path) for path in sampled_paths)
    if total_points == 0:
        return []

    result: list[dict[str, float | int]] = []
    global_index = 0
    for stroke_id, path in enumerate(sampled_paths, start=1):
        for point_index, (x, y) in enumerate(path):
            radius = float(distance[y, x])
            thickness = max(1.0, radius * 2.0)
            t = global_index / max(1, total_points - 1)
            result.append(
                {
                    "stroke_id": stroke_id,
                    "point_index": point_index,
                    "x": int(x),
                    "y": int(y),
                    "z": round(-thickness * depth_scale, 4),
                    "t": round(float(t), 6),
                    "thickness": round(thickness, 4),
                }
            )
            global_index += 1
    if result:
        result[-1]["t"] = 1.0
    return result


def draw_debug(crop: np.ndarray, skeleton: np.ndarray, points: list[dict[str, float | int]]) -> np.ndarray:
    debug = crop.copy()
    debug[skeleton > 0] = (40, 210, 230)
    grouped: dict[int, list[dict[str, float | int]]] = defaultdict(list)
    for point in points:
        grouped[int(point["stroke_id"])].append(point)
    palette = [(230, 80, 40), (50, 160, 230), (80, 210, 100), (190, 90, 220), (240, 180, 60)]
    for stroke_id, stroke_points in grouped.items():
        color = palette[(stroke_id - 1) % len(palette)]
        for a, b in zip(stroke_points, stroke_points[1:]):
            cv2.line(debug, (int(a["x"]), int(a["y"])), (int(b["x"]), int(b["y"])), color, 1, cv2.LINE_AA)
    return debug


def preprocess_character(args: argparse.Namespace) -> None:
    output = Path(args.output)
    roi_dir = output / "character_rois"
    mask_dir = output / "character_masks"
    roi_dir.mkdir(parents=True, exist_ok=True)
    mask_dir.mkdir(parents=True, exist_ok=True)

    if args.input:
        source = read_image(Path(args.input))
        glyph_id = Path(args.input).stem
        label = args.label or glyph_id
        crop = source
    else:
        work_dir = Path(args.work)
        glyph = load_glyph_box(work_dir, args.glyph_id)
        source = read_image(work_dir / "original.png")
        h, w = source.shape[:2]
        x, y, bw, bh = percent_box_to_pixels(glyph["box"], w, h)
        crop = source[y : y + bh, x : x + bw]
        glyph_id = glyph["id"]
        label = glyph.get("label", glyph_id)

    gray, mask = build_ink_mask(crop)
    mask = keep_significant_components(mask)
    skeleton = thin_mask(mask)
    distance = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    paths = trace_skeleton_paths(skeleton)
    points = build_points(paths, distance, args.depth_scale)

    write_image(roi_dir / f"{glyph_id}_crop.png", crop)
    write_image(mask_dir / f"{glyph_id}_binary.png", mask)
    write_image(mask_dir / f"{glyph_id}_skeleton.png", skeleton)
    height = cv2.normalize(distance, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    write_image(mask_dir / f"{glyph_id}_height.png", height)
    write_image(mask_dir / f"{glyph_id}_debug.png", draw_debug(crop, skeleton, points))

    data_path = output / f"character_3d_data_{glyph_id}.json"
    data_path.write_text(json.dumps(points, ensure_ascii=False, indent=2), encoding="utf-8")
    
    # Also write to default path for compatibility
    data_path_default = output / "character_3d_data.json"
    data_path_default.write_text(json.dumps(points, ensure_ascii=False, indent=2), encoding="utf-8")

    meta = {
        "glyph_id": glyph_id,
        "label": label,
        "source": str(Path(args.input) if args.input else Path(args.work) / "original.png"),
        "point_count": len(points),
        "stroke_count": len({point["stroke_id"] for point in points}),
        "note": "Stroke order is a geometry-based estimate from an offline image, not the historical writing order.",
    }
    
    meta_path = output / f"character_3d_meta_{glyph_id}.json"
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    
    meta_path_default = output / "character_3d_meta.json"
    meta_path_default.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {data_path}")
    print(f"Wrote {meta['point_count']} points across {meta['stroke_count']} estimated strokes")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate 3D dynamic calligraphy trajectory data.")
    parser.add_argument("--input", type=str, help="Optional single-character image path.")
    parser.add_argument("--label", type=str, help="Optional display label for --input mode.")
    parser.add_argument("--work", type=Path, default=Path("data/work_003"))
    parser.add_argument("--glyph-id", default="fu", help="Glyph id from glyphs/glyph-boxes.json.")
    parser.add_argument("--output", type=Path, default=Path("data/work_003/character_3d"))
    parser.add_argument("--depth-scale", type=float, default=0.16)
    args = parser.parse_args()
    preprocess_character(args)


if __name__ == "__main__":
    main()
