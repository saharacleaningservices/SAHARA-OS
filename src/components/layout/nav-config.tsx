import {
    LayoutDashboard,
    Users,
    Users2,
    ClipboardList,
    UserCog,
    IndianRupee,
    Receipt,
    TrendingUp,
    FileText,
    Sparkles,
    Truck,
    BookUser,
    Trash2,
    ScrollText,
    ShieldCheck,
    CalendarCheck,
    Wallet,
    MessageCircle,
    Smartphone,
    ShieldAlert,
    Route,
    Home,
    Bug,
    PaintRoller,
    FileSignature,
    FileStack,
    Megaphone,
    FileSpreadsheet,
    Calculator,
    Send,
    Settings,
    BarChart3,
    type LucideIcon,
} from "lucide-react";

export type NavGroupKey = "dashboards" | "sales" | "operations" | "finance" | "admin";

export type NavItem = {
    label: string;
    href: string;
    section: string;
    icon: LucideIcon;
    group: NavGroupKey;
    /** Optional collapsible sub-heading inside the group. Items sharing a cluster must be listed next to each other;
     *  every page stays reachable. */
    cluster?: string;
};

/**
 * The sidebar (owner 2026-10-23): the Dashboard link on top, then FOUR sections — Sales & CRM, Operations, Finance & Billing, Settings & Admin
 * (a section with nothing the role may open is hidden). `pinned` = no header, the link is shown directly.
 */
export const NAV_GROUPS: { key: NavGroupKey; label: string; pinned?: boolean }[] = [
  { key: "dashboards", label: "Dashboard", pinned: true },
  { key: "sales", label: "Sales & CRM" },
  { key: "operations", label: "Operations" },
  { key: "finance", label: "Finance & Billing" },
  { key: "admin", label: "Settings & Admin" },
];

// Which section each destination lives in (by href). Anything not listed falls under Settings & Admin.
const GROUP_BY_HREF: Record<string, NavGroupKey> = {
  "/dashboard": "dashboards",
  "/leads": "sales", "/customers": "sales", "/leads/price-list": "sales", "/service-catalog": "sales",
  "/jobs": "operations", "/jobs/dispatch": "operations", "/jobs/slots": "operations", "/staff": "operations", "/attendance": "operations", "/vehicles": "operations",
  "/amc": "operations", "/jobs?service=HOUSEKEEPING": "operations", "/jobs?service=PEST_CONTROL": "operations", "/jobs?service=INTERIOR_PAINTING": "operations",
  "/sales": "finance", "/quotations": "finance", "/invoices": "finance", "/payments": "finance",
  "/vouchers/proforma-invoice": "finance", "/vouchers/credit-note": "finance", "/vouchers/delivery-challan": "finance",
  "/expenses": "finance", "/vouchers/purchase-voucher": "finance",
  "/revenue": "finance", "/profit": "finance", "/profit/marketing": "finance", "/reports": "finance", "/reports/export-center": "finance",
};

