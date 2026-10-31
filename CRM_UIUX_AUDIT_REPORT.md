# Sahara OS – CRM UI/UX, Duplication, RBAC & Notification Audit

**Repo:** `saharacleaningservices/SAHARA-OS` · **Branch audited:** `coolify-deploy` @ `11f92eb` · **Date:** 31 Oct 2026

## 0. How this audit was done (read first)

- **Method:** static read of the full source (784 files: `src/`, `prisma/`, config). Nothing was run or deployed.
- **Not done:** no live screenshots or device testing, because the app was not opened logged in. Every mobile finding below is based on class names and component code, so confirm each on a real phone (320, 375, 414 px) before fixing. File paths stand in for screenshots.
- **Not checked:** Playwright/Lighthouse results, bundle analyzer output, and the real production role assignments in the DB.
- **Layout recommendation (standing rule):** **Boxed** for the CRM shell, forms and dashboards. **Fluid** for data-dense screens and for mobile. Details in section 2.4.

---

## 1. Executive Summary

**Overall health: good (B+). This is not a rebuild.** It is a mature, role-aware system with a few concentrated weak spots.

| Area | Verdict | Evidence |
|---|---|---|
| Architecture | Strong | Next.js app, Prisma (69 models), ~82k hand-written LOC, 65 server-action files, 47 API routes |
| Access control | Strong, with one policy gap | Central middleware gates sections. All 52 `(app)` pages reference a guard. Fine-grained `permissions.ts` |
| Notifications | Already advanced | Bell with 20 s polling, Web Push + service worker, alert sound, Sonner toasts, ~28 event kinds, per-user sound/notification prefs |
| Role dashboards | Already exist | Operations Command Center for Francis, a Finance/Operations "view as" toggle for Admin, Tabbed dashboard |
| Mobile UI | Fair | Drawer nav and responsive buttons exist. Inputs and tap targets are below mobile standards (see C1, C2) |
| Duplication | Moderate | Two booking UIs, repeated helper functions, 25 local ₹ formatters |
| Repo hygiene | Needs a clean-up | Generated Prisma client committed, about 15 root-level `.md` files, `android/` folder in the web repo |

**Top 5 actions (highest return):**

1. Fix inputs on mobile: 16 px text and 44 px height. This stops iOS zoom-on-focus on every form.
2. Decide the **Shoyab role**. The code gives him the `ACCOUNTS` role, which is close to owner-level on customer data, salary and delete. That does not match a Sales Coordinator job.
3. Merge the two public booking UIs into one. This matches the plan to deprecate the standalone booking route.
4. Add a sidebar badge and a one-tap "Call / WhatsApp" strip on lead and job cards for the roles that need it.
5. Add the dark/light toggle. Dark CSS is already written but there is no switch.

---

## 2. UI/UX & Responsive Findings

### 2.1 Critical (fix first)

| ID | Issue | Where | Impact | Fix |
|---|---|---|---|---|
| C1 | `Input` is `h-9` (36 px) with `text-sm` (14 px) at all widths. `Select` trigger is `h-8/h-9`. `Textarea` is `text-sm`. | `src/components/ui/input.tsx`, `select.tsx`, `textarea.tsx` | iOS Safari zooms the page on focus for any field under 16 px. Tap target is under 44 px. This hits every form: lead, job, payment, quotation | `h-11 text-base sm:h-9 sm:text-sm` (same pattern the Button already uses) |
| C2 | Button `sm` is `h-9 text-xs` on mobile (36 px). `icon` is 40 px. `default` is 40 px. Only `lg` reaches 44 px. | `src/components/ui/button.tsx` | Mis-taps on dense lead/job action rows, mainly with gloves or one hand in the field | Raise mobile heights to `h-11`, keep desktop sizes under `sm:` |
| C3 | Public booking exists as **two separate implementations**: `booking-wizard.tsx` (1,494 lines) and `public-booking-form.tsx` (937 lines). | `components/public/*`, routes `/booking`, `/book-embed`, `/book` | Two flows to keep consistent on pricing, slots and validation, and a risk of different mobile behaviour | See D1 |

