"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { setStaffPhoto } from "@/server/actions/staff-photo";
import { initials } from "@/lib/utils";

/** Round profile photo with optional upload / change / remove. Photo is always optional. */
export function StaffPhotoUploader({
  staffId,
  name,
  photoUrl,
  canEdit,
  size = 56,
}: {
  /** Omit for the Staff App (server uses the signed-in staff member). */
  staffId?: string;
  name: string;
  photoUrl: string | null;
  canEdit: boolean;
  size?: number;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();

  async function onFile(file: File) {
    if (!file.type.startsWith("image/")) return void toast.error("Please choose a photo.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "staff");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) throw new Error(body.error || "Upload failed");
      const saved = await setStaffPhoto(staffId ?? null, body.url);
      if ("error" in saved && saved.error) throw new Error(saved.error);
      toast.success("Profile photo updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function remove() {
    start(async () => {
      const res = await setStaffPhoto(staffId ?? null, null);
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success("Photo removed");
      router.refresh();
    });
  }

  const working = busy || pending;
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={!canEdit || working}
        onClick={() => input.current?.click()}
        className="relative shrink-0 overflow-hidden rounded-full bg-primary text-primary-foreground disabled:cursor-default"
        style={{ width: size, height: size }}
        aria-label={canEdit ? "Upload profile photo" : name}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-lg font-bold">{initials(name)}</span>
        )}
        {canEdit && (
          <span className="absolute inset-x-0 bottom-0 flex justify-center bg-black/45 py-0.5">
            {working ? <Loader2 className="size-3.5 animate-spin text-white" /> : <Camera className="size-3.5 text-white" />}
          </span>
        )}
      </button>
      {canEdit && (
        <div className="flex flex-col gap-1 text-xs">
          <button type="button" disabled={working} onClick={() => input.current?.click()} className="text-left font-medium text-primary">
            {photoUrl ? "Change photo" : "Add photo (optional)"}
          </button>
          {photoUrl && (
            <button type="button" disabled={working} onClick={remove} className="flex items-center gap-1 text-left text-muted-foreground">
              <Trash2 className="size-3" /> Remove
            </button>
          )}
        </div>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
    </div>
  );
}
