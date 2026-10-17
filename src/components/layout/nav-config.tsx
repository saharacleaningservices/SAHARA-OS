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
    Images,
    Home,
    Bug,
    PaintRoller,
    FileSignature,
    FileStack,
    Megaphone,
    FileSpreadsheet,
    type LucideIcon,
} from "lucide-react";

export type NavGroupKey = "operations" | "sales" | "dashboards" | "tools" | "admin";

export type NavItem = {
    label: string;
    href: string;
    section: string;
    icon: LucideIcon;
    group: NavGroupKey;
};

/** Mobile / desktop sidebar accordion groups, in display order (a group with no items for the role is hidden). */
export const NAV_GROUPS: { key: NavGroupKey; label: string }[] = [
  // Fixed order (owner 2026-10-18): Dashboards first.
  { key: "dashboards", label: "Dashboards & Reports" },
  { key: "operations", label: "Operations" },
  { key: "sales", label: "Sales & Finance" },
  { key: "tools", label: "Tools & AI" },
  { key: "admin", label: "Settings & Admin" },
];

// Which accordion group each destination lives in (by href). Anything not listed falls under Tools & AI.
const GROUP_BY_HREF: Record<string, NavGroupKey> = {
  "/dashboard": "dashboards", "/revenue": "dashboards", "/profit": "dashboards", "/profit/marketing": "dashboards",
  "/reports": "dashboards", "/reports/export-center": "dashboards",
  "/leads": "sales", "/leads/price-list": "sales", "/quotations": "sales", "/invoices": "sales", "/payments": "sales",
  "/expenses": "sales", "/customers": "sales",
  "/jobs": "operations", "/jobs/dispatch": "operations", "/jobs/slots": "operations", "/staff": "operations",
  "/vehicles": "operations", "/attendance": "operations", "/amc": "operations",
  "/jobs?service=HOUSEKEEPING": "operations", "/jobs?service=PEST_CONTROL": "operations", "/jobs?service=INTERIOR_PAINTING": "operations",
  "/assistant": "tools", "/admin/gallery": "tools", "/admin/announcements": "tools", "/admin/khata-import": "tools",
  "/admin/whatsapp-inbox": "tools",
  "/settings/pricing": "admin", "/admin/trash": "admin", "/admin/audit-log": "admin", "/admin/users": "admin",
  "/admin/whatsapp-log": "admin", "/admin/device-approvals": "admin", "/admin/security-approvals": "admin",
};

const RAW_NAV_ITEMS: Omit<NavItem, "group">[] = [
  { label: "Dashboard", href: "/dashboard", section: "dashboard", icon: LayoutDashboard },
  { label: "Leads / CRM", href: "/leads", section: "leads", icon: Users },
  { label: "Price List", href: "/leads/price-list", section: "leads", icon: IndianRupee },
  { label: "Jobs", href: "/jobs", section: "jobs", icon: ClipboardList },
  { label: "Team Dispatch", href: "/jobs/dispatch", section: "jobs", icon: Route },
  { label: "Slot Availability", href: "/jobs/slots", section: "jobs", icon: CalendarCheck },
  { label: "Staff", href: "/staff", section: "staff", icon: UserCog },
  { label: "Vehicles", href: "/vehicles", section: "vehicles", icon: Truck },
  { label: "Attendance", href: "/attendance", section: "attendance", icon: CalendarCheck },
  { label: "AMC Contracts", href: "/amc", section: "amc", icon: ShieldCheck },
  { label: "Payments", href: "/payments", section: "payments", icon: IndianRupee },
  { label: "Expenses", href: "/expenses", section: "expenses", icon: Receipt },
  { label: "Quotations", href: "/quotations", section: "quotations", icon: FileSignature },
  { label: "Invoices", href: "/invoices", section: "invoices", icon: FileStack },
  { label: "Housekeeping", href: "/jobs?service=HOUSEKEEPING", section: "service-housekeeping", icon: Home },
  { label: "Pest Control", href: "/jobs?service=PEST_CONTROL", section: "service-pest-control", icon: Bug },
  { label: "Interior Painting", href: "/jobs?service=INTERIOR_PAINTING", section: "service-interior-painting", icon: PaintRoller },
  { label: "Revenue Dashboard", href: "/revenue", section: "revenue", icon: Wallet },
  { label: "Profit Dashboard", href: "/profit", section: "profit", icon: TrendingUp },
  { label: "Marketing Dashboard", href: "/profit/marketing", section: "profit", icon: TrendingUp },
  { label: "Customers", href: "/customers", section: "customers", icon: BookUser },
  { label: "Reports", href: "/reports", section: "reports", icon: FileText },
  { label: "Export Center", href: "/reports/export-center", section: "reports", icon: FileSpreadsheet },
  { label: "Pricing & Packages", href: "/settings/pricing", section: "pricing", icon: IndianRupee },
  { label: "Khata Book Import", href: "/admin/khata-import", section: "khata-import", icon: FileSpreadsheet },
  { label: "Announcements", href: "/admin/announcements", section: "announcements", icon: Megaphone },
  { label: "AI Assistant", href: "/assistant", section: "assistant", icon: Sparkles },
  { label: "Gallery", href: "/admin/gallery", section: "admin", icon: Images },
  { label: "Trash", href: "/admin/trash", section: "trash", icon: Trash2 },
  { label: "Audit Log", href: "/admin/audit-log", section: "audit-log", icon: ScrollText },
  { label: "User Management", href: "/admin/users", section: "users", icon: Users2 },
  { label: "WhatsApp Inbox", href: "/admin/whatsapp-inbox", section: "whatsapp-log", icon: MessageCircle },
  { label: "Message Log", href: "/admin/whatsapp-log", section: "whatsapp-log", icon: MessageCircle },
  { label: "Device Approvals", href: "/admin/device-approvals", section: "device-approvals", icon: Smartphone },
  { label: "Security Approvals", href: "/admin/security-approvals", section: "security-approvals", icon: ShieldAlert },
  ];

export const NAV_ITEMS: NavItem[] = RAW_NAV_ITEMS.map((i) => ({ ...i, group: GROUP_BY_HREF[i.href] ?? "tools" }));
