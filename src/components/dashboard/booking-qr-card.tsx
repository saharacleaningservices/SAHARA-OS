"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

// QR to the public booking form for visiting cards, flyers and banners. Generated in the browser
// (no request, no stored file); PNG is 1024 px for print, SVG scales to any size.
export function BookingQrCard({ url }: { url: string }) {
  const [svg, setSvg] = useState("");
  const [png, setPng] = useState("");

  useEffect(() => {
    const opts = { margin: 2, errorCorrectionLevel: "M" as const, color: { dark: "#0a2540", light: "#ffffff" } };
    void QRCode.toString(url, { ...opts, type: "svg" }).then(setSvg).catch(() => setSvg(""));
    void QRCode.toDataURL(url, { ...opts, width: 1024 }).then(setPng).catch(() => setPng(""));
  }, [url]);

  const save = (href: string, name: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const saveSvg = () => {
    const blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    save(blobUrl, "sahara-booking-qr.svg");
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
      <div className="size-24 shrink-0 overflow-hidden rounded-lg border bg-white p-1 [&>svg]:size-full" aria-label="Booking form QR code" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="flex items-center gap-1.5 text-sm font-semibold"><QrCode className="size-4 text-primary" /> Booking Form QR</p>
        <p className="truncate text-xs text-muted-foreground" title={url}>{url.replace(/^https?:\/\//, "")}</p>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant="outline" className="h-8" disabled={!png} onClick={() => save(png, "sahara-booking-qr.png")}>
            <Download className="size-3.5" /> PNG
          </Button>
          <Button type="button" size="sm" variant="outline" className="h-8" disabled={!svg} onClick={saveSvg}>
            <Download className="size-3.5" /> SVG
          </Button>
        </div>
      </div>
    </div>
  );
}
