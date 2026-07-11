from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import cv2
import numpy as np


ASSET_SCALE = 3


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


def load_boxes(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(
            f"Missing {path}. Create glyph-boxes.json before extracting glyphs."
        )
    return json.loads(path.read_text(encoding="utf-8"))


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


def clean_crop_mask(mask: np.ndarray) -> np.ndarray:
    cleaned = mask.copy()
    labels_count, labels, stats, _ = cv2.connectedComponentsWithStats(cleaned, 8)
    min_area = max(10, int(cleaned.shape[0] * cleaned.shape[1] * 0.0012))
    keep = np.zeros(cleaned.shape, dtype=np.uint8)
    for idx in range(1, labels_count):
        area = stats[idx, cv2.CC_STAT_AREA]
        if area >= min_area:
            keep[labels == idx] = 255
    kernel = np.ones((2, 2), np.uint8)
    keep = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, kernel, iterations=1)
    return keep


def make_skeleton(mask: np.ndarray) -> np.ndarray:
    work = (mask > 0).astype(np.uint8) * 255
    skel = np.zeros(work.shape, np.uint8)
    element = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))

    while cv2.countNonZero(work) > 0:
        opened = cv2.morphologyEx(work, cv2.MORPH_OPEN, element)
        temp = cv2.subtract(work, opened)
        eroded = cv2.erode(work, element)
        skel = cv2.bitwise_or(skel, temp)
        work = eroded

    skeleton = np.zeros((*skel.shape, 4), dtype=np.uint8)
    skeleton[..., 0:3] = (230, 218, 196)
    skeleton[..., 3] = skel
    return skeleton


