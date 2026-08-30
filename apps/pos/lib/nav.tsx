import { Receipt, LayoutGrid, ClipboardList, ChefHat, Lock } from "lucide-react";
import type { NavItem } from "@billbistro/ui";

export const posNav: NavItem[] = [
  { label: "Bill", href: "/", icon: <Receipt size={20} /> },
  { label: "Tables", href: "/tables", icon: <LayoutGrid size={20} /> },
  { label: "Orders", href: "/orders", icon: <ClipboardList size={20} /> },
  { label: "KDS", href: "/kds", icon: <ChefHat size={20} /> },
  { label: "Day close", href: "/day-close", icon: <Lock size={20} /> },
];
