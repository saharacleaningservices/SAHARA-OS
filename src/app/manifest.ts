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
      // Official brand PNG — used once dropped at public/brand/sahara-logo.png.
      { src: "/brand/sahara-logo.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
