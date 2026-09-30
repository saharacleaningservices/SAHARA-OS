import { Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CUSTOMER_REQUIREMENTS, HOME_DURATION, homePleaseNote, homeScopeByArea, tierFromPackage } from "@/lib/service-scope";

/**
 * The room-wise scope + exclusions of the full-house package that was sold,
 * from the same source the customer saw on the booking page — so office and
 * crew work to exactly what was booked. Renders nothing for other services.
 */
export function PackageScopeCard({ service, packageName, serviceVariant }: { service: string; packageName?: string | null; serviceVariant?: string | null }) {
  if (service !== "HOME_DEEP_CLEANING") return null;
  const tier = tierFromPackage(packageName, serviceVariant);
  if (!tier) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Package scope — {packageName || tier}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {tier === "Platinum" ? "Wall wet cleaning + ceiling dry dusting" : "Wall dry dusting + ceiling dry dusting"} · {HOME_DURATION}
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          {homeScopeByArea(tier).map((a) => (
            <div key={a.area}>
              <p className="text-xs font-semibold uppercase text-primary">{a.area}</p>
              <ul className="mt-1 space-y-0.5">
                {a.items.map((i) => (
                  <li key={i.item} className="flex gap-1.5 text-xs">
                    <Check className="mt-0.5 size-3 shrink-0 text-success" />
                    <span><span className="font-medium">{i.item}:</span> {i.method}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div>
          <p className="text-xs font-semibold">Not included / extra</p>
          <ul className="mt-1 space-y-0.5">
            {homePleaseNote(tier).map((s) => <li key={s} className="flex gap-1.5 text-xs text-muted-foreground"><X className="mt-0.5 size-3 shrink-0 text-destructive" />{s}</li>)}
          </ul>
        </div>
        <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Customer arranges:</span> {CUSTOMER_REQUIREMENTS.join(" · ")}</p>
      </CardContent>
    </Card>
  );
}
