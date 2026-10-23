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
    type LucideIcon,
} from "lucide-react";

export type NavGroupKey = "operations" | "sales" | "parties" | "purchases" | "dashboards" | "tools" | "admin";

export type NavItem = {
    label: string;
    href: string;
    section: string;
    icon: LucideIcon;
    group: NavGroupKey;
    /** Optional collapsible sub-heading inside the group (owner 2026-10-22: Operations shows at most 6 entries). Items
     *  sharing a cluster must be listed next to each other; every page stays reachable. */
    cluster?: string;
};

/** Mobile / desktop sidebar accordion groups, in display order (a group with no items for the role is hidden). */
export const NAV_GROUPS: { key: NavGroupKey; label: string }[] = [
  // Fixed order (owner 2026-10-18): Dashboards first.
  { key: "dashboards", label: "Dashboards & Reports" },
  // MyBillBook-style order (owner 2026-10-23): Dashboard, Parties, Sales, Purchases, then the field / tools / settings groups.
  { key: "parties", label: "Parties" },
  { key: "sales", label: "Sales" },
  { key: "purchases", label: "Purchases" },
  { key: "operations", label: "Operations" },
  { key: "tools", label: "Tools & AI" },
  { key: "admin", label: "Settings & Admin" },
];

// Which accordion group each destination lives in (by href). Anything not listed falls under Tools & AI.
const GROUP_BY_HREF: Record<string, NavGroupKey> = {
  "/dashboard": "dashboards", "/revenue": "dashboards", "/profit": "dashboards", "/profit/marketing": "dashboards",
  "/reports": "dashboards", "/reports/export-center": "dashboards",
  "/leads": "sales", "/leads/price-list": "sales", "/service-catalog": "sales", "/quotations": "sales", "/invoices": "sales", "/payments": "sales",
  "/expenses": "purchases", "/customers": "parties",
  "/jobs": "operations", "/jobs/quick-quote": "operations", "/jobs/dispatch": "operations", "/jobs/slots": "operations", "/staff": "operations",
  "/vehicles": "operations", "/attendance": "operations", "/amc": "operations",
  "/jobs?service=HOUSEKEEPING": "operations", "/jobs?service=PEST_CONTROL": "operations", "/jobs?service=INTERIOR_PAINTING": "operations",
  // Tools & AI (owner 2026-10-22): AI Assistant, WhatsApp Inbox, Payment Link Sender, Announcements. Gallery left the menu
  // (the page and the public /gallery keep working); Khata Book Import moved to Settings & Admin for archival use.
  "/assistant": "tools", "/admin/whatsapp-inbox": "tools", "/payments/send-link": "tools", "/admin/announcements": "tools",
  "/admin/khata-import": "admin",
  "/settings/pricing": "admin", "/admin/trash": "admin", "/admin/audit-log": "admin", "/admin/users": "admin",
  "/admin/whatsapp-log": "admin", "/admin/lifecycle-reminders": "admin", "/admin/device-approvals": "admin", "/admin/security-approvals": "admin",
};

