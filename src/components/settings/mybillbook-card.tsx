"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Link2, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveMyBillBookSettings, clearMyBillBookSettings } from "@/server/actions/integrations";

export function MyBillBookCard({
  configured,
  source,
}: {
  configured: boolean;
  source: "db" | "env" | null;
}) {
  const [apiKey, setApiKey] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    if (!apiKey.trim()) {
      toast.error("Paste the API key MyBillBook issued for your account");
      return;
    }
    startTransition(async () => {
      const res = await saveMyBillBookSettings({ apiKey });
      if (res.error) toast.error(res.error);
      else {
        toast.success("MyBillBook connected");
        setApiKey("");
      }
      router.refresh();
    });
  }

  function disconnect() {
    startTransition(async () => {
      await clearMyBillBookSettings();
      toast.success("MyBillBook disconnected");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          MyBillBook
          {configured ? (
            <Badge variant="success">Connected{source === "env" ? " (env)" : ""}</Badge>
          ) : (
            <Badge variant="muted">Not connected</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          MyBillBook issues API access per account on request. Paste the key here to auto-sync invoices; until then,
          attach the MyBillBook invoice PDF to each payment manually.
        </p>
        {configured ? (
          <Button variant="outline" onClick={disconnect} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Link2Off className="size-3.5" />}
            Disconnect
          </Button>
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label>API Key</Label>
              <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="mbb_live_…" />
            </div>
            <Button onClick={save} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Link2 className="size-3.5" />}
              Connect
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
