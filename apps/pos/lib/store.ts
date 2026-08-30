"use client";
// Local POS state (Zustand). Cart edits are local-first (optimistic); the server order is synced on KOT/bill.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Bill, MenuItem, Order, OrderType } from "@billbistro/sdk";
import type { CartLine, Discount } from "./calc";
import { uid } from "./format";

export type Sheet = null | "item" | "table" | "hold" | "kot" | "discount" | "split" | "pay" | "receipt";

export interface HeldOrder { id: string; label: string; heldAt: string; type: OrderType; tableRef: string | null; lines: CartLine[]; discount: Discount; orderId: string | null }

interface PosState {
  type: OrderType; tableId: string | null; tableRef: string | null; covers: number;
  lines: CartLine[]; discount: Discount; tip: number;
  orderId: string | null; orderNo: string | null; orderVersion: number | null; kots: Order["kots"]; syncing: boolean;
  /** Authoritative totals from the last server sync; null while the cart has unsynced edits (client math shown instead). */
  serverTotals: { subtotal: number; taxTotal: number; total: number; version: number } | null;
  bill: Bill | null; splitCount: number; splitIndex: number;
  held: HeldOrder[];
  sheet: Sheet; sheetItem: MenuItem | null; editingLineId: string | null;
  toast: string | null;

  openSheet: (s: Sheet, item?: MenuItem | null, lineId?: string | null) => void;
  setTable: (tableRef: string | null, type: OrderType, covers?: number, tableId?: string | null) => void;
  addLine: (item: MenuItem, variantId: string | null, modifierIds: string[], qty: number, notes?: string | null) => void;
  updateLine: (lineId: string, patch: Partial<Pick<CartLine, "qty" | "variantId" | "modifierIds" | "notes">>) => void;
  removeLine: (lineId: string) => void;
  setDiscount: (d: Discount) => void; setTip: (paise: number) => void;
  setOrder: (o: Order | null) => void; setSyncing: (b: boolean) => void;
  setBill: (b: Bill | null) => void; setSplit: (count: number, index: number) => void;
  hold: () => void; recall: (id: string) => void; dropHeld: (id: string) => void;
  reset: () => void; notify: (msg: string | null) => void;
}

const empty = { type: "DINE_IN" as OrderType, tableId: null, tableRef: null, covers: 0, lines: [], discount: null, tip: 0, orderId: null, orderNo: null, orderVersion: null, kots: [], serverTotals: null, bill: null, splitCount: 1, splitIndex: 0 };

export const usePos = create<PosState>()(
  persist(
    (set, get) => ({
      ...empty, syncing: false, held: [], sheet: null, sheetItem: null, editingLineId: null, toast: null,
      openSheet: (sheet, sheetItem = null, editingLineId = null) => set({ sheet, sheetItem, editingLineId }),
      setTable: (tableRef, type, covers = 0, tableId = null) => set({ tableRef, type, covers, tableId }),
      addLine: (item, variantId, modifierIds, qty, notes = null) =>
        set((s) => {
          // merge identical lines (same item/variant/mods/notes) that aren't sent to kitchen yet
          const key = (l: CartLine) => `${l.item.id}|${l.variantId}|${[...l.modifierIds].sort().join(",")}|${l.notes ?? ""}`;
          const k = `${item.id}|${variantId}|${[...modifierIds].sort().join(",")}|${notes ?? ""}`;
          const existing = s.lines.find((l) => !l.kotId && key(l) === k);
          if (existing) return { serverTotals: null, lines: s.lines.map((l) => (l === existing ? { ...l, qty: l.qty + qty } : l)) };
          return { serverTotals: null, lines: [...s.lines, { lineId: uid(), item, variantId, modifierIds, qty, notes }] };
        }),
      updateLine: (lineId, patch) => set((s) => ({ serverTotals: null, lines: s.lines.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)).filter((l) => l.qty > 0) })),
      removeLine: (lineId) => set((s) => ({ serverTotals: null, lines: s.lines.filter((l) => l.lineId !== lineId) })),
      setDiscount: (discount) => set({ discount }), setTip: (tip) => set({ tip }),
      setOrder: (o) => set((s) => ({
        orderId: o?.id ?? null, orderNo: o?.orderNo ?? null, orderVersion: o?.version ?? null, kots: o?.kots ?? [],
        serverTotals: o ? { subtotal: o.subtotal, taxTotal: o.taxTotal, total: o.total, version: o.version } : null,
        lines: o ? s.lines.map((l) => { const srv = o.items.find((i) => i.clientLineId === l.lineId || i.id === l.serverId || i.id === l.lineId); return srv ? { ...l, serverId: srv.id, kotId: srv.kotId ?? l.kotId ?? null } : l; }) : s.lines,
      })),
      setSyncing: (syncing) => set({ syncing }),
      setBill: (bill) => set({ bill }), setSplit: (splitCount, splitIndex) => set({ splitCount, splitIndex }),
      hold: () => { const s = get(); if (!s.lines.length) return; set({ held: [{ id: uid(), label: s.tableRef ?? "Counter", heldAt: new Date().toISOString(), type: s.type, tableRef: s.tableRef, lines: s.lines, discount: s.discount, orderId: s.orderId }, ...s.held], ...empty, sheet: null }); },
      recall: (id) => { const s = get(); const h = s.held.find((x) => x.id === id); if (!h) return; set({ ...empty, held: s.held.filter((x) => x.id !== id), type: h.type, tableRef: h.tableRef, lines: h.lines, discount: h.discount, orderId: h.orderId, sheet: null }); },
      dropHeld: (id) => set((s) => ({ held: s.held.filter((x) => x.id !== id) })),
      reset: () => set({ ...empty, sheet: null, sheetItem: null, editingLineId: null }),
      notify: (toast) => set({ toast }),
    }),
    { name: "bb-pos-v1", partialize: (s) => ({ held: s.held, lines: s.lines, tableId: s.tableId, tableRef: s.tableRef, type: s.type, covers: s.covers, discount: s.discount, tip: s.tip, orderId: s.orderId, orderNo: s.orderNo, orderVersion: s.orderVersion, kots: s.kots }) },
  ),
);
