"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Loader2, FileText, Trash2, Download, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { addCompanyDocument, deleteCompanyDocument } from "@/server/actions/company-documents";
import { COMPANY_DOC_CATEGORIES, COMPANY_DOC_LABELS } from "@/lib/company-documents";

type Doc = {
  id: string;
  category: string;
  label: string;
  url: string;
  createdAt: Date;
};

export function CompanyDocumentsPanel({
  documents,
  origin,
  companyName,
}: {
  documents: Doc[];
  origin: string;
  companyName: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState("PROFILE_PDF");
  const [label, setLabel] = useState("");
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
      fd.append("folder", "company-docs");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      startTransition(async () => {
        const r = await addCompanyDocument({
          category,
          label: label.trim() || COMPANY_DOC_LABELS[category],
          url: data.url,
          sizeBytes: file.size,
        });
        if (r.error) toast.error(r.error);
        else {
          toast.success("Document added");
          setLabel("");
        }
        router.refresh();
      });
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteCompanyDocument(id);
      router.refresh();
      toast.success("Document removed");
    });
  }

  function shareUrl(d: Doc) {
    return `${origin}${d.url}`;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Profile PDF, PPT, GST, Shop Act, MSME, certificates, brochures — upload once and share to customers over
          WhatsApp, email or a direct download link.
        </p>

        {documents.length === 0 ? (
          <EmptyState title="No documents yet" />
        ) : (
          <div className="space-y-2">
            {documents.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{d.label}</p>
                    <p className="text-xs text-muted-foreground">{COMPANY_DOC_LABELS[d.category] ?? d.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button asChild variant="outline" size="icon" className="size-8" title="Download">
                    <a href={d.url} target="_blank" rel="noreferrer" download>
                      <Download className="size-3.5" />
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="icon" className="size-8 text-success" title="Share on WhatsApp">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`${companyName} — ${d.label}: ${shareUrl(d)}`)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="size-3.5" />
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="icon" className="size-8" title="Share by email">
                    <a
                      href={`mailto:?subject=${encodeURIComponent(`${companyName} — ${d.label}`)}&body=${encodeURIComponent(`${d.label}:\n${shareUrl(d)}`)}`}
                    >
                      <Mail className="size-3.5" />
                    </a>
                  </Button>
                  <Button variant="outline" size="icon" className="size-8 text-destructive" onClick={() => remove(d.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_DOC_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {COMPANY_DOC_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Label (optional)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={COMPANY_DOC_LABELS[category]} />
            </div>
          </div>
          <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFile} />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload className="size-3.5" />}
            Upload document
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
