"use client";
import * as React from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createPosApi, ApiError, type OrderItemInput, type PosApi } from "@billbistro/sdk";
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

/** In real/hybrid mode, blocks the app behind Jim's cookie login until /auth/me succeeds. Mock mode passes through. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const api = useApi();
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: api.auth.me, retry: false, staleTime: Infinity });
  const [form, setForm] = React.useState({ tenantSlug: "demo", email: "owner@demo.local", password: "" });
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  if (api.mode === "mock" || me.data) return <>{children}</>;
  if (me.isPending) return <div className="flex h-dvh items-center justify-center text-sm text-muted">Connecting to {api.mode} API…</div>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.auth.login(form); await me.refetch(); } catch (x) { setErr(x instanceof ApiError ? x.message : String(x)); } finally { setBusy(false); }
  };
  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <form onSubmit={submit} className="flex w-[360px] flex-col gap-4 rounded-2xl border border-border bg-surface-raised p-6 shadow-2">
        <div className="flex items-center gap-3"><LogoMark size={36} /><div><div className="font-display text-lg font-semibold">Sign in</div><div className="text-xs text-muted">{api.mode} mode · API cookie session</div></div></div>
        <Input label="Restaurant" value={form.tenantSlug} onChange={(e) => setForm({ ...form, tenantSlug: e.target.value })} />
        <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoFocus />
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button size="lg" type="submit" disabled={busy || !form.password}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
    </div>
  );
}

export const useMenu = () => {
  const api = useApi();
  const categories = useQuery({ queryKey: ["menu", "categories"], queryFn: api.menu.categories });
  const items = useQuery({ queryKey: ["menu", "items"], queryFn: api.menu.items });
  return { categories: (categories.data ?? []).filter((c) => c.isActive), items: items.data ?? [], loading: categories.isPending || items.isPending, error: categories.error ?? items.error };
};
export const useTables = () => { const api = useApi(); return useQuery({ queryKey: ["tables"], queryFn: api.tables.list, staleTime: 5_000 }); };

const toInput = (l: CartLine): OrderItemInput => ({ itemId: l.item.id, qty: l.qty, variantId: l.variantId, modifierIds: l.modifierIds, notes: l.notes, clientLineId: l.serverId ?? l.lineId });

/** Ensures a server order exists and mirrors the local cart (called before KOT / bill). Returns the order. */
export function useSyncOrder() {
  const api = useApi();
  return React.useCallback(async () => {
    const s = usePos.getState();
    s.setSyncing(true);
    try {
      const order = s.orderId
        ? await api.orders.replaceItems(s.orderId, s.lines.map(toInput))
        : await api.orders.create({ type: s.type, tableRef: s.tableRef, items: s.lines.map(toInput), clientKey: crypto.randomUUID() });
      usePos.getState().setOrder(order);
      return order;
    } finally { usePos.getState().setSyncing(false); }
  }, [api]);
}
