"use client";
// KDS — per Figma "Hero / KDS". High-contrast, color-coded timers, glanceable. Live over GET /v1/kots + SSE (T-105).
import * as React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { ThemeToggle, cn, spring } from "@billbistro/ui";
import type { KotTicket, KotStatus } from "@billbistro/sdk";
import { ApiProvider, useApi, useKotFeed } from "../lib/api";

type Urgency = "late" | "warn" | "ok";
const urgencyOf = (ageSeconds: number): Urgency => (ageSeconds >= 600 ? "late" : ageSeconds >= 300 ? "warn" : "ok");
const head: Record<Urgency, string> = { late: "bg-danger", warn: "bg-warning", ok: "bg-success" };
const NEXT: Partial<Record<KotStatus, { status: KotStatus; label: string }>> = {
  PENDING: { status: "PREPARING", label: "START →" },
  PREPARING: { status: "READY", label: "READY →" },
  READY: { status: "SERVED", label: "SERVE →" },
};
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function KdsPage() {
  return <ApiProvider><KdsBoard /></ApiProvider>;
}

function KdsBoard() {
  const api = useApi();
  const { tickets, loading, error } = useKotFeed();
  const [station, setStation] = React.useState("All");
  const [now, setNow] = React.useState(() => Date.now());
  const [msg, setMsg] = React.useState<string | null>(null);
  React.useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const stations = ["All", ...Array.from(new Set(tickets.map((t) => t.station).filter((s): s is string => !!s))).sort()];
  const visible = station === "All" ? tickets : tickets.filter((t) => t.station === station);
  const ages = tickets.map((t) => (now - Date.parse(t.createdAt ?? "")) / 1000);
  const lateCount = ages.filter((a) => urgencyOf(a) === "late").length;

  const bump = async (t: KotTicket) => {
    const next = NEXT[t.status];
    if (!next) return;
    try { await api.kots.setStatus(t.id, next.status); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); setTimeout(() => setMsg(null), 3000); }
  };

  return (
    <div className="flex h-dvh flex-col bg-neutral-950 text-foreground">
      <header className="flex items-center justify-between border-b border-border bg-surface px-8 py-5">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-3xl font-bold tracking-tight">KITCHEN · MAIN LINE</h1>
          <span className="rounded-full bg-surface-overlay px-3.5 py-1.5 text-lg font-semibold text-warning">{tickets.length} active · {lateCount} late</span>
        </div>
        <div className="flex items-center gap-3">
          {stations.map((s) => (
            <button key={s} onClick={() => setStation(s)} className={cn("relative h-12 rounded-lg px-5 text-lg font-semibold", s === station ? "text-primary-foreground" : "bg-surface-overlay")}>
              {s === station && <motion.span layoutId="station" className="absolute inset-0 rounded-lg bg-primary" transition={spring} />}
              <span className="relative">{s}</span>
            </button>
          ))}
          <span className="ml-3 font-mono text-3xl font-medium text-muted font-tabular">{new Date(now).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
          <ThemeToggle />
        </div>
      </header>
      <main className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(352px,1fr))] gap-5 overflow-y-auto p-6">
        {loading && <p className="text-lg text-muted">Loading tickets…</p>}
        {!!error && <p className="text-lg text-danger">Failed to load KDS feed: {String(error)}</p>}
        {!loading && !visible.length && <p className="text-lg text-muted">No active tickets{station !== "All" ? ` for ${station}` : ""}.</p>}
        {visible.map((t) => {
          const age = Math.max(0, (now - Date.parse(t.createdAt ?? "")) / 1000);
          const urgency = urgencyOf(age);
          const done = t.status === "READY" || t.status === "SERVED";
          const next = NEXT[t.status];
          return (
            <motion.article key={t.id} layout className={cn("flex flex-col overflow-hidden rounded-2xl border bg-surface-raised", urgency === "late" ? "border-2 border-danger" : "border-border")}>
              <div className={cn("flex items-center justify-between px-4.5 py-3.5 text-neutral-950", head[urgency])}>
                <div><div className="font-display text-xl font-bold">{t.tableRef ?? "Takeaway"}</div><div className="text-sm font-medium text-neutral-900">{t.kotNo} · {t.orderNo}</div></div>
                <span className="font-mono text-3xl font-medium font-tabular">{mmss(age)}</span>
              </div>
              <ul className="px-4.5 py-2">
                {(t.items ?? []).map((i) => (
                  <li key={i.id} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                    <span className={cn("flex size-7 items-center justify-center rounded-md", done ? "bg-success text-neutral-950" : "border border-border-strong")}>{done && <Check size={16} strokeWidth={3} />}</span>
                    <span className={cn("text-kds font-semibold", done ? "text-subtle line-through" : "text-foreground")}>{i.qty}× {i.name}{i.variantName ? ` (${i.variantName})` : ""}</span>
                  </li>
                ))}
              </ul>
              {next && <button onClick={() => bump(t)} className="bg-surface-overlay py-4 text-xl font-bold hover:bg-primary hover:text-primary-foreground">{next.label}</button>}
            </motion.article>
          );
        })}
      </main>
      {msg && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-surface-overlay px-5 py-2.5 text-sm font-semibold shadow-3">{msg}</div>}
    </div>
  );
}
