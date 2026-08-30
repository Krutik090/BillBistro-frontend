// Real PosApi over Jim's NestJS API (phase1-backend, /v1). Endpoints that don't exist yet throw
// NotImplementedError so hybrid mode can route them to the mock until T-101/T-102/T-103 land.
import type { MenuCategory, MenuItem, ModifierGroup, PosApi, EffectiveMenu, ItemInput, Principal, FloorView, TableInfo, Outlet } from "./types";
import { createClient, type ApiClient } from "./client";

export class NotImplementedError extends Error { constructor(what: string) { super(`${what} is not available on the API yet`); } }

export interface RealApiOptions { client?: ApiClient; /** When set, POS reads GET /menu/outlets/:id/effective (schedules + outlet prices applied). */ outletId?: string | null }

const ADDONS = "Add-ons";
const tableInfo = (s: { id: string; name: string }) => (t: FloorView["sections"][number]["tables"][number]): TableInfo =>
  ({ id: t.id, sectionId: s.id, section: s.name, name: t.code, seats: t.capacity, status: t.status, statusSince: t.statusSince ?? null, orderId: t.currentOrderId ?? null, posX: t.posX ?? null, posY: t.posY ?? null, version: t.version });

export function createRealApi(opts: RealApiOptions = {}): PosApi {
  const c = opts.client ?? createClient();
  const pinned = opts.outletId ?? (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_OUTLET_ID : undefined) ?? null;
  const notYet = (what: string) => async () => { throw new NotImplementedError(what); };

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
      // Contract confirmed with Jim (T-102, landing): POST /orders {type, tableRef, items[{itemId, qty, variantId?, modifierIds?, notes?, clientLineId?}], clientKey}
      create: (input) => c.post("/orders", input),
      get: (id) => c.get(`/orders/${id}`),
      replaceItems: (id, items, version) => c.patch(`/orders/${id}/items`, { items, version }),
      sendKot: (orderId, orderItemIds, station) => c.post(`/orders/${orderId}/kots`, { orderItemIds, station }),
    },
    billing: {
      create: notYet("POST /bills (T-103)"),
      pay: notYet("POST /bills/:id/payments (T-103)"),
      finalize: notYet("POST /bills/:id/finalize (T-103)"),
    },
  };
}
