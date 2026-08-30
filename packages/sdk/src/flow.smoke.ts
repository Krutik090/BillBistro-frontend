// Smoke: end-to-end POS flow on the mock API. Run: pnpm --filter @billbistro/sdk smoke
import { createMockApi, priceLine, allOptions } from "./index";

const api = createMockApi({ latencyMs: 0 });
const assert = (c: unknown, m: string) => { if (!c) throw new Error(`FAIL ${m}`); };

const items = await api.menu.items();
const bc = items.find((i) => i.id === "i-butter-chicken")!;
const naan = items.find((i) => i.id === "i-garlic-naan")!;
const lassi = items.find((i) => i.id === "i-sweet-lassi")!;

// pricing: Butter Chicken Half (-160) + Extra gravy (+40) = 300
const half = bc.variants.find((v) => v.name === "Half")!.id, gravy = allOptions(bc).find((m) => m.name === "Extra gravy")!.id;
assert(priceLine(bc, { itemId: bc.id, qty: 2, variantId: half, modifierIds: [gravy] }).lineTotal === 60000, "variant+modifier pricing");

const order = await api.orders.create({ type: "DINE_IN", tableRef: "T4", items: [
  { itemId: bc.id, qty: 2, variantId: half, modifierIds: [gravy], clientLineId: "L1" },
  { itemId: naan.id, qty: 3, clientLineId: "L2" },
  { itemId: lassi.id, qty: 2, variantId: lassi.variants.find((v) => v.name === "Large")!.id, clientLineId: "L3" },
] });
assert(order.subtotal === 60000 + 21000 + 32000, `subtotal ${order.subtotal}`);
assert(order.taxTotal === 4050 + 5760, `tax ${order.taxTotal}`); // 5% on 81000, 18% on 32000
assert(order.items.every((i) => ["L1", "L2", "L3"].includes(i.id)), "server echoes clientLineId");

const kot = await api.orders.sendKot(order.id, ["L1", "L2"]);
const o2 = await api.orders.get(order.id);
assert(o2.items.filter((i) => i.kotId === kot.id).length === 2 && !o2.items[2].kotId, "KOT marks only sent lines");

const o3 = await api.orders.replaceItems(order.id, [...o2.items.map((i) => ({ itemId: i.itemId, qty: i.qty, clientLineId: i.id, variantId: i.id === "L1" ? half : i.id === "L3" ? lassi.variants[1].id : null, modifierIds: i.id === "L1" ? [gravy] : [] })), { itemId: naan.id, qty: 1, clientLineId: "L4" }]);
assert(o3.items.find((i) => i.id === "L1")!.kotId === kot.id, "KOT survives replaceItems");

// menu admin: edit item add-ons + variants, then price with the new option
const edited = await api.menu.updateItem(naan.id, { modifiers: [{ id: allOptions(naan)[0].id, name: "Extra butter", price: 1500 }, { name: "Garlic overload", price: 2000 }], variants: [{ name: "Double", priceDelta: 5000 }] });
assert(allOptions(edited).length === 2 && edited.modifierGroups[0].maxSelect === 2 && edited.variants.length === 1, "menu admin diff applied");

// 10% discount + ₹50 tip → bill, split 2 ways. Flow: create (DRAFT) → finalize (FINAL) → pay → SETTLED
const bill1 = await api.billing.create({ orderId: order.id, discount: Math.round(o3.subtotal * 0.1), tip: 5000, splitOf: { index: 0, count: 2 } });
assert(bill1.total % 100 === 0 && Math.abs(bill1.roundOff) < 100, "bill rounded to rupee");
assert(bill1.cgst! + bill1.sgst! === bill1.taxTotal && bill1.cgst === Math.floor(bill1.taxTotal / 2), "cgst floor / sgst rest");
let threw = false; try { await api.billing.pay(bill1.id, { mode: "CASH", amount: bill1.total, idempotencyKey: "k0" }); } catch { threw = true; } assert(threw, "cannot pay a DRAFT bill (409)");
const fin1 = await api.billing.finalize(bill1.id, bill1.version);
assert(fin1.status === "FINAL" && !!fin1.businessDate, "bill finalized");
threw = false; try { await api.billing.pay(fin1.id, { mode: "UPI", amount: fin1.total, idempotencyKey: "k1" }); } catch { threw = true; } assert(threw, "UPI needs reference");
threw = false; try { await api.billing.pay(fin1.id, { mode: "CASH", amount: fin1.total + 100, idempotencyKey: "k1x" }); } catch { threw = true; } assert(threw, "amount > due rejected (422)");
const p1 = await api.billing.pay(fin1.id, { mode: "UPI", amount: fin1.total, reference: "UTR1234", idempotencyKey: "k1" });
const p1b = await api.billing.pay(fin1.id, { mode: "UPI", amount: fin1.total, reference: "UTR1234", idempotencyKey: "k1" });
assert(p1.id === p1b.id && p1.due === 0, "idempotent payment, due 0");
assert((await api.billing.get(fin1.id)).status === "SETTLED", "share 1 settled");
assert((await api.orders.get(order.id)).status !== "SETTLED", "order not settled until all shares paid");
const bill2 = await api.billing.create({ orderId: order.id, discount: Math.round(o3.subtotal * 0.1), tip: 5000, splitOf: { index: 1, count: 2 } });
assert(bill1.subtotal + bill2.subtotal === o3.subtotal && bill1.tip + bill2.tip === 5000, "split shares sum exactly");
const fin2 = await api.billing.finalize(bill2.id);
const p2 = await api.billing.pay(fin2.id, { mode: "CASH", amount: fin2.total, tendered: fin2.total + 5000, idempotencyKey: "k2" });
assert(p2.change === 5000, "cash change computed");
assert((await api.orders.get(order.id)).status === "SETTLED", "order settled after all shares paid");
const rc = await api.billing.receipt(fin2.id);
assert(rc.bill.billNo === fin2.billNo && rc.totals.total === fin2.total && rc.taxSummary.length > 0 && rc.payments[0].mode === "CASH", "receipt shape");
const rf = await api.billing.refund(p2.id, { amount: 1000, reason: "test", idempotencyKey: "r1" });
assert(rf.amount === 1000 && (await api.billing.get(fin2.id)).refundTotal === 1000, "refund");
let vp = false; try { await api.billing.void(fin2.id, "x"); } catch { vp = true; } assert(vp, "void paid bill rejected");
const z = await api.dayClose.get();
assert(z.totals.bills === 2 && z.totals.refunded === 1000 && z.totals.cashExpected === fin2.total - 1000 && z.totals.byMode.UPI.collected === fin1.total, "Z-report totals");
const zc = await api.dayClose.close(z.businessDate!);
assert(zc.status === "CLOSED", "day closed");

console.log("mock flow OK:", { orderNo: order.orderNo, subtotal: o3.subtotal, tax: o3.taxTotal, share: bill1.total, bills: [fin1.billNo, fin2.billNo] });
