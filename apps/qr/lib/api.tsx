"use client";
// QR ordering — no staff session, no auth gate. The outlet is deployment config (single restaurant,
// single outlet in practice), never resolved via the authenticated GET /outlets.
import * as React from "react";
import { createPosApi, ApiError, type EffectiveMenu, type Order, type OrderItemInput, type PosApi } from "@billbistro/sdk";

const OUTLET_ID = process.env.NEXT_PUBLIC_OUTLET_ID || "";

const ApiContext = React.createContext<PosApi | null>(null);
export const useApi = () => { const a = React.useContext(ApiContext); if (!a) throw new Error("ApiProvider missing"); return a; };

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [api] = React.useState(() => createPosApi());
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
}

export function useQrMenu() {
  const api = useApi();
  const [menu, setMenu] = React.useState<EffectiveMenu | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown>(null);
  React.useEffect(() => {
    let cancelled = false;
    api.qr.menu(OUTLET_ID).then((m) => { if (!cancelled) { setMenu(m); setLoading(false); } }).catch((e) => { if (!cancelled) { setError(e); setLoading(false); } });
    return () => { cancelled = true; };
  }, [api]);
  return { menu, loading, error };
}

/** Table context printed into the QR code's URL: /?table=<tableId>. Absent = counter/takeaway order. */
export function useTableId(): string | undefined {
  const [tableId, setTableId] = React.useState<string | undefined>(undefined);
  React.useEffect(() => { setTableId(new URLSearchParams(window.location.search).get("table") ?? undefined); }, []);
  return tableId;
}

export function useSubmitOrder() {
  const api = useApi();
  const tableId = useTableId();
  return React.useCallback(async (items: OrderItemInput[]): Promise<Order> => {
    try {
      return await api.qr.createOrder({ type: tableId ? "DINE_IN" : "TAKEAWAY", outletId: OUTLET_ID, tableId, items, clientKey: crypto.randomUUID() });
    } catch (e) {
      throw e instanceof ApiError ? new Error(e.message) : e;
    }
  }, [api, tableId]);
}
