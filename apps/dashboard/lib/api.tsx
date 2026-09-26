"use client";
import * as React from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPosApi, ApiError, type CategoryInput, type ItemInput, type PosApi } from "@billbistro/sdk";
import { Button, Input, LogoMark } from "@billbistro/ui";

const ApiContext = React.createContext<PosApi | null>(null);
export const useApi = () => { const a = React.useContext(ApiContext); if (!a) throw new Error("ApiProvider missing"); return a; };

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [api] = React.useState(() => createPosApi());
  const [qc] = React.useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  return <ApiContext.Provider value={api}><QueryClientProvider client={qc}><AuthGate>{children}</AuthGate></QueryClientProvider></ApiContext.Provider>;
}

function AuthGate({ children }: { children: React.ReactNode }) {
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

export function useReports(from: string, to: string) {
  const api = useApi();
  const sales = useQuery({ queryKey: ["reports", "sales", from, to], queryFn: () => api.reports.sales(from, to) });
  const items = useQuery({ queryKey: ["reports", "items", from, to], queryFn: () => api.reports.items(from, to) });
  const tax = useQuery({ queryKey: ["reports", "tax", from, to], queryFn: () => api.reports.tax(from, to) });
  return {
    sales: sales.data, items: items.data?.items ?? [], tax: tax.data,
    loading: sales.isPending || items.isPending || tax.isPending,
    error: sales.error ?? items.error ?? tax.error,
  };
}

export function useMenu() {
  const api = useApi();
  const categories = useQuery({ queryKey: ["menu", "categories"], queryFn: api.menu.categories });
  const items = useQuery({ queryKey: ["menu", "items"], queryFn: api.menu.items });
  return { categories: categories.data ?? [], items: items.data ?? [], loading: categories.isPending || items.isPending, error: categories.error ?? items.error };
}

/** Mutations invalidate the menu queries; errors bubble to the caller for toasts. */
export function useMenuMutations() {
  const api = useApi(); const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["menu"] });
  return {
    createCategory: useMutation({ mutationFn: (i: CategoryInput) => api.menu.createCategory(i), onSuccess: inv }),
    updateCategory: useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<CategoryInput> }) => api.menu.updateCategory(id, input), onSuccess: inv }),
    deleteCategory: useMutation({ mutationFn: (id: string) => api.menu.deleteCategory(id), onSuccess: inv }),
    createItem: useMutation({ mutationFn: (i: ItemInput) => api.menu.createItem(i), onSuccess: inv }),
    updateItem: useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<ItemInput> }) => api.menu.updateItem(id, input), onSuccess: inv }),
    deleteItem: useMutation({ mutationFn: (id: string) => api.menu.deleteItem(id), onSuccess: inv }),
  };
}
