"use client";

import { useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HandCoins, Banknote, Bell, Phone, MessageCircle, Mail, ReceiptText, Loader2 } from "lucide-react";
import { SearchInput } from "@/components/shared/search-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EditPaymentDialog } from "./edit-payment-dialog";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { SendPaymentLinkButton } from "@/components/shared/send-payment-link-button";
import type { CompanyPaymentDetails } from "@/components/shared/payment-details-box";
import { bulkDeletePayments, recordCollection, recordReminder } from "@/server/actions/payments";
import { computePaymentStatus, pendingDays } from "@/lib/payment-status";
import { formatINR, formatDate, cn, toWhatsAppLink, toTelLink, dayBucket } from "@/lib/utils";
import { PAYMENT_MODE_LABELS, PAYMENT_MODES } from "@/lib/constants";
import { paymentReceiptMessage, paymentReminderWhatsAppMessage } from "@/lib/whatsapp-templates";

type Payment = {
id: string;
invoiceNumber: string;
refNumber: string;
clientName: string;
clientMobile: string | null;
amount: number;
paidAmount: number;
dueDate: Date;
status: string;
mode: string | null;
serviceLabel: string | null;
serviceVariant: string | null;
packageName: string | null;
invoiceAttachmentUrl: string | null;
mybillbookInvoiceNo: string | null;
notes: string | null;
};

const PAGE_SIZE = 12;
const FILTERS = ["ALL", "PENDING", "PARTIAL", "PAID", "TODAY", "TOMORROW", "OVERDUE"] as const;
const FILTER_LABELS: Record<string, string> = {
ALL: "All", PENDING: "Pending", PARTIAL: "Partial", PAID: "Paid", TODAY: "Due Today", TOMORROW: "Due Tomorrow", OVERDUE: "Overdue",
};

function derivedStatus(p: Payment) {
if (p.status === "PAID" || p.paidAmount >= p.amount - 0.01) return "PAID";
if (p.paidAmount > 0) return "PARTIAL";
return computePaymentStatus(p.dueDate, p.status);
}

const STATUS_BADGE: Record<string, "success" | "warning" | "destructive" | "muted" | "info"> = {
PAID: "success", PARTIAL: "info", DUE_SOON: "warning", OVERDUE: "destructive", PENDING: "muted",
};
const STATUS_LABEL: Record<string, string> = {
PAID: "Paid", PARTIAL: "Partial", DUE_SOON: "Due Soon", OVERDUE: "Overdue", PENDING: "Pending",
};

/** "Record" — log a specific collected amount + mode (cash in hand, a UPI/
* bank transfer already received, etc.) without necessarily clearing the
* full outstanding balance. Complements the one-tap "Collect" action. */
function RecordPaymentPopover({ p }: { p: Payment }) {
const [open, setOpen] = useState(false);
const [amount, setAmount] = useState("");
const [mode, setMode] = useState<string>("CASH");
const [pending, startTransition] = useTransition();
const router = useRouter();
const balance = Math.max(p.amount - p.paidAmount, 0);

function submit() {
const amt = Number(amount);
if (!amt || amt <= 0) {
toast.error("Enter a valid amount");
return;
}
startTransition(async () => {
const res = await recordCollection(p.id, { amount: amt, mode: mode as "CASH" | "UPI" | "QR" | "BANK" });
if (res.error) {
toast.error(res.error);
return;
}
toast.success(res.fullyPaid ? "Fully paid" : "Payment recorded");
setOpen(false);
setAmount("");
router.refresh();
});
}

return (
<Popover open={open} onOpenChange={setOpen}>
<PopoverTrigger asChild>
<Button type="button" variant="outline" size="icon" className="size-8" title="Record a payment">
<Banknote className="size-3.5" />
</Button>
</PopoverTrigger>
<PopoverContent className="w-56 space-y-2" align="end">
<p className="text-xs font-medium text-muted-foreground">Record payment · balance {formatINR(balance)}</p>
<Input
type="number"
inputMode="decimal"
placeholder="Amount received"
value={amount}
onChange={(e) => setAmount(e.target.value)}
className="h-8"
/>
<Select value={mode} onValueChange={setMode}>
<SelectTrigger className="h-8">
<SelectValue />
</SelectTrigger>
<SelectContent>
{PAYMENT_MODES.map((m) => (
<SelectItem key={m} value={m}>{PAYMENT_MODE_LABELS[m]}</SelectItem>
))}
</SelectContent>
</Select>
<Button size="sm" className="w-full" onClick={submit} disabled={pending}>
{pending && <Loader2 className="size-3.5 animate-spin" />} Save
</Button>
</PopoverContent>
</Popover>
);
}