### 2.2 Minor

| ID | Issue | Where | Fix |
|---|---|---|---|
| M1 | One raw `<table>` with no scroll wrapper | `app/my/records/page.tsx` (Staff App) | Wrap in `overflow-x-auto` or switch to a card list on mobile |
| M2 | The shared `<Table>` is safe (it has an overflow wrapper). Several explorers still render wide tables on phones (`staff-explorer`, `expenses-explorer`, `amc-explorer`, `users-explorer`, `upcoming-jobs-table`) | `components/*` | Add a `md:hidden` card layout for the top 3 used on phones: staff, expenses, upcoming jobs |
| M3 | Dark theme CSS exists (`.dark` palette in `globals.css`) but there is **no toggle**. No `next-themes`, no `setTheme` | `app/globals.css`, `layout/topbar.tsx` | Add System / Light / Dark switch in the topbar user menu and persist per user |
| M4 | No badge counts in the sidebar (leads, follow-ups, unassigned jobs) | `layout/sidebar-nav.tsx` | Add count pills fed from the existing notification feed or a lightweight counts endpoint |
| M5 | The CRM has no bottom tab bar on mobile (only the Staff App `/my` does). All navigation is through the hamburger drawer | `layout/topbar.tsx`, `app-shell.tsx` | Add a 4-tab bottom bar for Francis and Shoyab: Home, Leads, Jobs, More |
| M6 | 17 `confirm()` calls (4 are `window.confirm`) and no `AlertDialog` anywhere. Native confirm dialogs look off-brand and are weak on mobile | grep across `src/` | Replace with one shared confirm dialog component |
| M7 | Large fixed widths (`min-w/w-[600–999px]`) appear in 3 files | grep for fixed widths of 600px and up | Check each at 375 px |
| M8 | `font-family` stack is system fonts with Devanagari fallbacks. This is good for performance but not branded | `globals.css` | Optional: self-host one display font for headings only |

### 2.3 Suggested dashboard widgets (what is missing vs. already built)

Already in the codebase: hero stats, new-leads card, follow-up board, quick dispatch, pending-actions panel, collect-pay widget, revenue intelligence, business-target card, lead calendar, booking QR card, owner quick inquiry.

| Widget | Who | Why |
|---|---|---|
| **Service Status strip**: today's jobs by state (unassigned / assigned / on the way / in progress / done / payment pending) | Francis, Admin | One glance at the day, with a tap through to the filtered list |
| **Lead response timer**: minutes since each NEW lead arrived, red after 15 min | Shoyab, Admin | Speed to first call decides conversion |
| **Today's Leads / Sales pipeline mini-funnel** (New → Contacted → Quoted → Won) | Shoyab, Admin | There is a kanban in `leads-explorer`, but no compact summary on the home |
| **Unpaid & overdue** tile with 1-tap "Send reminder" | Shoyab | Links to `OPS_PAYMENT_DUE` events that already exist |
| **AMC renewals due in 30 days** | Admin, Shoyab | Highest-margin repeat revenue |

### 2.4 Layout: Boxed vs. Fluid (recommendation)

Current state: the shell is a fixed 256 px sidebar at `lg+`, with `main` using `px-4 sm:px-6` and a `mx-auto max-w-7xl` wrapper. 42 of 52 pages set no `max-w` of their own. Net effect: **already boxed at 1280 px**.

| Surface | Recommendation | Reason |
|---|---|---|
| Dashboard, forms, detail pages (job, customer, quotation) | **Boxed**, `max-w-7xl`, centred | Readable line length, calmer on 1440–1920 px monitors |
| Leads kanban, calendar, dispatch board, big tables | **Fluid**: opt out with `max-w-none` inside the shell | These need width. Boxing them causes sideways scroll |
| Mobile (below `sm`) | **Fluid**, full-bleed cards, `px-4` | Boxed has no benefit on a phone. Remove side gutters on tables |
| Public booking and landing pages | **Boxed** (`max-w-2xl` form, `max-w-6xl` page) | Conversion pages should be narrow and focused |

