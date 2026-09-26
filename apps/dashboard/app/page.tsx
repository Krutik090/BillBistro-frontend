"use client";
// Owner dashboard overview — real data: today's sales/tax report, top items, low stock, live orders.
import { Badge, Card, CardTitle, KpiTile } from "@billbistro/ui";
import { DashboardShell } from "../components/shell";
import { useReports, useInventory, useLiveOrders } from "../lib/api";

const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: p % 100 ? 2 : 0 })}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

export default function DashboardPage() {
  return <DashboardShell><Overview /></DashboardShell>;
}

function Overview() {
  const t = today();
  const { sales, items, loading, error } = useReports(t, t);
  const { items: invItems } = useInventory();
  const { orders: liveOrders, loading: ordersLoading } = useLiveOrders("OPEN");

  const lowStock = invItems.filter((i) => i.stockMilli <= i.lowStockMilli);
  const avgTicket = sales?.bills ? Math.round(sales.netSales / sales.bills) : 0;

  return (
    <div className="flex flex-col gap-5 p-7">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">{greeting()}</h1>
          <p className="text-sm text-muted">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })} · {liveOrders.length} open order{liveOrders.length === 1 ? "" : "s"}</p>
        </div>
      </header>

      {error && <p className="text-sm text-danger">Failed to load today's report: {String(error)}</p>}

      <div className="grid grid-cols-4 gap-4">
        <KpiTile label="Sales today" value={sales?.netSales ?? 0} format={inr} />
        <KpiTile label="Orders / bills" value={sales?.bills ?? 0} />
        <KpiTile label="Avg. ticket" value={avgTicket} format={inr} />
        <KpiTile label="Tax collected" value={sales?.taxTotal ?? 0} format={inr} />
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-4">
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between"><CardTitle>Low stock</CardTitle><span className="text-xs font-medium text-muted">{lowStock.length} item{lowStock.length === 1 ? "" : "s"}</span></div>
          {!lowStock.length && <p className="text-sm text-muted">Nothing running low right now.</p>}
          {lowStock.map((i) => (
            <div key={i.id} className="flex items-center justify-between text-sm">
              <span className="font-medium">{i.name}</span>
              <span className="font-mono text-muted">{(i.stockMilli / 1000).toLocaleString("en-IN", { maximumFractionDigits: 3 })} {i.unit}</span>
            </div>
          ))}
        </Card>
        <Card className="flex flex-col gap-3">
          <CardTitle>Top items today</CardTitle>
          {loading && <p className="text-sm text-muted">Loading…</p>}
          {!loading && !items.length && <p className="text-sm text-muted">No sales yet today.</p>}
          {items.slice(0, 5).map((i) => {
            const pct = items[0]?.qty ? Math.round((i.qty / items[0].qty) * 100) : 0;
            return (
              <div key={i.name} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm"><span className="font-medium">{i.name}</span><span className="font-mono text-muted">{i.qty}</span></div>
                <div className="h-1.5 rounded-full bg-surface-overlay"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </Card>
      </div>

      <Card className="flex flex-col gap-2.5 py-4">
        <CardTitle>Live orders</CardTitle>
        {ordersLoading && <p className="px-0.5 text-sm text-muted">Loading…</p>}
        {!ordersLoading && !liveOrders.length && <p className="px-0.5 text-sm text-muted">No open orders right now.</p>}
        <div className="grid grid-cols-5 gap-2.5">
          {liveOrders.slice(0, 10).map((o) => (
            <div key={o.id} className="rounded-lg border border-border bg-surface px-3.5 py-3">
              <div className="text-sm font-semibold">{o.table?.code ?? o.tableRef ?? o.type.replace("_", " ")} · #{o.orderNo}</div>
              <Badge tone="warning" className="mt-1">{o.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
