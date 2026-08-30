"use client";
import * as React from "react";
import { Printer, Plus } from "lucide-react";
import { Button, Drawer } from "@billbistro/ui";
import { usePos } from "../lib/store";
import { computeTotals, lineLabel, lineTotal } from "../lib/calc";
import { inr } from "../lib/format";

const OUTLET = { name: "Spice Route", addr: "12, 80ft Road, Koramangala, Bengaluru 560034", gstin: "29ABCDE1234F1Z5", phone: "+91 98450 12345" };

/** Receipt preview + browser print (80mm). The #receipt element is the only thing painted under @media print. */
export function ReceiptSheet() {
  const s = usePos();
  const open = s.sheet === "receipt";
  const t = computeTotals(s.lines, s.discount, s.tip);
  const bill = s.bill;
  const print = () => window.print();
  const next = () => { s.reset(); };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && next()} title="Receipt" footer={<><Button variant="secondary" size="lg" onClick={print}><Printer size={18} /> Print</Button><Button size="lg" onClick={next}><Plus size={18} /> New bill</Button></>}>
      <div className="mx-auto w-[300px] rounded-md bg-neutral-0 p-4 font-mono text-[12px] leading-snug text-neutral-950 shadow-2" id="receipt">
        <div className="text-center">
          <div className="font-display text-base font-bold">{OUTLET.name}</div>
          <div>{OUTLET.addr}</div><div>GSTIN {OUTLET.gstin} · {OUTLET.phone}</div>
        </div>
        <hr className="my-2 border-dashed border-neutral-400" />
        <div className="flex justify-between"><span>{bill?.billNo ?? "DRAFT"}</span><span>{new Date(bill?.finalizedAt ?? Date.now()).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span></div>
        <div className="flex justify-between"><span>{s.tableRef ? `Table ${s.tableRef}` : s.type.replace("_", "-")}</span><span>{s.orderNo}</span></div>
        <hr className="my-2 border-dashed border-neutral-400" />
        <table className="w-full"><tbody>
          {s.lines.map((l) => (
            <tr key={l.lineId} className="align-top"><td className="pr-1">{l.qty}×</td><td className="w-full">{l.item.name}{lineLabel(l) && <div className="text-[10px] text-neutral-600">{lineLabel(l)}</div>}</td><td className="text-right">{inr(lineTotal(l))}</td></tr>
          ))}
        </tbody></table>
        <hr className="my-2 border-dashed border-neutral-400" />
        <R k="Subtotal" v={inr(t.subtotal)} />
        {t.discountAmt > 0 && <R k="Discount" v={`-${inr(t.discountAmt)}`} />}
        {[...t.taxByRate].map(([bps, amt]) => <React.Fragment key={bps}><R k={`CGST @${bps / 200}%`} v={inr(Math.round(amt / 2))} /><R k={`SGST @${bps / 200}%`} v={inr(amt - Math.round(amt / 2))} /></React.Fragment>)}
        {t.tip > 0 && <R k="Tip" v={inr(t.tip)} />}
        {t.roundOff !== 0 && <R k="Round off" v={inr(t.roundOff)} />}
        <div className="mt-1 flex justify-between text-base font-bold"><span>TOTAL</span><span>{inr(bill?.total ?? t.total)}</span></div>
        {bill?.payments.map((p) => <R key={p.id} k={`Paid · ${p.mode}${p.reference ? ` ${p.reference}` : ""}`} v={inr(p.amount)} />)}
        <hr className="my-2 border-dashed border-neutral-400" />
        <div className="text-center text-[11px]">Thank you! Visit again.<br />Powered by BillBistro</div>
      </div>
    </Drawer>
  );
}
const R = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between"><span>{k}</span><span>{v}</span></div>;
