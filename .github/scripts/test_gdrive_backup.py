#!/usr/bin/env python3
"""Unit tests for the Drive destination logic in gdrive_backup.py (no network, no Google libraries needed).

Run: python3 .github/scripts/test_gdrive_backup.py   (also run by tests/gdrive-backup-destination.test.ts)
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gdrive_backup as g  # noqa: E402

OWNER = "shaikhaltaf161@gmail.com"


class FakeReq:
    def __init__(self, value):
        self.value = value

    def execute(self):
        return self.value


class FakeFiles:
    def __init__(self, meta=None, listing=None):
        self.meta = meta or {}
        self.listing = listing or []
        self.last_q = None

    def get(self, fileId, fields, supportsAllDrives):
        return FakeReq(dict(self.meta, id=fileId))

    def list(self, q, **_):
        self.last_q = q
        return FakeReq({"files": self.listing})


class FakeSvc:
    def __init__(self, files):
        self._files = files

    def files(self):
        return self._files


def folder(name="Sahara OS Backups", owner=OWNER, **extra):
    return dict({"mimeType": g.FOLDER_MIME, "name": name, "trashed": False, "owners": [{"emailAddress": owner}]}, **extra)


class DestinationConfig(unittest.TestCase):
    def test_defaults_are_the_owners_folder(self):
        cfg = g.destination_config({})
        self.assertEqual(cfg, {"name": "Sahara OS Backups", "owner": OWNER, "folder_id": None, "strict": False})

    def test_unset_github_variables_render_empty_and_fall_back(self):
        cfg = g.destination_config({"GDRIVE_BACKUP_FOLDER_NAME": "", "GDRIVE_BACKUP_OWNER_EMAIL": " ", "GDRIVE_FOLDER_ID": ""})
        self.assertEqual((cfg["name"], cfg["owner"], cfg["folder_id"]), ("Sahara OS Backups", OWNER, None))

    def test_overrides(self):
        cfg = g.destination_config({"GDRIVE_BACKUP_FOLDER_NAME": "Other", "GDRIVE_BACKUP_OWNER_EMAIL": "X@Gmail.com", "GDRIVE_FOLDER_ID": "abc", "GDRIVE_STRICT_FOLDER": "1"})
        self.assertEqual(cfg, {"name": "Other", "owner": "x@gmail.com", "folder_id": "abc", "strict": True})
        self.assertEqual(g.destination_config({"GDRIVE_BACKUP_OWNER_EMAIL": "-"})["owner"], "")


class FolderLookup(unittest.TestCase):
    def test_query_is_exact_name_folder_and_owner(self):
        q = g.folder_query("Sahara OS Backups", OWNER)
        self.assertIn("mimeType = 'application/vnd.google-apps.folder'", q)
        self.assertIn("name = 'Sahara OS Backups'", q)
        self.assertIn(f"'{OWNER}' in owners", q)
        self.assertIn("trashed = false", q)
        self.assertNotIn("in owners", g.folder_query("Sahara OS Backups", ""))
        self.assertIn("name = 'Altaf\\'s'", g.folder_query("Altaf's", ""))

    def test_lookup_by_name_and_owner(self):
        files = FakeFiles(listing=[{"id": "F1"}, {"id": "F2"}])
        self.assertEqual(g.resolve_folder(FakeSvc(files), g.destination_config({})), "F1")
        self.assertIn(f"'{OWNER}' in owners", files.last_q)

    def test_missing_folder_fails_loudly(self):
        with self.assertRaises(SystemExit) as e:
            g.resolve_folder(FakeSvc(FakeFiles(listing=[])), g.destination_config({}))
        self.assertIn("Sahara OS Backups", str(e.exception))
        self.assertIn(OWNER, str(e.exception))

    def test_pinned_folder_checked_against_name_and_owner(self):
        self.assertEqual(g.folder_problems(folder(), "Sahara OS Backups", OWNER), [])
        self.assertEqual(len(g.folder_problems(folder(owner="contact@saharacleaningservices.com"), "Sahara OS Backups", OWNER)), 1)
        self.assertEqual(len(g.folder_problems(folder(name="Old"), "Sahara OS Backups", OWNER)), 1)
        self.assertEqual(g.folder_problems(dict(folder(), owners=[]), "Sahara OS Backups", OWNER), [], "Shared Drive folders have no owners")
        wrong = FakeSvc(FakeFiles(meta=folder(owner="contact@saharacleaningservices.com")))
        self.assertEqual(g.resolve_folder(wrong, g.destination_config({"GDRIVE_FOLDER_ID": "P"})), "P", "non-strict: warn, still upload")
        with self.assertRaises(SystemExit):
            g.resolve_folder(wrong, g.destination_config({"GDRIVE_FOLDER_ID": "P", "GDRIVE_STRICT_FOLDER": "1"}))
        ok = FakeSvc(FakeFiles(meta=folder()))
        self.assertEqual(g.resolve_folder(ok, g.destination_config({"GDRIVE_FOLDER_ID": "P", "GDRIVE_STRICT_FOLDER": "1"})), "P")


if __name__ == "__main__":
    unittest.main()
