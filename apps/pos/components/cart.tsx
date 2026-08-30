"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ChefHat, Users, Pause, Percent, Scissors, Loader2, ListChecks } from "lucide-react";
import { Badge, Button, cn } from "@billbistro/ui";
import { usePos } from "../lib/store";
import { computeTotals, lineLabel, lineTotal, type CartLine } from "../lib/calc";
import { inr } from "../lib/format";
import { useSyncOrder, useApi } from "../lib/api";

export function Cart() {
  const s = usePos();
  const api = useApi();
  const sync = useSyncOrder();
  const t = computeTotals(s.lines, s.discount, s.tip);
  const unsent = s.lines.filter((l) => !l.kotId);
  const [busy, setBusy] = React.useState<null | "kot" | "bill">(null);

  const sendKot = async () => {
    if (!unsent.length) return;
    setBusy("kot");
    try {
      const order = await sync();
      const ids = order.items.filter((i) => !i.kotId).map((i) => i.id);
      await api.orders.sendKot(order.id, ids);
      usePos.getState().setOrder(await api.orders.get(order.id));
      s.notify(`KOT sent · ${ids.length} item${ids.length === 1 ? "" : "s"}`);
    } catch (e) { s.notify(`KOT failed: ${(e as Error).message}`); } finally { setBusy(null); }
  };
  const charge = async () => {
    if (!s.lines.length) return;
    setBusy("bill");
    try { await sync(); s.openSheet("pay"); } catch (e) { s.notify(`Could not sync order: ${(e as Error).message}`); } finally { setBusy(null); }
  };

  return (
    <aside className="flex w-[420px] shrink-0 flex-col border-l border-border bg-surface print:hidden">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <button onClick={() => s.openSheet("table")} className="flex items-center gap-2 rounded-md px-2 py-1 -ml-2 hover:bg-surface-overlay">
          <Users size={16} className="text-primary" />
          <span className="font-display text-lg font-semibold">{s.tableRef ?? (s.type === "DINE_IN" ? "Pick table" : s.type === "TAKEAWAY" ? "Takeaway" : "Delivery")}</span>
          {s.covers > 0 && <span className="text-sm text-muted">· {s.covers} pax</span>}
        </button>
        <div className="flex items-center gap-2">
          {s.syncing && <Loader2 size={14} className="animate-spin text-muted" />}
          {s.orderNo && <Badge>{s.orderNo}</Badge>}
          {s.kots.length > 0 && <button onClick={() => s.openSheet("kot")}><Badge tone="success-soft">{s.kots.length} KOT</Badge></button>}
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto px-5">
        <AnimatePresence initial={false}>
          {s.lines.map((l) => <Line key={l.lineId} l={l} />)}
        </AnimatePresence>
        {!s.lines.length && <li className="py-16 text-center text-sm text-muted">Tap items to start a bill.<br /><span className="text-xs text-subtle">/ search · F8 KOT · F9 pay · F10 hold</span></li>}
      </ul>

      <div className="flex flex-col gap-1.5 bg-surface-raised px-5 py-3 text-sm">
        <Row k={`Subtotal · ${t.qty} item${t.qty === 1 ? "" : "s"}`} v={inr(t.subtotal)} />
        {t.discountAmt > 0 && <Row k={`Discount${s.discount?.kind === "percent" ? ` ${s.discount.value}%` : ""}`} v={`−${inr(t.discountAmt)}`} cls="text-success" />}
        {[...t.taxByRate].map(([bps, amt]) => <React.Fragment key={bps}><Row k={`CGST ${bps / 200}%`} v={inr(Math.round(amt / 2))} /><Row k={`SGST ${bps / 200}%`} v={inr(amt - Math.round(amt / 2))} /></React.Fragment>)}
        {t.tip > 0 && <Row k="Tip" v={inr(t.tip)} />}
        {t.roundOff !== 0 && <Row k="Round off" v={inr(t.roundOff)} />}
        <div className="flex items-center justify-between pt-1"><span className="text-lg font-semibold">Total</span><span className="font-display text-3xl font-semibold font-tabular">{inr(t.total)}</span></div>
      </div>

      <div className="flex flex-col gap-2.5 px-5 pt-3 pb-4">
        <div className="grid grid-cols-4 gap-2">
          <Action icon={<Pause size={16} />} label="Hold" onClick={s.hold} disabled={!s.lines.length} badge={s.held.length || undefined} onBadge={() => s.openSheet("hold")} />
          <Action icon={<Percent size={16} />} label="Discount" onClick={() => s.openSheet("discount")} active={!!s.discount} />
          <Action icon={<Scissors size={16} />} label="Split" onClick={() => s.openSheet("split")} disabled={!s.lines.length} active={s.splitCount > 1} />
          <Action icon={busy === "kot" ? <Loader2 size={16} className="animate-spin" /> : <ChefHat size={16} />} label={unsent.length ? `KOT (${unsent.length})` : "KOT"} onClick={sendKot} disabled={!unsent.length || !!busy} hot />
        </div>
        <Button variant="glow" size="lg" className="h-16 text-lg" onClick={charge} disabled={!s.lines.length || !!busy}>
          {busy === "bill" ? <Loader2 className="animate-spin" /> : <ListChecks size={20} />} Charge {inr(t.total)}
        </Button>
      </div>
    </aside>
  );
}

