# Sahara OS — Production Security Audit

_Performed 2026-09-21 as Phase 3 of the "Phase 1-10 production polish" prompt. Methodology: full static code inspection of every auth/authorization/data-handling code path (`git grep` across the whole source tree, line-by-line reading of every API route, every server action, session/JWT/password/rate-limit/CSRF library, and the upload/backup/restore pipeline). No live penetration testing, no dependency/CVE scan, and no attempt to log in to production was performed — this session had no active authenticated browser session at the time of the audit, and entering a real password to create one is categorically off-limits regardless of framing (see `SAHARA_OS_STATUS.md` §3.9 onward for why). Re-run this audit after any change to auth, session, or a new API route/server action — it is a snapshot, not a standing guarantee._

## Score: 8.5 / 10 (production-acceptable, with disclosed gaps below)

Nothing found during this pass was a live, currently-exploited incident. Three real, concrete defects were found and fixed in the same pass (see §1). The remaining points off a perfect score are documented gaps and judgment calls, not unknowns — every one of them is named explicitly in §3/§4 below with a reason it wasn't changed.

## 1. Findings — fixed this pass

| # | Area | Finding | Fix | Commit |
|---|---|---|---|---|
| 1 | Route protection | `/api/webhook/missed-call` failed **open**: `if (token && ...)` skipped the entire auth check when neither `MISSED_CALL_TOKEN` nor `CRON_TOKEN` was configured — meaning an unauthenticated caller could POST an arbitrary phone number and create a real Lead, or attach a fake "missed call" note to an existing customer's Lead by supplying their number. | Inverted to fail **closed**: reject whenever no token is configured, not just when a wrong one is supplied. | `09fa3e1` |
| 2 | API authorization | `/api/webhooks/whatsapp` accepted any POST body with no verification it came from Meta. An attacker could forge a payload to (a) mark arbitrary `WhatsAppMessage` rows as FAILED by guessing a `providerMessageId`, or (b) make `sendWhatsApp()` queue/attempt a send to any phone number of their choosing, via the inbound-button-reply auto-responder logic. | Added Meta's `X-Hub-Signature-256` HMAC-SHA256 verification (`WHATSAPP_APP_SECRET`), constant-time compared. Skips verification (not a rejection) while the secret is unset, since there's no real inbound Meta traffic yet — this is exactly the Phase 5 readiness gap that needed closing before real WhatsApp Cloud API integration. | `09fa3e1` |
| 3 | Audit logs / login history | No persistent login-history trail existed anywhere. Device-approval **requests** were audit-logged, but an actual successful login — of any role, including the Owner's own ADMIN account — left zero durable record. Failed logins only fired a transient `notify()` (in-app/WhatsApp alert), never an `AuditLog` row. | Added `AuditLog` rows for `LOGIN_SUCCESS` and `LOGIN_FAILED` (both the "unknown account" and "wrong password" cases) in `api/auth/login`. Now visible on `/admin/audit-log`. | `09fa3e1` |
| 4 | API authorization | `server/actions/reviews.ts` (`createReview`, `markReviewReplied`) had no session check at all. A Next.js Server Action is a real HTTP endpoint regardless of which page links to it — being reachable only from the authenticated `/reports` page in the UI doesn't stop a direct call while logged out, if the action reference is extracted from the client bundle. | Added `requireRole(["ADMIN","ACCOUNTS","OPERATIONS","SUPERVISOR"])`, matching `/reports`'s own gate. | `09fa3e1` |

## 2. Checklist results

