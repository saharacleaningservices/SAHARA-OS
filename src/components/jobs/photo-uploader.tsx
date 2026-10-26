"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addJobPhoto } from "@/server/actions/jobs";
import { compressToWebp } from "@/lib/image-compress";

export function PhotoUploader({ jobId, type }: { jobId: string; type: "BEFORE" | "AFTER" }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", await compressToWebp(file));
      formData.append("folder", "photos");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      startTransition(async () => {
        await addJobPhoto(jobId, type, data.url);
        toast.success(`${type === "BEFORE" ? "Before" : "After"} photo added`);
        router.refresh();
      });
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
        {uploading ? <Loader2 className="animate-spin" /> : <Camera className="size-3.5" />}
        Add {type === "BEFORE" ? "Before" : "After"} Photo
      </Button>
    </div>
  );
}
