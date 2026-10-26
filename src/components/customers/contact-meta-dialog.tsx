"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserCog } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CONTACT_TYPE_LABEL, categoryChoices } from "@/lib/contact-category";
import { updateContactMeta } from "@/server/actions/customer-sites";



/** Contact type, Repeat flag, name and email for one contact (Super Admin, Accounts). */
export function ContactMetaDialog({ mobile, initial }: { mobile: string; initial: { name: string; email: string | null; contactType: string; isRepeat: boolean } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: initial.name, email: initial.email ?? "", contactType: initial.contactType || "CUSTOMER", isRepeat: initial.isRepeat });
  const [pending, start] = useTransition();
  function save() {
    start(async () => {
      const r = await updateContactMeta({ mobile, ...f });
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success("Contact updated");
      setOpen(false);
      router.refresh();
    });
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm"><UserCog className="size-3.5" /> Edit contact</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="optional" />
          </div>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <Label>Category</Label>
              <select value={f.contactType} onChange={(e) => setF({ ...f, contactType: e.target.value })} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                {categoryChoices(initial.contactType).map((v) => <option key={v} value={v}>{CONTACT_TYPE_LABEL[v]}</option>)}
              </select>
            </div>
            <label className="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium">
              <Checkbox checked={f.isRepeat} onCheckedChange={(v) => setF({ ...f, isRepeat: !!v })} /> Repeat
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={save} disabled={pending}>{pending && <Loader2 className="size-4 animate-spin" />} Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
