// Pure cart math (int paise). Mirrors the API contract: GST per line by taxRateBps, split CGST/SGST, round-off to the rupee.
import type { MenuItem } from "@billbistro/sdk";
import { priceLine } from "@billbistro/sdk";

export interface CartLine {
  lineId: string;
  item: MenuItem;
  variantId: string | null;
  modifierIds: string[];
  qty: number;
  notes: string | null;
  /** server OrderItem id once synced; kotId once sent to kitchen */
  serverId?: string;
  kotId?: string | null;
}
export type Discount = { kind: "percent" | "flat"; value: number; reason?: string } | null;

export const lineUnit = (l: CartLine) => priceLine(l.item, { itemId: l.item.id, qty: 1, variantId: l.variantId, modifierIds: l.modifierIds }).unitPrice;
export const lineTotal = (l: CartLine) => lineUnit(l) * l.qty;
export const lineLabel = (l: CartLine) => {
  const v = l.item.variants.find((x) => x.id === l.variantId)?.name;
  const m = l.item.modifiers.filter((x) => l.modifierIds.includes(x.id)).map((x) => x.name);
  return [v, ...m].filter(Boolean).join(" · ");
};

export function computeTotals(lines: CartLine[], discount: Discount, tipPaise: number) {
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const discountAmt = !discount ? 0 : Math.min(subtotal, discount.kind === "percent" ? Math.round((subtotal * discount.value) / 100) : Math.round(discount.value));
  const factor = subtotal ? 1 - discountAmt / subtotal : 1;
  const taxByRate = new Map<number, number>();
  for (const l of lines) {
    const t = Math.round((lineTotal(l) * factor * l.item.taxRateBps) / 10000);
    taxByRate.set(l.item.taxRateBps, (taxByRate.get(l.item.taxRateBps) ?? 0) + t);
  }
  const taxTotal = [...taxByRate.values()].reduce((s, t) => s + t, 0);
  const raw = subtotal - discountAmt + taxTotal + tipPaise;
  const total = Math.round(raw / 100) * 100;
  return { subtotal, discountAmt, taxByRate, taxTotal, tip: tipPaise, roundOff: total - raw, total, qty: lines.reduce((s, l) => s + l.qty, 0) };
}
export type Totals = ReturnType<typeof computeTotals>;
