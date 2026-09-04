"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addVoiceNote } from "@/server/actions/leads";

export function VoiceRecorder({ leadId }: { leadId: string }) {
  const [state, setState] = useState<"idle" | "recording" | "uploading">("idle");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  async function start() {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Recording isn't supported on this device");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        stopTimer();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size < 1024) {
          setState("idle");
          setSeconds(0);
          return;
        }
        await upload(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone permission denied");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setState("uploading");
  }

  async function upload(blob: Blob) {
    setState("uploading");
    try {
      const ext = (blob.type.split("/")[1] || "webm").split(";")[0];
      const body = new FormData();
      body.append("file", new File([blob], `voice.${ext}`, { type: blob.type }));
      body.append("folder", "voice");
      const res = await fetch("/api/upload", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Upload failed");
        setState("idle");
        return;
      }
      const saved = await addVoiceNote(leadId, json.url);
      if (saved.error) {
        toast.error(saved.error);
      } else {
        toast.success("Voice note added");
        router.refresh();
      }
    } catch {
      toast.error("Could not save the recording");
    } finally {
      setState("idle");
      setSeconds(0);
    }
  }

  if (state === "recording") {
    return (
      <Button type="button" variant="destructive" size="sm" onClick={stop} className="gap-2">
        <Square className="size-3.5 fill-current" />
        {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-9"
      onClick={start}
      disabled={state === "uploading"}
      aria-label="Record voice note"
    >
      {state === "uploading" ? <Loader2 className="animate-spin" /> : <Mic className="size-4" />}
    </Button>
  );
}
