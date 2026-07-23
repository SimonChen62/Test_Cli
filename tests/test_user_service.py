import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.app.services import db_service, user_service


class UserServiceTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "callilens-test.db"
        self.path_patch = patch.object(db_service, "LOCAL_DB_PATH", self.db_path)
        self.dir_patch = patch.object(db_service, "LOCAL_DB_DIR", self.db_path.parent)
        self.url_patch = patch.dict("os.environ", {"DATABASE_URL": ""}, clear=False)
        self.path_patch.start()
        self.dir_patch.start()
        self.url_patch.start()
        user_service.init_db()

    def tearDown(self):
        self.url_patch.stop()
        self.dir_patch.stop()
        self.path_patch.stop()
        self.temp_dir.cleanup()

    def test_register_login_and_save_records(self):
        created = user_service.register("student01", "secret123")

        self.assertIn("token", created)
        self.assertEqual(created["user"]["username"], "student01")

        logged_in = user_service.login("student01", "secret123")
        token = logged_in["token"]

        session = user_service.start_session(token, "work_003", "test-agent")
        self.assertEqual(session["session"]["work_id"], "work_003")

        first_look = user_service.save_first_look(
            token,
            "work_003",
            "整体安静",
            "中段有运动感",
            "题名附近较疏朗",
        )
        self.assertEqual(first_look["first_look"]["overall"], "整体安静")

        reflection = user_service.save_reflection(
            token,
            "work_003",
            "qi_1",
            "motion",
            "我看到上下笔画之间有方向承接。",
        )
        self.assertEqual(reflection["reflection"]["annotation_id"], "qi_1")

        records = user_service.admin_records()
        self.assertEqual(len(records["users"]), 1)
        self.assertEqual(len(records["sessions"]), 1)
        self.assertEqual(len(records["first_looks"]), 1)
        self.assertEqual(len(records["reflections"]), 1)

        mine = user_service.my_records(token)
        self.assertEqual(mine["user"]["username"], "student01")
        self.assertEqual(len(mine["sessions"]), 1)
        self.assertEqual(len(mine["first_looks"]), 1)
        self.assertEqual(len(mine["reflections"]), 1)
        self.assertEqual(mine["reflections"][0]["content"], "我看到上下笔画之间有方向承接。")

    def test_rejects_bad_login(self):
        user_service.register("student02", "secret123")

        with self.assertRaises(ValueError):
            user_service.login("student02", "wrong-password")


if __name__ == "__main__":
    unittest.main()
