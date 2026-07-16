import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend.app.main import app


class AdminDraftEndpointTest(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_question_draft_accepts_unsaved_upload_form(self):
        with patch(
            "backend.app.services.guide_service.llm_service.enhance_answer",
            return_value=("", "local_rag"),
        ):
            response = self.client.post(
                "/api/admin/question-draft",
                data={
                    "title": "测试书法作品",
                    "artist": "测试作者",
                    "script_type": "行书",
                    "description": "用于测试上传前生成推荐问题。",
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("questions", payload)
        self.assertTrue(payload["questions"])
        self.assertIsNone(payload["work_id"])

    def test_appreciation_draft_accepts_unsaved_upload_form(self):
        with patch(
            "backend.app.services.guide_service.llm_service.enhance_answer",
            return_value=("这是一段本地测试赏析草稿。", "local_rag"),
        ):
            response = self.client.post(
                "/api/admin/appreciation-draft",
                data={
                    "title": "测试书法作品",
                    "artist": "测试作者",
                    "script_type": "行书",
                    "description": "用于测试上传前生成全文赏析。",
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("guideText", payload)
        self.assertTrue(payload["guideText"])
        self.assertIsNone(payload["work_id"])


if __name__ == "__main__":
    unittest.main()
