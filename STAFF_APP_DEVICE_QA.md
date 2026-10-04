# Staff App — real-device QA checklist (before commit / deploy)

Run on **1 Android phone (Chrome)** and **1 iPhone (Safari, iOS 16.4+)** against an **HTTPS test address**
(phones only allow install + push over HTTPS). Use 2 test staff records, never real staff data.
Mark each line ✅ / ❌ with a note.

## Setup (office laptop, Super Admin)
1. Staff → test staff → *Staff App access* → **Enable Staff App login** → note the 4-digit PIN shown once.
2. Repeat for a second test staff member → PIN must be **different**.

## On each phone
| # | Check | Android | iPhone |
|---|---|---|---|
| 1 | Open the address → sign in with **mobile number + 4-digit PIN** → lands on Sahara Staff home | | |
| 2 | Show/Hide eye on the PIN field works | | |
| 3 | iPhone: Share → **Add to Home Screen** → open "Sahara Staff" from the icon. Android: menu → **Install app** | | |
| 4 | Home: name, today's attendance, today's job, team names, Directions opens Maps, emergency **Call** buttons dial | | |
| 5 | "Make your PIN private" card → **Change my PIN** → `1234` refused → own 4-digit PIN accepted → sign out → old PIN fails, new PIN works | | |
| 6 | **Turn on notifications** (from the installed app on iPhone) → allow | | |
| 7 | Calendar month + year view; tap a date → attendance, site/job, team, money for that day | | |
| 8 | My Records: Salary (slip **View** + **Download** PDF opens), Attendance, Jobs/Sites, Team, Advance, Debit/Fine, Rewards + Team incentives | | |
| 9 | Customer tab: Google Review QR and Payment QR scan correctly with another phone | | |
| 10 | No page scrolls sideways; text readable; buttons easy to tap | | |

## Notifications (office does one of each; phone app closed / screen locked)
Each must arrive **once**, show the Sahara vibration on Android, and tapping must open the exact record.
| Event (office side) | Android | iPhone |
|---|---|---|
| Mark today's attendance | | |
| Add advance | | |
| Add fine | | |
| Add reward | | |
| ₹50 team incentive on a completed job of that staff member | | |
| Assign staff to a new job | | |
| Change that job's date, then its team | | |
| Publish an **Important** announcement (normal announcement → no notification) | | |
| Re-save a job without changes → **no** notification | | |

## Forgot PIN + approval roles
| Check | Result |
|---|---|
| Sign out → "Field staff forgot PIN? **Request a reset**" → mobile + new PIN → "sent to the office" | |
| New PIN does **not** work yet | |
| **Accounts** login: staff record shows "PIN reset requested" → **Approve** | |
| New PIN now works; old PIN fails | |
| Repeat once with **Super Admin** approving (and once **Reject** → PIN unchanged) | |

## Security isolation (signed in as staff on the phone)
Type these addresses — each must bounce back to the Staff App or show "Forbidden":
`/dashboard`, `/payments`, `/expenses`, `/revenue`, `/profit`, `/reports/export-center`, `/staff`, `/admin/announcements`, `/api/export/period?year=2026&month=10`.
No other staff member's pay, no customer phone numbers on past jobs, no job prices anywhere.

## Office checks (laptop)
- Reports → **Export Center** → download one month and the whole year (Super Admin and Accounts).
- *Business Summary* Revenue / Total Expenses / Net for the month = Profit dashboard *Collected* / *Expenses* / *This Month's Profit*.

Known platform limits (not failures): web push uses the phone's normal notification sound (custom sounds aren't
allowed for web apps); the Sahara chime plays only while the app is open. iPhone needs Add to Home Screen first.
