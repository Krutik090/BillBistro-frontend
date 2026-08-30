"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { Search, Leaf, Drumstick } from "lucide-react";
import { cn, spring } from "@billbistro/ui";
import type { MenuItem } from "@billbistro/sdk";
import { useMenu } from "../lib/api";
import { usePos } from "../lib/store";
import { inr } from "../lib/format";

export function Catalog({ searchRef }: { searchRef: React.RefObject<HTMLInputElement | null> }) {
  const { categories, items, loading, error } = useMenu();
  const [cat, setCat] = React.useState<string | "all">("all");
  const [q, setQ] = React.useState("");
  const addLine = usePos((s) => s.addLine);
  const openSheet = usePos((s) => s.openSheet);

  const visible = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => i.isAvailable && (cat === "all" || i.categoryId === cat) && (!needle || i.name.toLowerCase().includes(needle) || i.sku?.toLowerCase().includes(needle)));
  }, [items, cat, q]);

  const pick = (item: MenuItem) => {
    // One tap adds when the item has no choices; otherwise open the variant/modifier sheet.
    if (item.variants.length === 0 && item.modifiers.length === 0) addLine(item, null, [], 1);
    else openSheet("item", item);
  };

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-4 p-5">
      <label className="flex h-touch items-center gap-2.5 rounded-lg border border-border bg-surface px-4 text-subtle focus-within:border-ring">
        <Search size={18} />
        <input
          ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && visible[0]) { pick(visible[0]); setQ(""); } if (e.key === "Escape") { setQ(""); (e.target as HTMLInputElement).blur(); } }}
          className="w-full bg-transparent text-md text-foreground outline-none placeholder:text-subtle" placeholder="Search or scan item · press /   (Enter adds the first match)"
        />
        {q && <span className="text-xs">{visible.length} match{visible.length === 1 ? "" : "es"}</span>}
      </label>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[{ id: "all" as const, name: "All" }, ...categories].map((c) => (
          <button key={c.id} onClick={() => setCat(c.id)} className={cn("relative h-11 shrink-0 rounded-full border px-4.5 text-sm font-semibold transition-colors", c.id === cat ? "border-transparent text-primary-foreground" : "border-border bg-surface text-foreground hover:border-border-strong")}>
            {c.id === cat && <motion.span layoutId="cat" className="absolute inset-0 rounded-full bg-primary" transition={spring} />}
            <span className="relative">{c.name}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-danger">Menu failed to load: {String(error)}</p>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 overflow-y-auto pr-1">
        {loading && Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[124px] animate-pulse rounded-2xl bg-surface-raised" />)}
        {visible.map((item) => (
          <motion.button key={item.id} whileTap={{ scale: 0.96 }} transition={{ duration: 0.08 }} onClick={() => pick(item)}
            className="flex min-h-[124px] flex-col gap-2 rounded-2xl border border-border bg-surface-raised p-3.5 text-left hover:border-border-strong focus-visible:outline-2 focus-visible:outline-ring">
            <div className="flex items-start justify-between gap-2">
              <span className="text-md font-semibold leading-snug">{item.name}</span>
              {item.isVeg ? <Leaf size={14} className="mt-1 shrink-0 text-success" /> : <Drumstick size={14} className="mt-1 shrink-0 text-danger" />}
            </div>
            <span className="mt-auto flex items-center justify-between">
              <span className="font-mono text-md font-medium text-primary">{inr(item.basePrice)}</span>
              {(item.variants.length > 0 || item.modifiers.length > 0) && <span className="text-[11px] font-medium text-subtle">{item.variants.length ? `${item.variants.length} sizes` : "add-ons"}</span>}
            </span>
          </motion.button>
        ))}
        {!loading && !visible.length && <p className="col-span-full py-10 text-center text-sm text-muted">Nothing matches “{q}”.</p>}
      </div>
    </section>
  );
}
