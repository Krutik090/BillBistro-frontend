// Real PosApi over Jim's NestJS API (phase1-backend, /v1). Endpoints that don't exist yet throw
// NotImplementedError so hybrid mode can route them to the mock until T-101/T-102/T-103 land.
import type { MenuCategory, MenuItem, ModifierGroup, PosApi, EffectiveMenu, ItemInput, Principal, FloorView, TableInfo, Outlet, KotTicket, SalesReport, ItemSalesReport, TaxReport, InventoryItem, InventoryItemInput, StockMovement, RecipeLine } from "./types";
import { createClient, type ApiClient } from "./client";

export class NotImplementedError extends Error { constructor(what: string) { super(`${what} is not available on the API yet`); } }

export interface RealApiOptions { client?: ApiClient; /** When set, POS reads GET /menu/outlets/:id/effective (schedules + outlet prices applied). */ outletId?: string | null }

const ADDONS = "Add-ons";
/** API kot rows carry items[]; derive itemIds + flatten order/table context. */
const normKot = (k: KotTicket & { items?: { id: string }[]; order?: { orderNo?: string; tableRef?: string | null; table?: { code?: string } } }): KotTicket =>
  ({ ...k, itemIds: k.itemIds ?? k.items?.map((i) => i.id) ?? [], orderNo: k.orderNo ?? k.order?.orderNo, tableRef: k.tableRef ?? k.order?.tableRef ?? k.order?.table?.code ?? null });
const tableInfo = (s: { id: string; name: string }) => (t: FloorView["sections"][number]["tables"][number]): TableInfo =>
  ({ id: t.id, sectionId: s.id, section: s.name, name: t.code, seats: t.capacity, status: t.status, statusSince: t.statusSince ?? null, orderId: t.currentOrderId ?? null, posX: t.posX ?? null, posY: t.posY ?? null, version: t.version });