---

## 3. Duplication Breakdown & Refactoring Roadmap

| ID | Duplication | Evidence | Refactor | Effort | Gain |
|---|---|---|---|---|---|
| D1 | Two public booking UIs | `booking-wizard.tsx` (1,494 L, used by `/booking`, `/book-embed`, `landing-kit`) and `public-booking-form.tsx` (937 L, used only by `/book`). The two files share 0 identical long lines, so they are independent re-implementations | Keep the wizard. Redirect `/book` to `/booking`. Delete the form. Fits the planned route deprecation | M | Largest single code and bundle cut (~900 L) |
| D2 | `waLink` defined 4 times | `campaign-kit.tsx`, `ppc-landing.tsx`, `category-landing.tsx`, `landing-kit.tsx`. A shared `toWhatsAppLink` already exists in `lib/utils` | Import the shared one | S | Single place to change the number or prefill text |
| D3 | `last10()` phone-normaliser defined 6 times | `protected-numbers.ts`, `leads.ts`, `public-booking-core.ts`, `whatsapp.ts`, `staff-registration.ts`, `whatsapp-audience.ts` | Move to `lib/phone.ts` and import | S | Prevents phone-matching bugs (duplicate customers, missed protected-number checks) |
| D4 | `safeEqual` (constant-time compare) defined 4 times | `webhook/email-lead`, `webhook/cognito`, `call-webhook-auth.ts`, `public-api-auth.ts` | Single `lib/safe-equal.ts` | S | Security code should exist once |
| D5 | `requireAdmin` defined 5 times in action files | `integrations`, `khata-import`, `whatsapp-campaigns`, `whatsapp-queue`, `users` | One shared guard in `lib/current-user` | S | One place to change admin rules |
| D6 | ₹ formatting: 25 local formatter functions and 48 inline `toLocaleString("en-IN")` | grep | One `formatINR()` plus a `<Money>` component | S–M | Consistent currency display |
| D7 | `wa.me/` literal built by hand in 13 files | grep | Route all through `toWhatsAppLink` | S | Same as D2 |
| D8 | Very large files | 21 files over 500 L. Top: `booking-wizard` 1,494, `actions/leads.ts` 1,080, `lead-form.tsx` 825, `whatsapp-templates.ts` 725, `actions/jobs.ts` 711, `webhooks/whatsapp/route.ts` 705, `landing-kit.tsx` 690 | Split by responsibility (e.g. `leads.ts` into create / assign / follow-up / import) | M–L | Maintainability |
| D9 | Client-heavy tree: 208 of 375 `.tsx` files are `"use client"` | grep | Convert read-only display components to server components as you touch them | M | Smaller JS on phones |

### Repo and build-size clean-up

| Item | Finding | Action |
|---|---|---|
| Generated Prisma client | 77 files under `src/generated/prisma` are committed (the largest, `Lead.ts`, is ~7.5k lines) | Remove from git, add to `.gitignore`, run `prisma generate` in the Docker build (Coolify already builds) |
| Root documents | About 15 `.md` files at root plus `SAHARA_DEVELOPER_HANDOVER/` (12) and `docs/` (27) | Move into `docs/`, keep only `README.md` and `CLAUDE.md` at root |
| `android/` | 18 files in the web repo | Fine if it is the Staff App wrapper. Otherwise split to its own repo |
| Public assets | 20 PNG + 17 JPG + 16 WebP | Convert PNG/JPG to WebP/AVIF and use `next/image`. Sizes not measured |
| Deployment config | `render.yaml` still present although hosting is Coolify | Remove if unused |

---

## 4. Role-Based Access Control (RBAC)

