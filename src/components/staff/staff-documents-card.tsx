"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Loader2, FileText, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { addStaffDocument, removeStaffDocument } from "@/server/actions/staff";

type Doc = { label: string; url: string; uploadedAt: string };

const DOC_LABELS = ["Aadhaar", "PAN", "Bank Passbook", "Joining Letter", "Other"];

export function StaffDocumentsCard({
  staffId,
  documents,
  canEdit,
}: {
  staffId: string;
  documents: Doc[];
  canEdit: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("Aadhaar");
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "staff-docs");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      startTransition(async () => {
        const r = await addStaffDocument(staffId, { label, url: data.url });
        if (r.error) toast.error(r.error);
        else toast.success("Document added");
        router.refresh();
      });
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(url: string) {
    startTransition(async () => {
      await removeStaffDocument(staffId, url);
      router.refresh();
      toast.success("Document removed");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-4" /> Document Folder
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {documents.length === 0 ? (
          <EmptyState title="No documents" description="Aadhaar, PAN, passbook, joining letter…" />
        ) : (
          <div className="space-y-2">
            {documents.map((d) => (
              <div key={d.url} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{d.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(d.uploadedAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button asChild variant="outline" size="icon" className="size-8">
                    <a href={d.url} target="_blank" rel="noreferrer" title="Open / download">
                      <Download className="size-3.5" />
                    </a>
                  </Button>
                  {canEdit && (
                    <Button variant="outline" size="icon" className="size-8 text-destructive" onClick={() => remove(d.url)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Select value={label} onValueChange={setLabel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_LABELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <Upload className="size-3.5" />}
              Upload
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
