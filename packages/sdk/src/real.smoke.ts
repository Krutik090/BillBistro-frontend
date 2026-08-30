// Smoke against the RUNNING API (phase1-backend): login → categories → items → create/edit/delete an item with variants + add-ons.
// Run: pnpm --filter @billbistro/sdk smoke:real   (needs `pnpm api:dev` + seeded db; demo creds from Jim's seed)
import { createClient } from "./client";
import { createRealApi } from "./real";
import { allOptions } from "./types";
import { priceLine } from "./mock";

// Node 22 fetch has no cookie jar — keep cookies by hand.
let cookie = "";
const jarFetch: typeof fetch = async (url, init = {}) => {
  const res = await fetch(url, { ...init, headers: { ...(init.headers ?? {}), ...(cookie ? { cookie } : {}) } });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((s) => s.split(";")[0]).join("; ");
  return res;
};
const api = createRealApi({ client: createClient({ fetch: jarFetch }) });
const assert = (c: unknown, m: string) => { if (!c) throw new Error(`FAIL ${m}`); };

const me = await api.auth.login({ tenantSlug: "demo", email: "owner@demo.local", password: "Password123!" });
assert(me.permissions.includes("menu.write"), "owner can write menu");
const cats = await api.menu.categories();
assert(cats.length > 0, "categories");
const before = await api.menu.items();

const created = await api.menu.createItem({ categoryId: cats[0].id, name: `SDK Smoke ${Date.now()}`, basePrice: 12345, taxRateBps: 500, isVeg: true, sku: `SMK-${Date.now() % 100000}`,
  variants: [{ name: "Half", priceDelta: -5000 }, { name: "Full", priceDelta: 0, isDefault: true }], modifiers: [{ name: "Extra gravy", price: 4000 }] });
assert(created.variants.length === 2 && allOptions(created).length === 1, `nested create: v=${created.variants.length} o=${allOptions(created).length}`);

const half = created.variants.find((v) => v.name === "Half")!;
const updated = await api.menu.updateItem(created.id, { basePrice: 15000, isAvailable: false,
  variants: [{ id: half.id, name: "Half", priceDelta: -6000 }, { name: "Family", priceDelta: 20000 }],
  modifiers: [{ id: allOptions(created)[0].id, name: "Extra gravy", price: 4500 }, { name: "Boneless", price: 6000 }] });
assert(updated.basePrice === 15000 && updated.isAvailable === false, "scalar patch");
assert(updated.variants.length === 2 && !updated.variants.some((v) => v.name === "Full") && updated.variants.find((v) => v.name === "Half")!.priceDelta === -6000, "variant diff (delete/patch/create)");
assert(allOptions(updated).length === 2 && allOptions(updated).find((o) => o.name === "Extra gravy")!.price === 4500, "option diff");

await api.menu.deleteItem(created.id);
const after = await api.menu.items();
assert(after.length === before.length, "soft-deleted item gone from list");

