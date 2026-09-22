# Backup & Restore Guide

This lives at the repository root: **[`../BACKUP_RESTORE_GUIDE.md`](../BACKUP_RESTORE_GUIDE.md)**.

Kept as a single copy (not duplicated here) so there's exactly one place to
update it. It covers: application crash, database corruption, VPS failure,
server replacement, code redeployment, database restore, file recovery, and
how to actually test a restore rather than just trusting a backup exists.

See also **[`../BACKUP.md`](../BACKUP.md)** for how the automated daily
off-site backup pipeline itself is configured (S3 primary, optional Google
Drive secondary, GitHub Actions scheduling).
