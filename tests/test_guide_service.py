import tempfile
import unittest
import json
from pathlib import Path
from unittest.mock import patch

from backend.app.services import guide_service


class GuideServiceQuestionDraftTest(unittest.TestCase):
    def test_missing_quality_fields_detects_basic_metadata_gap(self):
        work = {"title": "测试作品", "script_type": "行书"}

        self.assertEqual(guide_service._missing_quality_fields(work), ["作者", "年代", "资料来源"])

    def test_question_draft_uses_local_fallback_without_llm(self):
        work = {"id": "work_test", "title": "测试作品", "script_type": "行书"}
        with tempfile.TemporaryDirectory() as temp_dir:
            with patch("backend.app.services.guide_service.llm_service.enhance_answer") as enhance:
                enhance.return_value = ("", "local_rag")
                draft = guide_service.create_question_draft(Path(temp_dir), work)

        self.assertEqual(draft["provider"], "local_rag")
        self.assertTrue(draft["questions"])
        self.assertIn("missing_fields", draft)
        self.assertIn("资料来源", draft["missing_fields"])

    def test_save_manual_annotation_writes_official_annotation_file(self):
        work = {"id": "work_test", "title": "测试作品", "script_type": "行书"}
        annotations = [
            {
                "id": "manual_1",
                "type": "brush_ink",
                "label": "重墨观察",
                "box": {"x": 10, "y": 20, "width": 30, "height": 12},
                "formal": "形式证据",
                "perception": "观看感受",
                "aesthetic": "解释",
            }
        ]
        with tempfile.TemporaryDirectory() as temp_dir:
            work_dir = Path(temp_dir)
            generated = guide_service.save_manual_annotation(
                work_dir,
                work,
                json.dumps(annotations, ensure_ascii=False),
                "全文赏析",
            )
            payload = json.loads((work_dir / "annotation.json").read_text(encoding="utf-8"))

        self.assertEqual(generated, ["annotation.json"])
        self.assertEqual(payload["guideKind"], "admin_manual")
        self.assertEqual(payload["guideText"], "全文赏析")
        self.assertEqual(payload["annotations"][0]["label"], "重墨观察")


if __name__ == "__main__":
    unittest.main()
