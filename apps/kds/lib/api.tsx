"use client";
import * as React from "react";
import { createPosApi, ApiError, type KotTicket, type PosApi } from "@billbistro/sdk";
import { Button, Input, LogoMark } from "@billbistro/ui";

const ApiContext = React.createContext<PosApi | null>(null);
export const useApi = () => { const a = React.useContext(ApiContext); if (!a) throw new Error("ApiProvider missing"); return a; };

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [api] = React.useState(() => createPosApi());
  return <ApiContext.Provider value={api}><AuthGate>{children}</AuthGate></ApiContext.Provider>;
}

/** Single-restaurant deployment: the tenant slug is deployment config, not something a human types. */
const TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG || "demo";

function AuthGate({ children }: { children: React.ReactNode }) {
  const api = useApi();
  const [ready, setReady] = React.useState(api.mode === "mock");
  const [checked, setChecked] = React.useState(api.mode === "mock");
  const [form, setForm] = React.useState({ email: "owner@demo.local", password: "" });
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (api.mode === "mock") return;
    api.auth.me().then(() => setReady(true)).catch(() => {}).finally(() => setChecked(true));
  }, [api]);
  if (ready) return <>{children}</>;
  if (!checked) return <div className="flex h-dvh items-center justify-center text-sm text-muted">Connecting to {api.mode} API…</div>;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.auth.login({ tenantSlug: TENANT_SLUG, ...form }); setReady(true); } catch (x) { setErr(x instanceof ApiError ? x.message : String(x)); } finally { setBusy(false); }
  };
  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <form onSubmit={submit} className="flex w-[360px] flex-col gap-4 rounded-2xl border border-border bg-surface-raised p-6 shadow-2">
        <div className="flex items-center gap-3"><LogoMark size={36} /><div><div className="font-display text-lg font-semibold">Sign in</div><div className="text-xs text-muted">{api.mode} mode · kitchen display</div></div></div>
        <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoFocus />
        <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button size="lg" type="submit" disabled={busy || !form.password}>{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
    </div>
  );
}

const active = (t: KotTicket) => t.status !== "SERVED" && t.status !== "CANCELLED";
const byAge = (a: KotTicket, b: KotTicket) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "");

/** Initial GET /v1/kots, then live upserts/removals from the SSE (or mock) push — never a full refetch. */
export function useKotFeed() {
  const api = useApi();
  const [tickets, setTickets] = React.useState<KotTicket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown>(null);

  React.useEffect(() => {
    let cancelled = false;
    api.kots.list().then((ts) => { if (!cancelled) { setTickets(ts.filter(active).sort(byAge)); setLoading(false); } }).catch((e) => { if (!cancelled) { setError(e); setLoading(false); } });
    const unsubscribe = api.kots.subscribe((t) => {
      setTickets((prev) => {
        const rest = prev.filter((x) => x.id !== t.id);
        return active(t) ? [...rest, t].sort(byAge) : rest;
      });
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [api]);

  return { tickets, loading, error };
}
