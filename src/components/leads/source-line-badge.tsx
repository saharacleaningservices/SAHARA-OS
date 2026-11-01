import { Badge } from "@/components/ui/badge";
import { SOURCE_LINE_LABELS, isSourceLine } from "@/lib/source-line";

/** Which business line the enquiry came in on (hidden for the default "Main" legacy value unless `always`). */
export function SourceLineBadge({ line, className, always }: { line?: string | null; className?: string; always?: boolean }) {
  if (!isSourceLine(line) || (line === "Main" && !always)) return null;
  const tone = line === "Shoyab-GMB" ? "border-primary/40 bg-primary/10 text-primary" : line === "Francis-Direct" ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-border";
  return (
    <Badge variant="outline" className={`shrink-0 text-[10px] ${tone} ${className ?? ""}`}>
      {SOURCE_LINE_LABELS[line]}
    </Badge>
  );
}