**How roles map to people.** The code has five roles: `ADMIN`, `OPERATIONS`, `ACCOUNTS`, `SUPERVISOR`, `STAFF`. Per code comments, **Francis = `OPERATIONS`** and **Shoyab = `ACCOUNTS`**. There is **no Sales / Telecaller role**. The code itself warns that names are not verified identity, so confirm both accounts in `/admin/users`.

### 4.1 Role matrix (from `lib/permissions.ts` and `ROLE_NAV_ACCESS`)

| Capability | Admin | Operations (Francis) | Accounts (Shoyab) | Supervisor | Staff |
|---|---|---|---|---|---|
| Dashboard | Full + "view as" toggle | Operations Command Center | Finance-style tabbed view | Reduced | Redirects to `/my` |
| Leads / CRM | ✅ | ✅ | ✅ | – | – |
| Jobs scope | All | Yesterday + today + tomorrow, all teams | All | Today + tomorrow | Own, today |
| Staff / Vehicles / Attendance | ✅ | ✅ (no calendar edit, backfill, month-close) | ✅ | – | Own only |
| Job amount, advance, balance | ✅ | ✅ | ✅ | – | – |
| Edit billing, discount, GST | ✅ | ✅ (no cap) | ✅ | – | – |
| Customer mobile number | ✅ | ❌ (masked call only) | ✅ | – | – |
| Payments page | ✅ | ❌ in nav | ✅ | – | – |
| Expenses page | ✅ | ❌ in nav | ✅ | – | – |
| Quotations / Invoices / Vouchers | ✅ | ❌ | ✅ | – | – |
| Revenue / Reports / Customers | ✅ | ❌ | ✅ | – | – |
| Staff salary | ✅ | ❌ | ✅ | – | – |
| Delete records | ✅ | ❌ | ✅ | – | – |
| Export customer list | ✅ | ❌ | ✅ | – | – |
| Global search | ✅ | ❌ | ✅ | – | – |
| Financial settings, security, data safety | ✅ only | ❌ | ❌ | ❌ | ❌ |
| Restore from trash | ✅ | ✅ | ✅ | – | – |

### 4.2 Findings

| ID | Severity | Finding | Recommendation |
|---|---|---|---|
| R1 | **High (policy)** | `ACCOUNTS` can see customer phones, **export the full customer list**, **delete records**, view **staff salaries** and search globally. If Shoyab is the **Sales Coordinator** (as recorded), this is more power than the job needs. A customer export is the standard way leads are taken to a competitor. | Create a `SALES` role (leads, follow-ups, quotations, customers read-only, WhatsApp/call, no export/delete/salary). Keep `ACCOUNTS` for a true accounts person. Until then, at least remove `canExportCustomers` and `canViewSalary` from Shoyab, **only if you confirm this is his actual job**. |
| R2 | Medium | **Doc/code drift for Operations.** The header comment in `permissions.ts` says Operations has Payments (record/edit) and Expenses (add/edit operational), but `ROLE_NAV_ACCESS.OPERATIONS` has neither, and the middleware enforces the nav list. Francis can edit billing and discount with no cap but cannot open the Payments page | Decide the real rule, then align comment, nav list and buttons. If Francis should record payments, add `payments` to his nav list. If not, remove the wording from the comment |
| R3 | Medium | `OPERATIONS` and `ACCOUNTS` both have the `admin` section. Sub-pages like users, device approvals and security approvals look ADMIN-only via `canManageSecurity`, but I did not trace every `/admin/*` page | Check each `/admin/*` page for a page-level role check, not just the nav-level one |
| R4 | Medium | Server actions without an obvious session check: `slot-availability`, `upsell`, `review-feedback`, `public-booking`, `booking-page`, `login-id-recovery` (all public-facing by design). Public API routes: `public/v1/leads` has a secret check but **no rate limit**; `booking-link/[token]/open` has no check by design (token) | Add rate limiting to `public/v1/leads`, `webhook/missed-call` and `v1/webhooks/*`. Webhooks do verify signatures or `Authorization` (`createHmac`, `timingSafeEqual`) |
| R5 | Good | `OPERATIONS` branch of the dashboard never builds a finance section on the server, so numbers are not merely hidden in the UI | Keep this pattern for every future role view |
| R6 | Good | Francis never sees customer mobile numbers. Calls go through the call-trigger flow | Keep. Add a visible "Call customer" button so the rule does not slow him down (see section 6) |

