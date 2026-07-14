import unittest

from backend.app.services import rag_service, work_service


class RagServiceTest(unittest.TestCase):
    def test_answers_default_work_question_with_sources(self):
        result = rag_service.answer("赵孟頫是谁？", "work_003")

        self.assertEqual(result["mode"], "local_rag")
        self.assertIn("赵孟頫", result["answer"])
        self.assertTrue(result["sources"])
        self.assertEqual(result["sources"][0]["title"], "赵孟頫是谁")

    def test_filters_to_default_work_and_global_chunks(self):
        chunks = rag_service.search("《光福重建塔记》是什么？", "work_003")

        self.assertTrue(chunks)
        self.assertTrue(all(chunk.work_id in {"work_003", "global"} for chunk in chunks))

    def test_unrelated_question_does_not_fallback_to_default_work(self):
        result = rag_service.answer("完全不存在的问题 xyz", "work_003")

        self.assertIn("当前资料不足", result["answer"])
        self.assertEqual(result["sources"], [])

    def test_answers_inkverse_teacher_task_question(self):
        result = rag_service.answer("老师新文档要求是什么？", "work_003")

        self.assertIn("VR 看书法展", result["answer"])
        self.assertTrue(any("老师新文档要求是什么" == source["title"] for source in result["sources"]))

    def test_answers_local_database_question(self):
        result = rag_service.answer("RAG 数据库在哪里？", "work_003")

        self.assertIn("data/works.json", result["answer"])
        self.assertIn("knowledge/*.md", result["answer"])

    def test_answers_testing_route_question(self):
        result = rag_service.answer("做完之后我怎么测试？", "work_003")

        self.assertIn("start-demo.ps1", result["answer"])
        self.assertIn("127.0.0.1:5190", result["answer"])


class WorkServiceTest(unittest.TestCase):
    def test_loads_default_work(self):
        work = work_service.get_work("work_003")

        self.assertIsNotNone(work)
        self.assertEqual(work["title"], "赵孟頫《光福重建塔记》")


if __name__ == "__main__":
    unittest.main()
