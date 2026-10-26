import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sahara OS — Sahara Cleaning Services",
    short_name: "Sahara OS",
    description: "Internal business operating system for Sahara Cleaning Services.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0B5ED7",
    icons: [
      // Square, aspect-correct icons (the wide logo on a white square, never stretched). The maskable one keeps the logo
      // inside the 80% safe zone so round / rounded launcher masks do not crop it. Separate entries: purpose "any" and "maskable".
      { src: "/brand/crm-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/crm-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/crm-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
