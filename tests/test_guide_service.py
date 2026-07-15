from pathlib import Path
import tempfile
import unittest

from backend.app.services import guide_service


class GuideServiceTest(unittest.TestCase):
    def test_save_official_guide_normalizes_manual_annotation(self):
        with tempfile.TemporaryDirectory() as tmp:
            work_dir = Path(tmp)
            result = guide_service.save_official_guide(
                work_dir,
                {"id": "work_test", "title": "Test Work", "script_type": "running script"},
                "Manual guide",
                [
                    {
                        "type": "bad_type",
                        "label": "Heavy ink",
                        "box": {"x": 95, "y": -10, "width": 20, "height": 12},
                        "formal": "Visible ink evidence.",
                    }
                ],
            )

            self.assertEqual(result["guideKind"], "admin_confirmed")
            self.assertEqual(result["annotations"][0]["type"], "brush_ink")
            self.assertEqual(result["annotations"][0]["box"], {"x": 80.0, "y": 0.0, "width": 20.0, "height": 12.0})
            self.assertTrue((work_dir / "annotation.json").exists())


if __name__ == "__main__":
    unittest.main()
