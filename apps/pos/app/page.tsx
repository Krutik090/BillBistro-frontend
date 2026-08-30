"use client";
// POS billing screen (T-111). Layout per docs/design/hero-pos-billing.png: rail · catalog · bill panel.
import * as React from "react";
import Link from "next/link";
import { AppShell } from "@billbistro/ui";
import { posNav } from "../lib/nav";
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
    <AppShell app="POS" nav={posNav} activeHref="/" variant="rail" Link={Link} headerRight={<HealthDot />}>
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
