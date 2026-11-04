# Schema and locality validation (2026-11-04)

| Item | Result | Action |
|---|---|---|
| Phones on 22 pages | PASS. Text 89565 67130, call links `tel:+918956567130`, WhatsApp `wa.me/919175220270`, no 70833 | none |
| JSON-LD | PASS. 22 blocks parse; FAQ in schema matches visible FAQ | run Rich Results Test on one page |
| Coordinates (`geo`, GeoCircle) | NOT VERIFIED. Approximate values (Mohammadwadi 18.469, 73.91) | Owner/maintainer: replace the branch `geo` with the pin from Google Maps before publishing |
| Pincodes | NOT VERIFIED against India Post (general knowledge) | spot-check against India Post; the URL slugs embed the pincode, so a wrong one needs a redirect |
| Photo placeholders | None exist. Pages reuse the old pages' stock images with localised alt text | add one real crew photo per locality |
| 4.9 rating / 1,830 reviews | CANNOT BE VERIFIED here. Live homepage carries two `aggregateRating` blocks: 4.9 (1,830) and 4.8 (234) | Owner: compare with the real Google review count. The 22 new pages deliberately carry no `aggregateRating`, and the branch node file does not either |

The rating is not copied into any new node. Self-serving or unsupported ratings risk a Google
manual action; keep it only on the node where it matches the actual Google profile.
