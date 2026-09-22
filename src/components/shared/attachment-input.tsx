"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Loader2, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Upload a single PDF / image to a document folder and report back its URL.
 * Used for invoice attachments and other doc uploads inside forms.
 */
export function AttachmentInput({
  value,
  onChange,
  folder,
  label = "Attachment",
}: {
  value: string;
  onChange: (url: string) => void;
  folder: "invoices" | "company-docs" | "staff-docs";
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", folder);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      onChange(data.url);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{label}</p>
      <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
      {value ? (
        <div className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
          <a href={value} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary">
            <FileText className="size-3.5" /> View file
          </a>
          <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => onChange("")}>
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="animate-spin" /> : <Upload className="size-3.5" />}
          Upload PDF / image
        </Button>
      )}
    </div>
  );
}