/** "Reminder" — every customer-outreach action for this invoice (call,
* WhatsApp reminder, payment link, receipt, email) collapsed into one
* popover so the row keeps a single button. */
function ReminderPopover({ p, details }: { p: Payment; details: CompanyPaymentDetails }) {
const [, startTransition] = useTransition();
const balance = Math.max(p.amount - p.paidAmount, 0);

function log(channel: "WHATSAPP" | "EMAIL" | "CALL") {
startTransition(() => {
recordReminder(p.id, channel);
});
}

const reminderMessage = paymentReminderWhatsAppMessage({
clientName: p.clientName,
invoiceNumber: p.invoiceNumber,
balance,
dueDate: p.dueDate,
});
const receiptMessage = paymentReceiptMessage({
customerName: p.clientName,
bookingId: p.refNumber,
service: p.serviceLabel,
amountPaid: p.paidAmount,
mode: p.mode,
balance,
});
const subject = encodeURIComponent(`Payment reminder — Invoice ${p.invoiceNumber}`);
const body = encodeURIComponent(
`Hi ${p.clientName}, this is a payment reminder for invoice ${p.invoiceNumber} of ${formatINR(p.amount)}. Kindly clear it at your earliest convenience. Thank you!`,
);

const itemClass = "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted";

return (
<Popover>
<PopoverTrigger asChild>
<Button type="button" variant="outline" size="icon" className="size-8" title="Reminder / receipt">
<Bell className="size-3.5" />
</Button>
</PopoverTrigger>
<PopoverContent className="w-60 space-y-0.5 p-2" align="end">
{p.clientMobile && (
<a href={toTelLink(p.clientMobile)} onClick={() => log("CALL")} className={itemClass}>
<Phone className="size-3.5" /> Call
</a>
)}
{p.clientMobile && balance > 0 && (
<a
href={toWhatsAppLink(p.clientMobile, reminderMessage)}
target="_blank"
rel="noreferrer"
onClick={() => log("WHATSAPP")}
className={cn(itemClass, "text-success")}
>
<MessageCircle className="size-3.5" /> WhatsApp Reminder
</a>
)}
{balance > 0 && (
<SendPaymentLinkButton
mobile={p.clientMobile}
details={details}
context={{
customerName: p.clientName,
bookingId: p.refNumber,
service: p.serviceLabel,
packageName: p.packageName,
quote: p.amount,
advance: p.paidAmount,
balance,
}}
purpose="BALANCE"
variant="ghost"
size="sm"
className="w-full justify-start px-2 font-normal"
/>
)}
{p.clientMobile && (
<a href={toWhatsAppLink(p.clientMobile, receiptMessage)} target="_blank" rel="noreferrer" className={itemClass}>
<ReceiptText className="size-3.5" /> Send Receipt
</a>
)}
<a href={`mailto:?subject=${subject}&body=${body}`} onClick={() => log("EMAIL")} className={itemClass}>
<Mail className="size-3.5" /> Email Reminder
</a>
</PopoverContent>
</Popover>
);
}

function RowActions({ p, details }: { p: Payment; details: CompanyPaymentDetails }) {
const [pending, startTransition] = useTransition();
const router = useRouter();
const st = derivedStatus(p);

function collectFull() {
startTransition(async () => {
const res = await recordCollection(p.id, { full: true });
if (res.error) {
toast.error(res.error);
return;
}
toast.success(res.fullyPaid ? "Fully paid" : "Collection recorded");
router.refresh();
});
}

return (
<div className="flex items-center justify-end gap-1">
{st !== "PAID" && (
<Button
type="button"
size="icon"
variant="success"
className="size-8"
onClick={collectFull}
disabled={pending}
title="Collect full balance"
>
{pending ? <Loader2 className="size-3.5 animate-spin" /> : <HandCoins className="size-3.5" />}
</Button>
)}
{st !== "PAID" && <RecordPaymentPopover p={p} />}
<ReminderPopover p={p} details={details} />
<EditPaymentDialog payment={p} />
</div>
);
}

