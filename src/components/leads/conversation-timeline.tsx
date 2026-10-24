"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MessageSquare,
  Mic,
  PhoneCall,
  GitBranch,
  FileText,
  ClipboardList,
  IndianRupee,
  CalendarClock,
  Info,
  Send,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceRecorder } from "./voice-recorder";
import { CallLogDialog } from "./call-log-dialog";
import { addNote } from "@/server/actions/leads";
import { formatDateTime } from "@/lib/utils";
import { tidyTimeline } from "@/lib/timeline-tidy";

type Entry = {
  id: string;
  type: string;
  body: string | null;
  audioUrl: string | null;
  createdAt: Date;
  author: { name: string } | null;
};

const BUBBLE_TYPES = new Set(["NOTE", "VOICE", "CALL"]);

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  NOTE: MessageSquare,
  VOICE: Mic,
  CALL: PhoneCall,
  STAGE: GitBranch,
  QUOTATION: FileText,
  JOB: ClipboardList,
  PAYMENT: IndianRupee,
  FOLLOW_UP: CalendarClock,
  SYSTEM: Info,
};

export function ConversationTimeline({ leadId, entries }: { leadId: string; entries: Entry[] }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const feedRef = useRef<HTMLDivElement>(null);
  const tidy = tidyTimeline(entries); // no placeholder notes, no repeated system lines

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [entries.length]);

  function sendNote() {
    const text = body.trim();
    if (!text) return;
    startTransition(async () => {
      const res = await addNote(leadId, { body: text });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <div className="flex h-[32rem] flex-col">
      <div ref={feedRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
        {tidy.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No conversation yet. Add a note or record a voice memo below.
          </p>
        ) : (
          tidy.map((e) => {
            const Icon = TYPE_ICON[e.type] ?? Info;
            if (!BUBBLE_TYPES.has(e.type)) {
              return (
                <div key={e.id} className="flex justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
                    <Icon className="size-3" />
                    {e.body}
                    <span className="opacity-60">· {formatDateTime(e.createdAt)}</span>
                  </span>
                </div>
              );
            }
            return (
              <div key={e.id} className="flex gap-2.5">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-3.5" />
                </div>
                <div className="min-w-0 flex-1 rounded-lg rounded-tl-none border border-border bg-card p-2.5">
                  {e.type === "VOICE" && e.audioUrl ? (
                    <audio controls src={e.audioUrl} className="h-9 w-full max-w-xs" />
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">{e.body}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {e.author?.name ? `${e.author.name} · ` : ""}
                    {formatDateTime(e.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 space-y-2 border-t border-border pt-3">
        <Textarea
          value={body}
          onChange={(ev) => setBody(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
              ev.preventDefault();
              sendNote();
            }
          }}
          rows={2}
          placeholder="Type a note…  (⌘/Ctrl + Enter to send)"
          className="resize-none"
        />
        <div className="flex items-center gap-2">
          <VoiceRecorder leadId={leadId} />
          <CallLogDialog leadId={leadId} />
          <Button type="button" onClick={sendNote} disabled={pending || !body.trim()} className="ml-auto">
            {pending ? <Loader2 className="animate-spin" /> : <Send className="size-4" />}
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