// Outlets (Jim e0259ea) + Floor (T-101). OUTLET_ID env pins an outlet; otherwise the first active one is auto-resolved.
const outlets = await api.outlets.list();
assert(outlets.length > 0 && outlets[0].code, "outlets list");
const cur = await api.outlets.current();
assert(cur.id === (process.env.OUTLET_ID ?? outlets.find((o) => o.isActive)?.id), "current outlet resolution");
let floor = "";
{
  const fapi = createRealApi({ client: createClient({ fetch: jarFetch }), outletId: process.env.OUTLET_ID });
  const tables = await fapi.tables.list();
  assert(tables.length > 0 && tables[0].section && tables[0].name, "floor tables flattened");
  const free = tables.find((t) => t.status === "FREE")!;
  const occ = await fapi.tables.setStatus(free.id, "OCCUPIED", free.version);
  assert(occ.status === "OCCUPIED" && occ.version === (free.version ?? 0) + 1, "status transition + version bump");
  let illegal = false; try { await fapi.tables.setStatus(free.id, "RESERVED", occ.version); } catch { illegal = true; } assert(illegal, "illegal transition rejected (422)");
  let stale = false; try { await fapi.tables.setStatus(free.id, "FREE", free.version); } catch { stale = true; } assert(stale, "stale version rejected (409)");
  await fapi.tables.setStatus(free.id, "FREE", occ.version);
  const eff = await fapi.menu.effective();
  assert(eff.every((i) => typeof i.effectivePrice === "number" && i.isAvailable), "effective menu carries effectivePrice, only available items");
  floor = `${tables.length} tables in ${new Set(tables.map((t) => t.section)).size} sections; effective menu ${eff.length} items`;
}
// Orders + KOT (T-102 @ 23e4f71): seat a free table → edit (full-list replace, sent lines immutable) → KOT → cancel frees the table.
let ordersNote = "";
{
  const menu = await api.menu.effective();
  const a = menu[0], b = menu[1] ?? menu[0];
  // satisfy required modifier groups (server validates min/max per group → 422)
  const req = (i: typeof a) => i.modifierGroups.flatMap((g) => g.options.slice(0, g.minSelect).map((o) => o.id));
  const line = (i: typeof a, qty: number, clientLineId: string) => ({ itemId: i.id, qty, variantId: i.variants.find((v) => v.isDefault)?.id ?? i.variants[0]?.id ?? null, modifierIds: req(i), clientLineId });
  const tables0 = await api.tables.list();
  const free = tables0.find((t) => t.status === "FREE")!;
  const key = `smoke-${Date.now()}`;
  const o1 = await api.orders.create({ type: "DINE_IN", tableId: free.id, guestCount: 2, clientKey: key, items: [line(a, 2, "L1"), line(b, 1, "L2")] });
  assert(o1.items.length === 2 && o1.items.find((i) => i.clientLineId === "L1")?.qty === 2, "clientLineId echoed");
  assert(o1.subtotal === o1.items.reduce((s, i) => s + i.lineTotal, 0) && o1.items.every((i) => i.lineTotal === i.unitPrice * i.qty), "server pricing consistent");
  // client estimate (priceLine on the effective menu) must equal the server's re-pricing — otherwise the POS would show a drift warning
  const est = [line(a, 2, "L1"), line(b, 1, "L2")].reduce((s, l) => s + priceLine(l.itemId === a.id ? a : b, l).lineTotal, 0);
  assert(est === o1.subtotal, `client estimate ${est} == server subtotal ${o1.subtotal}`);
  const estTax = [line(a, 2, "L1"), line(b, 1, "L2")].reduce((s, l) => { const p = priceLine(l.itemId === a.id ? a : b, l); return s + Math.round((p.lineTotal * p.taxRateBps) / 10000); }, 0);
  assert(estTax === o1.taxTotal, `client tax ${estTax} == server tax ${o1.taxTotal}`);
  try {
  const o1b = await api.orders.create({ type: "DINE_IN", tableId: free.id, guestCount: 2, clientKey: key, items: [line(a, 2, "L1"), line(b, 1, "L2")] });
  assert(o1b.id === o1.id, "clientKey idempotent");
  const seated = (await api.tables.list()).find((t) => t.id === free.id)!;
  assert(seated.status === "OCCUPIED" && seated.orderId === o1.id, "table seated by order");
  const l1 = o1.items.find((i) => i.clientLineId === "L1")!;
  const kot = await api.orders.sendKot(o1.id, [l1.id]);
  assert(kot.kotNo && kot.itemIds.includes(l1.id), "KOT created with itemIds");
  const o2 = await api.orders.get(o1.id);
  assert(o2.items.find((i) => i.id === l1.id)?.kotId === kot.id && !o2.items.find((i) => i.clientLineId === "L2")?.kotId, "only sent line has kotId");
  // KDS feed + status machine
  const feed = await api.kots.list({ status: "PENDING" });
  assert(feed.some((k) => k.id === kot.id && k.itemIds.includes(l1.id)), "KOT visible in KDS feed with itemIds");
  const prep = await api.kots.setStatus(kot.id, "PREPARING"); assert(prep.status === "PREPARING", "KOT -> PREPARING");
  let badKot = false; try { await api.kots.setStatus(kot.id, "SERVED"); } catch { badKot = true; } assert(badKot, "KOT skip to SERVED rejected");
  assert((await api.kots.setStatus(kot.id, "READY")).status === "READY", "KOT -> READY");
  // full-list replace: keep L1 unchanged, change L2 qty, add L3
  const keep = { itemId: l1.itemId, qty: l1.qty, variantId: o2.items.find((i) => i.id === l1.id)!.variantId ?? null, modifierIds: req(a), clientLineId: l1.id };
  const o3 = await api.orders.replaceItems(o1.id, [keep, { ...line(b, 3, "L2") }, { ...line(a, 1, "L3") }], o2.version);
  assert(o3.items.length === 3 && o3.items.find((i) => i.clientLineId === "L2")?.qty === 3 && o3.items.find((i) => i.id === l1.id)?.kotId === kot.id, "replace keeps sent line, edits unsent");
  let immut = false; try { await api.orders.replaceItems(o1.id, [{ ...keep, qty: keep.qty + 1 }], o3.version); } catch { immut = true; } assert(immut, "sent line qty change rejected (422)");
  let stale = false; try { await api.orders.replaceItems(o1.id, [keep], o2.version); } catch { stale = true; } assert(stale, "stale order version rejected (409)");

  // BILLING (T-103 @ 746488d): 10% discount + ₹50 tip, split 2 ways → finalize → pay (UPI, then cash w/ change) → SETTLED → table FREE → receipt
  const disc = Math.round(o3.subtotal * 0.1);
  const b1 = await api.billing.create({ orderId: o1.id, discount: disc, tip: 5000, splitOf: { index: 0, count: 2 }, clientKey: `${key}:b1` });
  assert(b1.status === "DRAFT" && b1.total % 100 === 0 && (b1.cgst ?? 0) + (b1.sgst ?? 0) === b1.taxTotal, "bill draft, rupee-rounded, cgst+sgst=tax");
  assert(b1.taxTotal === (b1.lines ?? []).reduce((s, l) => s + l.cgst + l.sgst, 0), "bill tax = Σ per-line");
  let payDraft = false; try { await api.billing.pay(b1.id, { mode: "CASH", amount: b1.total, idempotencyKey: `${key}:p0` }); } catch { payDraft = true; } assert(payDraft, "pay before finalize rejected (409)");
  const f1 = await api.billing.finalize(b1.id, b1.version);
  assert(f1.status === "FINAL" && !!f1.businessDate, "finalized w/ businessDate");
  assert((await api.tables.list()).find((t) => t.id === free.id)!.status === "BILLED", "table BILLED after finalize");
  let over = false; try { await api.billing.pay(f1.id, { mode: "UPI", amount: f1.total + 100, reference: "UTR1", idempotencyKey: `${key}:px` }); } catch { over = true; } assert(over, "amount > due rejected (422)");
  const p1 = await api.billing.pay(f1.id, { mode: "UPI", amount: f1.total, reference: "UTR12345", idempotencyKey: `${key}:p1` });
  const p1b = await api.billing.pay(f1.id, { mode: "UPI", amount: f1.total, reference: "UTR12345", idempotencyKey: `${key}:p1` });
  assert(p1.id === p1b.id, "payment idempotent");
  assert((await api.billing.get(f1.id)).status === "SETTLED", "share 1 SETTLED");
  const b2 = await api.billing.create({ orderId: o1.id, discount: disc, tip: 5000, splitOf: { index: 1, count: 2 }, clientKey: `${key}:b2` });
  assert(b1.subtotal + b2.subtotal === o3.subtotal && b1.tip + b2.tip === 5000 && b1.discount + b2.discount === disc, "split shares sum exactly");
  const f2 = await api.billing.finalize(b2.id, b2.version);
  const p2 = await api.billing.pay(f2.id, { mode: "CASH", amount: f2.total, tendered: f2.total + 5000, idempotencyKey: `${key}:p2` });
  assert(p2.change === 5000, `cash change 5000 (got ${p2.change})`);
  assert((await api.orders.get(o1.id)).status === "SETTLED", "order SETTLED after all shares");
  assert((await api.tables.list()).find((t) => t.id === free.id)!.status === "FREE", "table FREE after settlement");
  const rc = await api.billing.receipt(f2.id);
  assert(rc.bill.billNo === f2.billNo && rc.totals.total === f2.total && rc.totals.due === 0 && rc.taxSummary.length > 0 && rc.payments[0].mode === "CASH", "receipt shape");
  ordersNote = `${o1.orderNo} on ${free.name}: client==server ₹${o1.subtotal / 100} → KOT ${kot.kotNo} PENDING→PREPARING→READY → replace(3) → 422/409 → bills ${f1.billNo}+${f2.billNo} (UPI, cash change ₹50) → SETTLED, table FREE, receipt OK`;
  } finally {
    // never leave a seeded table occupied by a smoke order (settled orders free the table themselves)
    const o = await api.orders.get(o1.id); if (o.status === "OPEN" || o.status === "BILLED") await api.orders.cancel(o1.id, "smoke cleanup", o.version).catch(() => {});
  }
}
console.log("real API smoke OK:", { outlet: `${cur.code} ${cur.id.slice(0, 8)}`, categories: cats.length, items: after.length, created: created.name, floor, orders: ordersNote });