### 4.3 Role-tailored home screens

**Francis (Operations)**: already has the Operations Command Center. Keep the home to:

1. Service Status strip (today's jobs by state)
2. Unassigned jobs with an inline crew dropdown
3. Quick Dispatch (exists)
4. Crew attendance today (present / late / absent)
5. Escalations (`OPS_ESCALATION`, `OPS_TEAM_UNASSIGNED`)
6. Tomorrow's readiness (crew + vehicle assigned, address confirmed)

Hide: revenue, targets, quotations.

**Shoyab (today Accounts, effectively Sales)**: proposed view:

1. New leads with response timer
2. Follow-ups due today (Follow-up board exists)
3. Quotes awaiting reply (`OPS_QUOTATION_FOLLOWUP`)
4. Payments due, with a 1-tap reminder
5. AMC renewals due
6. Pipeline mini-funnel

Hide: salaries, vehicles, attendance calendar, security/admin tiles.

---

## 5. Notification & Alert System

**Current state (stronger than most CRMs).**

| Layer | What exists | Source |
|---|---|---|
| In-app bell | Polls `/api/notifications/feed` every **20 s** and on tab focus. Shows the last 20 items and the unread count | `notifications-bell.tsx` |
| Push | Service worker (`/sw.js`), `PushManager` subscription, `web-push` server | `lib/webpush.ts`, `staff-app/push-control.tsx` |
| Sound | `lib/alert-audio.ts`. A global switch (ops settings) plus a per-user switch | `feed/route.ts`, `User.soundEnabled` |
| Toasts | Sonner (107 files use it) | `components/ui/sonner` |
| Data model | `Notification { kind, title, body, href, critical, readAt }`: supports deep links and criticality | `schema.prisma` |
| Event kinds | ~28, including `NEW_INQUIRY`, `NEW_BOOKING`, `FOLLOWUP_DUE`, `STALE_LEAD`, `PAYMENT_RECEIVED`, `OPS_PAYMENT_DUE`, `OPS_ESCALATION`, `STAFF_JOB_ASSIGNED`, `CREW_UPDATE` | `server/notify.ts`, `staff-notify.ts` |

Staff job alerts stay in the Staff App (no WhatsApp to staff), per your standing decision. This audit does not suggest changing that.

**Gaps and upgrades**

| ID | Gap | Recommendation | Effort |
|---|---|---|---|
| N1 | Polling is every 20 s. There is no push of events while the tab is open (no SSE/WebSocket) | Fine at your scale. If you want instant "new lead" pop-ups, add one SSE stream for `NEW_INQUIRY` / `NEW_BOOKING` only | M |
| N2 | Bell has a filter but no grouping or priority styling beyond `critical` | Group by Today / Earlier. Colour chips: red = critical, green = money, blue = leads, amber = follow-ups | S |
| N3 | No sidebar badges (see M4) | Per-section unread counts | S |
| N4 | I found **no `LEAD_ASSIGNED` kind**. Lead assignment writes exist in `actions/leads.ts`, `import.ts` and `owner-inquiry.ts`. One of them may already notify through another helper, so check before adding | Notify the assignee on assign, with a deep link to the lead | S |
| N5 | Sound is one tone for everything | Two tones: urgent (new lead/booking, payment) and soft (everything else). Keep the per-user mute | S |
| N6 | Audio needs a user gesture on mobile browsers | Show a one-time "Enable alerts" prompt and confirm with a test beep. `push-control.tsx` already has the pieces | S |
| N7 | Tab-title badge `(3) Sahara OS` and app-icon badge (`navigator.setAppBadge`) for the installed PWA | Add both | S |
| N8 | Quiet hours | Per-user off-hours window, except `critical` | S |

---

## 6. Operational Shortcuts

| ID | Shortcut | Status | Action |
|---|---|---|---|
| S1 | Call and WhatsApp buttons | `shared/quick-actions.tsx` has `CallButton` and `WhatsAppButton` (using `tel:` and `wa.me`). `lead-card.tsx` uses both. WhatsApp deep links also appear on job cards | Standardise: same two buttons, same position, on lead card, job card, customer page and follow-up board |
| S2 | WhatsApp with a ready message | Templates exist (`lib/whatsapp-templates.ts`, 725 L) | Add a template picker next to the button: Quote follow-up, Payment reminder, On-the-way, Review request. One tap opens WhatsApp with text filled |
| S3 | Francis cannot see numbers | Masked call flow exists | Make "Call customer" a prominent button on job cards for Operations (it goes through call-trigger) |
| S4 | Assignment dropdown | Leads and jobs have assignment selects (`lead-card` has a select; dispatch exists) | Make it inline on list rows (no need to open the record), with auto-save and a toast |
| S5 | Global search | Only Admin and Accounts (`canSearchGlobally`). No `Ctrl/Cmd+K` palette found | Add a command palette for Admin/Accounts. Give Operations a job-only search |
| S6 | Bulk actions | Not checked in depth | Multi-select on leads: assign, change status, send template |
| S7 | Swipe actions on mobile lead list | Not present | Swipe right = call, left = WhatsApp |

---

## 7. Prioritised Roadmap (Effort vs. Impact)

| # | Item | Effort | Impact | Owner |
|---|---|---|---|---|
| 1 | C1/C2: 16 px inputs, 44 px tap targets | S (1 day) | **Very high** | Dev |
| 2 | R1/R2: decide Shoyab role and Francis payment rule | S (a decision) | **Very high** | Altaf |
| 3 | D2, D3, D4, D5: shared helpers (waLink, last10, safeEqual, requireAdmin) | S | High | Dev |
| 4 | N4: notify on lead assignment | S | High | Dev |
| 5 | M4 + N3 + N7: sidebar badges, tab-title and app-icon badge | S | High | Dev |
| 6 | S1/S2: standard Call + WhatsApp + template picker | S–M | **Very high** | Dev |
| 7 | Service Status strip and lead response timer widgets | M | High | Dev |
| 8 | M3: dark/light toggle | S | Medium | Dev |
| 9 | M5: bottom tab bar for CRM mobile | M | High | Dev |
| 10 | D1: retire `/book` + `public-booking-form.tsx` | M | High | Dev |
| 11 | R4: rate limits on public endpoints | S | Medium (security) | Dev |
| 12 | Remove committed `src/generated`, move root docs | S | Medium | Dev |
| 13 | M2: card layouts for staff, expenses and upcoming jobs on phones | M | Medium | Dev |
| 14 | M6: shared confirm dialog | S | Medium | Dev |
| 15 | `SALES` role with its own home | M | High (after #2) | Dev |
| 16 | N1: SSE for instant alerts | M | Medium | Dev |
| 17 | S5/S6: command palette, bulk actions | M–L | Medium | Dev |
| 18 | D8/D9: split the 21 large files, more server components | L | Medium (long-term) | Dev |

**Suggested sequence:** Week 1 = #1–6 (mostly small, one decision). Week 2 = #7–11. Then #12–18 as bandwidth allows.

---

## 8. Items to Verify Manually

1. Open the CRM on a real phone at 375 px. Test the lead form, job form, payment form and the five table explorers in M2.
2. In `/admin/users`, confirm which account holds which role.
3. Trace every `/admin/*` page for its own role check (R3).
4. Confirm whether any helper already notifies on lead assignment (N4).
5. Measure bundle size and image weights with `next build` and the analyzer.
