"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, Star, Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  GALLERY_CATEGORIES,
  GALLERY_KIND_LABELS,
  type GalleryItemView,
} from "@/lib/gallery";
import { addGalleryItem, deleteGalleryItem, toggleGalleryFeatured } from "@/server/actions/gallery";

// canManage: upload / feature / delete are Super Admin only (enforced again in the server actions).
export function GalleryAdminPanel({ items, canManage = false }: { items: GalleryItemView[]; canManage?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<"PHOTO" | "VIDEO">("PHOTO");
  const [kind, setKind] = useState("GENERAL");
  const [category, setCategory] = useState<string>(GALLERY_CATEGORIES[0]);
  const [caption, setCaption] = useState("");
  const [pairKey, setPairKey] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith("video/");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", isVideo ? "videos" : "gallery");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Upload failed");
        return;
      }
      startTransition(async () => {
        const r = await addGalleryItem({
          type: isVideo ? "VIDEO" : "PHOTO",
          kind: isVideo ? "GENERAL" : kind,
          category,
          url: data.url,
          caption: caption.trim() || null,
          pairKey: pairKey.trim() || null,
        });
        if (r.error) toast.error(r.error);
        else {
          toast.success("Added to gallery");
          setCaption("");
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
      await deleteGalleryItem(id);
      router.refresh();
      toast.success("Removed");
    });
  }

  function toggleFeatured(id: string, next: boolean) {
    startTransition(async () => {
      await toggleGalleryFeatured(id, next);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gallery</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Upload before/after photos and result videos. Featured items appear on the public booking page, the
          shareable <span className="font-medium">/gallery</span> link and in review campaigns. Pair a Before and an
          After photo by giving them the same <span className="font-medium">Pair tag</span>.
        </p>
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          Upload only genuine Sahara job photos that the customer has agreed can be shown publicly. Remove faces, house numbers,
          nameplates and other identifying details first. Featured photos are shown on the public website.
        </p>

        {!canManage && (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            View only — the Super Admin uploads, features and removes gallery items.
          </p>
        )}
        {canManage && (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "PHOTO" | "VIDEO")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PHOTO">Photo</SelectItem>
                  <SelectItem value="VIDEO">Video</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {type === "PHOTO" && (
              <div className="space-y-1">
                <Label>Stage</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BEFORE">Before</SelectItem>
                    <SelectItem value="AFTER">After</SelectItem>
                    <SelectItem value="GENERAL">Showcase</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GALLERY_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {type === "PHOTO" && kind !== "GENERAL" && (
              <div className="space-y-1">
                <Label>Pair tag (Before + After)</Label>
                <Input value={pairKey} onChange={(e) => setPairKey(e.target.value)} placeholder="e.g. flat-201-kitchen" />
              </div>
            )}
            <div className="space-y-1 sm:col-span-2">
              <Label>Caption (optional)</Label>
              <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Kitchen deep cleaning — Magarpatta" />
            </div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={type === "VIDEO" ? "video/mp4,video/webm,video/quicktime" : "image/*"}
            className="hidden"
            onChange={handleFile}
          />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading || pending}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload className="size-3.5" />}
            Upload {type === "VIDEO" ? "video" : "photo"}
          </Button>
        </div>
        )}

        {items.length === 0 ? (
          <EmptyState title="Gallery is empty" description="Upload before/after photos and videos to feature them on the booking page." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((it) => (
              <div key={it.id} className="overflow-hidden rounded-lg border border-border">
                <div className="relative aspect-square w-full bg-muted">
                  {it.type === "VIDEO" ? (
                    <video src={it.url} className="h-full w-full object-cover" muted playsInline />
                  ) : (
                    <img src={it.url} alt={it.caption ?? "Gallery"} className="h-full w-full object-cover" />
                  )}
                  <span className="absolute left-1 top-1 flex items-center gap-1">
                    <Badge variant="muted" className="text-[10px]">
                      {it.type === "VIDEO" ? <VideoIcon className="size-3" /> : <ImageIcon className="size-3" />}
                      {GALLERY_KIND_LABELS[it.kind] ?? it.kind}
                    </Badge>
                  </span>
                </div>
                <div className="space-y-1.5 p-2">
                  <p className="truncate text-[11px] text-muted-foreground" title={it.caption ?? ""}>
                    {it.caption || it.category || "—"}
                  </p>
                  {canManage && (
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`size-7 ${it.featured ? "text-yellow-500" : "text-muted-foreground"}`}
                      title={it.featured ? "Featured — click to hide" : "Hidden — click to feature"}
                      onClick={() => toggleFeatured(it.id, !it.featured)}
                    >
                      <Star className={`size-3.5 ${it.featured ? "fill-current" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7 text-destructive" onClick={() => remove(it.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
