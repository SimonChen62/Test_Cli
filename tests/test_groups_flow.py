import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.app.services import db_service, user_service, group_service


class GroupsFlowTest(unittest.TestCase):
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

    def test_group_creation_join_and_reflections(self):
        # 1. Register two users
        user_a = user_service.register("student_a", "secret123")
        user_b = user_service.register("student_b", "secret123")
        token_a = user_a["token"]
        token_b = user_b["token"]
        id_a = user_a["user"]["id"]
        id_b = user_b["user"]["id"]

        # 2. Student A creates a group
        group = group_service.create_group("九歌书法社", id_a)
        self.assertEqual(group["name"], "九歌书法社")
        self.assertEqual(group["creator_id"], id_a)
        self.assertTrue(len(group["invite_code"]) == 6)

        # 3. Student B joins the group using the invite code
        invite_code = group["invite_code"]
        joined_group = group_service.join_group(invite_code, id_b)
        self.assertEqual(joined_group["id"], group["id"])

        # 4. Verify groups the users belong to
        groups_a = group_service.get_user_groups(id_a)
        groups_b = group_service.get_user_groups(id_b)
        self.assertEqual(len(groups_a), 1)
        self.assertEqual(len(groups_b), 1)
        self.assertEqual(groups_a[0]["name"], "九歌书法社")

        # 5. Check group details (members)
        details = group_service.get_group_details(group["id"], id_a)
        member_ids = [m["id"] for m in details["members"]]
        self.assertIn(id_a, member_ids)
        self.assertIn(id_b, member_ids)

        # 6. Save reflection and verify work reflections list
        reflection_a = user_service.save_reflection(
            token_a,
            "work_999",
            "free_reflection",
            "free",
            "学生A对测试作品999的反思内容"
        )
        reflection_b = user_service.save_reflection(
            token_b,
            "work_999",
            "free_reflection",
            "free",
            "学生B对测试作品999的精彩评论"
        )

        all_reflections = user_service.get_work_reflections("work_999")
        self.assertEqual(len(all_reflections), 2)
        
        usernames = [r["username"] for r in all_reflections]
        self.assertIn("student_a", usernames)
        self.assertIn("student_b", usernames)
        
        contents = [r["content"] for r in all_reflections]
        self.assertIn("学生A对测试作品999的反思内容", contents)
        self.assertIn("学生B对测试作品999的精彩评论", contents)


if __name__ == "__main__":
    unittest.main()
