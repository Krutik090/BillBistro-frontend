"use client";
// T-104 basic reports: sales summary, item-wise sales, GST by rate — over a date range.
import * as React from "react";
import { Card, CardTitle, KpiTile, Table, THead, TBody, TR, TH, TD, cn } from "@billbistro/ui";
import { DashboardShell } from "../../components/shell";
import { useReports } from "../../lib/api";

const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: p % 100 ? 2 : 0 })}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };

const RANGES = [
  { label: "Today", from: () => today(), to: () => today() },
  { label: "This week", from: () => daysAgo(6), to: () => today() },
  { label: "This month", from: () => daysAgo(29), to: () => today() },
] as const;

export default function ReportsPage() {
  return <DashboardShell><ReportsView /></DashboardShell>;
}

function ReportsView() {
  const [range, setRange] = React.useState<(typeof RANGES)[number]["label"]>("Today");
  const preset = RANGES.find((r) => r.label === range)!;
  const from = preset.from(), to = preset.to();
  const { sales, items, tax, loading, error } = useReports(from, to);

  return (
    <div className="flex flex-col gap-5 p-7">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted">{from === to ? from : `${from} → ${to}`} · sales, item-wise, GST summary</p>
        </div>
        <div className="flex rounded-md border border-border bg-surface p-1 text-sm">
          {RANGES.map((r) => (
            <button key={r.label} onClick={() => setRange(r.label)} className={cn("rounded-[7px] px-3.5 py-1.5 font-medium", r.label === range ? "bg-surface-overlay text-foreground" : "text-muted hover:text-foreground")}>{r.label}</button>
          ))}
        </div>
      </header>

      {error && <p className="text-sm text-danger">Failed to load reports: {String(error)}</p>}

      <div className="grid grid-cols-4 gap-4">
        <KpiTile label="Gross sales" value={sales?.grossSales ?? 0} format={inr} />
        <KpiTile label="Net sales" value={sales?.netSales ?? 0} format={inr} />
        <KpiTile label="Tax collected" value={sales?.taxTotal ?? 0} format={inr} />
        <KpiTile label="Bills" value={sales?.bills ?? 0} />
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-4">
        <Card className="flex flex-col gap-3">
          <CardTitle>Item-wise sales</CardTitle>
          <Table>
            <THead><TR><TH>Item</TH><TH numeric>Qty</TH><TH numeric>Gross</TH><TH numeric>Discount</TH><TH numeric>Tax</TH><TH numeric>Net</TH></TR></THead>
            <TBody>
              {loading && <TR><TD colSpan={6} className="text-center text-muted">Loading…</TD></TR>}
              {!loading && !items.length && <TR><TD colSpan={6} className="text-center text-muted">No sales in this range.</TD></TR>}
              {items.map((i) => (
                <TR key={i.name}>
                  <TD className="font-medium">{i.name}</TD>
                  <TD numeric>{i.qty}</TD>
                  <TD numeric>{inr(i.grossAmount)}</TD>
                  <TD numeric className="text-muted">{inr(i.discount)}</TD>
                  <TD numeric className="text-muted">{inr(i.tax)}</TD>
                  <TD numeric className="font-semibold">{inr(i.netAmount)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <CardTitle>Collections by mode</CardTitle>
            {Object.entries(sales?.byMode ?? {}).length === 0 && <p className="text-sm text-muted">No payments in this range.</p>}
            {Object.entries(sales?.byMode ?? {}).map(([mode, m]) => (
              <div key={mode} className="flex items-center justify-between text-sm">
                <span className="font-medium">{mode}</span>
                <span className="font-mono text-muted">{inr(m.collected)}{m.refunded ? ` (−${inr(m.refunded)} refunded)` : ""}</span>
              </div>
            ))}
          </Card>
          <Card className="flex flex-col gap-3">
            <CardTitle>GST summary</CardTitle>
            {(tax?.brackets ?? []).length === 0 && <p className="text-sm text-muted">No taxable sales in this range.</p>}
            {(tax?.brackets ?? []).map((b) => (
              <div key={b.taxRateBps} className="flex flex-col gap-1 border-b border-border pb-2 last:border-0 last:pb-0">
                <div className="flex justify-between text-sm font-medium"><span>{b.taxRateBps / 100}% GST</span><span className="font-mono">{inr(b.tax)}</span></div>
                <div className="flex justify-between text-xs text-muted"><span>Taxable {inr(b.taxable)}</span><span>CGST {inr(b.cgst)} · SGST {inr(b.sgst)}</span></div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
