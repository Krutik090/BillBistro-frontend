"use client";
// T-112 Floor view: sections → table grid, live status (refetch 5s), occupancy timers, status machine actions.
import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Users, Clock, Receipt, Sparkles, Ban, CalendarClock, Check } from "lucide-react";
import { Button, Drawer, Badge, cn } from "@billbistro/ui";
import { TABLE_TRANSITIONS, type TableInfo, type TableStatus } from "@billbistro/sdk";
import { useApi } from "../lib/api";
import { usePos } from "../lib/store";

const STATUS: Record<TableStatus, { label: string; tone: string; card: string; icon: React.ReactNode }> = {
  FREE: { label: "Free", tone: "text-success", card: "border-border bg-surface-raised hover:border-success/60", icon: <Check size={14} /> },
  OCCUPIED: { label: "Occupied", tone: "text-warning", card: "border-warning/50 bg-warning/10", icon: <Users size={14} /> },
  RESERVED: { label: "Reserved", tone: "text-chart-3", card: "border-chart-3/50 bg-chart-3/10", icon: <CalendarClock size={14} /> },
  BILLED: { label: "Bill printed", tone: "text-info", card: "border-info/50 bg-info/10", icon: <Receipt size={14} /> },
  CLEANING: { label: "Cleaning", tone: "text-muted", card: "border-border bg-surface-overlay", icon: <Sparkles size={14} /> },
  BLOCKED: { label: "Blocked", tone: "text-danger", card: "border-danger/40 bg-surface-overlay opacity-70", icon: <Ban size={14} /> },
};
const ACTION_LABEL: Record<TableStatus, string> = { FREE: "Free table", OCCUPIED: "Seat guests", RESERVED: "Reserve", BILLED: "Mark billed", CLEANING: "Needs cleaning", BLOCKED: "Block table" };

const since = (iso?: string | null) => { if (!iso) return ""; const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`; };

export function Floor() {
  const api = useApi();
  const qc = useQueryClient();
  const router = useRouter();
  const { data: tables = [], isPending, error, dataUpdatedAt } = useQuery({ queryKey: ["tables"], queryFn: api.tables.list, refetchInterval: 5000 });
  const [picked, setPicked] = React.useState<TableInfo | null>(null);
  const [section, setSection] = React.useState<string | "all">("all");
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => { const id = setInterval(tick, 30_000); return () => clearInterval(id); }, []);
  const setTable = usePos((s) => s.setTable);
  const notify = usePos((s) => s.notify);

  const setStatus = useMutation({
    mutationFn: ({ t, status }: { t: TableInfo; status: TableStatus }) => api.tables.setStatus(t.id, status, t.version),
    // optimistic: paint the new status immediately, roll back on 409/422
    onMutate: async ({ t, status }) => {
      await qc.cancelQueries({ queryKey: ["tables"] });
      const prev = qc.getQueryData<TableInfo[]>(["tables"]);
      qc.setQueryData<TableInfo[]>(["tables"], (old) => old?.map((x) => (x.id === t.id ? { ...x, status, statusSince: new Date().toISOString() } : x)));
      return { prev };
    },
    onError: (e, _v, ctx) => { qc.setQueryData(["tables"], ctx?.prev); notify(`Table update failed: ${(e as Error).message}`); },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tables"] }),
  });

  const sections = [...new Set(tables.map((t) => t.section))];
  const counts = tables.reduce<Record<string, number>>((a, t) => ((a[t.status] = (a[t.status] ?? 0) + 1), a), {});
  const visible = tables.filter((t) => section === "all" || t.section === section);

  const startOrder = (t: TableInfo) => {
    // The order itself seats the table on the API (tableId → OCCUPIED + currentOrderId), so no manual status change here.
    setTable(t.name, "DINE_IN", t.seats, t.id);
    setPicked(null);
    router.push("/");
  };

  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto"><h1 className="font-display text-2xl font-semibold">Floor</h1><p className="text-xs text-muted">{tables.length} tables · live {dataUpdatedAt ? `· updated ${since(new Date(dataUpdatedAt).toISOString()) || "now"} ago` : ""}</p></div>
        {(Object.keys(STATUS) as TableStatus[]).filter((s) => counts[s]).map((s) => <Badge key={s} className={cn("bg-surface-overlay", STATUS[s].tone)}>{counts[s]} {STATUS[s].label.toLowerCase()}</Badge>)}
      </header>
      <div className="flex gap-2 overflow-x-auto">
        {["all", ...sections].map((s) => (
          <button key={s} onClick={() => setSection(s)} className={cn("relative h-11 shrink-0 rounded-full border px-4.5 text-sm font-semibold", s === section ? "border-transparent text-primary-foreground" : "border-border bg-surface text-foreground")}>
            {s === section && <motion.span layoutId="floor-sec" className="absolute inset-0 rounded-full bg-primary" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
            <span className="relative">{s === "all" ? "All sections" : s}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-danger">Floor failed to load: {String((error as Error).message)}</p>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 overflow-y-auto">
        {isPending && Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface-raised" />)}
        {visible.map((t) => {
          const s = STATUS[t.status];
          return (
            <motion.button key={t.id} layout whileTap={{ scale: 0.97 }} onClick={() => setPicked(t)} className={cn("flex h-28 flex-col justify-between rounded-2xl border p-3.5 text-left transition-colors", s.card)}>
              <div className="flex items-start justify-between"><span className="font-display text-xl font-semibold">{t.name}</span><span className={cn("flex items-center gap-1 text-xs font-semibold", s.tone)}>{s.icon}{s.label}</span></div>
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="flex items-center gap-1"><Users size={12} />{t.seats}</span>
                {t.status !== "FREE" && t.statusSince && <span className="flex items-center gap-1 font-mono"><Clock size={12} />{since(t.statusSince)}</span>}
                {section === "all" && <span className="truncate">{t.section}</span>}
              </div>
            </motion.button>
          );
        })}
      </div>

      <Drawer open={!!picked} onOpenChange={(o) => !o && setPicked(null)} title={picked ? `${picked.name} · ${picked.section}` : ""}>
        {picked && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-raised p-4">
              <div><div className={cn("flex items-center gap-1.5 font-semibold", STATUS[picked.status].tone)}>{STATUS[picked.status].icon}{STATUS[picked.status].label}</div><div className="text-xs text-muted">{picked.seats} seats{picked.statusSince && picked.status !== "FREE" ? ` · ${since(picked.statusSince)}` : ""}{picked.orderId ? ` · order ${picked.orderId.slice(0, 8)}` : ""}</div></div>
            </div>
            {(picked.status === "FREE" || picked.status === "RESERVED" || picked.status === "OCCUPIED") && (
              <Button size="lg" variant="glow" onClick={() => startOrder(picked)}><Receipt size={18} /> {picked.status === "OCCUPIED" ? "Open bill" : "Start order"}</Button>
            )}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Change status</span>
              <div className="grid grid-cols-2 gap-2">
                {TABLE_TRANSITIONS[picked.status].filter((s) => !(s === "OCCUPIED" && picked.status !== "RESERVED")).map((s) => (
                  <Button key={s} variant="secondary" size="lg" disabled={setStatus.isPending} onClick={() => { setStatus.mutate({ t: picked, status: s }); setPicked(null); }}>{STATUS[s].icon} {ACTION_LABEL[s]}</Button>
                ))}
              </div>
              <p className="text-xs text-subtle">Transitions follow the server state machine; a stale card is refreshed automatically.</p>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
