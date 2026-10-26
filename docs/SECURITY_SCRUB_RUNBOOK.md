# Security scrub runbook (2026-10-21)

Why: the repository was briefly public. History contained a Sept-3 `.env` (dev `AUTH_SECRET`) and nine versions of `dev.db`
(5 office accounts with password hashes, 20 staff mobiles, demo jobs). A full pattern scan of all 599 commits found no
Meta/Google/GitHub/AWS tokens, private keys or webhook URLs — only those two items (plus an example secret in the first
`.env.example`).

## Done in code (this branch)
- `dev.db` untracked and ignored (`.gitignore`). A fresh volume is built by `scripts/db-setup.mjs` + `prisma/seed.ts`.
- Production first boot now seeds the five bootstrap accounts with **random** temporary passwords (printed once in the boot
  log, forced through /set-password). The fixed development passwords never exist in production.
- `scripts/env-check.mjs` validates the environment at boot: stops only for a missing `AUTH_SECRET` or a non-SQLite
  `DATABASE_URL`; everything else is a warning.

## Rotate first (history scrubbing does not undo exposure)
1. `AUTH_SECRET` in Coolify, redeploy (signs everyone out).
2. Passwords of the 5 bootstrap users; change Admin and Accounts first.
3. Tell the 20 staff in the old `dev.db` if those mobiles were real.

## History rewrite (owner runs this — it is a force-push)
A dry run on a mirror clone was verified: `.env` and `dev.db` have 0 commits afterwards, the example secret is masked,
583 commits remain, every branch gets new commit ids. Steps:
1. Tell everyone to push or abandon open work; note open PRs will be orphaned.
2. `python -m pip install git-filter-repo`
3. `git clone --mirror https://github.com/saharacleaningservices/SAHARA-OS.git scrub.git && cd scrub.git`
4. `python -m git_filter_repo --invert-paths --path dev.db --path .env --force`
5. Put the old example secret into a file as `VALUE==>REMOVED-EXAMPLE-SECRET` and run
   `python -m git_filter_repo --replace-text that-file --force`, then delete the file.
6. Verify: `git log --all -- dev.db .env` prints nothing.
7. Re-add the remote and `git push --force --mirror` (this rebuilds `coolify-deploy`; Coolify will deploy the new tip).
   Merge `chore/untrack-dev-db` BEFORE this so the tip no longer needs `dev.db`.
8. Everyone re-clones. Ask GitHub Support to purge cached views of the old commits and any `refs/pull/*` for old PRs.
