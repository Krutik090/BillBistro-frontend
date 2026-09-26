"use client";
// T-107 basic inventory: stock levels, manual receive/adjust, and per-menu-item recipes.
import * as React from "react";
import { Plus, Pencil, PackagePlus } from "lucide-react";
import { Badge, Button, Card, CardTitle, Drawer, Input, Table, THead, TBody, TR, TH, TD, cn } from "@billbistro/ui";
import type { InventoryItem, InventoryItemInput } from "@billbistro/sdk";
import { DashboardShell } from "../../components/shell";
import { useInventory, useInventoryMutations, useMenu, useRecipe } from "../../lib/api";

const fmt = (milli: number, unit: string) => `${(milli / 1000).toLocaleString("en-IN", { maximumFractionDigits: 3 })} ${unit}`;

export default function InventoryPage() {
  return <DashboardShell><InventoryManager /></DashboardShell>;
}

function InventoryManager() {
  const { items, loading, error } = useInventory();
  const m = useInventoryMutations();
  const [creating, setCreating] = React.useState(false);
  const [adjusting, setAdjusting] = React.useState<InventoryItem | null>(null);
  const [editing, setEditing] = React.useState<InventoryItem | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const flash = (s: string) => { setMsg(s); setTimeout(() => setMsg(null), 2500); };
  const run = async (p: Promise<unknown>, ok: string) => { try { await p; flash(ok); } catch (e) { flash(`Error: ${(e as Error).message}`); } };

  const lowStock = items.filter((i) => i.stockMilli <= i.lowStockMilli).length;

  return (
    <div className="flex flex-col gap-5 p-7">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted">{items.length} items · {lowStock} low stock</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus size={16} /> New item</Button>
      </header>
      {error && <p className="text-sm text-danger">Failed to load inventory: {String(error)}</p>}

      <Table>
        <THead><TR><TH>Item</TH><TH>Unit</TH><TH numeric>Stock</TH><TH numeric>Low-stock at</TH><TH>Status</TH><TH></TH></TR></THead>
        <TBody>
          {loading && <TR><TD colSpan={6} className="text-center text-muted">Loading…</TD></TR>}
          {!loading && !items.length && <TR><TD colSpan={6} className="text-center text-muted">No inventory items yet.</TD></TR>}
          {items.map((i) => {
            const low = i.stockMilli <= i.lowStockMilli;
            return (
              <TR key={i.id} className="hover:bg-surface-overlay/40">
                <TD className="font-medium">{i.name}</TD>
                <TD className="text-muted">{i.unit}</TD>
                <TD numeric>{fmt(i.stockMilli, i.unit)}</TD>
                <TD numeric className="text-muted">{fmt(i.lowStockMilli, i.unit)}</TD>
                <TD><Badge tone={low ? "danger-soft" : "success-soft"}>{low ? "Low stock" : "OK"}</Badge></TD>
                <TD>
                  <div className="flex justify-end gap-1">
                    <IconBtn title="Adjust stock" onClick={() => setAdjusting(i)}><PackagePlus size={14} /></IconBtn>
                    <IconBtn title="Edit" onClick={() => setEditing(i)}><Pencil size={14} /></IconBtn>
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <RecipePanel />

      <ItemDrawer open={creating} onClose={() => setCreating(false)} onSave={async (input) => { await run(m.create.mutateAsync(input), `Added ${input.name}`); setCreating(false); }} />
      <ItemDrawer open={!!editing} item={editing} onClose={() => setEditing(null)} onSave={async (input) => { await run(m.update.mutateAsync({ id: editing!.id, input }), "Saved"); setEditing(null); }} />
      <AdjustDrawer open={!!adjusting} item={adjusting} onClose={() => setAdjusting(null)} onSave={async (qtyMilli, reason) => { await run(m.adjust.mutateAsync({ id: adjusting!.id, qtyMilli, reason }), "Stock updated"); setAdjusting(null); }} />
      {msg && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-surface-overlay px-5 py-2.5 text-sm font-semibold shadow-3">{msg}</div>}
    </div>
  );
}

function ItemDrawer({ open, item, onClose, onSave }: { open: boolean; item?: InventoryItem | null; onClose: () => void; onSave: (input: InventoryItemInput) => void }) {
  const isEdit = !!item;
  const [name, setName] = React.useState("");
  const [unit, setUnit] = React.useState("kg");
  const [opening, setOpening] = React.useState("0");
  const [lowStock, setLowStock] = React.useState("0");
  React.useEffect(() => {
    if (!open) return;
    setName(item?.name ?? ""); setUnit(item?.unit ?? "kg");
    setOpening(item ? String(item.stockMilli / 1000) : "0");
    setLowStock(item ? String(item.lowStockMilli / 1000) : "0");
  }, [open, item]);

  const save = () => onSave({
    name, unit,
    ...(isEdit ? {} : { stockMilli: Math.round(Number(opening) * 1000) }),
    lowStockMilli: Math.round(Number(lowStock) * 1000),
  });

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} title={isEdit ? "Edit item" : "New inventory item"}
      footer={<Button size="lg" onClick={save} disabled={!name.trim() || !unit.trim()}>{isEdit ? "Save" : "Add item"}</Button>}>
      <div className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Refined flour (maida)" autoFocus />
        <Input label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, ltr, pcs…" />
        {!isEdit && <Input label="Opening stock" type="number" min="0" value={opening} onChange={(e) => setOpening(e.target.value)} />}
        <Input label={`Low-stock alert below (${unit || "unit"})`} type="number" min="0" value={lowStock} onChange={(e) => setLowStock(e.target.value)} />
      </div>
    </Drawer>
  );
}

function AdjustDrawer({ open, item, onClose, onSave }: { open: boolean; item: InventoryItem | null; onClose: () => void; onSave: (qtyMilli: number, reason: string) => void }) {
  const [direction, setDirection] = React.useState<"receive" | "remove">("receive");
  const [qty, setQty] = React.useState("");
  const [reason, setReason] = React.useState("");
  React.useEffect(() => { if (open) { setDirection("receive"); setQty(""); setReason(""); } }, [open]);
  if (!item) return null;
  const n = Number(qty);
  const submit = () => { if (!n) return; onSave(Math.round(n * 1000) * (direction === "receive" ? 1 : -1), reason.trim() || (direction === "receive" ? "Stock received" : "Stock adjustment")); };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} title={`Adjust stock — ${item.name}`} footer={<Button size="lg" onClick={submit} disabled={!n}>Save</Button>}>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">Current: {fmt(item.stockMilli, item.unit)}</p>
        <div className="flex rounded-md border border-border bg-surface p-1 text-sm">
          {(["receive", "remove"] as const).map((d) => (
            <button key={d} onClick={() => setDirection(d)} className={cn("flex-1 rounded-[7px] py-2 font-medium", d === direction ? "bg-surface-overlay text-foreground" : "text-muted")}>{d === "receive" ? "Receive" : "Waste / correction"}</button>
          ))}
        </div>
        <Input label={`Quantity (${item.unit})`} type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
        <Input label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={direction === "receive" ? "e.g. delivery from vendor" : "e.g. spoilage"} />
      </div>
    </Drawer>
  );
}

function RecipePanel() {
  const { items: menuItems } = useMenu();
  const { items: invItems } = useInventory();
  const [menuItemId, setMenuItemId] = React.useState<string | null>(null);
  const { lines, setRecipe } = useRecipe(menuItemId);
  const [draft, setDraft] = React.useState<{ inventoryItemId: string; qty: string }[]>([]);
  React.useEffect(() => { setDraft(lines.map((l) => ({ inventoryItemId: l.inventoryItemId, qty: String(l.qtyMilli / 1000) }))); }, [lines]);

  const addLine = () => setDraft((d) => [...d, { inventoryItemId: invItems[0]?.id ?? "", qty: "0" }]);
  const removeLine = (i: number) => setDraft((d) => d.filter((_, idx) => idx !== i));
  const save = () => setRecipe.mutate(draft.filter((l) => l.inventoryItemId && Number(l.qty) > 0).map((l) => ({ inventoryItemId: l.inventoryItemId, qtyMilli: Math.round(Number(l.qty) * 1000) })));

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>Recipes</CardTitle>
          <p className="text-xs text-muted">What one unit of a menu item consumes — drives auto-deduction when a KOT is sent.</p>
        </div>
        <select value={menuItemId ?? ""} onChange={(e) => setMenuItemId(e.target.value || null)} className="h-10 rounded-md border border-border bg-surface px-3 text-sm text-foreground">
          <option value="">Select a menu item…</option>
          {menuItems.map((mi) => <option key={mi.id} value={mi.id}>{mi.name}</option>)}
        </select>
      </div>
      {!menuItemId && <p className="text-sm text-muted">Pick a menu item above to define its recipe.</p>}
      {menuItemId && !invItems.length && <p className="text-sm text-muted">Add an inventory item first — there's nothing to link a recipe to yet.</p>}
      {menuItemId && !!invItems.length && (
        <div className="flex flex-col gap-3">
          {draft.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <select value={l.inventoryItemId} onChange={(e) => setDraft((d) => d.map((x, idx) => (idx === i ? { ...x, inventoryItemId: e.target.value } : x)))} className="h-10 flex-1 rounded-md border border-border bg-surface px-3 text-sm text-foreground">
                {invItems.map((ii) => <option key={ii.id} value={ii.id}>{ii.name} ({ii.unit})</option>)}
              </select>
              <input type="number" min="0" value={l.qty} onChange={(e) => setDraft((d) => d.map((x, idx) => (idx === i ? { ...x, qty: e.target.value } : x)))} placeholder="qty per unit sold" className="h-10 w-40 rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none placeholder:text-subtle" />
              <button onClick={() => removeLine(i)} className="text-xs font-medium text-danger hover:underline">Remove</button>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={addLine}>+ Add ingredient</Button>
            <Button size="sm" onClick={save} disabled={setRecipe.isPending}>{setRecipe.isPending ? "Saving…" : "Save recipe"}</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

const IconBtn = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
  <button title={title} aria-label={title} onClick={onClick} className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-overlay hover:text-foreground">{children}</button>
);
