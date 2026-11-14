# Zones / MOV, Staff GPS, and OTP

## Zones & Minimum Order Value — `src/lib/zones.ts`
| Zone | Areas | Residential MOV | Commercial MOV |
|---|---|---|---|
| 1 East & South Pune | Magarpatta, Hadapsar, Kharadi, Viman Nagar, Koregaon Park, Kalyani Nagar, Wagholi, Mohammadwadi, Undri, NIBM, Kondhwa, Wanowrie, Katraj, Dhankawadi, Bibwewadi, Swargate, Sahakar Nagar, Satara Road | none | none |
| 2 West Pune & Inner PCMC | Shivajinagar, Kothrud, Karve Nagar, Warje, Bavdhan, Pashan, Aundh, Baner, Balewadi, Wakad, Hinjewadi, Punawale, Pimple Saudagar, Pimpri, Chinchwad, Nigdi, Deccan | ₹4,000 | ₹4,000 |
| 3 Far NW / Industrial | Chakan, Moshi, Ravet, Talegaon, Alandi | ₹7,500 | none |

Locality name wins over pincode. Unmapped areas keep the legacy ₹3,999 CRM floor.
`publicBookLead` accepts `estimatedTotal` (₹) and rejects totals below the MOV with the exact customer message.
Without a total (plain `/book` form) the lead is accepted and flagged in its timeline.

## Lead attribution
`Lead.zone, pincode, utmSource, utmMedium, utmCampaign, gclid, fbclid` — captured from the landing URL on `/book`.

## Staff GPS
Check-in / check-out / job start / job complete store coordinates. `POST /api/staff/location-ping`
(session auth, same-origin, 4/min, only while checked in) logs to `StaffLocationPing` (30-day retention).
Browser limitation: pings run while the app tab is open and visible; true background tracking needs a native app.

## OTP (WhatsApp Cloud API; unsent codes stay QUEUED in Admin → WhatsApp Log)
| Flag | Effect | Default |
|---|---|---|
| `STAFF_LOGIN_OTP=on` | STAFF-role logins need a 6-digit WhatsApp code after the password (10 min, 5 tries, single use) | off |
| `JOB_OTP_ENFORCE=on` | Staff/Supervisor need the customer's start / completion OTP to advance a job. Admin/Operations may override (logged in the job activity) | off |

Both ship **off** so a deploy can't lock anyone out before WhatsApp Cloud API credentials are live.
Turn them on in Render env once `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` are set and a test message is delivered.
