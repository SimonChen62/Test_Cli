from pathlib import Path
import unittest

from scripts.extract_glyphs import build_auto_scroll_records, build_full_scroll_records


class FullScrollRecordsTest(unittest.TestCase):
    def test_maps_crop_pixel_boxes_to_full_scroll_coordinates(self):
        manifest = {
            "sourceSize": {"width": 9592, "height": 2100},
            "sourceMap": {
                "sourceWidth": 18332,
                "sourceHeight": 2100,
                "cropX": 8740,
                "cropY": 0,
            },
            "glyphs": [
                {
                    "id": "guang",
                    "label": "光",
                    "pixelBox": {"x": 9208, "y": 67, "width": 192, "height": 185},
                    "mask": "guang_mask.png",
                    "height": "guang_height.png",
                },
            ],
        }

        records = build_full_scroll_records(manifest, Path("data/work_003/glyphs"))

        self.assertEqual(
            records,
            [
                {
                    "id": "guang",
                    "char": "光",
                    "scroll_x": 17948,
                    "scroll_y": 67,
                    "width": 192,
                    "height": 185,
                    "img_path": "data/work_003/glyphs/guang_mask.png",
                    "height_path": "data/work_003/glyphs/guang_height.png",
                }
            ],
        )

    def test_builds_auto_scroll_records_in_right_to_left_reading_order(self):
        boxes = [
            {"x": 100, "y": 80, "width": 20, "height": 30},
            {"x": 300, "y": 120, "width": 22, "height": 31},
            {"x": 300, "y": 40, "width": 21, "height": 32},
        ]

        records = build_auto_scroll_records(boxes, Path("data/work_003/full_scroll_glyphs"))

        self.assertEqual([record["id"] for record in records], ["glyph_0001", "glyph_0002", "glyph_0003"])
        self.assertEqual([record["scroll_x"] for record in records], [300, 300, 100])
        self.assertEqual([record["scroll_y"] for record in records], [40, 120, 80])
        self.assertEqual(records[0]["char"], "glyph_0001")
        self.assertEqual(records[0]["img_path"], "data/work_003/full_scroll_glyphs/glyph_0001_mask.png")
        self.assertEqual(records[0]["height_path"], "data/work_003/full_scroll_glyphs/glyph_0001_height.png")


if __name__ == "__main__":
    unittest.main()
