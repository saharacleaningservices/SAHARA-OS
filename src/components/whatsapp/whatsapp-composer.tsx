"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendInboxReply, sendInboxTemplate } from "@/server/actions/whatsapp-inbox";

type TemplateOption = { name: string; category: string; purpose: string; body: string };

/**
 * Reply box for one WhatsApp conversation. Free-form text is only offered
 * inside the 24-hour customer service window (Meta rejects it otherwise);
 * outside it, staff pick an approved template and fill its {{n}} fields.
 * Every send asks for confirmation — nothing is sent automatically.
 */
export function WhatsAppComposer({
  number,
  ready,
  windowOpen,
  templates,
  defaultName,
}: {
  number: string;
  ready: boolean;
  windowOpen: boolean;
  templates: TemplateOption[];
  defaultName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [params, setParams] = useState<string[]>([]);

  const template = templates.find((t) => t.name === templateName) ?? null;
  const fields = useMemo(() => (template ? [...new Set(template.body.match(/\{\{\d+\}\}/g) ?? [])].length : 0), [template]);

  function pickTemplate(name: string) {
    setTemplateName(name);
    const t = templates.find((x) => x.name === name);
    const count = t ? [...new Set(t.body.match(/\{\{\d+\}\}/g) ?? [])].length : 0;
    setParams(Array.from({ length: count }, (_, i) => (i === 0 ? defaultName : "")));
  }

  function sendText() {
    if (!text.trim()) return;
    if (!confirm(`Send this WhatsApp message to +${number}?`)) return;
    startTransition(async () => {
      const res = await sendInboxReply({ number, text });
      if ("error" in res && res.error) return void toast.error(res.error);
      setText("");
      toast.success("Message sent.");
      router.refresh();
    });
  }

  function sendTemplate() {
    if (!template) return;
    if (!confirm(`Send template "${template.name}" (${template.category}) to +${number}?`)) return;
    startTransition(async () => {
      const res = await sendInboxTemplate({ number, templateName: template.name, params });
      if ("error" in res && res.error) return void toast.error(res.error);
      toast.success("Template sent.");
      router.refresh();
    });
  }

  if (!ready) {
    return <p className="text-xs text-muted-foreground">Connect the WhatsApp Cloud API in Settings → Integrations to reply.</p>;
  }

  return (
    <div className="space-y-3">
      {windowOpen ? (
        <div className="flex gap-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a reply…" rows={2} className="flex-1" />
          <Button type="button" onClick={sendText} disabled={pending || !text.trim()}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          No customer message in the last 24 hours — WhatsApp only allows an approved template now.
        </p>
      )}

      <div className="space-y-2 rounded-md border p-3">
        <select
          value={templateName}
          onChange={(e) => pickTemplate(e.target.value)}
          className="h-9 w-full rounded-md border bg-background px-2 text-sm"
        >
          <option value="">Send an approved template…</option>
          {templates.map((t) => (
            <option key={t.name} value={t.name}>
              {t.purpose} — {t.name} ({t.category})
            </option>
          ))}
        </select>
        {template && (
          <>
            <p className="whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs text-muted-foreground">{template.body}</p>
            {Array.from({ length: fields }, (_, i) => (
              <input
                key={i}
                value={params[i] ?? ""}
                onChange={(e) => setParams((p) => Object.assign([...p], { [i]: e.target.value }))}
                placeholder={`{{${i + 1}}}`}
                className="h-8 w-full rounded-md border bg-background px-2 text-sm"
              />
            ))}
            <Button type="button" size="sm" onClick={sendTemplate} disabled={pending || params.some((p) => !p.trim())}>
              {pending && <Loader2 className="size-4 animate-spin" />} Send template
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
