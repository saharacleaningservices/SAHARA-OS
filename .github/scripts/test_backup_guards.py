"""Tests for the backup delivery guards and the failure-alert script.

Run: python -I .github/scripts/test_backup_guards.py
No network, no Google libraries, no real credentials.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import gdrive_backup as g  # noqa: E402

OAUTH = json.dumps({"client_id": "x", "client_secret": "y", "refresh_token": "z"})
GDRIVE_PY = os.path.join(HERE, "gdrive_backup.py")


def run_check_config(extra_env):
    env = {k: v for k, v in os.environ.items() if not k.startswith("GDRIVE_")}
    env.update(extra_env)
    return subprocess.run([sys.executable, "-I", GDRIVE_PY, "--check-config"], env=env, capture_output=True, text=True)


class ConfigGuards(unittest.TestCase):
    def test_missing_credentials_is_a_failure_not_a_skip(self):
        with self.assertRaises(g.BackupDeliveryError):
            g.require_config({"GDRIVE_FOLDER_ID": "folder"})
        with self.assertRaises(g.BackupDeliveryError):
            g.require_config({"GDRIVE_CREDENTIALS": "   ", "GDRIVE_FOLDER_ID": "folder"})

    def test_missing_folder_id(self):
        with self.assertRaises(g.BackupDeliveryError):
            g.require_config({"GDRIVE_CREDENTIALS": OAUTH})

    def test_invalid_or_incomplete_credentials(self):
        with self.assertRaises(g.BackupDeliveryError):
            g.require_config({"GDRIVE_CREDENTIALS": "not json", "GDRIVE_FOLDER_ID": "f"})
        with self.assertRaises(g.BackupDeliveryError):
            g.require_config({"GDRIVE_CREDENTIALS": json.dumps({"client_id": "x"}), "GDRIVE_FOLDER_ID": "f"})

    def test_valid_configs_pass(self):
        g.require_config({"GDRIVE_CREDENTIALS": OAUTH, "GDRIVE_FOLDER_ID": "f"})
        g.require_config({"GDRIVE_CREDENTIALS": json.dumps({"type": "service_account"}), "GDRIVE_FOLDER_ID": "f"})

    def test_error_never_contains_secret_values(self):
        secret = "SUPER-SECRET-REFRESH"
        with self.assertRaises(g.BackupDeliveryError) as cm:
            g.require_config({"GDRIVE_CREDENTIALS": json.dumps({"client_id": "a", "refresh_token": secret}), "GDRIVE_FOLDER_ID": "f"})
        self.assertNotIn(secret, str(cm.exception))

    def test_cli_missing_credentials_exits_1(self):
        r = run_check_config({})
        self.assertEqual(r.returncode, 1)
        self.assertIn("::error::GDRIVE_CREDENTIALS is not configured", r.stdout)

    def test_cli_configured_exits_0_and_prints_no_values(self):
        r = run_check_config({"GDRIVE_CREDENTIALS": OAUTH, "GDRIVE_FOLDER_ID": "f"})
        self.assertEqual(r.returncode, 0)
        self.assertNotIn("refresh_token", r.stdout)


class UploadVerification(unittest.TestCase):
    def test_matching_size_passes(self):
        self.assertEqual(g.verify_upload({"id": "1", "size": "5281507"}, 5281507), 5281507)

    def test_size_mismatch_fails(self):
        with self.assertRaises(g.BackupDeliveryError):
            g.verify_upload({"id": "1", "size": "100"}, 5281507)

    def test_missing_id_or_size_fails(self):
        with self.assertRaises(g.BackupDeliveryError):
            g.verify_upload({}, 10)
        with self.assertRaises(g.BackupDeliveryError):
            g.verify_upload({"id": "1"}, 10)


class RetentionScope(unittest.TestCase):
    def test_encrypted_and_plain_archives_never_prune_each_other(self):
        self.assertTrue(g.same_kind("sahara-os-1.tar.gz", "sahara-os-2.tar.gz"))
        self.assertTrue(g.same_kind("sahara-os-1.tar.gz.enc", "sahara-os-2.tar.gz.enc"))
        self.assertFalse(g.same_kind("sahara-os-1.tar.gz", "sahara-os-2.tar.gz.enc"))
        self.assertFalse(g.same_kind("sahara-os-1.tar.gz.enc", "sahara-os-2.tar.gz"))


class RetentionPolicy(unittest.TestCase):
    NOW = datetime(2026, 10, 14, 12, 0, tzinfo=timezone.utc)

    @staticmethod
    def item(i, dt):
        return {"id": str(i), "createdTime": dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")}

    def daily(self, days, hour=20, minute=30):
        # nightly 02:00 IST run = 20:30 UTC of the previous day; one per day for `days` days back from NOW
        return [self.item(f"d{n}", (self.NOW - timedelta(days=n)).replace(hour=hour, minute=minute)) for n in range(days)]

    def test_manual_runs_do_not_push_daily_history_out(self):
        items = self.daily(40)
        # 25 manual test runs crammed into one old day (the 2026-10-08 situation)
        day = self.NOW - timedelta(days=6)
        items += [self.item(f"m{n}", day.replace(hour=5, minute=0) + timedelta(minutes=20 * n)) for n in range(25)]
        keep = g.select_retained(items, self.NOW)
        by_id = {f["id"]: f for f in items}
        kept_days = {g._created(by_id[k]).date() for k in keep}
        for n in range(30):
            day = g._created(self.item("x", self.NOW - timedelta(days=n, hours=-8))).date()  # the IST day of nightly run n
            self.assertIn(day, kept_days, f"some backup from the day {n} days ago must survive")
        self.assertEqual(sum(1 for k in keep if k.startswith("m")), 1, "only the newest manual run of that busy day is kept")

    def test_everything_in_the_last_48_hours_is_kept(self):
        items = [self.item(n, self.NOW - timedelta(hours=h)) for n, h in enumerate([1, 2, 3, 5, 20, 40, 47])]
        self.assertEqual(g.select_retained(items, self.NOW), {str(n) for n in range(7)})

    def test_monthly_tier_beyond_the_daily_window(self):
        items = self.daily(30)
        old = [self.item(f"o{n}", datetime(2026, m, d, 20, 30, tzinfo=timezone.utc)) for n, (m, d) in enumerate([(8, 30), (8, 12), (7, 25), (7, 3), (6, 20)])]
        keep = g.select_retained(items + old, self.NOW)
        self.assertEqual({k for k in keep if k.startswith("o")}, {"o0", "o2", "o4"}, "newest archive of Aug, Jul and Jun only")

    def test_keep_months_cap(self):
        old = [self.item(f"o{n}", datetime(2025, 1, 1, 20, 30, tzinfo=timezone.utc) + timedelta(days=31 * n)) for n in range(20)]
        keep = g.select_retained(self.daily(3) + old, self.NOW, keep_months=12)
        self.assertEqual(len({k for k in keep if k.startswith("o")}), 12)

    def test_deletion_cap_deletes_nothing_when_plan_is_too_large(self):
        items = [self.item(f"i{n}", self.NOW - timedelta(days=n)) for n in range(50)]
        keep = {"i0"}
        self.assertEqual(g.plan_deletions(items, keep, max_delete=40), [], "49 > 40 -> nothing is deleted")
        self.assertEqual(len(g.plan_deletions(items, keep, max_delete=60)), 49)
        self.assertNotIn("i0", {f["id"] for f in g.plan_deletions(items, keep, max_delete=60)}, "kept files are never planned for deletion")

    def test_newest_is_never_deleted_and_empty_is_safe(self):
        self.assertEqual(g.select_retained([], self.NOW), set())
        stale_only = [self.item("x", self.NOW - timedelta(days=500))]
        self.assertEqual(g.select_retained(stale_only, self.NOW), {"x"})


@unittest.skipUnless(shutil.which("bash"), "bash required")
class AlertScript(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="backup-alert-test-")
        self.log = os.path.join(self.dir, "gh.log")
        # Fake `gh`: logs every call; `issue list` prints $FAKE_OPEN when set.
        stub = os.path.join(self.dir, "gh")
        with open(stub, "w", newline="\n") as f:
            f.write('#!/usr/bin/env bash\necho "$*" >> "$GH_LOG"\nif [ "$1 $2" = "issue list" ]; then [ -n "${FAKE_OPEN:-}" ] && echo "$FAKE_OPEN"; fi\nexit 0\n')
        os.chmod(stub, 0o755)

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def run_alert(self, mode, open_issue=""):
        env = dict(os.environ, PATH=self.dir + os.pathsep + os.environ["PATH"], GH_LOG=self.log, FAKE_OPEN=open_issue,
                   GITHUB_REPOSITORY="o/r", GITHUB_RUN_ID="42", GH_TOKEN="not-a-real-token")
        r = subprocess.run(["bash", os.path.join(HERE, "backup_alert.sh"), mode], env=env, capture_output=True, text=True)
        calls = open(self.log).read() if os.path.exists(self.log) else ""
        return r, calls

    def test_failure_opens_one_issue(self):
        r, calls = self.run_alert("failure")
        self.assertEqual(r.returncode, 0)
        self.assertIn("issue create", calls)
        self.assertIn("--label backup-failure", calls)
        self.assertNotIn("not-a-real-token", r.stdout + r.stderr + calls)

    def test_repeated_failure_comments_instead_of_duplicating(self):
        _, calls = self.run_alert("failure", open_issue="7")
        self.assertIn("issue comment 7", calls)
        self.assertNotIn("issue create", calls)

    def test_success_closes_open_issue(self):
        _, calls = self.run_alert("success", open_issue="7")
        self.assertIn("issue close 7", calls)

    def test_success_with_nothing_open_is_quiet(self):
        _, calls = self.run_alert("success")
        self.assertNotIn("issue close", calls)

    def test_bad_mode(self):
        r, _ = self.run_alert("bogus")
        self.assertEqual(r.returncode, 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
