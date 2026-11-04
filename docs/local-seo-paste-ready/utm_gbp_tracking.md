# GBP UTM tracking (Mohammadwadi and Magarpatta)

The CRM already captures `utm_source` and `utm_campaign` on the public booking funnel
(`attribution-capture.tsx` -> `public-booking.ts` -> lead sheet / `marketing-roi.ts`), and the
existing GBP convention in `src/app/(app)/profit/marketing/page.tsx` is
`utm_source=gbp&utm_medium=organic&utm_campaign=<name>`. These links follow it. The source codes
are kept as lowercase campaign values, because UTM values are case-sensitive and mixed case splits reports.

| Profile | Source code | Phone | Field in GBP | Link |
|---|---|---|---|---|
| Mohammadwadi ("in Pune") | SRC-GMB-MOHAMMADWADI | 89565 67130 | Website | `https://saharacleaningservices.com/cleaning-services-mohammadwadi-411060?utm_source=gbp&utm_medium=organic&utm_campaign=src-gmb-mohammadwadi` |
| Mohammadwadi | SRC-GMB-MOHAMMADWADI | 89565 67130 | Booking / Appointment | `https://saharacleaningservices.com/booking?utm_source=gbp&utm_medium=organic&utm_campaign=src-gmb-mohammadwadi&utm_content=booking_link` |
| Mohammadwadi | SRC-GMB-MOHAMMADWADI | 89565 67130 | Posts (button) | `https://saharacleaningservices.com/booking?utm_source=gbp&utm_medium=organic&utm_campaign=src-gmb-mohammadwadi&utm_content=post` |
| Magarpatta (SAHARA7130) | SRC-GMB-MAGARPATTA | 70833 47130 | Website | `https://saharacleaningservices.com/cleaning-services-magarpatta-411028?utm_source=gbp&utm_medium=organic&utm_campaign=src-gmb-magarpatta` |
| Magarpatta | SRC-GMB-MAGARPATTA | 70833 47130 | Booking / Appointment | `https://saharacleaningservices.com/booking?utm_source=gbp&utm_medium=organic&utm_campaign=src-gmb-magarpatta&utm_content=booking_link` |
| Magarpatta | SRC-GMB-MAGARPATTA | 70833 47130 | Posts (button) | `https://saharacleaningservices.com/booking?utm_source=gbp&utm_medium=organic&utm_campaign=src-gmb-magarpatta&utm_content=post` |

Notes
- Use the Website link only after the 308 redirects for that locality are live; until then point the
  Website field at `/pune/mohammadwadi` / `/pune/magarpatta` with the same UTM suffix.
- Calls from GBP are not UTM-trackable. Track them with the GBP "Calls" insight and by asking
  "How did you find us?" (CRM source field). Each profile keeps its own phone number.
- Per change control, edit one GBP field at a time with at least 72 h between changes and log each edit.
- CRM check after the first GBP booking: the lead's `utm_campaign` should read
  `src-gmb-mohammadwadi` or `src-gmb-magarpatta`. If it does not, the booking page is dropping the
  parameters and that is a bug to fix before relying on the report.
- Whether the site's lead-source dropdown needs matching `SRC-GMB-*` values is an owner decision. I did
  not change the CRM schema or source list.
