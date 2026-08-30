// Smoke against the RUNNING API (phase1-backend): login → categories → items → create/edit/delete an item with variants + add-ons.
// Run: pnpm --filter @billbistro/sdk smoke:real   (needs `pnpm api:dev` + seeded db; demo creds from Jim's seed)
import { createClient } from "./client";
import { createRealApi } from "./real";
import { allOptions } from "./types";

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

// Floor (T-101) — needs an outlet id (no outlets endpoint yet): OUTLET_ID=<uuid> pnpm --filter @billbistro/sdk smoke:real
let floor = "skipped (set OUTLET_ID)";
if (process.env.OUTLET_ID) {
  const fapi = createRealApi({ client: createClient({ fetch: jarFetch }), outletId: process.env.OUTLET_ID });
  const tables = await fapi.tables.list();
  assert(tables.length > 0 && tables[0].section && tables[0].name, "floor tables flattened");
  const free = tables.find((t) => t.status === "FREE")!;
  const occ = await fapi.tables.setStatus(free.id, "OCCUPIED", free.version);
  assert(occ.status === "OCCUPIED" && occ.version === (free.version ?? 0) + 1, "status transition + version bump");
  let illegal = false; try { await fapi.tables.setStatus(free.id, "RESERVED", occ.version); } catch { illegal = true; } assert(illegal, "illegal transition rejected (422)");
  let stale = false; try { await fapi.tables.setStatus(free.id, "FREE", free.version); } catch { stale = true; } assert(stale, "stale version rejected (409)");
  await fapi.tables.setStatus(free.id, "FREE", occ.version);
  const eff = await fapi.menu.items();
  assert(eff.every((i) => typeof i.effectivePrice === "number"), "effective menu carries effectivePrice");
  floor = `${tables.length} tables in ${new Set(tables.map((t) => t.section)).size} sections; effective menu ${eff.length} items`;
}
console.log("real API smoke OK:", { categories: cats.length, items: after.length, created: created.name, floor });