export function createRealApi(opts: RealApiOptions = {}): PosApi {
  const c = opts.client ?? createClient();
  const pinned = opts.outletId ?? (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_OUTLET_ID : undefined) ?? null;

  // Outlet resolution: pinned id, else first active outlet from GET /v1/outlets (cached per api instance).
  let outletP: Promise<Outlet> | null = null;
  const currentOutlet = () => (outletP ??= (async () => {
    const list = await c.get<Outlet[]>("/outlets");
    const o = pinned ? list.find((x) => x.id === pinned) : list.find((x) => x.isActive) ?? list[0];
    if (!o) throw new Error(pinned ? `Outlet ${pinned} not found` : "No outlets configured for this tenant");
    return o;
  })().catch((e) => { outletP = null; throw e; }));
  const outlet = async () => (await currentOutlet()).id;

  const getItem = async (id: string) => c.get<MenuItem>(`/menu/items/${id}?outletId=${await outlet()}`);

  /** Diff-sync variants + the item's "Add-ons" modifier group against the flat editor input. */
  async function syncNested(id: string, input: Partial<ItemInput>) {
    const cur = await getItem(id);
    if (input.variants) {
      const keep = new Set(input.variants.filter((v) => v.id).map((v) => v.id));
      for (const v of cur.variants) if (!keep.has(v.id)) await c.del(`/menu/variants/${v.id}`);
      for (const v of input.variants) {
        const body = { name: v.name, priceDelta: v.priceDelta, isDefault: v.isDefault };
        if (v.id) { const prev = cur.variants.find((x) => x.id === v.id); if (!prev || prev.name !== v.name || prev.priceDelta !== v.priceDelta || (v.isDefault !== undefined && prev.isDefault !== v.isDefault)) await c.patch(`/menu/variants/${v.id}`, body); }
        else await c.post(`/menu/items/${id}/variants`, body);
      }
    }
    if (input.modifiers) {
      let group: ModifierGroup | undefined = cur.modifierGroups.find((g) => g.name === ADDONS) ?? cur.modifierGroups[0];
      if (input.modifiers.length && !group) {
        group = await c.post<ModifierGroup>("/menu/modifier-groups", { name: ADDONS, minSelect: 0, maxSelect: Math.max(1, input.modifiers.length) });
        group.options = [];
        await c.put(`/menu/items/${id}/modifier-groups`, { groupIds: [...cur.modifierGroups.map((g) => g.id), group.id] });
      }
      if (group) {
        const keep = new Set(input.modifiers.filter((m) => m.id).map((m) => m.id));
        for (const o of group.options) if (!keep.has(o.id)) await c.del(`/menu/modifier-options/${o.id}`);
        for (const m of input.modifiers) {
          if (m.id) { const prev = group.options.find((x) => x.id === m.id); if (!prev || prev.name !== m.name || prev.price !== m.price) await c.patch(`/menu/modifier-options/${m.id}`, { name: m.name, price: m.price }); }
          else await c.post(`/menu/modifier-groups/${group.id}/options`, { name: m.name, price: m.price });
        }
        if (input.modifiers.length > group.maxSelect) await c.patch(`/menu/modifier-groups/${group.id}`, { maxSelect: input.modifiers.length });
      }
    }
    return getItem(id);
  }
  const scalars = ({ variants, modifiers, modifierGroupIds, sku, description, station, ...rest }: Partial<ItemInput>) => ({ ...rest, sku: sku ?? undefined, description: description ?? undefined, station: station ?? undefined });

  return {
    mode: "real",
    auth: {
      login: async (input) => (await c.post<{ user: Principal }>("/auth/login", input)).user,
      signup: async (input) => (await c.post<{ user: Principal }>("/auth/signup", input)).user,
      me: () => c.get("/auth/me"),
      logout: async () => { await c.post("/auth/logout"); },
    },
    outlets: { list: () => c.get<Outlet[]>("/outlets"), current: currentOutlet },
    menu: {
      categories: () => c.get<MenuCategory[]>("/menu/categories?includeInactive=true"),
      /** Admin list (all items, outlet pricing applied). POS uses menu.effective(). */
      items: async () => c.get<MenuItem[]>(`/menu/items?includeUnavailable=true&outletId=${await outlet()}`),
      effective: async () => { const eff = await c.get<EffectiveMenu>(`/menu/outlets/${await outlet()}/effective`); return eff.categories.flatMap((cat) => cat.items); },
      createCategory: (input) => c.post("/menu/categories", input),
      updateCategory: (id, input) => c.patch(`/menu/categories/${id}`, input),
      deleteCategory: async (id) => { await c.del(`/menu/categories/${id}`); },
      // POST /menu/items accepts nested variants[] + inline modifiers[] + modifierGroupIds[] (Jim 4059c8b) — one round-trip.
      createItem: async (input) => {
        const created = await c.post<MenuItem>("/menu/items", { ...scalars(input), variants: input.variants?.map(({ id: _i, ...v }) => v), modifiers: input.modifiers?.map(({ id: _i, ...m }) => m), modifierGroupIds: input.modifierGroupIds });
        return getItem(created.id);
      },
      updateItem: async (id, input) => { const s = scalars(input); if (Object.keys(s).length) await c.patch(`/menu/items/${id}`, s); return syncNested(id, input); },
      deleteItem: async (id) => { await c.del(`/menu/items/${id}`); },
    },
    tables: {
      list: async () => {
        const floor = await c.get<FloorView>(`/floor/outlets/${await outlet()}`);
        return floor.sections.flatMap((s) => s.tables.map(tableInfo(s)));
      },
      setStatus: async (id, status, version) => {
        const t = await c.post<FloorView["sections"][number]["tables"][number] & { sectionId: string; section?: { name: string } }>(`/floor/tables/${id}/status`, { status, version });
        return tableInfo({ id: t.sectionId, name: t.section?.name ?? "" })(t);
      },
    },
    orders: {
      // T-102 @ 23e4f71: server re-prices every line and validates variant/modifier groups (422); clientKey = idempotency.
      create: async (input) => c.post("/orders", { ...input, outletId: input.outletId ?? (input.tableId ? undefined : await outlet()), tableId: input.tableId ?? undefined, tableRef: input.tableRef ?? undefined, notes: input.notes ?? undefined }),
      get: (id) => c.get(`/orders/${id}`),
      replaceItems: (id, items, version) => c.patch(`/orders/${id}/items`, { items, version }),
      sendKot: async (orderId, orderItemIds, station) => { const k = normKot(await c.post<KotTicket>(`/orders/${orderId}/kots`, { orderItemIds, station })); return { ...k, itemIds: k.itemIds.length ? k.itemIds : orderItemIds }; },
      cancel: (id, reason, version) => c.post(`/orders/${id}/cancel`, { reason, version }),
    },
    kots: {
      list: async (f = {}) => { const q = new URLSearchParams({ outletId: await outlet(), ...(f.status ? { status: f.status } : {}), ...(f.station ? { station: f.station } : {}) }); return (await c.get<KotTicket[]>(`/kots?${q}`)).map(normKot); },
      setStatus: async (id, status) => normKot(await c.patch<KotTicket>(`/kots/${id}/status`, { status })),
      // Server-Sent Events: one KOT row per create/status-change/cancel (T-105). EventSource can't
      // send an Authorization header, so this relies on the httpOnly cookie session (withCredentials).
      subscribe: (onKot) => {
        let closed = false;
        let es: EventSource | null = null;
        void (async () => {
          const outletId = await outlet();
          if (closed) return;
          es = new EventSource(`${c.origin}/v1/kots/stream?outletId=${outletId}`, { withCredentials: true });
          es.addEventListener("kot", (e) => onKot(normKot(JSON.parse((e as MessageEvent).data))));
        })();
        return () => { closed = true; es?.close(); };
      },
    },
    billing: {
      // T-103 @ 746488d — server is the money authority (per-line tax, cgst floor/sgst rest, exact split shares).
      create: (input) => c.post("/bills", input),
      update: (id, input, version) => c.patch(`/bills/${id}`, { ...input, version }),
      finalize: (id, version) => c.post(`/bills/${id}/finalize`, { version }),
      pay: (id, input) => c.post(`/bills/${id}/payments`, input),
      refund: (paymentId, input) => c.post(`/payments/${paymentId}/refunds`, input),
      void: (id, reason) => c.post(`/bills/${id}/void`, { reason }),
      get: (id) => c.get(`/bills/${id}`),
      receipt: (id) => c.get(`/bills/${id}/receipt`),
    },
    dayClose: {
      get: async (businessDate = new Date().toISOString().slice(0, 10)) => c.get(`/day-close?outletId=${await outlet()}&businessDate=${businessDate}`),
      close: async (businessDate, note) => c.post("/day-close", { outletId: await outlet(), businessDate, note }),
    },
    reports: {
      sales: async (from, to) => c.get<SalesReport>(`/reports/sales?outletId=${await outlet()}&from=${from}&to=${to}`),
      items: async (from, to) => c.get<ItemSalesReport>(`/reports/items?outletId=${await outlet()}&from=${from}&to=${to}`),
      tax: async (from, to) => c.get<TaxReport>(`/reports/tax?outletId=${await outlet()}&from=${from}&to=${to}`),
    },
    inventory: {
      list: (lowStockOnly) => c.get<InventoryItem[]>(`/inventory/items${lowStockOnly ? "?lowStockOnly=true" : ""}`),
      create: (input) => c.post<InventoryItem>("/inventory/items", input),
      update: (id, input) => c.patch<InventoryItem>(`/inventory/items/${id}`, input),
      adjust: (id, input) => c.post<StockMovement>(`/inventory/items/${id}/adjust`, input),
      movements: (id) => c.get<StockMovement[]>(`/inventory/items/${id}/movements`),
      recipe: (menuItemId) => c.get<RecipeLine[]>(`/inventory/recipes?menuItemId=${menuItemId}`),
      setRecipe: (menuItemId, lines) => c.put<RecipeLine[]>(`/inventory/recipes/${menuItemId}`, { lines }),
    },
  };
}
