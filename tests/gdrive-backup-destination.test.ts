// Backups to the owner's Google Drive (owner 2026-11-14): folder "Sahara OS Backups" owned by shaikhaltaf161@gmail.com, configurable.
// Runs the Python unit tests of .github/scripts/gdrive_backup.py and checks the workflow + docs wiring. No network.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const hasPython = spawnSync("python3", ["--version"]).status === 0;

test("gdrive_backup.py destination logic (python unittest)", { skip: !hasPython && "python3 not installed" }, () => {
  const out = execFileSync("python3", [".github/scripts/test_gdrive_backup.py"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
  assert.equal(typeof out, "string");
});

test("workflow passes the configurable folder name / owner with the owner's defaults; no secret values in the repo", () => {
  const wf = readFileSync(".github/workflows/backup.yml", "utf8");
  assert.match(wf, /GDRIVE_BACKUP_FOLDER_NAME: \$\{\{ vars\.GDRIVE_BACKUP_FOLDER_NAME \|\| secrets\.GDRIVE_BACKUP_FOLDER_NAME \|\| 'Sahara OS Backups' \}\}/);
  assert.match(wf, /GDRIVE_BACKUP_OWNER_EMAIL: \$\{\{ vars\.GDRIVE_BACKUP_OWNER_EMAIL \|\| secrets\.GDRIVE_BACKUP_OWNER_EMAIL \|\| 'shaikhaltaf161@gmail\.com' \}\}/);
  assert.equal((wf.match(/GDRIVE_BACKUP_FOLDER_NAME: \$\{\{ env\.GDRIVE_BACKUP_FOLDER_NAME \}\}/g) ?? []).length, 2, "daily + weekly encrypted uploads");
  const py = readFileSync(".github/scripts/gdrive_backup.py", "utf8");
  assert.match(py, /DEFAULT_FOLDER_NAME = "Sahara OS Backups"/);
  assert.match(py, /DEFAULT_OWNER_EMAIL = "shaikhaltaf161@gmail\.com"/);
  for (const f of [wf, py, readFileSync("BACKUP.md", "utf8")]) {
    assert.ok(!/"refresh_token"\s*:\s*"1\/\/|"private_key"\s*:\s*"-----BEGIN/.test(f), "no credential committed");
  }
});

test("BACKUP.md documents the owner folder, sharing and the service-account quota limit", () => {
  const doc = readFileSync("BACKUP.md", "utf8");
  for (const s of ["Sahara OS Backups", "shaikhaltaf161@gmail.com", "GDRIVE_BACKUP_FOLDER_NAME", "GDRIVE_BACKUP_OWNER_EMAIL", "storageQuotaExceeded", "Content manager", "Run workflow"]) assert.ok(doc.includes(s), s);
});
