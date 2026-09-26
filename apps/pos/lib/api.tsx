"use client";
import * as React from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPosApi, ApiError, type OrderItemInput, type OrderStatus, type PosApi } from "@billbistro/sdk";
import { Button, Input, LogoMark } from "@billbistro/ui";
import { usePos } from "./store";
import type { CartLine } from "./calc";

const ApiContext = React.createContext<PosApi | null>(null);
export const useApi = () => { const a = React.useContext(ApiContext); if (!a) throw new Error("ApiProvider missing"); return a; };

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [api] = React.useState(() => createPosApi());
  const [qc] = React.useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } }));
  return <ApiContext.Provider value={api}><QueryClientProvider client={qc}><AuthGate>{children}</AuthGate></QueryClientProvider></ApiContext.Provider>;
}

/** Single-restaurant deployment: the tenant slug is deployment config, not something a human types. */
const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG || "demo";

/** In real/hybrid mode, blocks the app behind cookie login until /auth/me succeeds. Mock mode passes through. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const api = useApi();
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: api.auth.me, retry: false, staleTime: Infinity });
  const [form, setForm] = React.useState({ email: "owner@demo.local", password: "" });
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  if (api.mode === "mock" || me.data) return <>{children}</>;
  if (me.isPending) return <div className="flex h-dvh items-center justify-center text-sm text-muted">Connecting to {api.mode} API…</div>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.auth.login({ tenantSlug: TENANT_SLUG, ...form }); await me.refetch(); } catch (x) { setErr(x instanceof ApiError ? x.message : String(x)); } finally { setBusy(false); }
  };
  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <form onSubmit={submit} className="flex w-[360px] flex-col gap-4 rounded-2xl border border-border bg-surface-raised p-6 shadow-2">
        <div className="flex items-center gap-3"><LogoMark size={36} /><div><div className="font-display text-lg font-semibold">Sign in</div><div className="text-xs text-muted">{api.mode} mode · API cookie session</div></div></div>
        <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoFocus />
        <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button size="lg" type="submit" disabled={busy || !form.password}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
    </div>
  );
}

export const useMenu = () => {
  const api = useApi();
  const categories = useQuery({ queryKey: ["menu", "categories"], queryFn: api.menu.categories });
  const items = useQuery({ queryKey: ["menu", "effective"], queryFn: api.menu.effective, refetchInterval: 60_000 });
  return { categories: (categories.data ?? []).filter((c) => c.isActive), items: items.data ?? [], loading: categories.isPending || items.isPending, error: categories.error ?? items.error };
};
export const useOutlet = () => { const api = useApi(); return useQuery({ queryKey: ["outlet"], queryFn: api.outlets.current, staleTime: Infinity }); };
export const useTables = () => { const api = useApi(); return useQuery({ queryKey: ["tables"], queryFn: api.tables.list, staleTime: 5_000 }); };

/** Polls so the list stays current without a manual refresh. */
export function useLiveOrders(status: OrderStatus) {
  const api = useApi();
  const q = useQuery({ queryKey: ["orders", "list", status], queryFn: () => api.orders.list({ status, limit: 200 }), refetchInterval: 8_000 });
  return { orders: q.data ?? [], loading: q.isPending, error: q.error };
}

export function useOrderActions() {
  const api = useApi(); const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["orders"] });
  return {
    cancel: useMutation({ mutationFn: ({ id, reason }: { id: string; reason: string }) => api.orders.cancel(id, reason), onSuccess: inv }),
  };
}

const toInput = (l: CartLine): OrderItemInput => ({ itemId: l.item.id, qty: l.qty, variantId: l.variantId, modifierIds: l.modifierIds, notes: l.notes, clientLineId: l.serverId ?? l.lineId });

/** Ensures a server order exists and mirrors the local cart (called before KOT / bill). Returns the order. */
export function useSyncOrder() {
  const api = useApi();
  return React.useCallback(async () => {
    const s = usePos.getState();
    s.setSyncing(true);
    try {
      const order = s.orderId
        ? await api.orders.replaceItems(s.orderId, s.lines.map(toInput), s.orderVersion ?? undefined)
        : await api.orders.create({ type: s.type, tableId: s.tableId, tableRef: s.tableRef, guestCount: s.covers || undefined, items: s.lines.map(toInput), clientKey: crypto.randomUUID() });
      usePos.getState().setOrder(order);
      return order;
    } finally { usePos.getState().setSyncing(false); }
  }, [api]);
}
