"use client";
// QR ordering (T-108) — real menu, real cart, real order submission. No login: customers scan a
// per-table QR code (?table=<id> in the URL) and order directly against the single restaurant's
// public endpoints. Variant/modifier picking is out of scope for this pass — items add at their
// resolved effective price; that richer picker already exists in POS and can be reused here later.
import * as React from "react";
import { Search, Minus, Plus, Check } from "lucide-react";
import { Badge, Button, LogoMark, ThemeToggle, cn } from "@billbistro/ui";
import { itemPrice, type MenuItem } from "@billbistro/sdk";
import { ApiProvider, useQrMenu, useSubmitOrder } from "../lib/api";

const RESTAURANT_NAME = process.env.NEXT_PUBLIC_RESTAURANT_NAME || "Spice Route";
const inr = (p: number) => `₹${(p / 100).toLocaleString("en-IN", { minimumFractionDigits: p % 100 ? 2 : 0 })}`;

export default function QrPage() {
  return <ApiProvider><QrOrdering /></ApiProvider>;
}

function QrOrdering() {
  const { menu, loading, error } = useQrMenu();
  const submitOrder = useSubmitOrder();
  const [cart, setCart] = React.useState<Map<string, number>>(new Map());
  const [section, setSection] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [placing, setPlacing] = React.useState(false);
  const [placed, setPlaced] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const categories = menu?.categories ?? [];
  const activeSection = section ?? categories[0]?.id ?? null;
  const itemsById = React.useMemo(() => new Map(categories.flatMap((c) => c.items.map((i) => [i.id, i] as const))), [categories]);
  const cartCount = [...cart.values()].reduce((s, n) => s + n, 0);
  const cartTotal = [...cart.entries()].reduce((s, [id, qty]) => { const i = itemsById.get(id); return s + (i ? itemPrice(i) * qty : 0); }, 0);

  const add = (item: MenuItem) => setCart((c) => new Map(c).set(item.id, (c.get(item.id) ?? 0) + 1));
  const remove = (item: MenuItem) => setCart((c) => { const n = new Map(c); const q = (n.get(item.id) ?? 0) - 1; if (q <= 0) n.delete(item.id); else n.set(item.id, q); return n; });

  const checkout = async () => {
    setPlacing(true); setErr(null);
    try {
      const items = [...cart.entries()].map(([itemId, qty]) => ({ itemId, qty }));
      const order = await submitOrder(items);
      setPlaced(order.orderNo);
      setCart(new Map());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setPlacing(false);
    }
  };

  if (placed) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-success text-neutral-950"><Check size={32} strokeWidth={3} /></div>
        <h1 className="font-display text-2xl font-semibold">Order sent!</h1>
        <p className="text-muted">Order {placed} is with the kitchen. A staff member will confirm shortly.</p>
        <Button size="lg" onClick={() => setPlaced(null)}>Order more</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur">
        <LogoMark size={36} />
        <div className="flex-1 leading-tight">
          <div className="font-display font-semibold">{RESTAURANT_NAME}</div>
          <div className="text-xs text-muted">{menu?.outlet?.name ?? "Menu"}</div>
        </div>
        <Badge tone="success">Open</Badge>
        <ThemeToggle />
      </header>
      <div className="px-4 pt-4">
        <label className="flex h-12 items-center gap-2.5 rounded-md border border-border bg-surface px-3.5 text-subtle">
          <Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} className="w-full bg-transparent text-md text-foreground outline-none placeholder:text-subtle" placeholder="Search the menu" />
        </label>
      </div>
      {!!error && <p className="px-4 pt-4 text-sm text-danger">Couldn't load the menu: {String(error)}</p>}
      {!loading && !error && !categories.length && <p className="px-4 pt-4 text-sm text-muted">The menu is empty right now.</p>}
      {!q && (
        <nav className="flex gap-2 overflow-x-auto px-4 py-3">
          {categories.map((c) => (
            <button key={c.id} onClick={() => setSection(c.id)} className={cn("shrink-0 rounded-full px-4 py-2 text-sm font-semibold", c.id === activeSection ? "bg-primary text-primary-foreground" : "border border-border")}>{c.name}</button>
          ))}
        </nav>
      )}
      <main className="flex flex-1 flex-col gap-6 px-4 pb-28 pt-2">
        {loading && <p className="pt-6 text-center text-muted">Loading menu…</p>}
        {categories
          .filter((c) => !q && c.id === activeSection || q)
          .map((c) => {
            const items = c.items.filter((i) => !q || i.name.toLowerCase().includes(q.toLowerCase()));
            if (!items.length) return null;
            return (
              <section key={c.id} className="flex flex-col gap-3">
                <h2 className="font-display text-lg font-semibold">{c.name}</h2>
                {items.map((item) => {
                  const qty = cart.get(item.id) ?? 0;
                  return (
                    <div key={item.id} className="flex gap-3 rounded-xl border border-border bg-surface-raised p-3.5">
                      <div className="flex-1">
                        <div className="font-semibold">{item.name}</div>
                        {item.description && <p className="text-sm text-muted">{item.description}</p>}
                        <div className="mt-1 font-mono text-sm font-medium text-primary">{inr(itemPrice(item))}</div>
                      </div>
                      <div className="flex flex-col items-end justify-center gap-2">
                        {qty === 0 ? (
                          <Button size="sm" variant="secondary" onClick={() => add(item)}>Add</Button>
                        ) : (
                          <div className="flex items-center gap-2 rounded-md border border-border">
                            <button onClick={() => remove(item)} className="flex size-8 items-center justify-center text-muted hover:text-foreground"><Minus size={14} /></button>
                            <span className="w-4 text-center font-mono text-sm font-semibold">{qty}</span>
                            <button onClick={() => add(item)} className="flex size-8 items-center justify-center text-muted hover:text-foreground"><Plus size={14} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </section>
            );
          })}
      </main>
      {cartCount > 0 && (
        <footer className="fixed inset-x-0 bottom-0 mx-auto max-w-md p-4">
          {err && <p className="mb-2 rounded-md bg-surface-raised p-2 text-center text-sm text-danger">{err}</p>}
          <Button size="lg" variant="glow" className="w-full justify-between px-5" onClick={checkout} disabled={placing}>
            <span>{cartCount} item{cartCount > 1 ? "s" : ""}</span><span>{placing ? "Placing…" : `Place order · ${inr(cartTotal)}`}</span>
          </Button>
        </footer>
      )}
    </div>
  );
}
