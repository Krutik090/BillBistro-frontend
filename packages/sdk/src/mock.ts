// In-memory typed mock of PosApi. Same money math contract as the API (int paise, GST bps).
// Latency is simulated so optimistic UI paths are exercised.
import type { Bill, BillInput, DayClose, ItemInput, Kot, MenuCategory, MenuItem, Order, OrderInput, OrderItemInput, Outlet, Payment, PaymentInput, PosApi, Principal, Refund, TableInfo, TableStatus } from "./types";
import { allOptions, itemPrice } from "./types";

const uid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

const cat = (id: string, name: string, sortOrder: number): MenuCategory => ({ id, name, sortOrder, isActive: true });
export const MOCK_CATEGORIES: MenuCategory[] = [cat("c-starters", "Starters", 1), cat("c-mains", "Mains", 2), cat("c-breads", "Breads", 3), cat("c-rice", "Rice", 4), cat("c-drinks", "Drinks", 5), cat("c-desserts", "Desserts", 6)];

type ItemSeed = [id: string, cat: string, name: string, rupees: number, veg: boolean, variants?: [string, number][], addons?: [string, number][]];
const seeds: ItemSeed[] = [
  ["i-paneer-tikka", "c-starters", "Paneer Tikka", 320, true, [["Half", -120], ["Full", 0]], [["Extra mint chutney", 20], ["Extra spicy", 0]]],
  ["i-chicken-65", "c-starters", "Chicken 65", 360, false, [["Half", -140], ["Full", 0]], [["Extra spicy", 0]]],
  ["i-veg-manchurian", "c-starters", "Veg Manchurian", 260, true, [], [["Gravy", 20]]],
  ["i-masala-papad", "c-starters", "Masala Papad", 60, true],
  ["i-butter-chicken", "c-mains", "Butter Chicken", 420, false, [["Half", -160], ["Full", 0]], [["Extra gravy", 40], ["Boneless", 60]]],
  ["i-dal-makhani", "c-mains", "Dal Makhani", 280, true, [["Half", -100], ["Full", 0]], [["Extra butter", 20]]],
  ["i-mutton-rogan", "c-mains", "Mutton Rogan Josh", 520, false, [], [["Extra gravy", 40]]],
  ["i-garlic-naan", "c-breads", "Garlic Naan", 70, true, [], [["Extra butter", 10], ["Cheese", 40]]],
  ["i-tandoori-roti", "c-breads", "Tandoori Roti", 40, true, [], [["Butter", 10]]],
  ["i-veg-biryani", "c-rice", "Veg Biryani", 320, true, [["Half", -120], ["Full", 0]], [["Raita", 30], ["Extra gravy", 40]]],
  ["i-chicken-biryani", "c-rice", "Chicken Biryani", 380, false, [["Half", -140], ["Full", 0]], [["Raita", 30], ["Extra leg piece", 80]]],
  ["i-sweet-lassi", "c-drinks", "Sweet Lassi", 120, true, [["Regular", 0], ["Large", 40]]],
  ["i-coke", "c-drinks", "Coke", 60, true, [["300ml", 0], ["750ml", 40]]],
  ["i-gulab-jamun", "c-desserts", "Gulab Jamun", 140, true, [], [["Extra piece", 50]]],
  ["i-kulfi", "c-desserts", "Kulfi", 110, true],
];
export const MOCK_ITEMS: MenuItem[] = seeds.map(([id, categoryId, name, rupees, isVeg, variants = [], addons = []]) => ({
  id, categoryId, name, sku: id.toUpperCase(), description: null, basePrice: rupees * 100, taxRateBps: categoryId === "c-drinks" ? 1800 : 500, isVeg, isAvailable: true,
  variants: variants.map(([vn, d]) => ({ id: `${id}:v:${vn}`, itemId: id, name: vn, priceDelta: d * 100, isDefault: d === 0 })),
  modifierGroups: addons.length ? [{ id: `${id}:g`, name: "Add-ons", minSelect: 0, maxSelect: addons.length, options: addons.map(([mn, p]) => ({ id: `${id}:m:${mn}`, groupId: `${id}:g`, name: mn, price: p * 100 })) }] : [],
}));