export function PaymentsExplorer({
payments,
paymentDetails,
}: {
payments: Payment[];
paymentDetails: CompanyPaymentDetails;
}) {
const params = useSearchParams();
const [search, setSearch] = useState("");
const [filter, setFilter] = useState<string>((params.get("filter") ?? "ALL").toUpperCase());
const [page, setPage] = useState(1);
const [selected, setSelected] = useState<string[]>([]);

const filtered = useMemo(() => {
const q = search.trim().toLowerCase();
return payments.filter((p) => {
if (q && !`${p.clientName} ${p.invoiceNumber} ${p.refNumber}`.toLowerCase().includes(q)) return false;
const st = derivedStatus(p);
const bucket = dayBucket(p.dueDate);
switch (filter) {
case "PENDING": return st === "PENDING" || st === "DUE_SOON" || st === "OVERDUE";
case "PARTIAL": return st === "PARTIAL";
case "PAID": return st === "PAID";
case "TODAY": return bucket === "TODAY" && st !== "PAID";
case "TOMORROW": return bucket === "TOMORROW" && st !== "PAID";
case "OVERDUE": return st === "OVERDUE";
default: return true;
}
});
}, [payments, search, filter]);

const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

return (
<div className="space-y-3">
<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
<SearchInput value={search} onChange={setSearch} placeholder="Search by client, invoice / booking #..." className="sm:w-72" />
<Select value={filter} onValueChange={(v) => { setFilter(v); setPage(1); }}>
<SelectTrigger size="sm" className="sm:w-44">
<SelectValue />
</SelectTrigger>
<SelectContent>
{FILTERS.map((f) => (
<SelectItem key={f} value={f}>{FILTER_LABELS[f]}</SelectItem>
))}
</SelectContent>
</Select>
</div>

<BulkActionsBar count={selected.length} entityLabel="payment" onClear={() => setSelected([])} onDelete={() => bulkDeletePayments(selected)} />

{filtered.length === 0 ? (
<EmptyState title="No payments found" description="Try adjusting your search or filters." />
) : (
<>
<div className="overflow-x-auto">
<Table>
<TableHeader>
<TableRow>
<TableHead className="w-8 px-2">
<Checkbox
checked={pageItems.length > 0 && pageItems.every((p) => selected.includes(p.id))}
onCheckedChange={(checked) =>
setSelected((prev) =>
checked
? Array.from(new Set([...prev, ...pageItems.map((p) => p.id)]))
: prev.filter((id) => !pageItems.some((p) => p.id === id)),
)
}
/>
</TableHead>
<TableHead className="px-2">Customer</TableHead>
<TableHead className="px-2">Job ID</TableHead>
<TableHead className="px-2">Service</TableHead>
<TableHead className="px-2">Quote</TableHead>
<TableHead className="px-2">Advance</TableHead>
<TableHead className="px-2">Balance</TableHead>
<TableHead className="px-2">Due Date</TableHead>
<TableHead className="px-2">Status</TableHead>
<TableHead className="px-2 text-right">Actions</TableHead>
</TableRow>
</TableHeader>
<TableBody>
{pageItems.map((p) => {
const st = derivedStatus(p);
const balance = Math.max(p.amount - p.paidAmount, 0);
const days = pendingDays(p.dueDate);
return (
<TableRow key={p.id} className={cn(st === "OVERDUE" && "bg-destructive/5", st === "PAID" && "bg-success-5")}>
<TableCell className="p-2">
<Checkbox
checked={selected.includes(p.id)}
onCheckedChange={(checked) =>
setSelected((prev) => (checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)))
}
/>
</TableCell>
<TableCell className="max-w-[140px] truncate p-2 text-sm font-medium text-foreground">{p.clientName}</TableCell>
<TableCell className="p-2 text-xs text-muted-foreground">{p.refNumber}</TableCell>
<TableCell className="max-w-[150px] p-2 text-xs">
<p className="truncate">{p.serviceLabel ?? "—"}</p>
{(p.serviceVariant || p.packageName) && (
<p className="truncate text-[10px] text-muted-foreground">{[p.serviceVariant, p.packageName].filter(Boolean).join(" · ")}</p>
)}
</TableCell>
<TableCell className="p-2 text-xs">{formatINR(p.amount)}</TableCell>
<TableCell className="p-2 text-xs text-success">
{formatINR(p.paidAmount)}
{p.mode && <span className="ml-1 text-[10px] text-muted-foreground">{PAYMENT_MODE_LABELS[p.mode] ?? p.mode}</span>}
</TableCell>
<TableCell className="p-2 text-xs font-medium">{formatINR(balance)}</TableCell>
<TableCell className="p-2 text-xs">
{formatDate(p.dueDate)}
{st !== "PAID" && days > 0 && <p className="text-[10px] text-destructive">{days}d overdue</p>}
</TableCell>
<TableCell className="p-2">
<Badge variant={STATUS_BADGE[st] ?? "muted"}>{STATUS_LABEL[st] ?? st}</Badge>
</TableCell>
<TableCell className="p-2"><RowActions p={p} details={paymentDetails} /></TableCell>
</TableRow>
);
})}
</TableBody>
</Table>
</div>
<Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
</>
)}
</div>
);
}
