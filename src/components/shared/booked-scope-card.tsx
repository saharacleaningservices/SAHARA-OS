import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isAutoScope } from "@/lib/service-scope";

/**
 * What was booked, compactly: package price type, one line per booked
 * service ("Full Home Cleaning — Premium", "Sofa Cleaning × 5 seats") and only
 * scope text staff actually typed — never the auto-generated room-by-room
 * package sentence (that belongs on customer-facing scope documents).
 * Renders nothing when empty.
 */
export function BookedScopeCard({
  priceType,
  festivalName,
  scopeOfWork,
  services = [],
}: {
  priceType?: string | null;
  festivalName?: string | null;
  scopeOfWork?: string | null;
  services?: string[];
}) {
  const customScope = scopeOfWork && !isAutoScope(scopeOfWork) ? scopeOfWork : null;
  // Older records with no compact data keep showing their saved scope.
  const fallbackScope = !services.length && !customScope ? scopeOfWork : null;
  if (!priceType && !services.length && !customScope && !fallbackScope) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Booked services</CardTitle>
        {priceType && (
          <p className="text-xs text-muted-foreground">
            Price: <span className="font-medium text-foreground">{priceType === "FESTIVAL" ? `Festival Special${festivalName ? ` · ${festivalName}` : ""}` : "Regular"}</span>
          </p>
        )}
      </CardHeader>
      {(services.length > 0 || customScope || fallbackScope) && (
        <CardContent className="space-y-2">
          {services.length > 0 && (
            <ul className="space-y-0.5 text-sm font-medium">
              {services.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
          {(customScope || fallbackScope) && <p className="whitespace-pre-line text-sm text-muted-foreground">{customScope || fallbackScope}</p>}
        </CardContent>
      )}
    </Card>
  );
}
