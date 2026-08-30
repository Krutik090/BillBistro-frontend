"use client";
import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { Button, Drawer, cn } from "@billbistro/ui";
import { priceLine, itemPrice, type ModifierGroup } from "@billbistro/sdk";
import { usePos } from "../lib/store";
import { inr } from "../lib/format";

/** Variant + modifier-group picker (respects min/max per group). Also used to edit an existing cart line. */
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
    setVariantId(editing?.variantId ?? item.variants.find((v) => v.isDefault)?.id ?? item.variants.find((v) => v.priceDelta === 0)?.id ?? item.variants[0]?.id ?? null);
    setMods(editing?.modifierIds ?? item.modifierGroups.flatMap((g) => g.options.filter((o) => o.isDefault).map((o) => o.id)));
    setQty(editing?.qty ?? 1); setNotes(editing?.notes ?? "");
  }, [open, item, editing]);

  if (!item) return null;
  const unit = priceLine(item, { itemId: item.id, qty: 1, variantId, modifierIds: mods }).unitPrice;
  const unmet = item.modifierGroups.filter((g) => g.options.filter((o) => mods.includes(o.id)).length < g.minSelect);
  const toggle = (g: ModifierGroup, id: string) => {
    const inGroup = g.options.filter((o) => mods.includes(o.id)).map((o) => o.id);
    if (mods.includes(id)) return setMods(mods.filter((x) => x !== id));
    if (g.maxSelect === 1) return setMods([...mods.filter((x) => !inGroup.includes(x)), id]); // radio behaviour
    if (inGroup.length >= g.maxSelect) return;
    setMods([...mods, id]);
  };
  const confirm = () => {
    if (unmet.length) return;
    if (editing) updateLine(editing.lineId, { variantId, modifierIds: mods, qty, notes: notes || null });
    else addLine(item, variantId, mods, qty, notes || null);
    openSheet(null);
  };

  return (
    <Drawer open={open} onOpenChange={(o) => !o && openSheet(null)} title={item.name}
      footer={<><Button variant="secondary" size="lg" onClick={() => openSheet(null)}>Cancel</Button><Button size="lg" disabled={unmet.length > 0} onClick={confirm}>{editing ? "Update" : "Add"} · {inr(unit * qty)}</Button></>}>
      <div className="flex flex-col gap-6">
        {item.variants.length > 0 && (
          <Group label="Size">
            {item.variants.filter((v) => v.isAvailable !== false).map((v) => (
              <Chip key={v.id} active={variantId === v.id} onClick={() => setVariantId(v.id)}>
                {v.name}<span className="ml-2 font-mono text-xs text-muted">{inr(itemPrice(item) + v.priceDelta)}</span>
              </Chip>
            ))}
          </Group>
        )}
        {item.modifierGroups.map((g) => (
          <Group key={g.id} label={g.name} hint={g.minSelect > 0 ? `choose ${g.minSelect === g.maxSelect ? g.minSelect : `${g.minSelect}–${g.maxSelect}`}` : g.maxSelect > 1 ? `up to ${g.maxSelect}` : "optional"} warn={unmet.includes(g)}>
            {g.options.filter((o) => o.isAvailable !== false).map((o) => (
              <Chip key={o.id} active={mods.includes(o.id)} onClick={() => toggle(g, o.id)}>{o.name}{o.price > 0 && <span className="ml-2 font-mono text-xs text-muted">+{inr(o.price)}</span>}</Chip>
            ))}
          </Group>
        ))}
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

const Group = ({ label, hint, warn, children }: { label: string; hint?: string; warn?: boolean; children: React.ReactNode }) => (
  <div className="flex flex-col gap-2.5">
    <div className="flex items-baseline justify-between"><span className={cn("text-xs font-semibold uppercase tracking-wide", warn ? "text-warning" : "text-muted")}>{label}</span>{hint && <span className="text-xs text-subtle">{hint}</span>}</div>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);
const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className={cn("flex h-12 items-center rounded-md border px-4 text-sm font-semibold transition-colors", active ? "border-primary bg-primary-soft text-foreground" : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground")}>{children}</button>
);
