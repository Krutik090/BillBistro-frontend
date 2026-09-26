"use client";
// Live orders (T-102/T-120 exposure): real-time-ish view of OPEN orders for the outlet, polling the list endpoint.
import * as React from "react";
import { Badge, Button, Table, THead, TBody, TR, TH, TD, cn } from "@billbistro/ui";
import type { OrderStatus } from "@billbistro/sdk";
import { DashboardShell } from "../../components/shell";
import { useLiveOrders, useOrderActions } from "../../lib/api";

const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: p % 100 ? 2 : 0 })}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

const TABS: { label: string; status?: OrderStatus }[] = [
  { label: "Open", status: "OPEN" },
  { label: "Billed", status: "BILLED" },
  { label: "Settled", status: "SETTLED" },
  { label: "Cancelled", status: "CANCELLED" },
];

const STATUS_TONE: Record<OrderStatus, "warning" | "info" | "success" | "danger"> = {
  OPEN: "warning", BILLED: "info", SETTLED: "success", CANCELLED: "danger",
};

export default function OrdersPage() {
  return <DashboardShell><LiveOrdersView /></DashboardShell>;
}

function LiveOrdersView() {
  const [tab, setTab] = React.useState<OrderStatus>("OPEN");
  const { orders, loading, error } = useLiveOrders(tab);
  const { cancel } = useOrderActions();
  const [msg, setMsg] = React.useState<string | null>(null);
  const flash = (s: string) => { setMsg(s); setTimeout(() => setMsg(null), 2500); };

  const doCancel = async (id: string, orderNo: string) => {
    try { await cancel.mutateAsync({ id, reason: "Cancelled from dashboard" }); flash(`Cancelled #${orderNo}`); }
    catch (e) { flash(`Error: ${(e as Error).message}`); }
  };

  return (
    <div className="flex flex-col gap-5 p-7">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Live orders</h1>
          <p className="text-sm text-muted">{orders.length} {tab.toLowerCase()} · refreshes automatically</p>
        </div>
        <div className="flex rounded-md border border-border bg-surface p-1 text-sm">
          {TABS.map((t) => (
            <button key={t.label} onClick={() => setTab(t.status!)} className={cn("rounded-[7px] px-3.5 py-1.5 font-medium", t.status === tab ? "bg-surface-overlay text-foreground" : "text-muted hover:text-foreground")}>{t.label}</button>
          ))}
        </div>
      </header>

      {error && <p className="text-sm text-danger">Failed to load orders: {String(error)}</p>}

      <Table>
        <THead><TR><TH>Order</TH><TH>Type</TH><TH>Table</TH><TH numeric>Items</TH><TH numeric>Total</TH><TH>Status</TH><TH>Placed</TH><TH></TH></TR></THead>
        <TBody>
          {loading && <TR><TD colSpan={8} className="text-center text-muted">Loading…</TD></TR>}
          {!loading && !orders.length && <TR><TD colSpan={8} className="text-center text-muted">No {tab.toLowerCase()} orders.</TD></TR>}
          {orders.map((o) => (
            <TR key={o.id} className="hover:bg-surface-overlay/40">
              <TD className="font-medium">#{o.orderNo}</TD>
              <TD className="text-muted">{o.type.replace("_", " ")}</TD>
              <TD className="text-muted">{o.table?.code ?? o.tableRef ?? "—"}</TD>
              <TD numeric>{o.itemCount}</TD>
              <TD numeric className="font-semibold">{inr(o.total)}</TD>
              <TD><Badge tone={STATUS_TONE[o.status]}>{o.status}</Badge></TD>
              <TD className="text-muted">{time(o.createdAt)}</TD>
              <TD>
                {o.status === "OPEN" && (
                  <Button variant="danger" size="sm" onClick={() => doCancel(o.id, o.orderNo)} disabled={cancel.isPending}>Cancel</Button>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {msg && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-surface-overlay px-5 py-2.5 text-sm font-semibold shadow-3">{msg}</div>}
    </div>
  );
}
