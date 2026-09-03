import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sahara OS — Sahara Cleaning Services",
  description:
    "Internal business operating system for Sahara Cleaning Services — leads, jobs, staff, payments and profit in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
