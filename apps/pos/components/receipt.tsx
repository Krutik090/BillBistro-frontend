"use client";
// Receipt = GET /v1/bills/:id/receipt (server-rendered numbers, tax summary, payments). 80mm print via window.print().
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, Plus, Loader2 } from "lucide-react";
import { Button, Drawer } from "@billbistro/ui";
import { usePos } from "../lib/store";
import { useApi } from "../lib/api";
import { inr } from "../lib/format";

export function ReceiptSheet() {
  const s = usePos();
  const api = useApi();
  const open = s.sheet === "receipt";
  const billId = s.bill?.id ?? null;
  const rc = useQuery({ queryKey: ["receipt", billId], queryFn: () => api.billing.receipt(billId!), enabled: open && !!billId, staleTime: Infinity });
  const next = () => { s.reset(); };
  const r = rc.data;

  return (
    <Drawer open={open} onOpenChange={(o) => !o && next()} title="Receipt" footer={<><Button variant="secondary" size="lg" onClick={() => window.print()} disabled={!r}><Printer size={18} /> Print</Button><Button size="lg" onClick={next}><Plus size={18} /> New bill</Button></>}>
      {!r && <div className="flex items-center gap-2 text-sm text-muted">{rc.error ? <span className="text-danger">{String((rc.error as Error).message)}</span> : <><Loader2 size={14} className="animate-spin" /> Fetching receipt…</>}</div>}
      {r && (
        <div className="mx-auto w-[300px] rounded-md bg-neutral-0 p-4 font-mono text-[12px] leading-snug text-neutral-950 shadow-2" id="receipt">
          <div className="text-center">
            <div className="font-display text-base font-bold">{r.business.name}</div>
            {r.outlet.address && <div>{r.outlet.address}</div>}
            <div>{r.business.gstin ? `GSTIN ${r.business.gstin}` : ""}{r.outlet.phone ? ` · ${r.outlet.phone}` : ""}</div>
          </div>
          <Hr />
          <div className="flex justify-between"><span>{r.bill.billNo}{r.bill.split ? ` (${r.bill.split})` : ""}</span><span>{new Date(r.bill.date).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span></div>
          <div className="flex justify-between"><span>{r.bill.table ? `Table ${r.bill.table}` : "Counter"}</span><span>{r.bill.orderNo}{r.bill.cashier ? ` · ${r.bill.cashier}` : ""}</span></div>
          <Hr />
          <table className="w-full"><tbody>
            {r.lines.map((l, i) => <tr key={i} className="align-top"><td className="pr-1">{l.qty}×</td><td className="w-full">{l.name}</td><td className="text-right">{inr(l.lineTotal)}</td></tr>)}
          </tbody></table>
          <Hr />
          <Row k="Subtotal" v={inr(r.totals.subtotal)} />
          {r.totals.discount > 0 && <Row k="Discount" v={`-${inr(r.totals.discount)}`} />}
          {r.taxSummary.map((tx) => <React.Fragment key={tx.taxRateBps}><Row k={`CGST @${tx.taxRateBps / 200}%`} v={inr(tx.cgst)} /><Row k={`SGST @${tx.taxRateBps / 200}%`} v={inr(tx.sgst)} /></React.Fragment>)}
          {r.totals.tip > 0 && <Row k="Tip" v={inr(r.totals.tip)} />}
          {r.totals.roundOff !== 0 && <Row k="Round off" v={inr(r.totals.roundOff)} />}
          <div className="mt-1 flex justify-between text-base font-bold"><span>TOTAL</span><span>{inr(r.totals.total)}</span></div>
          {r.payments.map((p, i) => <Row key={i} k={`Paid · ${p.mode}${p.reference ? ` ${p.reference}` : ""}${p.change ? ` (change ${inr(p.change)})` : ""}`} v={inr(p.amount)} />)}
          {r.totals.due > 0 && <Row k="Due" v={inr(r.totals.due)} />}
          <Hr />
          <div className="text-center text-[11px]">{r.footer ?? "Thank you! Visit again."}<br />Powered by BillBistro</div>
        </div>
      )}
    </Drawer>
  );
}
const Hr = () => <hr className="my-2 border-dashed border-neutral-400" />;
const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between"><span>{k}</span><span>{v}</span></div>;
