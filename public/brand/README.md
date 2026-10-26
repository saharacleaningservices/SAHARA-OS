# Sahara brand assets

Drop the official logo here as **`sahara-logo.png`** (transparent background,
original proportions). Once committed + deployed it becomes the default logo
across the CRM, login, booking page and every PDF (quotation / invoice /
receipt / job card / payslip). No code change is needed — `CompanyLogo`
already resolves to `/brand/sahara-logo.png` first, then the admin-uploaded
logo from Settings, then the bundled SVG placeholder.

Favicon / PWA home-screen icon: replace `public/icon.svg` (or add
`public/brand/sahara-logo.png` and update `src/app/manifest.ts` +
`src/app/apple-icon.tsx`).
