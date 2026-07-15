import tempfile
import unittest
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


if __name__ == "__main__":
    unittest.main()
