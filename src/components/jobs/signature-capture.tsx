"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import SignaturePad from "signature_pad";
import { Eraser, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveJobSignature } from "@/server/actions/jobs";

export function SignatureCapture({ jobId, existingUrl }: { jobId: string; existingUrl: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [pending, startTransition] = useTransition();
  const [captured, setCaptured] = useState(!!existingUrl);
  const router = useRouter();

  useEffect(() => {
    if (!canvasRef.current || captured) return;
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
    padRef.current = new SignaturePad(canvas, { backgroundColor: "rgb(255,255,255)", penColor: "rgb(10,37,64)" });
    return () => padRef.current?.off();
  }, [captured]);

  function clear() {
    padRef.current?.clear();
  }

  function save() {
    if (!padRef.current || padRef.current.isEmpty()) {
      toast.error("Please capture a signature first");
      return;
    }
    const dataUrl = padRef.current.toDataURL("image/png");
    startTransition(async () => {
      const res = await saveJobSignature(jobId, dataUrl);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Signature saved");
      setCaptured(true);
      router.refresh();
    });
  }

  if (captured) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-center rounded-lg border border-border bg-white p-3">
          {existingUrl && <img src={existingUrl} alt="Customer signature" className="h-20 object-contain" />}
        </div>
        <Button variant="outline" size="sm" onClick={() => setCaptured(false)}>
          Re-capture signature
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="signature-canvas h-32 w-full rounded-lg border border-dashed border-border bg-white"
      />
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          <Eraser className="size-3.5" /> Clear
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Check className="size-3.5" />}
          Save signature
        </Button>
      </div>
    </div>
  );
}
