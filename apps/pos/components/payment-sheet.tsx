"use client";
// Settlement on the API's bill machine: create (DRAFT, server-priced) → finalize (FINAL) → payments → SETTLED → receipt.
// Server totals are rendered from the Bill; client math is never shown here.
import * as React from "react";
import { Banknote, QrCode, Loader2, Check, Delete } from "lucide-react";
import { Button, Drawer, cn } from "@billbistro/ui";
import type { Bill, PaymentMode } from "@billbistro/sdk";
import { usePos } from "../lib/store";
import { useApi } from "../lib/api";
import { computeTotals } from "../lib/calc";
import { inr, uid } from "../lib/format";

export function PaymentSheet() {
  const s = usePos();
  const api = useApi();
  const open = s.sheet === "pay";
  const t = computeTotals(s.lines, s.discount, s.tip);
  const [bill, setBill] = React.useState<Bill | null>(null);
  const [mode, setMode] = React.useState<PaymentMode>("UPI");
  const [tendered, setTendered] = React.useState("");
  const [ref, setRef] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [settled, setSettled] = React.useState<Bill[]>([]);
  const due = bill?.due ?? (bill ? bill.total - (bill.paidTotal ?? 0) : 0);

  // Create + finalize the bill for the current split share when the sheet opens (server computes every number).
  React.useEffect(() => {
    if (!open || !s.orderId) return;
    let alive = true;
    setBill(null); setErr(null); setTendered(""); setRef("");
    (async () => {
      const draft = await api.billing.create({ orderId: s.orderId!, discount: t.discountAmt, discountNote: s.discount?.reason, tip: t.tip, splitOf: s.splitCount > 1 ? { index: s.splitIndex, count: s.splitCount } : undefined, clientKey: `${s.orderId}:${s.splitIndex}/${s.splitCount}` });
      const fin = draft.status === "DRAFT" ? await api.billing.finalize(draft.id, draft.version) : draft;
      if (alive) setBill(fin);
    })().catch((e) => alive && setErr((e as Error).message));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, s.orderId, s.splitIndex, s.splitCount]);

  const tenderedPaise = Math.round(Number(tendered || 0) * 100);
  const change = mode === "CASH" && tenderedPaise > due ? tenderedPaise - due : 0;
  const canPay = !!bill && !busy && due > 0 && (mode === "CASH" ? tenderedPaise >= due : ref.trim().length >= 4);

  const pay = async () => {
    if (!bill) return;
    setBusy(true); setErr(null);
    try {
      const p = await api.billing.pay(bill.id, { mode, amount: due, tendered: mode === "CASH" ? tenderedPaise : undefined, reference: mode === "CASH" ? null : ref.trim(), idempotencyKey: uid() });
      const fresh = await api.billing.get(bill.id);
      const done = [...settled, fresh];
      setSettled(done); s.setBill(fresh);
      const chg = p.change ?? change;
      if (s.splitCount > 1 && s.splitIndex < s.splitCount - 1) {
        s.notify(`Share ${s.splitIndex + 1}/${s.splitCount} paid${chg ? ` · change ${inr(chg)}` : ""}`);
        s.setSplit(s.splitCount, s.splitIndex + 1); // effect above creates + finalizes the next share
      } else {
        s.notify(chg ? `Paid · return ${inr(chg)} change` : "Paid");
        s.openSheet("receipt");
      }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const quick = [due, Math.ceil(due / 10000) * 10000, Math.ceil(due / 50000) * 50000, Math.ceil(due / 100000) * 100000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).slice(0, 4);

  return (
    <Drawer open={open} onOpenChange={(o) => !o && s.openSheet(null)} title={s.splitCount > 1 ? `Pay share ${s.splitIndex + 1} of ${s.splitCount}` : "Payment"}
      footer={<><Button variant="secondary" size="lg" onClick={() => s.openSheet(null)}>Back</Button><Button size="lg" variant="glow" disabled={!canPay} onClick={pay}>{busy ? <Loader2 className="animate-spin" /> : <Check />} {mode === "CASH" ? "Take cash" : mode === "UPI" ? "Confirm UPI" : "Mark paid"} {inr(due)}</Button></>}>
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border border-border bg-surface-raised p-4">
          {!bill && !err && <div className="flex items-center gap-2 text-sm text-muted"><Loader2 size={14} className="animate-spin" /> Creating bill…</div>}
          {bill && <>
            <div className="flex items-center justify-between text-xs text-muted"><span>{bill.billNo} · {bill.status.toLowerCase()}</span><span>server-priced{bill.roundOff ? ` · round-off ${inr(bill.roundOff)}` : ""}</span></div>
            <div className="mt-1 flex items-baseline justify-between"><span className="text-md font-semibold">Amount due</span><span className="font-display text-4xl font-semibold font-tabular">{inr(due)}</span></div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 text-xs text-muted">
              <R k="Subtotal" v={inr(bill.subtotal)} />{bill.discount > 0 && <R k="Discount" v={`−${inr(bill.discount)}`} />}
              <R k="CGST" v={inr(bill.cgst ?? Math.floor(bill.taxTotal / 2))} /><R k="SGST" v={inr(bill.sgst ?? bill.taxTotal - Math.floor(bill.taxTotal / 2))} />
              {bill.tip > 0 && <R k="Tip" v={inr(bill.tip)} />}<R k="Total" v={inr(bill.total)} />
            </div>
          </>}
          {err && <p className="text-sm text-danger">{err}</p>}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {([["CASH", "Cash", <Banknote key="c" size={18} />], ["UPI", "UPI", <QrCode key="u" size={18} />], ["CARD", "Card machine", <Check key="k" size={18} />]] as const).map(([m, label, icon]) => (
            <button key={m} onClick={() => setMode(m)} className={cn("flex h-touch flex-col items-center justify-center gap-1 rounded-lg border text-xs font-semibold", mode === m ? "border-primary bg-primary-soft" : "border-border bg-surface text-muted")}>{icon}{label}</button>
          ))}
        </div>

        {mode === "CASH" && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">{quick.map((v) => <button key={v} onClick={() => setTendered(String(v / 100))} className="h-11 rounded-md border border-border bg-surface px-4 text-sm font-semibold hover:border-border-strong">{inr(v)}</button>)}</div>
            <div className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3"><span className="text-sm text-muted">Tendered</span><span className="font-mono text-2xl font-tabular">₹{tendered || "0"}</span></div>
            <Numpad onKey={(k) => setTendered((v) => (k === "⌫" ? v.slice(0, -1) : k === "." && v.includes(".") ? v : (v + k).replace(/^0+(?=\d)/, "")))} />
            {change > 0 && <div className="flex items-center justify-between rounded-md bg-success/15 px-4 py-3 text-success"><span className="text-sm font-semibold">Change to return</span><span className="font-mono text-xl font-semibold">{inr(change)}</span></div>}
          </div>
        )}
        {mode !== "CASH" && (
          <div className="flex flex-col items-center gap-3">
            {mode === "UPI" && <><div className="flex size-48 items-center justify-center rounded-xl bg-neutral-0 p-3"><QrCode size={160} className="text-neutral-950" strokeWidth={1} /></div>
              <p className="text-center text-xs text-muted">Customer scans · upi://pay?pa=spiceroute@upi&am={(due / 100).toFixed(2)}<br />(static QR placeholder — gateway lands in a later phase)</p></>}
            <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={mode === "UPI" ? "UPI reference / UTR (last 4+ digits)" : "Card slip / approval code"} className="h-12 w-full rounded-md border border-border bg-surface px-3.5 text-md outline-none placeholder:text-subtle focus:border-ring" />
          </div>
        )}
        {settled.length > 0 && <p className="text-xs text-subtle">Paid so far: {settled.map((b) => `${b.billNo} ${inr(b.total)}`).join(" · ")}</p>}
      </div>
    </Drawer>
  );
}

const R = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between"><span>{k}</span><span className="font-mono text-foreground">{v}</span></div>;

function Numpad({ onKey }: { onKey: (k: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"].map((k) => (
        <button key={k} onClick={() => onKey(k)} className="h-14 rounded-lg border border-border bg-surface-overlay font-display text-xl font-semibold hover:border-border-strong active:scale-[0.97]">{k === "⌫" ? <Delete className="mx-auto" size={20} /> : k}</button>
      ))}
    </div>
  );
}
