"use client";
// Small sheets: table picker, hold/recall, KOT view, discount, split.
import * as React from "react";
import { Button, Drawer, Badge, cn } from "@billbistro/ui";
import type { OrderType } from "@billbistro/sdk";
import { usePos } from "../lib/store";
import { useTables } from "../lib/api";
import { computeTotals, lineTotal } from "../lib/calc";
import { inr } from "../lib/format";

const useSheet = (name: string) => { const sheet = usePos((s) => s.sheet); const openSheet = usePos((s) => s.openSheet); return { open: sheet === name, close: () => openSheet(null) }; };

export function TableSheet() {
  const { open, close } = useSheet("table");
  const { data: tables = [], isPending } = useTables();
  const setTable = usePos((s) => s.setTable);
  const current = usePos((s) => s.tableRef);
  const sections = [...new Set(tables.map((t) => t.section))];
  const pick = (type: OrderType, ref: string | null, covers = 0) => { setTable(ref, type, covers); close(); };
  return (
    <Drawer open={open} onOpenChange={(o) => !o && close()} title="Table / order type">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="lg" onClick={() => pick("TAKEAWAY", null)}>Takeaway / counter</Button>
          <Button variant="secondary" size="lg" onClick={() => pick("DELIVERY", null)}>Delivery</Button>
        </div>
        {isPending && <p className="text-sm text-muted">Loading floor…</p>}
        {sections.map((sec) => (
          <div key={sec} className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">{sec}</span>
            <div className="grid grid-cols-4 gap-2">
              {tables.filter((t) => t.section === sec).map((t) => (
                <button key={t.id} onClick={() => pick("DINE_IN", t.name, t.seats)}
                  className={cn("flex h-16 flex-col items-center justify-center rounded-lg border text-sm font-semibold", current === t.name ? "border-primary bg-primary-soft" : t.status === "FREE" ? "border-border bg-surface hover:border-border-strong" : t.status === "OCCUPIED" ? "border-warning/50 bg-warning/10 text-warning" : "border-info/50 bg-info/10 text-info")}>
                  {t.name}<span className="text-[10px] font-medium opacity-70">{t.status === "FREE" ? `${t.seats} seats` : t.status.toLowerCase()}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
}

export function HoldSheet() {
  const { open, close } = useSheet("hold");
  const { held, recall, dropHeld } = usePos();
  return (
    <Drawer open={open} onOpenChange={(o) => !o && close()} title={`Held orders (${held.length})`}>
      <div className="flex flex-col gap-3">
        {!held.length && <p className="text-sm text-muted">Nothing on hold. Use Hold (F10) to park the current bill.</p>}
        {held.map((h) => {
          const t = computeTotals(h.lines, h.discount, 0);
          return (
            <div key={h.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold">{h.label}<Badge>{h.type.replace("_", "-").toLowerCase()}</Badge></div>
                <div className="truncate text-xs text-muted">{h.lines.map((l) => `${l.qty}× ${l.item.name}`).join(", ")}</div>
                <div className="text-xs text-subtle">{new Date(h.heldAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · {inr(t.total)}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => dropHeld(h.id)}>Drop</Button>
              <Button size="sm" onClick={() => recall(h.id)}>Recall</Button>
            </div>
          );
        })}
      </div>
    </Drawer>
  );
}

export function KotSheet() {
  const { open, close } = useSheet("kot");
  const { kots, lines, orderNo, tableRef } = usePos();
  return (
    <Drawer open={open} onOpenChange={(o) => !o && close()} title={`Kitchen tickets · ${orderNo ?? ""}`}>
      <div className="flex flex-col gap-4">
        {!kots.length && <p className="text-sm text-muted">No KOT sent yet.</p>}
        {[...kots].reverse().map((k) => (
          <div key={k.id} className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-center justify-between bg-surface-overlay px-4 py-2.5">
              <span className="font-mono font-semibold">{k.kotNo}</span>
              <span className="text-xs text-muted">{tableRef ?? "Counter"} · {new Date(k.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
              <Badge tone={k.status === "PENDING" ? "warning" : k.status === "READY" ? "success" : "info"}>{k.status.toLowerCase()}</Badge>
            </div>
            <ul className="px-4 py-2 text-sm">
              {lines.filter((l) => l.kotId === k.id).map((l) => <li key={l.lineId} className="flex justify-between py-1.5"><span>{l.qty}× {l.item.name}{l.notes ? <span className="text-muted"> — {l.notes}</span> : null}</span></li>)}
            </ul>
          </div>
        ))}
      </div>
    </Drawer>
  );
}

export function DiscountSheet() {
  const { open, close } = useSheet("discount");
  const { discount, setDiscount, tip, setTip, lines } = usePos();
  const sub = computeTotals(lines, null, 0).subtotal;
  const [kind, setKind] = React.useState<"percent" | "flat">(discount?.kind ?? "percent");
  const [val, setVal] = React.useState(discount ? String(discount.kind === "flat" ? discount.value / 100 : discount.value) : "");
  const [reason, setReason] = React.useState(discount?.reason ?? "");
  const [tipR, setTipR] = React.useState(tip ? String(tip / 100) : "");
  const apply = () => {
    const n = Number(val);
    setDiscount(n > 0 ? { kind, value: kind === "flat" ? Math.round(n * 100) : Math.min(100, n), reason: reason || undefined } : null);
    setTip(Math.max(0, Math.round(Number(tipR || 0) * 100)));
    close();
  };
  return (
    <Drawer open={open} onOpenChange={(o) => !o && close()} title="Discount & tip" footer={<><Button variant="secondary" size="lg" onClick={() => { setDiscount(null); setTip(0); close(); }}>Clear</Button><Button size="lg" onClick={apply}>Apply</Button></>}>
      <div className="flex flex-col gap-5">
        <div className="flex gap-2">{(["percent", "flat"] as const).map((k) => <button key={k} onClick={() => setKind(k)} className={cn("h-12 flex-1 rounded-md border text-sm font-semibold", kind === k ? "border-primary bg-primary-soft" : "border-border bg-surface text-muted")}>{k === "percent" ? "% off" : "₹ off"}</button>)}</div>
        <div className="flex flex-wrap gap-2">{(kind === "percent" ? [5, 10, 15, 20] : [50, 100, 200, 500]).map((p) => <button key={p} onClick={() => setVal(String(p))} className="h-11 rounded-md border border-border bg-surface px-4 text-sm font-semibold hover:border-border-strong">{kind === "percent" ? `${p}%` : `₹${p}`}</button>)}</div>
        <Field label={kind === "percent" ? "Percent" : "Amount (₹)"} value={val} onChange={setVal} type="number" />
        <Field label="Reason (optional)" value={reason} onChange={setReason} />
        <Field label="Tip (₹)" value={tipR} onChange={setTipR} type="number" />
        <p className="text-xs text-subtle">Subtotal {inr(sub)}. Discounts apply before GST.</p>
      </div>
    </Drawer>
  );
}

export function SplitSheet() {
  const { open, close } = useSheet("split");
  const { lines, discount, tip, splitCount, setSplit } = usePos();
  const t = computeTotals(lines, discount, tip);
  const [n, setN] = React.useState(splitCount);
  return (
    <Drawer open={open} onOpenChange={(o) => !o && close()} title="Split bill" footer={<><Button variant="secondary" size="lg" onClick={() => { setSplit(1, 0); close(); }}>No split</Button><Button size="lg" onClick={() => { setSplit(n, 0); close(); }}>Split {n} ways</Button></>}>
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-4 gap-2">{[2, 3, 4, 5, 6, 8].map((k) => <button key={k} onClick={() => setN(k)} className={cn("h-touch rounded-lg border font-display text-xl font-semibold", n === k ? "border-primary bg-primary-soft" : "border-border bg-surface")}>{k}</button>)}</div>
        <div className="rounded-xl border border-border bg-surface-raised p-4 text-sm">
          <div className="flex justify-between"><span className="text-muted">Bill total</span><span className="font-mono">{inr(t.total)}</span></div>
          <div className="mt-1 flex justify-between text-lg font-semibold"><span>Each of {n}</span><span className="font-mono">{inr(Math.round(t.total / n / 100) * 100)}</span></div>
          <p className="mt-2 text-xs text-subtle">Equal split; each share becomes its own bill and is paid separately in the payment sheet.</p>
        </div>
        <ul className="text-sm text-muted">{lines.map((l) => <li key={l.lineId} className="flex justify-between py-1"><span>{l.qty}× {l.item.name}</span><span className="font-mono">{inr(lineTotal(l))}</span></li>)}</ul>
      </div>
    </Drawer>
  );
}

const Field = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
  <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">{label}<input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-12 rounded-md border border-border bg-surface px-3.5 text-md text-foreground outline-none focus:border-ring" /></label>
);
