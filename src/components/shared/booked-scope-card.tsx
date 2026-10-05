import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Package price type + the Scope of Work frozen/edited on the lead or job. Renders nothing when empty. */
export function BookedScopeCard({ priceType, festivalName, scopeOfWork }: { priceType?: string | null; festivalName?: string | null; scopeOfWork?: string | null }) {
  if (!priceType && !scopeOfWork) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Scope of work (as booked)</CardTitle>
        {priceType && (
          <p className="text-xs text-muted-foreground">
            Price: <span className="font-medium text-foreground">{priceType === "FESTIVAL" ? `Festival Special${festivalName ? ` · ${festivalName}` : ""}` : "Regular"}</span>
          </p>
        )}
      </CardHeader>
      {scopeOfWork && (
        <CardContent>
          <p className="whitespace-pre-line text-sm">{scopeOfWork}</p>
        </CardContent>
      )}
    </Card>
  );
}