const table = (id: string, section: string, name: string, seats: number, status: TableStatus = "FREE"): TableInfo => ({ id, sectionId: `s-${section.toLowerCase().replace(/\s+/g, "-")}`, section, name, seats, status, statusSince: now(), orderId: null, version: 1 });
export const MOCK_TABLES: TableInfo[] = [
  table("t1", "Main hall", "T1", 2), table("t2", "Main hall", "T2", 4, "OCCUPIED"), table("t3", "Main hall", "T3", 4), table("t4", "Main hall", "T4", 4),
  table("t5", "Main hall", "T5", 6, "BILLED"), table("t6", "Main hall", "T6", 2, "CLEANING"), table("t7", "Rooftop", "R1", 4, "OCCUPIED"), table("t8", "Rooftop", "R2", 4, "RESERVED"),
  table("t9", "Rooftop", "R3", 8), table("t10", "AC room", "A1", 4), table("t11", "AC room", "A2", 6, "BLOCKED"), table("t12", "AC room", "A3", 2),
];
/** Mirrors Jim's floor status machine (T-101). */
export const TABLE_TRANSITIONS: Record<TableStatus, TableStatus[]> = {
  FREE: ["OCCUPIED", "RESERVED", "BLOCKED", "CLEANING"], RESERVED: ["OCCUPIED", "FREE"], OCCUPIED: ["BILLED", "FREE", "CLEANING"],
  BILLED: ["CLEANING", "FREE"], CLEANING: ["FREE", "BLOCKED"], BLOCKED: ["FREE"],
};
const MOCK_OUTLET: Outlet = { id: "mock-outlet", code: "MAIN", name: "Spice Route · Koramangala", isActive: true };
const MOCK_PRINCIPAL: Principal ={ userId: "mock-user", tenantId: "mock-tenant", roles: ["owner"], permissions: ["menu.read", "menu.write", "orders.write", "bills.write", "payments.write"] };

/** Pure pricing — shared contract with the API (T-102): unit = price + variant + options; tax per line, half CGST/half SGST. */
export function priceLine(item: MenuItem, input: OrderItemInput) {
  const variant = item.variants.find((v) => v.id === input.variantId);
  const opts = allOptions(item).filter((o) => input.modifierIds?.includes(o.id));
  const unitPrice = itemPrice(item) + (variant?.priceDelta ?? 0) + opts.reduce((s, o) => s + o.price, 0);
  const name = opts.length ? `${item.name} (+${opts.map((o) => o.name).join(", ")})` : item.name;
  return { unitPrice, lineTotal: unitPrice * input.qty, variantName: variant?.name ?? null, name, taxRateBps: item.taxRateBps };
}

