"use client";
import Link from "next/link";
import { Receipt, LayoutGrid, ClipboardList, ChefHat, MoreHorizontal } from "lucide-react";
import { AppShell } from "@billbistro/ui";
import { ApiProvider } from "../../lib/api";
import { Floor } from "../../components/floor";
import { Toast } from "../../components/toast";

const nav = [
  { label: "Bill", href: "/", icon: <Receipt size={20} /> },
  { label: "Tables", href: "/tables", icon: <LayoutGrid size={20} /> },
  { label: "Orders", href: "/orders", icon: <ClipboardList size={20} /> },
  { label: "KDS", href: "/kds", icon: <ChefHat size={20} /> },
  { label: "More", href: "/more", icon: <MoreHorizontal size={20} /> },
];

export default function TablesPage() {
  return (
    <ApiProvider>
      <AppShell app="POS" nav={nav} activeHref="/tables" variant="rail" Link={Link}>
        <Floor />
        <Toast />
      </AppShell>
    </ApiProvider>
  );
}