def make_mask_rgba(crop: np.ndarray, mask: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    darkness = np.clip(255 - gray, 0, 255)
    rgba = np.zeros((*mask.shape, 4), dtype=np.uint8)
    ink_tone = np.clip(42 - (darkness * 0.07), 12, 42).astype(np.uint8)
    rgba[..., 0] = ink_tone
    rgba[..., 1] = np.clip(ink_tone * 0.88, 10, 38).astype(np.uint8)
    rgba[..., 2] = np.clip(ink_tone * 0.74, 8, 34).astype(np.uint8)
    rgba[..., 3] = cv2.GaussianBlur(mask, (0, 0), 1.25)
    return rgba


def make_height(mask: np.ndarray) -> np.ndarray:
    distance = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    if distance.max() > 0:
        height = cv2.normalize(distance, None, 0, 255, cv2.NORM_MINMAX)
    else:
        height = distance
    height = height.astype(np.uint8)
    height[mask == 0] = 0
    return height


def find_contours(mask: np.ndarray) -> list[list[list[int]]]:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    result: list[list[list[int]]] = []
    for contour in contours:
        if cv2.contourArea(contour) < 12:
            continue
        epsilon = max(0.7, 0.0025 * cv2.arcLength(contour, True))
        approx = cv2.approxPolyDP(contour, epsilon, True)
        result.append(approx.reshape(-1, 2).astype(int).tolist())
    return result


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


def source_right_crop(source: np.ndarray, reference: np.ndarray) -> tuple[np.ndarray, dict[str, Any]]:
    """Map the current work_003 crop to the right side of the full scroll.

    The web demo image is a right-end crop downsampled to the current display
    height. Keeping the same percent boxes on this high-resolution crop gives
    smoother glyph masks without changing annotation semantics.
    """
    source_h, source_w = source.shape[:2]
    ref_h, ref_w = reference.shape[:2]
    crop_w = int(round(ref_w * source_h / ref_h))
    crop_w = max(1, min(source_w, crop_w))
    crop_x = max(0, source_w - crop_w)
    crop = source[:, crop_x : crop_x + crop_w]
    return crop, {
        "mode": "right-end crop scaled from work original",
        "sourceWidth": source_w,
        "sourceHeight": source_h,
        "cropX": crop_x,
        "cropY": 0,
        "cropWidth": crop.shape[1],
        "cropHeight": crop.shape[0],
    }


def extract_glyphs(work_dir: Path, source_path: Path | None = None) -> None:
    boxes_path = work_dir / "glyphs" / "glyph-boxes.json"
    output_dir = work_dir / "glyphs"
    output_dir.mkdir(parents=True, exist_ok=True)

    work_image_path = work_dir / "original.png"
    reference_image = read_image(work_image_path)
    image = reference_image
    source_meta: dict[str, Any] = {
        "mode": "work original",
        "sourceWidth": reference_image.shape[1],
        "sourceHeight": reference_image.shape[0],
        "cropX": 0,
        "cropY": 0,
        "cropWidth": reference_image.shape[1],
        "cropHeight": reference_image.shape[0],
    }
    if source_path and source_path.exists():
        full_source = read_image(source_path)
        image, source_meta = source_right_crop(full_source, reference_image)

    _gray, full_mask = build_ink_mask(image)
    height, width = full_mask.shape
    config = load_boxes(boxes_path)

    glyphs: list[dict[str, Any]] = []
    preview = image.copy()

    for item in config.get("glyphs", []):
        glyph_id = item["id"]
        x, y, bw, bh = percent_box_to_pixels(item["box"], width, height)
        crop = image[y : y + bh, x : x + bw]
        crop_mask = clean_crop_mask(full_mask[y : y + bh, x : x + bw])
        if ASSET_SCALE > 1:
            asset_size = (crop.shape[1] * ASSET_SCALE, crop.shape[0] * ASSET_SCALE)
            crop = cv2.resize(crop, asset_size, interpolation=cv2.INTER_CUBIC)
            crop_mask = cv2.resize(crop_mask, asset_size, interpolation=cv2.INTER_NEAREST)

        mask_file = f"{glyph_id}_mask.png"
        height_file = f"{glyph_id}_height.png"
        skeleton_file = f"{glyph_id}_skeleton.png"
        contour_file = f"{glyph_id}_contours.json"

        write_image(output_dir / mask_file, make_mask_rgba(crop, crop_mask))
        write_image(output_dir / height_file, make_height(crop_mask))
        write_image(output_dir / skeleton_file, make_skeleton(crop_mask))
        contours = find_contours(crop_mask)
        (output_dir / contour_file).write_text(
            json.dumps({"contours": contours}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

        cv2.rectangle(preview, (x, y), (x + bw, y + bh), (40, 70, 230), 3)
        glyphs.append(
            {
                "id": glyph_id,
                "label": item.get("label", glyph_id),
                "annotationId": item.get("annotationId"),
                "description": item.get("description", ""),
                "box": item["box"],
                "pixelBox": {"x": x, "y": y, "width": bw, "height": bh},
                "mask": mask_file,
                "height": height_file,
                "skeleton": skeleton_file,
                "contours": contour_file,
                "tracePath": item.get("tracePath", []),
            }
        )

    manifest = {
        "workId": config.get("workId", work_dir.name),
        "source": "original.png",
        "sourceSize": {"width": width, "height": height},
        "sourceMap": source_meta,
        "method": "manual boxes + OpenCV Otsu ink mask + distance-transform height map",
        "glyphs": glyphs,
    }
    (output_dir / "glyphs.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    preview_output = preview
    if preview.shape[1] > reference_image.shape[1] or preview.shape[0] > reference_image.shape[0]:
        preview_output = cv2.resize(
            preview,
            (reference_image.shape[1], reference_image.shape[0]),
            interpolation=cv2.INTER_AREA,
        )
    write_image(output_dir / "glyph_preview.png", preview_output)

    print(f"Wrote {output_dir / 'glyphs.json'}")
    print(f"Wrote {len(glyphs)} glyphs to {output_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract CalliLens single-glyph masks and height maps."
    )
    parser.add_argument(
        "--work",
        default=Path("data/work_003"),
        type=Path,
        help="Work directory containing original.png and glyphs/glyph-boxes.json.",
    )
    parser.add_argument(
        "--source",
        default=None,
        type=Path,
        help="Optional full-resolution scroll image. If provided, glyphs are extracted from the right-end crop that maps to the work image.",
    )
    args = parser.parse_args()
    extract_glyphs(args.work, args.source)


if __name__ == "__main__":
    main()
