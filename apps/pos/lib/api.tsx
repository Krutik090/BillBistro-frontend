"use client";
import * as React from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createPosApi, type OrderItemInput, type PosApi } from "@billbistro/sdk";
import { usePos } from "./store";
import type { CartLine } from "./calc";

const ApiContext = React.createContext<PosApi | null>(null);
export const useApi = () => { const a = React.useContext(ApiContext); if (!a) throw new Error("ApiProvider missing"); return a; };

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [api] = React.useState(() => createPosApi());
  const [qc] = React.useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }));
  return <ApiContext.Provider value={api}><QueryClientProvider client={qc}>{children}</QueryClientProvider></ApiContext.Provider>;
}

export const useMenu = () => {
  const api = useApi();
  const categories = useQuery({ queryKey: ["menu", "categories"], queryFn: api.menu.categories });
  const items = useQuery({ queryKey: ["menu", "items"], queryFn: api.menu.items });
  return { categories: categories.data ?? [], items: items.data ?? [], loading: categories.isPending || items.isPending, error: categories.error ?? items.error };
};
export const useTables = () => { const api = useApi(); return useQuery({ queryKey: ["tables"], queryFn: api.tables.list, staleTime: 5_000 }); };

const toInput = (l: CartLine): OrderItemInput => ({ itemId: l.item.id, qty: l.qty, variantId: l.variantId, modifierIds: l.modifierIds, notes: l.notes, clientLineId: l.serverId ?? l.lineId });

/** Ensures a server order exists and mirrors the local cart (called before KOT / bill). Returns the order id. */
export function useSyncOrder() {
  const api = useApi();
  return React.useCallback(async () => {
    const s = usePos.getState();
    s.setSyncing(true);
    try {
      const order = s.orderId
        ? await api.orders.replaceItems(s.orderId, s.lines.map(toInput))
        : await api.orders.create({ type: s.type, tableRef: s.tableRef, items: s.lines.map(toInput), clientKey: crypto.randomUUID() });
      // the mock echoes clientLineId as the server id, so lines get serverIds
      usePos.getState().setOrder(order);
      return order;
    } finally { usePos.getState().setSyncing(false); }
  }, [api]);
}
