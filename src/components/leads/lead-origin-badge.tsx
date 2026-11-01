import { Badge } from "@/components/ui/badge";
import { leadOrigin, originTone, type OriginInput } from "@/lib/lead-origin";

/** Where the lead came from — GMB Magarpatta / GMB Mohammadwadi / Google Ads / Meta Ads / Direct Web. Works on a full Lead row or a stored label. */
export function LeadOriginBadge({ lead, label, className }: { lead?: OriginInput | null; label?: string | null; className?: string }) {
  const text = label || (lead ? leadOrigin(lead) : null);
  if (!text) return null;
  const tone = originTone[text as keyof typeof originTone] ?? originTone.Other;
  return <Badge variant="outline" className={`shrink-0 text-[10px] ${tone} ${className ?? ""}`}>{text}</Badge>;
}