const RAW_NAV_ITEMS: Omit<NavItem, "group">[] = [
  { label: "Dashboard", href: "/dashboard", section: "dashboard", icon: LayoutDashboard },
  // ── Sales & CRM: Leads / CRM, Parties, Quick Quote Generator (+ price list and service catalog folded into one entry)
  { label: "Leads / CRM", href: "/leads", section: "leads", icon: Users },
  { label: "Parties", href: "/customers", section: "customers", icon: BookUser },
  { label: "Price List", href: "/leads/price-list", section: "leads", icon: IndianRupee, cluster: "Prices & Service Catalog" },
  { label: "Service Catalog", href: "/service-catalog", section: "service-catalog", icon: FileText, cluster: "Prices & Service Catalog" },
  // ── Operations: Jobs, Team Dispatch & Slots, AMC Contracts (+ team, attendance, vehicles and the specialised services folded)
  { label: "Jobs", href: "/jobs", section: "jobs", icon: ClipboardList },
  { label: "Team Dispatch", href: "/jobs/dispatch", section: "jobs", icon: Route, cluster: "Team Dispatch & Slots" },
  { label: "Slot Availability", href: "/jobs/slots", section: "jobs", icon: CalendarCheck, cluster: "Team Dispatch & Slots" },
  { label: "AMC Contracts", href: "/amc", section: "amc", icon: ShieldCheck },
  { label: "Staff", href: "/staff", section: "staff", icon: UserCog, cluster: "Team & Attendance" },
  { label: "Attendance", href: "/attendance", section: "attendance", icon: CalendarCheck, cluster: "Team & Attendance" },
  { label: "Vehicles", href: "/vehicles", section: "vehicles", icon: Truck, cluster: "Team & Attendance" },
  { label: "Housekeeping", href: "/jobs?service=HOUSEKEEPING", section: "service-housekeeping", icon: Home, cluster: "Specialized Services" },
  { label: "Pest Control", href: "/jobs?service=PEST_CONTROL", section: "service-pest-control", icon: Bug, cluster: "Specialized Services" },
  { label: "Interior Painting", href: "/jobs?service=INTERIOR_PAINTING", section: "service-interior-painting", icon: PaintRoller, cluster: "Specialized Services" },
  // ── Finance & Billing: Sales Vouchers, Purchases, Khata Book Import (+ reports and profit folded into one entry)
  // Sales Dashboard (owner 2026-10-25): first in Finance & Billing, not folded — total business, pending, paid, de-duplication.
  { label: "Sales Dashboard", href: "/sales", section: "revenue", icon: BarChart3 },
  { label: "Quotation / Estimate", href: "/quotations", section: "quotations", icon: FileSignature, cluster: "Sales Vouchers" },
  { label: "Sales Invoices", href: "/invoices", section: "invoices", icon: FileStack, cluster: "Sales Vouchers" },
  { label: "Payment In", href: "/payments", section: "payments", icon: IndianRupee, cluster: "Sales Vouchers" },
  { label: "Proforma Invoice", href: "/vouchers/proforma-invoice", section: "vouchers", icon: FileText, cluster: "Sales Vouchers" },
  { label: "Credit Note", href: "/vouchers/credit-note", section: "vouchers", icon: FileText, cluster: "Sales Vouchers" },
  { label: "Delivery Challan", href: "/vouchers/delivery-challan", section: "vouchers", icon: Truck, cluster: "Sales Vouchers" },
  { label: "Purchases & Expenses", href: "/expenses", section: "expenses", icon: Receipt, cluster: "Purchases" },
  { label: "Purchase Vouchers", href: "/vouchers/purchase-voucher", section: "vouchers", icon: FileStack, cluster: "Purchases" },
  { label: "Revenue Dashboard", href: "/revenue", section: "revenue", icon: Wallet, cluster: "Reports & Profit" },
  { label: "Profit Dashboard", href: "/profit", section: "profit", icon: TrendingUp, cluster: "Reports & Profit" },
  { label: "Marketing Dashboard", href: "/profit/marketing", section: "profit", icon: TrendingUp, cluster: "Reports & Profit" },
  { label: "Reports", href: "/reports", section: "reports", icon: FileText, cluster: "Reports & Profit" },
  { label: "Export Center", href: "/reports/export-center", section: "reports", icon: FileSpreadsheet, cluster: "Reports & Profit" },
  // ── Settings & Admin: User Management, Message Logs, Lifecycle Reminders, Settings (+ the rest of the admin tools)
  { label: "User Management", href: "/admin/users", section: "users", icon: Users2 },
  { label: "Message Log", href: "/admin/whatsapp-log", section: "whatsapp-log", icon: MessageCircle },
  { label: "Lifecycle Reminders", href: "/admin/lifecycle-reminders", section: "lifecycle-reminders", icon: Send },
  { label: "Settings", href: "/settings", section: "settings", icon: Settings },
  { label: "Pricing & Packages", href: "/settings/pricing", section: "pricing", icon: IndianRupee },
  { label: "WhatsApp Inbox", href: "/admin/whatsapp-inbox", section: "whatsapp-log", icon: MessageCircle },
  { label: "AI Assistant", href: "/assistant", section: "assistant", icon: Sparkles },
  { label: "Announcements", href: "/admin/announcements", section: "announcements", icon: Megaphone },
  { label: "Audit Log", href: "/admin/audit-log", section: "audit-log", icon: ScrollText },
  { label: "Device Approvals", href: "/admin/device-approvals", section: "device-approvals", icon: Smartphone },
  { label: "Security Approvals", href: "/admin/security-approvals", section: "security-approvals", icon: ShieldAlert },
  { label: "Trash", href: "/admin/trash", section: "trash", icon: Trash2 },
];

export const NAV_ITEMS: NavItem[] = RAW_NAV_ITEMS.map((i) => ({ ...i, group: GROUP_BY_HREF[i.href] ?? "admin" }));
