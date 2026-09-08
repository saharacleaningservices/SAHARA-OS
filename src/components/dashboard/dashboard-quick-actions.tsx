"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Phone, ClipboardList, Wallet, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toTelLink, toWhatsAppLink } from "@/lib/utils";

type Contact = { name: string; mobile: string };

function QuickCall({ contacts }: { contacts: Contact[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return contacts;
    return contacts.filter((c) => `${c.name} ${c.mobile}`.toLowerCase().includes(s));
  }, [contacts, q]);

  const dialDigits = q.replace(/\D/g, "");

  return (
    <>
      <Button variant="outline" className="h-auto w-full flex-col gap-1 py-3" onClick={() => setOpen(true)}>
        <Phone className="size-4" />
        <span className="text-xs">Quick Call</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Quick Call</DialogTitle>
            <DialogDescription>Search a recent customer or type a number to dial.</DialogDescription>
          </DialogHeader>
          <Input autoFocus inputMode="tel" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or number…" />
          {dialDigits.length >= 6 && (
            <a
              href={toTelLink(dialDigits)}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <Phone className="size-4" /> Dial {dialDigits}
            </a>
          )}
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {list.length === 0 ? (
              <p className="px-1 py-4 text-center text-sm text-muted-foreground">No recent contacts</p>
            ) : (
              list.map((c) => (
                <div key={c.mobile} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.mobile}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button asChild size="icon" variant="outline" className="size-8">
                      <a href={toTelLink(c.mobile)} title="Call">
                        <Phone className="size-3.5" />
                      </a>
                    </Button>
                    <Button asChild size="icon" variant="outline" className="size-8 text-success">
                      <a href={toWhatsAppLink(c.mobile)} target="_blank" rel="noreferrer" title="WhatsApp">
                        <svg viewBox="0 0 24 24" className="size-3.5 fill-current"><path d="M17.5 14.4c-.3-.1-1.7-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-1.7-.9-2.8-1.5-4-3.4-.3-.5.3-.5.8-1.6.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5 3 1.2 3 .8 3.5.8.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4 0-.1-.2-.2-.5-.3zM12 2a10 10 0 00-8.6 15l-1.3 4.6L6.8 20A10 10 0 1012 2z" /></svg>
                      </a>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DashboardQuickActions({
  contacts,
  showPayments = true,
}: {
  contacts: Contact[];
  showPayments?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <QuickCall contacts={contacts} />
      <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
        <Link href="/jobs?when=today">
          <ClipboardList className="size-4" />
          <span className="text-xs">Today&apos;s Jobs</span>
        </Link>
      </Button>
      {showPayments && (
        <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
          <Link href="/payments?filter=pending">
            <Wallet className="size-4" />
            <span className="text-xs">Collect Payment</span>
          </Link>
        </Button>
      )}
      <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
        <Link href="/jobs/dispatch">
          <Route className="size-4" />
          <span className="text-xs">Team Dispatch</span>
        </Link>
      </Button>
    </div>
  );
}
