"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { role: "Admin", email: "admin@saharacleaningservices.com" },
  { role: "Operations", email: "operations@saharacleaningservices.com" },
  { role: "Accounts", email: "accounts@saharacleaningservices.com" },
  { role: "Supervisor", email: "supervisor@saharacleaningservices.com" },
  { role: "Staff", email: "staff@saharacleaningservices.com" },
];

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      router.push(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="email" type="email" placeholder="you@saharacleaningservices.com" className="pl-8" {...register("email")} />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="password" type="password" placeholder="••••••••" className="pl-8" {...register("password")} />
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="animate-spin" />}
          Sign in
        </Button>
      </form>

      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Demo accounts (password: Sahara@2026)</p>
        <div className="grid grid-cols-1 gap-1">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => {
                setValue("email", acc.email);
                setValue("password", "Sahara@2026");
              }}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
            >
              <span className="font-medium text-foreground">{acc.role}</span>
              <span className="text-muted-foreground">{acc.email}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