function Line({ l }: { l: CartLine }) {
  const { updateLine, removeLine, openSheet } = usePos();
  const sub = lineLabel(l);
  return (
    <motion.li layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }} className="flex items-center gap-3 border-b border-border py-3">
      <div className="flex h-9 w-24 shrink-0 items-center justify-between rounded-md bg-surface-overlay">
        <button className="h-full w-8 text-muted hover:text-foreground" onClick={() => (l.qty === 1 ? removeLine(l.lineId) : updateLine(l.lineId, { qty: l.qty - 1 }))} aria-label="Decrease"><Minus size={14} className="mx-auto" /></button>
        <span className="text-md font-semibold font-tabular">{l.qty}</span>
        <button className="h-full w-8 text-primary" onClick={() => updateLine(l.lineId, { qty: l.qty + 1 })} aria-label="Increase"><Plus size={14} className="mx-auto" /></button>
      </div>
      <button className="min-w-0 flex-1 text-left" onClick={() => openSheet("item", l.item, l.lineId)}>
        <div className="flex items-center gap-2"><span className="truncate text-md font-medium">{l.item.name}</span>{l.kotId && <ChefHat size={12} className="shrink-0 text-success" />}</div>
        {(sub || l.notes) && <div className="truncate text-xs text-muted">{[sub, l.notes].filter(Boolean).join(" · ")}</div>}
      </button>
      <span className="font-mono text-md font-medium font-tabular">{inr(lineTotal(l))}</span>
    </motion.li>
  );
}

const Row = ({ k, v, cls }: { k: string; v: string; cls?: string }) => <div className={cn("flex items-center justify-between text-muted", cls)}><span>{k}</span><span className="font-mono text-foreground font-tabular">{v}</span></div>;

function Action({ icon, label, onClick, disabled, active, hot, badge, onBadge }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean; hot?: boolean; badge?: number; onBadge?: () => void }) {
  return (
    <div className="relative">
      <button onClick={onClick} disabled={disabled} data-hot={hot ? "kot" : undefined} className={cn("flex h-touch w-full flex-col items-center justify-center gap-1 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-40", active ? "border-primary bg-primary-soft" : hot && !disabled ? "border-primary/60 bg-surface-overlay text-primary" : "border-border bg-surface-overlay hover:border-border-strong")}>{icon}{label}</button>
      {badge ? <button onClick={onBadge} className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-warning text-[10px] font-bold text-neutral-950" aria-label="Held orders">{badge}</button> : null}
    </div>
  );
}
