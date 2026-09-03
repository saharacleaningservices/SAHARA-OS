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
  { label: "Staff", href: "/staff", section: "staff", icon: UserCog },
  { label: "Payments", href: "/payments", section: "payments", icon: IndianRupee },
  { label: "Expenses", href: "/expenses", section: "expenses", icon: Receipt },
  { label: "Profit Dashboard", href: "/profit", section: "profit", icon: TrendingUp },
  { label: "Reports", href: "/reports", section: "reports", icon: FileText },
  { label: "AI Assistant", href: "/assistant", section: "assistant", icon: Sparkles },
];
