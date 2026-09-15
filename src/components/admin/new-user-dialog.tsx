"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, UserPlus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { createUserSchema, type CreateUserFormValues } from "@/lib/validation";
import { ROLE_LABELS } from "@/lib/constants";
import { createUser } from "@/server/actions/users";

const ROLES: CreateUserFormValues["role"][] = ["ADMIN", "OPERATIONS", "ACCOUNTS", "SUPERVISOR", "STAFF"];

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function NewUserDialog() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "STAFF", password: randomPassword() },
  });

  async function onSubmit(values: CreateUserFormValues) {
    setSubmitting(true);
    const res = await createUser(values);
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("User created");
    setCreated({ email: values.email, password: values.password });
    router.refresh();
  }

  function closeAndReset() {
    setOpen(false);
    setCreated(null);
    setCopied(false);
    reset({ role: "STAFF", password: randomPassword(), name: "", email: "", phone: "" });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) closeAndReset();
        else setOpen(true);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="size-4" /> New User
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>User created</DialogTitle>
              <DialogDescription>
                Share this temporary password with {created.email} — they'll be asked to set their own on first
                login. This is shown only once.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <code className="text-sm font-medium text-foreground">{created.password}</code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(created.password).catch(() => {});
                  setCopied(true);
                }}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={closeAndReset}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>New User</DialogTitle>
              <DialogDescription>Create a login for a team member and assign their role.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Mobile (optional)</Label>
                <Input {...register("phone")} inputMode="tel" placeholder="10-digit mobile" />
                {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
              </div>
              <div className="space-y-1">
                <Label>Role</Label>
                <Select value={watch("role")} onValueChange={(v) => setValue("role", v as CreateUserFormValues["role"])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r] ?? r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Temporary password</Label>
                <div className="flex gap-2">
                  <Input {...register("password")} />
                  <Button type="button" variant="outline" onClick={() => setValue("password", randomPassword())}>
                    Regenerate
                  </Button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
                <p className="text-xs text-muted-foreground">They'll be asked to set their own password on first login.</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeAndReset}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="animate-spin" />}
                  Create User
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
