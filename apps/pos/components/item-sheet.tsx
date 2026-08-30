"use client";
import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { Button, Drawer, cn } from "@billbistro/ui";
import { priceLine } from "@billbistro/sdk";
import { usePos } from "../lib/store";
import { inr } from "../lib/format";

/** Variant + modifier picker. Also used to edit an existing cart line. */
export function ItemSheet() {
  const { sheet, sheetItem: item, editingLineId, lines, addLine, updateLine, openSheet } = usePos();
  const editing = lines.find((l) => l.lineId === editingLineId) ?? null;
  const [variantId, setVariantId] = React.useState<string | null>(null);
  const [mods, setMods] = React.useState<string[]>([]);
  const [qty, setQty] = React.useState(1);
  const [notes, setNotes] = React.useState("");
  const open = sheet === "item" && !!item;

  React.useEffect(() => {
    if (!open || !item) return;
    setVariantId(editing?.variantId ?? item.variants.find((v) => v.priceDelta === 0)?.id ?? item.variants[0]?.id ?? null);
    setMods(editing?.modifierIds ?? []); setQty(editing?.qty ?? 1); setNotes(editing?.notes ?? "");
  }, [open, item, editing]);

  if (!item) return null;
  const unit = priceLine(item, { itemId: item.id, qty: 1, variantId, modifierIds: mods }).unitPrice;
  const confirm = () => {
    if (editing) updateLine(editing.lineId, { variantId, modifierIds: mods, qty, notes: notes || null });
    else addLine(item, variantId, mods, qty, notes || null);
    openSheet(null);
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && openSheet(null)} title={item.name}
      footer={<><Button variant="secondary" size="lg" onClick={() => openSheet(null)}>Cancel</Button><Button size="lg" onClick={confirm}>{editing ? "Update" : "Add"} · {inr(unit * qty)}</Button></>}>
      <div className="flex flex-col gap-6">
        {item.variants.length > 0 && (
          <Group label="Size">
            {item.variants.map((v) => (
              <Chip key={v.id} active={variantId === v.id} onClick={() => setVariantId(v.id)}>
                {v.name}<span className="ml-2 font-mono text-xs text-muted">{inr(item.basePrice + v.priceDelta)}</span>
              </Chip>
            ))}
          </Group>
        )}
        {item.modifiers.length > 0 && (
          <Group label="Add-ons">
            {item.modifiers.map((m) => {
              const on = mods.includes(m.id);
              return <Chip key={m.id} active={on} onClick={() => setMods(on ? mods.filter((x) => x !== m.id) : [...mods, m.id])}>{m.name}{m.price > 0 && <span className="ml-2 font-mono text-xs text-muted">+{inr(m.price)}</span>}</Chip>;
            })}
          </Group>
        )}
        <Group label="Quantity">
          <div className="flex h-touch items-center rounded-lg bg-surface-overlay">
            <button className="h-full w-touch text-muted hover:text-foreground" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Decrease"><Minus className="mx-auto" size={20} /></button>
            <span className="w-12 text-center font-display text-xl font-semibold font-tabular">{qty}</span>
            <button className="h-full w-touch text-primary" onClick={() => setQty(qty + 1)} aria-label="Increase"><Plus className="mx-auto" size={20} /></button>
          </div>
        </Group>
        <Group label="Kitchen note">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. less oil, no onion" className="h-12 w-full rounded-md border border-border bg-surface px-3.5 text-md outline-none placeholder:text-subtle focus:border-ring" />
        </Group>
      </div>
    </Drawer>
  );
}

const Group = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2.5"><span className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</span><div className="flex flex-wrap gap-2">{children}</div></div>
);
const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className={cn("flex h-12 items-center rounded-md border px-4 text-sm font-semibold transition-colors", active ? "border-primary bg-primary-soft text-foreground" : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground")}>{children}</button>
);