export function createMockApi(opts: { latencyMs?: number } = {}): PosApi {
  const latency = opts.latencyMs ?? 120;
  const orders = new Map<string, Order>();
  const bills = new Map<string, Bill>();
  const refunds: Refund[] = [];
  const closedDays = new Map<string, string>();
  let orderSeq = 1041, kotSeq = 17, billSeq = 1041;
  // Menu is mutable per api instance (menu management UI edits it).
  const tables: TableInfo[] = structuredClone(MOCK_TABLES);
  const categories: MenuCategory[] = structuredClone(MOCK_CATEGORIES);
  const menuItems: MenuItem[] = structuredClone(MOCK_ITEMS);
  const itemById = new Map(menuItems.map((i) => [i.id, i]));
  const applyItem = (target: MenuItem, input: Partial<ItemInput>) => {
    const { variants, modifiers, ...rest } = input;
    Object.assign(target, rest);
    if (variants) target.variants = variants.map((v) => ({ id: v.id ?? uid(), itemId: target.id, name: v.name, priceDelta: v.priceDelta, isDefault: v.isDefault }));
    if (modifiers) {
      const gid = target.modifierGroups[0]?.id ?? uid();
      target.modifierGroups = modifiers.length ? [{ id: gid, name: "Add-ons", minSelect: 0, maxSelect: modifiers.length, options: modifiers.map((m) => ({ id: m.id ?? uid(), groupId: gid, name: m.name, price: m.price })) }] : [];
    }
    return target;
  };

  const buildItems = (items: OrderItemInput[], existing: Order | null) =>
    items.map((input) => {
      const item = itemById.get(input.itemId);
      if (!item) throw new Error(`Unknown item ${input.itemId}`);
      const prev = existing?.items.find((e) => e.id === input.clientLineId);
      return { id: input.clientLineId ?? uid(), clientLineId: input.clientLineId ?? null, itemId: item.id, qty: input.qty, notes: input.notes ?? null, kotId: prev?.kotId ?? null, ...priceLine(item, input) };
    });
  const totals = (o: Order) => {
    o.subtotal = o.items.reduce((s, l) => s + l.lineTotal, 0);
    o.taxTotal = o.items.reduce((s, l) => s + Math.round((l.lineTotal * l.taxRateBps) / 10000), 0);
    o.total = o.subtotal + o.taxTotal - o.discount;
    return o;
  };

  return {
    mode: "mock",
    auth: { login: async () => (await wait(latency), MOCK_PRINCIPAL), me: async () => MOCK_PRINCIPAL, logout: async () => {} },
    outlets: { list: async () => [MOCK_OUTLET], current: async () => MOCK_OUTLET },
    menu: {
      categories: async () => (await wait(latency), structuredClone(categories)),
      items: async () => (await wait(latency), structuredClone(menuItems)),
      effective: async () => (await wait(latency), structuredClone(menuItems.filter((i) => i.isAvailable && categories.find((c) => c.id === i.categoryId)?.isActive !== false))),
      async createCategory(input) { await wait(latency); const c: MenuCategory = { id: uid(), name: input.name, sortOrder: input.sortOrder ?? categories.length + 1, isActive: input.isActive ?? true }; categories.push(c); return structuredClone(c); },
      async updateCategory(id, input) { await wait(latency); const c = categories.find((x) => x.id === id); if (!c) throw new Error("Category not found"); Object.assign(c, input); return structuredClone(c); },
      async deleteCategory(id) { await wait(latency); if (menuItems.some((i) => i.categoryId === id)) throw new Error("Move or delete its items first"); const i = categories.findIndex((x) => x.id === id); if (i >= 0) categories.splice(i, 1); },
      async createItem(input) {
        await wait(latency);
        const it = applyItem({ id: uid(), categoryId: input.categoryId, name: input.name, basePrice: input.basePrice, taxRateBps: input.taxRateBps ?? 500, isVeg: input.isVeg ?? true, isAvailable: input.isAvailable ?? true, sku: input.sku ?? null, description: input.description ?? null, variants: [], modifierGroups: [] }, input);
        menuItems.push(it); itemById.set(it.id, it); return structuredClone(it);
      },
      async updateItem(id, input) { await wait(latency); const it = itemById.get(id); if (!it) throw new Error("Item not found"); return structuredClone(applyItem(it, input)); },
      async deleteItem(id) { await wait(latency); const i = menuItems.findIndex((x) => x.id === id); if (i >= 0) menuItems.splice(i, 1); itemById.delete(id); },
    },
    tables: {
      list: async () => (await wait(latency), tables.map((t) => ({ ...t }))),
      async setStatus(id, status, version) {
        await wait(latency);
        const t = tables.find((x) => x.id === id); if (!t) throw new Error("Table not found");
        if (version !== undefined && version !== t.version) throw new Error("Stale table version (409)");
        if (!TABLE_TRANSITIONS[t.status].includes(status)) throw new Error(`Illegal transition ${t.status} → ${status} (422)`);
        t.status = status; t.statusSince = now(); t.version = (t.version ?? 1) + 1; if (status === "FREE") t.orderId = null;
        return { ...t };
      },
    },
    orders: {
      async create(input) {
        await wait(latency);
        const t = input.tableId ? tables.find((x) => x.id === input.tableId) : undefined;
        if (input.tableId && (!t || (t.status !== "FREE" && t.status !== "RESERVED"))) throw new Error("Table not free (409)");
        const o: Order = totals({ id: uid(), orderNo: `#${++orderSeq}`, type: input.type, status: "OPEN", tableId: t?.id ?? null, tableRef: input.tableRef ?? t?.name ?? null, guestCount: input.guestCount ?? null, subtotal: 0, taxTotal: 0, discount: 0, total: 0, version: 1, items: buildItems(input.items, null), kots: [], createdAt: now() });
        if (t) { t.status = "OCCUPIED"; t.orderId = o.id; t.statusSince = now(); t.version = (t.version ?? 1) + 1; }
        orders.set(o.id, o);
        return structuredClone(o);
      },
      async get(id) { await wait(latency / 2); const o = orders.get(id); if (!o) throw new Error("Order not found"); return structuredClone(o); },
      async replaceItems(id, items) {
        await wait(latency);
        const o = orders.get(id); if (!o) throw new Error("Order not found");
        o.items = buildItems(items, o); o.version++; totals(o);
        return structuredClone(o);
      },
      async cancel(id, reason, version) {
        await wait(latency);
        const o = orders.get(id); if (!o) throw new Error("Order not found");
        if (version !== undefined && version !== o.version) throw new Error("Stale order version (409)");
        o.status = "CANCELLED"; o.version++; for (const k of o.kots) if (k.status === "PENDING" || k.status === "PREPARING") k.status = "CANCELLED";
        const t = tables.find((x) => x.id === o.tableId); if (t) { t.status = "FREE"; t.orderId = null; t.version = (t.version ?? 1) + 1; }
        void reason; return structuredClone(o);
      },
      async sendKot(orderId, orderItemIds, station) {
        await wait(latency * 2);
        const o = orders.get(orderId); if (!o) throw new Error("Order not found");
        const kot: Kot = { id: uid(), orderId, kotNo: `K-${++kotSeq}`, status: "PENDING", station: station ?? null, itemIds: orderItemIds, createdAt: now() };
        for (const l of o.items) if (orderItemIds.includes(l.id)) l.kotId = kot.id;
        o.kots.push(kot); o.version++;
        return structuredClone(kot);
      },
    },
    kots: {
      list: async (f = {}) => { await wait(latency / 2); return [...orders.values()].flatMap((o) => o.kots.filter((k) => (!f.status || k.status === f.status) && (!f.station || k.station === f.station)).map((k) => ({ ...k, orderNo: o.orderNo, tableRef: o.tableRef, items: o.items.filter((i) => k.itemIds.includes(i.id)).map((i) => ({ id: i.id, name: i.name, qty: i.qty, variantName: i.variantName, notes: i.notes })) }))); },
      async setStatus(id, status) {
        await wait(latency / 2);
        const legal: Record<string, string[]> = { PENDING: ["PREPARING", "CANCELLED"], PREPARING: ["READY", "CANCELLED"], READY: ["SERVED", "PREPARING"], SERVED: [], CANCELLED: [] };
        for (const o of orders.values()) { const k = o.kots.find((x) => x.id === id); if (k) { if (!legal[k.status].includes(status)) throw new Error(`Illegal KOT transition ${k.status} → ${status} (422)`); k.status = status; return { ...k, orderNo: o.orderNo, tableRef: o.tableRef }; } }
        throw new Error("KOT not found");
      },
    },
    dayClose: {
      async get(businessDate) {
        await wait(latency / 2);
        const date = businessDate ?? now().slice(0, 10);
        const day = [...bills.values()].filter((b) => (b.businessDate ?? b.createdAt?.slice(0, 10)) === date && b.status !== "DRAFT");
        const settled = day.filter((b) => b.status !== "VOID");
        const sum = (f: (b: Bill) => number) => settled.reduce((s, b) => s + f(b), 0);
        const byMode: DayClose["totals"]["byMode"] = {};
        for (const b of settled) for (const p of b.payments) { const m = (byMode[p.mode] ??= { collected: 0, refunded: 0, count: 0 }); m.collected += p.amount; m.count++; m.refunded += refunds.filter((r) => r.paymentId === p.id).reduce((s, r) => s + r.amount, 0); }
        const collected = sum((b) => b.paidTotal ?? 0), refunded = sum((b) => b.refundTotal ?? 0);
        return { status: closedDays.has(date) ? "CLOSED" : "OPEN", businessDate: date, closedAt: closedDays.get(date) ?? null, totals: { bills: settled.length, orders: new Set(settled.map((b) => b.orderId)).size, grossSales: sum((b) => b.subtotal), discounts: sum((b) => b.discount), taxableSales: sum((b) => b.taxable ?? 0), cgst: sum((b) => b.cgst ?? 0), sgst: sum((b) => b.sgst ?? 0), taxTotal: sum((b) => b.taxTotal), tips: sum((b) => b.tip), roundOff: sum((b) => b.roundOff), netSales: sum((b) => b.total), collected, refunded, byMode, voids: day.length - settled.length, cashExpected: (byMode.CASH?.collected ?? 0) - (byMode.CASH?.refunded ?? 0) } };
      },
      async close(businessDate, note) {
        await wait(latency);
        if ([...bills.values()].some((b) => b.status === "FINAL" && (b.businessDate ?? "") === businessDate)) throw new Error("Unpaid FINAL bills exist (409)");
        closedDays.set(businessDate, now()); void note;
        return this.get(businessDate);
      },
    },
    billing: {
      async create(input) {
        await wait(latency);
        const o = orders.get(input.orderId); if (!o) throw new Error("Order not found");
        const discount = Math.min(input.discount ?? 0, o.subtotal);
        // Split shares: round(x/count) per component; the LAST share absorbs the paise remainder so shares sum exactly (spec + server).
        const { index, count } = input.splitOf ?? { index: 0, count: 1 };
        const shareOf = (x: number) => (index < count - 1 ? Math.round(x / count) : x - Math.round(x / count) * (count - 1));
        const subtotal = shareOf(o.subtotal);
        const disc = shareOf(discount);
        const taxable = subtotal - disc;
        // Spec + server: tax is rounded PER LINE — Σ round(lineShare * (1 - discount/subtotal) * bps / 10000) — never once over the sum.
        const factor = 1 - discount / Math.max(o.subtotal, 1);
        const taxTotal = o.items.reduce((s, l) => s + Math.round((shareOf(l.lineTotal) * factor * l.taxRateBps) / 10000), 0);
        const tip = shareOf(input.tip ?? 0);
        const raw = taxable + taxTotal + tip;
        const total = Math.round(raw / 100) * 100;
        if ([...bills.values()].some((x) => x.orderId === o.id && x.status !== "VOID" && (x.splitIndex ?? 0) === index && (x.splitCount ?? 1) === count)) throw new Error("Bill already exists for this order/share (409)");
        const cgst = Math.floor(taxTotal / 2);
        const b: Bill = { id: uid(), orderId: o.id, billNo: `B-${++billSeq}${input.splitOf ? `/${input.splitOf.index + 1}` : ""}`, status: "DRAFT", splitIndex: index, splitCount: count, subtotal, discount: disc, taxable, cgst, sgst: taxTotal - cgst, taxTotal, tip, roundOff: total - raw, total, paidTotal: 0, refundTotal: 0, due: total, version: 1, payments: [],
          lines: o.items.map((l) => { const ls = shareOf(l.lineTotal); const ld = Math.round(ls * (1 - factor)); const tx = Math.round(ls * factor * l.taxRateBps / 10000); return { name: l.name, qty: l.qty, unitPrice: l.unitPrice, lineTotal: ls, discount: ld, taxable: ls - ld, taxRateBps: l.taxRateBps, cgst: Math.floor(tx / 2), sgst: tx - Math.floor(tx / 2) }; }),
          order: { orderNo: o.orderNo, status: o.status, tableRef: o.tableRef }, createdAt: now() };
        bills.set(b.id, b); o.discount = discount;
        return structuredClone(b);
      },
      async finalize(billId, version) {
        await wait(latency);
        const b = bills.get(billId); if (!b) throw new Error("Bill not found");
        if (version !== undefined && version !== b.version) throw new Error("Stale bill version (409)");
        if (b.status !== "DRAFT") throw new Error(`Bill is ${b.status} (409)`);
        b.status = "FINAL"; b.finalizedAt = now(); b.businessDate = now().slice(0, 10); b.version = (b.version ?? 1) + 1;
        const o = orders.get(b.orderId); if (o) { o.status = "BILLED"; const t = tables.find((x) => x.id === o.tableId); if (t) t.status = "BILLED"; }
        return structuredClone(b);
      },
      async pay(billId, input) {
        await wait(latency * 3);
        const b = bills.get(billId); if (!b) throw new Error("Bill not found");
        const dup = b.payments.find((p) => p.id === input.idempotencyKey); if (dup) return structuredClone(dup);
        if (b.status !== "FINAL") throw new Error(`Bill must be FINAL to take payment (409, is ${b.status})`);
        if (input.mode !== "CASH" && !input.reference) throw new Error("Reference required for non-cash payments (422)");
        if (input.amount > (b.due ?? 0)) throw new Error(`Amount exceeds due ${b.due} (422)`);
        const change = input.mode === "CASH" && input.tendered ? Math.max(0, input.tendered - input.amount) : 0;
        b.paidTotal = (b.paidTotal ?? 0) + input.amount; b.due = b.total - b.paidTotal;
        const p: Payment = { id: input.idempotencyKey, billId, mode: input.mode, status: "CAPTURED", amount: input.amount, tendered: input.tendered ?? null, change, due: b.due, reference: input.reference ?? null, createdAt: now() };
        b.payments.push(p);
        if (b.due <= 0) {
          b.status = "SETTLED";
          const o = orders.get(b.orderId);
          const shares = [...bills.values()].filter((x) => x.orderId === b.orderId && x.status !== "VOID");
          if (o && shares.length >= (b.splitCount ?? 1) && shares.every((x) => x.status === "SETTLED")) { o.status = "SETTLED"; const t = tables.find((x) => x.id === o.tableId); if (t) { t.status = "FREE"; t.orderId = null; } }
        }
        return structuredClone(p);
      },
      async get(billId) { await wait(latency / 2); const b = bills.get(billId); if (!b) throw new Error("Bill not found"); return structuredClone(b); },
      async update(billId, input, version) {
        await wait(latency);
        const b = bills.get(billId); if (!b) throw new Error("Bill not found");
        if (b.status !== "DRAFT") throw new Error("Only DRAFT bills can change (409)");
        if (version !== undefined && version !== b.version) throw new Error("Stale bill version (409)");
        const o = orders.get(b.orderId)!; bills.delete(billId);
        const fresh = await this.create({ orderId: o.id, discount: input.discount ?? b.discount * (b.splitCount ?? 1), tip: input.tip ?? b.tip * (b.splitCount ?? 1), splitOf: (b.splitCount ?? 1) > 1 ? { index: b.splitIndex ?? 0, count: b.splitCount! } : undefined });
        bills.delete(fresh.id); const kept = { ...fresh, id: b.id, billNo: b.billNo, version: (b.version ?? 1) + 1 }; bills.set(b.id, kept); return structuredClone(kept);
      },
      async refund(paymentId, input) {
        await wait(latency);
        for (const b of bills.values()) { const p = b.payments.find((x) => x.id === paymentId); if (!p) continue;
          const dup = refunds.find((r) => r.id === input.idempotencyKey); if (dup) return structuredClone(dup);
          const refundable = p.amount - refunds.filter((r) => r.paymentId === paymentId).reduce((s, r) => s + r.amount, 0);
          if (input.amount > refundable) throw new Error(`Refund exceeds refundable ${refundable} (422)`);
          const r: Refund = { id: input.idempotencyKey, paymentId, amount: input.amount, reason: input.reason, reference: input.reference ?? null, createdAt: now() };
          refunds.push(r); b.refundTotal = (b.refundTotal ?? 0) + input.amount; return structuredClone(r); }
        throw new Error("Payment not found");
      },
      async void(billId, reason) {
        await wait(latency);
        const b = bills.get(billId); if (!b) throw new Error("Bill not found");
        if ((b.paidTotal ?? 0) - (b.refundTotal ?? 0) !== 0) throw new Error("Refund payments before voiding (409)");
        b.status = "VOID"; b.version = (b.version ?? 1) + 1; void reason;
        const o = orders.get(b.orderId); if (o) { o.status = "OPEN"; const t = tables.find((x) => x.id === o.tableId); if (t) { t.status = "OCCUPIED"; t.orderId = o.id; } }
        return structuredClone(b);
      },
      async receipt(billId) {
        await wait(latency / 2);
        const b = bills.get(billId); if (!b) throw new Error("Bill not found");
        const byRate = new Map<number, { taxable: number; cgst: number; sgst: number }>();
        for (const l of b.lines ?? []) { const r = byRate.get(l.taxRateBps) ?? { taxable: 0, cgst: 0, sgst: 0 }; r.taxable += l.taxable; r.cgst += l.cgst; r.sgst += l.sgst; byRate.set(l.taxRateBps, r); }
        return {
          business: { name: "Spice Route", gstin: "29ABCDE1234F1Z5" }, outlet: { name: "Koramangala", address: "12, 80ft Road, Koramangala, Bengaluru 560034", phone: "+91 98450 12345" },
          bill: { billNo: b.billNo, date: b.finalizedAt ?? b.createdAt ?? now(), orderNo: b.order?.orderNo, table: b.order?.tableRef ?? null, cashier: "Priya", split: (b.splitCount ?? 1) > 1 ? `${(b.splitIndex ?? 0) + 1}/${b.splitCount}` : null },
          lines: b.lines ?? [], totals: { subtotal: b.subtotal, discount: b.discount, taxable: b.taxable ?? 0, cgst: b.cgst ?? 0, sgst: b.sgst ?? 0, taxTotal: b.taxTotal, tip: b.tip, roundOff: b.roundOff, total: b.total, paid: b.paidTotal ?? 0, refunded: b.refundTotal ?? 0, due: b.due ?? 0 },
          taxSummary: [...byRate].map(([taxRateBps, r]) => ({ taxRateBps, ...r })), payments: b.payments.map((p) => ({ mode: p.mode, amount: p.amount, tendered: p.tendered, change: p.change, reference: p.reference })), footer: "Thank you! Visit again.",
        };
      },
    },
  };
}
