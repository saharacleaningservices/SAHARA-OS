"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bot, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setInboxConversationMode } from "@/server/actions/whatsapp-inbox";

/** Human takeover control: staff can take a conversation from the AI assistant (or hand it back) at any time. */
export function ConversationModeToggle({ number, mode, changedBy }: { number: string; mode: "AI" | "HUMAN"; changedBy?: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = mode === "AI" ? "HUMAN" : "AI";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${mode === "AI" ? "bg-violet-100 text-violet-800" : "bg-emerald-100 text-emerald-800"}`}>
        {mode === "AI" ? <Bot className="size-3" /> : <UserRound className="size-3" />}
        {mode === "AI" ? "AI assistant" : "Staff handling"}
      </span>
      {changedBy && <span className="text-muted-foreground">by {changedBy}</span>}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await setInboxConversationMode({ number, mode: next });
            if ("error" in res && res.error) return void toast.error(res.error);
            toast.success(next === "HUMAN" ? "You took over this conversation." : "Handed back to the AI assistant.");
            router.refresh();
          })
        }
      >
        {next === "HUMAN" ? "Take over" : "Hand back to AI"}
      </Button>
    </div>
  );
}
