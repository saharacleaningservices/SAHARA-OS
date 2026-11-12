# Service page photos

One folder per service category. Each service-page hero slider reads these files
(see `src/config/service-slides.ts`):

| Folder | Used on |
|---|---|
| home | Full House Deep Cleaning, Unfurnished, Move-in / Move-out |
| kitchen | Kitchen Deep Cleaning |
| bathroom | Bathroom Deep Cleaning |
| sofa | Sofa & Upholstery Shampooing |
| carpet | Carpet Cleaning |
| window | Window Cleaning |
| balcony | Balcony Cleaning |

Until you add job photos, each slider shows real Sahara work photos (team, equipment, a finished room).
To add real Before / After photos for a service, just drop them into its folder:
`before-1.webp` + `after-1.webp` (then `before-2` / `after-2` ... up to 8 pairs; .jpg and .png also work).
They appear automatically as labelled "Before" / "After" slides, ahead of the work photos. No code change needed.
Keep photos around 1600x1200 and under 300 KB each.
