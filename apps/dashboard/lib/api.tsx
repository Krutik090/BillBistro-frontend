"use client";
import * as React from "react";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createPosApi, ApiError, type CategoryInput, type ItemInput, type PosApi, type InventoryItemInput, type Milli } from "@billbistro/sdk";
import { Button, Input, LogoMark } from "@billbistro/ui";

const ApiContext = React.createContext<PosApi | null>(null);
export const useApi = () => { const a = React.useContext(ApiContext); if (!a) throw new Error("ApiProvider missing"); return a; };

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [api] = React.useState(() => createPosApi());
  const [qc] = React.useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  return <ApiContext.Provider value={api}><QueryClientProvider client={qc}><AuthGate>{children}</AuthGate></QueryClientProvider></ApiContext.Provider>;
}

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function AuthGate({ children }: { children: React.ReactNode }) {
  const api = useApi();
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: api.auth.me, retry: false, staleTime: Infinity });
  const [screen, setScreen] = React.useState<"signin" | "signup">("signin");
  const [login, setLogin] = React.useState({ tenantSlug: "demo", email: "owner@demo.local", password: "" });
  const [signup, setSignup] = React.useState({ tenantName: "", tenantSlug: "", ownerName: "", email: "", password: "", outletName: "" });
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  if (api.mode === "mock" || me.data) return <>{children}</>;
  if (me.isPending) return <div className="flex h-dvh items-center justify-center text-sm text-muted">Connecting to {api.mode} API…</div>;

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.auth.login(login); await me.refetch(); } catch (x) { setErr(x instanceof ApiError ? x.message : String(x)); } finally { setBusy(false); }
  };
  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.auth.signup({ ...signup, outletName: signup.outletName || undefined }); await me.refetch(); } catch (x) { setErr(x instanceof ApiError ? x.message : String(x)); } finally { setBusy(false); }
  };
  const signupValid = signup.tenantName && signup.tenantSlug && signup.ownerName && signup.email && signup.password.length >= 8;

  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <div className="flex w-[400px] flex-col gap-4 rounded-2xl border border-border bg-surface-raised p-6 shadow-2">
        <div className="flex items-center gap-3">
          <LogoMark size={36} />
          <div><div className="font-display text-lg font-semibold">{screen === "signin" ? "Sign in" : "Create your restaurant"}</div><div className="text-xs text-muted">{api.mode} mode · API cookie session</div></div>
        </div>
        {screen === "signin" ? (
          <form onSubmit={submitLogin} className="flex flex-col gap-4">
            <Input label="Restaurant" value={login.tenantSlug} onChange={(e) => setLogin({ ...login, tenantSlug: e.target.value })} />
            <Input label="Email" type="email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
            <Input label="Password" type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} autoFocus />
            {err && <p className="text-sm text-danger">{err}</p>}
            <Button size="lg" type="submit" disabled={busy || !login.password}>{busy ? "Signing in…" : "Sign in"}</Button>
          </form>
        ) : (
          <form onSubmit={submitSignup} className="flex flex-col gap-4">
            <Input label="Restaurant name" value={signup.tenantName} onChange={(e) => setSignup({ ...signup, tenantName: e.target.value, tenantSlug: signup.tenantSlug || slugify(e.target.value) })} />
            <Input label="Restaurant URL (used to sign in)" value={signup.tenantSlug} onChange={(e) => setSignup({ ...signup, tenantSlug: slugify(e.target.value) })} />
            <Input label="Your name" value={signup.ownerName} onChange={(e) => setSignup({ ...signup, ownerName: e.target.value })} />
            <Input label="Email" type="email" value={signup.email} onChange={(e) => setSignup({ ...signup, email: e.target.value })} />
            <Input label="Password" type="password" value={signup.password} onChange={(e) => setSignup({ ...signup, password: e.target.value })} />
            <Input label="First outlet name (optional)" value={signup.outletName} onChange={(e) => setSignup({ ...signup, outletName: e.target.value })} />
            {err && <p className="text-sm text-danger">{err}</p>}
            <Button size="lg" type="submit" disabled={busy || !signupValid}>{busy ? "Creating…" : "Create account"}</Button>
          </form>
        )}
        <button type="button" onClick={() => { setScreen(screen === "signin" ? "signup" : "signin"); setErr(null); }} className="text-center text-xs text-muted hover:text-foreground">
          {screen === "signin" ? "New restaurant? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
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

export function useInventory() {
  const api = useApi();
  const items = useQuery({ queryKey: ["inventory", "items"], queryFn: () => api.inventory.list() });
  return { items: items.data ?? [], loading: items.isPending, error: items.error };
}

export function useInventoryMutations() {
  const api = useApi(); const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["inventory"] });
  return {
    create: useMutation({ mutationFn: (i: InventoryItemInput) => api.inventory.create(i), onSuccess: inv }),
    update: useMutation({ mutationFn: ({ id, input }: { id: string; input: Partial<InventoryItemInput> }) => api.inventory.update(id, input), onSuccess: inv }),
    adjust: useMutation({ mutationFn: ({ id, qtyMilli, reason }: { id: string; qtyMilli: Milli; reason: string }) => api.inventory.adjust(id, { qtyMilli, reason }), onSuccess: inv }),
  };
}

export function useRecipe(menuItemId: string | null) {
  const api = useApi(); const qc = useQueryClient();
  const q = useQuery({ queryKey: ["inventory", "recipe", menuItemId], queryFn: () => api.inventory.recipe(menuItemId!), enabled: !!menuItemId });
  const setRecipe = useMutation({
    mutationFn: (lines: { inventoryItemId: string; qtyMilli: Milli }[]) => api.inventory.setRecipe(menuItemId!, lines),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", "recipe", menuItemId] }),
  });
  return { lines: q.data ?? [], loading: q.isPending, setRecipe };
}
