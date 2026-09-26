"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Flame, UtensilsCrossed, Boxes, Users, Heart, BarChart3, Settings } from "lucide-react";
import { AppShell } from "@billbistro/ui";
import { ApiProvider } from "../lib/api";

const nav = [
  { label: "Overview", href: "/", icon: <LayoutDashboard size={16} /> },
  { label: "Live orders", href: "/orders", icon: <Flame size={16} /> },
  { label: "Menu & pricing", href: "/menu", icon: <UtensilsCrossed size={16} /> },
  { label: "Inventory", href: "/inventory", icon: <Boxes size={16} /> },
  { label: "Staff", href: "/staff", icon: <Users size={16} /> },
  { label: "Customers", href: "/customers", icon: <Heart size={16} /> },
  { label: "Reports", href: "/reports", icon: <BarChart3 size={16} /> },
  { label: "Settings", href: "/settings", icon: <Settings size={16} /> },
];

/** Single-restaurant deployment — set this once you know the real name; "Spice Route · Koramangala" was always a placeholder. */
const RESTAURANT_NAME = process.env.NEXT_PUBLIC_RESTAURANT_NAME || "Spice Route · Koramangala";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active = nav.find((n) => n.href !== "/" && pathname.startsWith(n.href))?.href ?? "/";
  return (
    <ApiProvider>
      <AppShell app="Dashboard" tenant={RESTAURANT_NAME} nav={nav} activeHref={active} variant="sidebar" Link={Link}>{children}</AppShell>
    </ApiProvider>
  );
}
