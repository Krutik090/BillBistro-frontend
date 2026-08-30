"use client";
// Day close (Z-report): GET /v1/day-close totals for a business date; POST closes it (409 while unpaid FINAL bills exist).
import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lock, RefreshCw, CheckCircle2 } from "lucide-react";
import { AppShell, Button, Card, CardTitle, KpiTile, Badge, Table, THead, TBody, TR, TH, TD } from "@billbistro/ui";
import { ApiProvider, useApi, useOutlet } from "../../lib/api";
import { posNav } from "../../lib/nav";
import { inr } from "../../lib/format";
import { Toast } from "../../components/toast";
import { usePos } from "../../lib/store";

const today = () => new Date().toISOString().slice(0, 10);

export default function DayClosePage() {
  return (
    <ApiProvider>
      <AppShell app="POS" nav={posNav} activeHref="/day-close" variant="rail" Link={Link}>
        <DayClose />
        <Toast />
      </AppShell>
    </ApiProvider>
  );
}

function DayClose() {
  const api = useApi(); const qc = useQueryClient();
  const notify = usePos((s) => s.notify);
  const { data: outlet } = useOutlet();
  const [date, setDate] = React.useState(today());
  const q = useQuery({ queryKey: ["day-close", date], queryFn: () => api.dayClose.get(date), refetchInterval: 30_000 });
  const close = useMutation({ mutationFn: (note?: string) => api.dayClose.close(date, note), onSuccess: () => { qc.invalidateQueries({ queryKey: ["day-close"] }); notify(`Business date ${date} closed`); }, onError: (e) => notify(`Close failed: ${(e as Error).message}`) });
  const d = q.data; const t = d?.totals;
  const closed = d?.status === "CLOSED";

  return (
    <div className="flex flex-col gap-5 p-6">
      <header className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h1 className="font-display text-2xl font-semibold">Day close</h1>
          <p className="text-sm text-muted">{outlet?.name ?? "Outlet"} · Z-report{t ? ` · ${t.bills} bills / ${t.orders} orders` : ""}</p>
        </div>
        <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-ring" />
        <Button variant="secondary" onClick={() => q.refetch()} disabled={q.isFetching}><RefreshCw size={16} className={q.isFetching ? "animate-spin" : ""} /> Refresh</Button>
        {closed ? <Badge tone="success" className="h-11 px-4 text-sm"><CheckCircle2 size={14} className="mr-1" /> Closed{d?.closedAt ? ` · ${new Date(d.closedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}</Badge>
          : <Button variant="glow" disabled={!t || close.isPending} onClick={() => window.confirm(`Close business date ${date}? Finalize/pay on this date will be blocked afterwards.`) && close.mutate(undefined)}><Lock size={16} /> Close day</Button>}
      </header>
      {q.error && <p className="text-sm text-danger">{String((q.error as Error).message)}</p>}
      {t && (
        <>
          <div className="grid grid-cols-4 gap-4">
            <KpiTile label="Net sales" value={t.netSales} format={inr} />
            <KpiTile label="Collected" value={t.collected} format={inr} />
            <KpiTile label="Cash expected in drawer" value={t.cashExpected} format={inr} />
            <KpiTile label="Refunds" value={t.refunded} format={inr} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Card className="flex flex-col gap-2 text-sm">
              <CardTitle>Sales breakdown</CardTitle>
              <Row k="Gross sales" v={inr(t.grossSales)} /><Row k="Discounts" v={`−${inr(t.discounts)}`} /><Row k="Taxable" v={inr(t.taxableSales)} />
              <Row k="CGST" v={inr(t.cgst)} /><Row k="SGST" v={inr(t.sgst)} /><Row k="Tips" v={inr(t.tips)} /><Row k="Round off" v={inr(t.roundOff)} />
              <div className="mt-1 flex justify-between border-t border-border pt-2 text-md font-semibold"><span>Net sales</span><span className="font-mono">{inr(t.netSales)}</span></div>
              <Row k="Voided bills" v={String(t.voids)} />
            </Card>
            <Card className="flex flex-col gap-3">
              <CardTitle>Collections by mode</CardTitle>
              <Table>
                <THead><TR><TH>Mode</TH><TH numeric>Count</TH><TH numeric>Collected</TH><TH numeric>Refunded</TH><TH numeric>Net</TH></TR></THead>
                <TBody>
                  {Object.entries(t.byMode).map(([m, v]) => <TR key={m}><TD className="font-medium">{m}</TD><TD numeric>{v.count}</TD><TD numeric>{inr(v.collected)}</TD><TD numeric>{inr(v.refunded)}</TD><TD numeric>{inr(v.collected - v.refunded)}</TD></TR>)}
                  {!Object.keys(t.byMode).length && <TR><TD colSpan={5} className="text-center text-muted">No payments on this date.</TD></TR>}
                </TBody>
              </Table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between text-muted"><span>{k}</span><span className="font-mono text-foreground">{v}</span></div>;