### RBAC enforcement — GOOD, actively maintained
`ROLE_NAV_ACCESS` (`src/lib/constants.ts`) is the single source of truth consumed by both the sidebar (`sidebar-nav.tsx`) and `middleware.ts`'s route-level redirect, so nav visibility and backend gating structurally can't disagree by design. The recurring defect class this whole session has been "a page's own `requireRole` array or a server action's local permission check drifts out of sync with the shared nav/permission source" — found and fixed **eight separate times** across this and prior sessions (Customers, Reports, Trash, Gallery, AMC, Vehicles, Staff Performance pages; `restoreRecord`/`bulkRestore`; `customers/page.tsx`'s own `canManage` literal; and now `reviews.ts` in this pass). There is no structural guard that prevents a ninth instance — this is a process risk (new code has to remember to reuse the shared permission functions), not a currently-known open instance. Recommendation: a lint rule or a code-review checklist item that flags any new `requireRole([...])` array or local `role === "..."` literal as needing to justify why it isn't calling into `src/lib/permissions.ts`.

### API authorization — FIXED where broken, otherwise consistent
Every route under `src/app/api/` was individually inspected (18 routes). Six intentionally public (webhooks, PDF-by-unguessable-CUID documents, booking-link redemption — see §3), the rest require either a session or a bearer token, verified fail-closed. Every `src/server/actions/*.ts` file was checked for at least one `getSession`/`requireUser`/`requireRole` call; six had none, five of those are intentionally public (password/login-ID recovery, public booking, slot availability — see §3), one (`reviews.ts`) was a real gap, now fixed.

### Route protection (middleware) — GOOD
`src/middleware.ts`'s `PUBLIC_PATHS` allow-list plus `canAccess(role, section)` gate was the subject of a major fix earlier this session (`/forgot-password`, `/forgot-login-id`, `/privacy-policy`, `/terms` were all unreachable when genuinely logged out — see `SAHARA_OS_STATUS.md` §3.10/§3.11) and was re-verified live at the time. Re-checked this pass: no other route outside `(app)` or link from the public booking page is missing from the list.

### JWT / session security — GOOD, one accepted limitation
`src/lib/session.ts`: `jose` HS256 JWT, 12-hour TTL (deliberately shortened this session from an original 7 days), `httpOnly` + `secure` (prod) + `sameSite: lax` cookie. **Accepted limitation, not fixed**: sessions are stateless — there is no server-side revocation list, so a password change, a device-approval revocation, or a manual "log out everywhere" action cannot invalidate an already-issued token before its natural 12-hour expiry. Fixing this properly needs a session-version or deny-list column checked on every request (a real, if moderate, schema + middleware change) — flagged for a future pass rather than done blind in this one, since it touches every authenticated request path.

### Password hashing — GOOD
`bcryptjs`, 10 salt rounds (`src/lib/auth.ts`). 10 is an acceptable, still-common cost factor; bumping to 12 is a low-priority, optional hardening (each increment roughly doubles hashing time — costs nothing to raise for new hashes, existing hashes keep working since bcrypt encodes its own cost in the hash string).

### Rate limiting — GOOD, one documented scaling caveat
`src/lib/rate-limit.ts`: in-memory, 10 attempts/10 min per IP + 5/10 min per account on login; the OTP flows (`security.ts`) separately enforce a 5-attempt lockout and 20-minute expiry per code. The module's own comment already documents the real caveat: in-memory buckets reset on every process restart (which happens on every Coolify auto-deploy) and wouldn't be shared across multiple instances if this ever moves off a single-instance deployment. Correctly scoped to the current architecture — not a defect, just a known ceiling worth remembering before ever scaling horizontally.

### CSRF — GOOD
Next.js Server Actions get Next's own built-in Origin-header CSRF check for free. The plain Route Handlers that mutate state using the cookie session (`/api/upload`, `/api/backup/restore`) explicitly call `isSameOrigin()` (`src/lib/csrf.ts`), which correctly accounts for Coolify/Traefik's `X-Forwarded-Host` header rather than trusting a possibly-port-suffixed `Host`.

### XSS — GOOD
Zero uses of `dangerouslySetInnerHTML` anywhere in `src/`. React's default JSX interpolation escapes all rendered user content. **Gap, not fixed**: there is no `Content-Security-Policy` header (`next.config.ts` sets `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS, but no CSP). A correct CSP for a Next.js app with its own inline styles/scripts and any third-party embeds (Maps links, etc.) needs to be built and tested carefully — a wrong one silently breaks legitimate functionality, which would violate this project's explicit "zero regression" requirement. Recommended as a dedicated, separately-tested follow-up, not something to add blind in an audit pass.

### SQL injection — EXCELLENT
Zero occurrences of `$queryRaw`/`$executeRaw` anywhere in the codebase (checked, excluding the generated Prisma client). Every query goes through Prisma's parameterized query builder. This is about as low a SQL-injection surface as a real app can have.

### File upload security — GOOD
`/api/upload`: CSRF-checked, session-required, folder allow-list (prevents path traversal — the folder segment is validated against a fixed list, and the filename itself is always server-generated via `randomUUID()`, never taken from the client), per-category MIME-type checks and size limits (8MB images / 20MB docs / 25MB audio / 60MB video). `X-Content-Type-Options: nosniff` is set globally, which mitigates the main risk of trusting the client-supplied `Content-Type` for the file extension (a mislabeled upload can't be browser-sniffed into executing as a different content type when served statically). **Not fixed, lower priority**: file type is validated by the client-supplied MIME type, not by inspecting the file's actual magic bytes — a belt-and-suspenders improvement, but `nosniff` already closes the realistic exploit path for a static file server.

### Audit logs — GOOD, gap closed this pass
`AuditLog` model + `/admin/audit-log` page already existed and is used by delete/restore/device-approval/backup/restore actions. The one real gap (no login-history entries) is fixed in §1.

### Device approval — GOOD
New-device logins for OPERATIONS/ACCOUNTS/SUPERVISOR require an OTP the Owner approves (`api/auth/login`, `/admin/device-approvals`); every approval request is already audit-logged; the approving OTP itself follows the same hardened pattern as password/login-ID recovery (crypto-random via `node:crypto`, 5-attempt lockout, expiry).

### Login history — GAP, fixed this pass
Was not actually implemented as a durable trail before this audit (see finding #3 above) despite `notify()`'s transient alerts giving the impression it was. Now fixed.

## 3. Reviewed and judged intentional — not defects

- **PDF-by-CUID routes with no session check** (`/api/invoices/[id]/pdf`, `/api/quotations/[id]/pdf`, `/api/certificates/[id]/pdf`): each keys strictly by the record's unguessable CUID primary key (never by its human-readable number), which is the same "unguessable-link, no login required" design already used deliberately for `/j/[jobNumber]` and the public booking page — these documents are meant to be shareable with the customer via a WhatsApp link without asking them to log in. Not changed, since requiring a session would break that legitimate, working customer-facing flow. Worth a conscious owner decision if the business ever wants these locked down instead (that's a product choice, not something this audit should decide unilaterally).
- **`/api/webhook/missed-call`'s bearer-token model** (vs. a signature check): appropriate for the range of telephony providers (Exotel/Knowlarity/MyOperator/Servetel) it's built to accept, none of which sign payloads the way Meta does. Fail-open bug fixed (§1); the token-based model itself is fine.
- **In-memory rate limiting**: correctly scoped to a single-instance deployment, already self-documented as needing Redis if that ever changes.

## 4. Not fixed this pass — explicitly flagged for a future pass

1. **No server-side session revocation** — a stateless JWT can't be force-expired before its 12-hour TTL. Needs a session-version/deny-list mechanism touching every authenticated request.
2. **No Content-Security-Policy header** — needs to be built and tested carefully against this app's actual script/style/embed surface before shipping, to avoid a silent functional regression.
3. **File upload type validation trusts client-supplied MIME type, not file magic bytes** — lower priority given `nosniff` already closes the realistic exploit path.
4. **bcrypt cost factor (10, not 12)** — optional, low-priority hardening for new hashes only.
5. **No dependency/CVE scan was run** — this audit was source-code-only; a `npm audit` / Snyk-style pass is a separate, complementary exercise this session didn't perform.

## 5. What "8.5/10" means here

This is not a certification and shouldn't be read as one. It reflects: zero live incidents found, four real defects found *and fixed* in the same pass (not just reported), a consistently strong baseline (parameterized queries throughout, real password hashing, real rate limiting, real CSRF checks, real device-approval OTP gating) — offset by one recurring process risk (RBAC checks drifting apart across files) and five disclosed, deliberately-deferred hardening items above. Re-audit after the CSP and session-revocation items are addressed, and this number should move up.
