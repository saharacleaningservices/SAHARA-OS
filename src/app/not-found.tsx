import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-lg font-semibold text-foreground">Page not found</p>
      <p className="text-sm text-muted-foreground">This link may be old or the record was removed.</p>
      <Link href="/dashboard" className="flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">
        Go to dashboard
      </Link>
    </div>
  );
}
