"use client";
import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button, Drawer, Input, cn } from "@billbistro/ui";
import type { ItemInput, MenuCategory, MenuItem } from "@billbistro/sdk";

interface Props { open: boolean; item: MenuItem | null; categories: MenuCategory[]; defaultCategoryId?: string; onClose: () => void; onSave: (input: ItemInput) => Promise<void> }
type Row = { id?: string; name: string; rupees: string };

const GST = [0, 5, 12, 18];

export function ItemEditor({ open, item, categories, defaultCategoryId, onClose, onSave }: Props) {
  const [name, setName] = React.useState(""); const [sku, setSku] = React.useState(""); const [desc, setDesc] = React.useState("");
  const [categoryId, setCategoryId] = React.useState(""); const [price, setPrice] = React.useState(""); const [tax, setTax] = React.useState(5);
  const [veg, setVeg] = React.useState(true); const [avail, setAvail] = React.useState(true);
  const [variants, setVariants] = React.useState<Row[]>([]); const [mods, setMods] = React.useState<Row[]>([]);
  const [busy, setBusy] = React.useState(false); const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setName(item?.name ?? ""); setSku(item?.sku ?? ""); setDesc(item?.description ?? ""); setCategoryId(item?.categoryId ?? defaultCategoryId ?? "");
    setPrice(item ? String(item.basePrice / 100) : ""); setTax(item ? item.taxRateBps / 100 : 5); setVeg(item?.isVeg ?? true); setAvail(item?.isAvailable ?? true);
    setVariants(item?.variants.map((v) => ({ id: v.id, name: v.name, rupees: String(v.priceDelta / 100) })) ?? []);
    setMods(item?.modifiers.map((m) => ({ id: m.id, name: m.name, rupees: String(m.price / 100) })) ?? []);
    setErr(null);
  }, [open, item, defaultCategoryId]);

  const toPaise = (s: string) => Math.round(Number(s || 0) * 100);
  const valid = name.trim() && categoryId && Number(price) >= 0 && price !== "";
  const save = async () => {
    if (!valid) return; setBusy(true); setErr(null);
    try {
      await onSave({ name: name.trim(), sku: sku.trim() || null, description: desc.trim() || null, categoryId, basePrice: toPaise(price), taxRateBps: tax * 100, isVeg: veg, isAvailable: avail,
        variants: variants.filter((v) => v.name.trim()).map((v) => ({ id: v.id, name: v.name.trim(), priceDelta: toPaise(v.rupees) })),
        modifiers: mods.filter((m) => m.name.trim()).map((m) => ({ id: m.id, name: m.name.trim(), price: toPaise(m.rupees) })) });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()} title={item ? `Edit · ${item.name}` : "New item"} className="w-[520px]"
      footer={<><Button variant="secondary" size="lg" onClick={onClose}>Cancel</Button><Button size="lg" disabled={!valid || busy} onClick={save}>{busy ? "Saving…" : item ? "Save changes" : "Add item"}</Button></>}>
      <div className="flex flex-col gap-5">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Butter Chicken" autoFocus />
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium text-muted">Category
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-12 rounded-md border border-border bg-surface px-3 text-md text-foreground outline-none focus:border-ring">
              <option value="" disabled>Choose…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></label>
          <Input label="SKU (optional)" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="BC-01" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Base price (₹)" type="number" min={0} step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="420" />
          <div className="flex flex-col gap-1.5 text-sm font-medium text-muted">GST
            <div className="flex h-12 gap-1 rounded-md border border-border bg-surface p-1">{GST.map((g) => <button key={g} onClick={() => setTax(g)} className={cn("flex-1 rounded-[7px] text-sm font-semibold", tax === g ? "bg-surface-overlay text-foreground" : "text-muted")}>{g}%</button>)}</div>
          </div>
        </div>
        <div className="flex gap-3">
          <Toggle on={veg} onChange={setVeg} onLabel="🟢 Veg" offLabel="🔴 Non-veg" />
          <Toggle on={avail} onChange={setAvail} onLabel="In stock" offLabel="Sold out" />
        </div>
        <Input label="Description (shown on QR menu)" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Tomato-cashew gravy, slow simmered" />
        <RowsEditor label="Variants (size / portion)" hint="price difference vs base, ₹ (can be negative)" rows={variants} onChange={setVariants} namePlaceholder="Half" />
        <RowsEditor label="Add-ons / modifiers" hint="extra price, ₹" rows={mods} onChange={setMods} namePlaceholder="Extra gravy" />
        {err && <p className="text-sm text-danger">{err}</p>}
      </div>
    </Drawer>
  );
}

const Toggle = ({ on, onChange, onLabel, offLabel }: { on: boolean; onChange: (b: boolean) => void; onLabel: string; offLabel: string }) => (
  <button onClick={() => onChange(!on)} className={cn("h-11 flex-1 rounded-md border text-sm font-semibold", on ? "border-success/50 bg-success/10 text-success" : "border-border bg-surface text-muted")}>{on ? onLabel : offLabel}</button>
);

function RowsEditor({ label, hint, rows, onChange, namePlaceholder }: { label: string; hint: string; rows: Row[]; onChange: (r: Row[]) => void; namePlaceholder: string }) {
  const set = (i: number, patch: Partial<Row>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between"><span className="text-sm font-medium text-muted">{label}</span><span className="text-xs text-subtle">{hint}</span></div>
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2">
          <input value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder={namePlaceholder} className="h-11 flex-1 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-ring" />
          <input value={r.rupees} onChange={(e) => set(i, { rupees: e.target.value })} type="number" step="0.5" placeholder="0" className="h-11 w-28 rounded-md border border-border bg-surface px-3 text-right font-mono text-sm outline-none focus:border-ring" />
          <button onClick={() => onChange(rows.filter((_, j) => j !== i))} className="flex size-11 items-center justify-center rounded-md text-muted hover:bg-surface-overlay hover:text-danger" aria-label="Remove"><X size={16} /></button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="self-start" onClick={() => onChange([...rows, { name: "", rupees: "0" }])}><Plus size={14} /> Add {label.split(" ")[0].toLowerCase()}</Button>
    </div>
  );
}
