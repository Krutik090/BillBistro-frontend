"use client";
// POS billing screen (T-111). Layout per docs/design/hero-pos-billing.png: rail · catalog · bill panel.
import * as React from "react";
import Link from "next/link";
import { Receipt, LayoutGrid, ClipboardList, ChefHat, MoreHorizontal } from "lucide-react";
import { AppShell } from "@billbistro/ui";
import { ApiProvider } from "../lib/api";
import { usePos } from "../lib/store";
import { useHotkeys } from "../lib/hotkeys";
import { PwaRegister } from "./pwa-register";
import { HealthDot } from "./health-dot";
import { Catalog } from "../components/catalog";
import { Cart } from "../components/cart";
import { ItemSheet } from "../components/item-sheet";
import { TableSheet, HoldSheet, KotSheet, DiscountSheet, SplitSheet } from "../components/sheets";
import { PaymentSheet } from "../components/payment-sheet";
import { ReceiptSheet } from "../components/receipt";
import { Toast } from "../components/toast";

const nav = [
  { label: "Bill", href: "/", icon: <Receipt size={20} /> },
  { label: "Tables", href: "/tables", icon: <LayoutGrid size={20} /> },
  { label: "Orders", href: "/orders", icon: <ClipboardList size={20} /> },
  { label: "KDS", href: "/kds", icon: <ChefHat size={20} /> },
  { label: "More", href: "/more", icon: <MoreHorizontal size={20} /> },
];

export default function PosPage() {
  return (
    <ApiProvider>
      <PosScreen />
    </ApiProvider>
  );
}

function PosScreen() {
  const searchRef = React.useRef<HTMLInputElement>(null);
  const { openSheet, hold, lines } = usePos();
  const keys = React.useMemo(() => ({
    "/": () => searchRef.current?.focus(),
    Escape: () => openSheet(null),
    F8: () => document.querySelector<HTMLButtonElement>('button[data-hot="kot"]')?.click(),
    F9: () => lines.length && openSheet("pay"),
    F10: () => hold(),
    F2: () => openSheet("table"),
  }), [openSheet, hold, lines.length]);
  useHotkeys(keys);

  return (
    <AppShell app="POS" nav={nav} activeHref="/" variant="rail" Link={Link} headerRight={<HealthDot />}>
      <PwaRegister />
      <div className="flex h-full print:hidden">
        <Catalog searchRef={searchRef} />
        <Cart />
      </div>
      <ItemSheet /><TableSheet /><HoldSheet /><KotSheet /><DiscountSheet /><SplitSheet /><PaymentSheet /><ReceiptSheet />
      <Toast />
    </AppShell>
  );
}
