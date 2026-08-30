"use client";
// T-110 Menu management: categories (create/rename/toggle/delete) + items (CRUD, variants, modifiers, pricing, availability).
import * as React from "react";
import { Plus, Leaf, Drumstick, Pencil, Trash2, Search } from "lucide-react";
import { Badge, Button, Table, THead, TBody, TR, TH, TD, cn } from "@billbistro/ui";
import { allOptions, type MenuCategory, type MenuItem } from "@billbistro/sdk";
import { DashboardShell } from "../../components/shell";
import { useMenu, useMenuMutations } from "../../lib/api";
import { ItemEditor } from "../../components/item-editor";

const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

export default function MenuPage() {
  return <DashboardShell><MenuManager /></DashboardShell>;
}

function MenuManager() {
  const { categories, items, loading, error } = useMenu();
  const m = useMenuMutations();
  const [cat, setCat] = React.useState<string | "all">("all");
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<MenuItem | "new" | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const flash = (s: string) => { setMsg(s); setTimeout(() => setMsg(null), 2500); };
  const run = async (p: Promise<unknown>, ok: string) => { try { await p; flash(ok); } catch (e) { flash(`Error: ${(e as Error).message}`); } };

  const visible = items.filter((i) => (cat === "all" || i.categoryId === cat) && (!q || i.name.toLowerCase().includes(q.toLowerCase())));
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="flex h-full">
      <aside className="flex w-64 shrink-0 flex-col gap-1 border-r border-border p-4">
        <div className="mb-2 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">Categories</h2>
          <Button size="sm" variant="ghost" aria-label="Add category" onClick={() => { const name = window.prompt("Category name"); if (name) run(m.createCategory.mutateAsync({ name }), `Added ${name}`); }}><Plus size={16} /></Button></div>
        <CatRow label="All items" count={items.length} active={cat === "all"} onClick={() => setCat("all")} />
        {categories.map((c) => (
          <CatRow key={c.id} label={c.name} count={items.filter((i) => i.categoryId === c.id).length} active={cat === c.id} muted={!c.isActive} onClick={() => setCat(c.id)}
            actions={<>
              <IconBtn title="Rename" onClick={() => { const name = window.prompt("Rename category", c.name); if (name && name !== c.name) run(m.updateCategory.mutateAsync({ id: c.id, input: { name } }), "Renamed"); }}><Pencil size={12} /></IconBtn>
              <IconBtn title={c.isActive ? "Hide from POS" : "Show in POS"} onClick={() => run(m.updateCategory.mutateAsync({ id: c.id, input: { isActive: !c.isActive } }), c.isActive ? "Hidden" : "Visible")}>{c.isActive ? "◉" : "○"}</IconBtn>
              <IconBtn title="Delete" onClick={() => run(m.deleteCategory.mutateAsync(c.id), "Deleted")}><Trash2 size={12} /></IconBtn>
            </>} />
        ))}
      </aside>

      <section className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <header className="flex items-center gap-3">
          <div className="flex-1"><h1 className="font-display text-2xl font-semibold">Menu & pricing</h1><p className="text-sm text-muted">{items.length} items · {categories.length} categories · prices incl. variants, GST by rate</p></div>
          <label className="flex h-11 w-64 items-center gap-2 rounded-md border border-border bg-surface px-3 text-subtle"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items" className="w-full bg-transparent text-sm text-foreground outline-none" /></label>
          <Button onClick={() => setEditing("new")}><Plus size={16} /> New item</Button>
        </header>
        {error && <p className="text-sm text-danger">Failed to load menu: {String(error)}</p>}
        <Table>
          <THead><TR><TH>Item</TH><TH>Category</TH><TH numeric>Base price</TH><TH>GST</TH><TH>Variants</TH><TH>Add-ons</TH><TH>Available</TH><TH></TH></TR></THead>
          <TBody>
            {loading && <TR><TD colSpan={8} className="text-center text-muted">Loading…</TD></TR>}
            {visible.map((i) => (
              <TR key={i.id} className="hover:bg-surface-overlay/40">
                <TD><div className="flex items-center gap-2 font-medium">{i.isVeg ? <Leaf size={14} className="text-success" /> : <Drumstick size={14} className="text-danger" />}{i.name}{i.sku && <span className="font-mono text-xs text-subtle">{i.sku}</span>}</div></TD>
                <TD className="text-muted">{catName(i.categoryId)}</TD>
                <TD numeric>{inr(i.basePrice)}</TD>
                <TD className="text-muted">{i.taxRateBps / 100}%</TD>
                <TD className="text-muted">{i.variants.length ? i.variants.map((v) => `${v.name} ${v.priceDelta ? (v.priceDelta > 0 ? "+" : "") + inr(v.priceDelta) : ""}`.trim()).join(", ") : "—"}</TD>
                <TD className="text-muted">{allOptions(i).length ? allOptions(i).map((x) => x.name).join(", ") : "—"}</TD>
                <TD><button onClick={() => run(m.updateItem.mutateAsync({ id: i.id, input: { isAvailable: !i.isAvailable } }), i.isAvailable ? "Marked sold out" : "Available")}><Badge tone={i.isAvailable ? "success-soft" : "danger-soft"}>{i.isAvailable ? "In stock" : "Sold out"}</Badge></button></TD>
                <TD><div className="flex justify-end gap-1"><IconBtn title="Edit" onClick={() => setEditing(i)}><Pencil size={14} /></IconBtn><IconBtn title="Delete" onClick={() => window.confirm(`Delete ${i.name}?`) && run(m.deleteItem.mutateAsync(i.id), "Deleted")}><Trash2 size={14} /></IconBtn></div></TD>
              </TR>
            ))}
            {!loading && !visible.length && <TR><TD colSpan={8} className="text-center text-muted">No items here yet.</TD></TR>}
          </TBody>
        </Table>
      </section>

      <ItemEditor open={editing !== null} item={editing === "new" ? null : editing} categories={categories} defaultCategoryId={cat === "all" ? categories[0]?.id : cat}
        onClose={() => setEditing(null)}
        onSave={async (input) => { const isNew = editing === "new"; await run(isNew ? m.createItem.mutateAsync(input) : m.updateItem.mutateAsync({ id: (editing as MenuItem).id, input }), isNew ? "Item added" : "Saved"); setEditing(null); }} />
      {msg && <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-surface-overlay px-5 py-2.5 text-sm font-semibold shadow-3">{msg}</div>}
    </div>
  );
}

function CatRow({ label, count, active, muted, onClick, actions }: { label: string; count: number; active: boolean; muted?: boolean; onClick: () => void; actions?: React.ReactNode }) {
  return (
    <div className={cn("group flex h-10 items-center gap-2 rounded-md px-3 text-sm", active ? "bg-surface-overlay font-semibold" : "text-muted hover:text-foreground", muted && "opacity-50")}>
      <button onClick={onClick} className="flex flex-1 items-center justify-between text-left"><span>{label}</span><span className="font-mono text-xs">{count}</span></button>
      {actions && <div className="hidden items-center gap-0.5 group-hover:flex">{actions}</div>}
    </div>
  );
}
const IconBtn = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
  <button title={title} aria-label={title} onClick={onClick} className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-overlay hover:text-foreground">{children}</button>
);
export type { MenuCategory };
