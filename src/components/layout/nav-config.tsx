import {
  LayoutDashboard,
  Users,
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
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  section: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", section: "dashboard", icon: LayoutDashboard },
  { label: "Leads / CRM", href: "/leads", section: "leads", icon: Users },
  { label: "Jobs", href: "/jobs", section: "jobs", icon: ClipboardList },
  { label: "Team Dispatch", href: "/jobs/dispatch", section: "jobs", icon: Route },
  { label: "Staff", href: "/staff", section: "staff", icon: UserCog },
  { label: "Vehicles", href: "/vehicles", section: "vehicles", icon: Truck },
  { label: "Attendance", href: "/attendance", section: "attendance", icon: CalendarCheck },
  { label: "AMC Contracts", href: "/amc", section: "amc", icon: ShieldCheck },
  { label: "Payments", href: "/payments", section: "payments", icon: IndianRupee },
  { label: "Expenses", href: "/expenses", section: "expenses", icon: Receipt },
  { label: "Revenue Dashboard", href: "/revenue", section: "revenue", icon: Wallet },
  { label: "Profit Dashboard", href: "/profit", section: "profit", icon: TrendingUp },
  { label: "Customers", href: "/customers", section: "customers", icon: BookUser },
  { label: "Reports", href: "/reports", section: "reports", icon: FileText },
  { label: "AI Assistant", href: "/assistant", section: "assistant", icon: Sparkles },
  { label: "Trash", href: "/admin/trash", section: "trash", icon: Trash2 },
  { label: "Audit Log", href: "/admin/audit-log", section: "audit-log", icon: ScrollText },
  { label: "Message Log", href: "/admin/whatsapp-log", section: "whatsapp-log", icon: MessageCircle },
  { label: "Device Approvals", href: "/admin/device-approvals", section: "device-approvals", icon: Smartphone },
  { label: "Security Approvals", href: "/admin/security-approvals", section: "security-approvals", icon: ShieldAlert },
];