const RAW_NAV_ITEMS: Omit<NavItem, "group">[] = [
  { label: "Dashboard", href: "/dashboard", section: "dashboard", icon: LayoutDashboard },
  { label: "Leads / CRM", href: "/leads", section: "leads", icon: Users },
  // Owner 2026-10-23: Price List and Service Catalog fold under one entry (one click to either, no duplicate menu items).
  { label: "Price List", href: "/leads/price-list", section: "leads", icon: IndianRupee, cluster: "Prices & Service Catalog" },
  { label: "Service Catalog", href: "/service-catalog", section: "service-catalog", icon: FileText, cluster: "Prices & Service Catalog" },
  // Operations — six entries (owner 2026-10-22): Jobs, Quick Quote, Dispatch & Slots, Team & Attendance, AMC, Specialized Services.
  { label: "Jobs", href: "/jobs", section: "jobs", icon: ClipboardList },
  { label: "Quick Quote Generator", href: "/jobs/quick-quote", section: "jobs", icon: Calculator },
  { label: "Team Dispatch", href: "/jobs/dispatch", section: "jobs", icon: Route, cluster: "Team Dispatch & Slots" },
  { label: "Slot Availability", href: "/jobs/slots", section: "jobs", icon: CalendarCheck, cluster: "Team Dispatch & Slots" },
  { label: "Staff", href: "/staff", section: "staff", icon: UserCog, cluster: "Team & Attendance" },
  { label: "Attendance", href: "/attendance", section: "attendance", icon: CalendarCheck, cluster: "Team & Attendance" },
  { label: "Vehicles", href: "/vehicles", section: "vehicles", icon: Truck, cluster: "Team & Attendance" },
  { label: "AMC Contracts", href: "/amc", section: "amc", icon: ShieldCheck },
  { label: "Housekeeping", href: "/jobs?service=HOUSEKEEPING", section: "service-housekeeping", icon: Home, cluster: "Specialized Services" },
  { label: "Pest Control", href: "/jobs?service=PEST_CONTROL", section: "service-pest-control", icon: Bug, cluster: "Specialized Services" },
  { label: "Interior Painting", href: "/jobs?service=INTERIOR_PAINTING", section: "service-interior-painting", icon: PaintRoller, cluster: "Specialized Services" },
  { label: "Payment In", href: "/payments", section: "payments", icon: IndianRupee },
  { label: "Purchases & Expenses", href: "/expenses", section: "expenses", icon: Receipt },
  { label: "Quotation / Estimate", href: "/quotations", section: "quotations", icon: FileSignature },
  { label: "Sales Invoices", href: "/invoices", section: "invoices", icon: FileStack },
  { label: "Revenue Dashboard", href: "/revenue", section: "revenue", icon: Wallet },
  { label: "Profit Dashboard", href: "/profit", section: "profit", icon: TrendingUp },
  { label: "Marketing Dashboard", href: "/profit/marketing", section: "profit", icon: TrendingUp },
  { label: "Parties", href: "/customers", section: "customers", icon: BookUser },
  { label: "Reports", href: "/reports", section: "reports", icon: FileText },
  { label: "Export Center", href: "/reports/export-center", section: "reports", icon: FileSpreadsheet },
  { label: "Pricing & Packages", href: "/settings/pricing", section: "pricing", icon: IndianRupee },
  { label: "Khata Book Import", href: "/admin/khata-import", section: "khata-import", icon: FileSpreadsheet },
  { label: "AI Assistant", href: "/assistant", section: "assistant", icon: Sparkles },
  { label: "WhatsApp Inbox", href: "/admin/whatsapp-inbox", section: "whatsapp-log", icon: MessageCircle },
  { label: "Payment Link Sender", href: "/payments/send-link", section: "payments", icon: Send },
  { label: "Announcements", href: "/admin/announcements", section: "announcements", icon: Megaphone },
  { label: "Trash", href: "/admin/trash", section: "trash", icon: Trash2 },
  { label: "Audit Log", href: "/admin/audit-log", section: "audit-log", icon: ScrollText },
  { label: "User Management", href: "/admin/users", section: "users", icon: Users2 },
  { label: "Message Log", href: "/admin/whatsapp-log", section: "whatsapp-log", icon: MessageCircle },
  { label: "Lifecycle Reminders", href: "/admin/lifecycle-reminders", section: "lifecycle-reminders", icon: Send },
  { label: "Device Approvals", href: "/admin/device-approvals", section: "device-approvals", icon: Smartphone },
  { label: "Security Approvals", href: "/admin/security-approvals", section: "security-approvals", icon: ShieldAlert },
  ];

export const NAV_ITEMS: NavItem[] = RAW_NAV_ITEMS.map((i) => ({ ...i, group: GROUP_BY_HREF[i.href] ?? "tools" }));
