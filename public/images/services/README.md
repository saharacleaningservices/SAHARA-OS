# Service page photos

One folder per service category. Each service-page hero slider reads these files
(see `src/config/service-slides.ts`):

| Folder | Used on |
|---|---|
| home | Full House Deep Cleaning, Unfurnished, Move-in / Move-out |
| kitchen | Kitchen Deep Cleaning |
| bathroom | Bathroom Scrubbing |
| sofa | Sofa & Upholstery Shampooing |
| carpet | Carpet Cleaning |
| window | Window Cleaning |
| balcony | Balcony Cleaning |

`before-1` and `after-1` are styled placeholders. To use real Sahara photos:
1. Save your edited photos as `before-1.webp`, `after-1.webp` (add `before-2`, `after-2`... as needed).
2. In `src/config/service-slides.ts` change that folder's extension from `svg` to `webp`
   and add any extra pairs to its list.
3. Keep photos around 1600x1200 and under 300 KB each.
