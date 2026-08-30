// Domain types mirroring prisma/schema.prisma + apps/api (phase1-backend) response shapes. Money = integer paise.
export type Money = number;

export interface MenuCategory { id: string; name: string; description?: string | null; sortOrder: number; isActive: boolean; scheduleId?: string | null }
export interface MenuVariant { id: string; itemId?: string; name: string; priceDelta: Money; isDefault?: boolean; isAvailable?: boolean; sortOrder?: number }
export interface ModifierOption { id: string; groupId?: string; name: string; price: Money; isDefault?: boolean; isAvailable?: boolean; sortOrder?: number }
export interface ModifierGroup { id: string; name: string; minSelect: number; maxSelect: number; options: ModifierOption[] }
export interface MenuItem {
  id: string; categoryId: string; sku?: string | null; name: string; description?: string | null;
  basePrice: Money; effectivePrice?: Money; taxRateBps: number; hsnCode?: string | null; isVeg: boolean; isAvailable: boolean; station?: string | null; sortOrder?: number;
  variants: MenuVariant[]; modifierGroups: ModifierGroup[];
}
/** Price the POS charges before variants/options (outlet override applied by the API when present). */
export const itemPrice = (i: MenuItem) => i.effectivePrice ?? i.basePrice;
export const allOptions = (i: MenuItem) => i.modifierGroups.flatMap((g) => g.options);

export interface EffectiveMenu { outlet: { id: string; code: string; name: string }; generatedAt: string; categories: (MenuCategory & { items: MenuItem[] })[]; combos: unknown[] }

export type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
export type OrderStatus = "OPEN" | "BILLED" | "SETTLED" | "CANCELLED";
export type KotStatus = "PENDING" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
export type BillStatus = "DRAFT" | "FINAL" | "VOID";
export type PaymentMode = "CASH" | "UPI" | "CARD" | "WALLET" | "OTHER";
export type PaymentStatus = "PENDING" | "CAPTURED" | "FAILED" | "REFUNDED";

export type TableStatus = "FREE" | "OCCUPIED" | "RESERVED" | "BILLED" | "CLEANING" | "BLOCKED";
/** Flattened from GET /v1/floor/outlets/:outletId (sections[].tables[]). name = table code. */
export interface TableInfo { id: string; sectionId: string; section: string; name: string; seats: number; status: TableStatus; statusSince?: string | null; orderId?: string | null; posX?: number | null; posY?: number | null; version?: number }
export interface FloorView { counts: Record<string, number>; sections: { id: string; name: string; tables: { id: string; code: string; capacity: number; status: TableStatus; statusSince?: string | null; currentOrderId?: string | null; posX?: number | null; posY?: number | null; version: number }[] }[] }

/** modifierIds = ModifierOption ids (across groups). */
export interface OrderItemInput { itemId: string; qty: number; variantId?: string | null; modifierIds?: string[]; notes?: string | null; clientLineId?: string }
export interface OrderInput { type: OrderType; tableRef?: string | null; items: OrderItemInput[]; clientKey?: string }
/** Server echoes clientLineId so optimistic cart lines reconcile by it (id is server-generated). */
export interface OrderItem { id: string; clientLineId?: string | null; itemId: string; name: string; variantName?: string | null; qty: number; unitPrice: Money; taxRateBps: number; lineTotal: Money; notes?: string | null; kotId?: string | null }
export interface Order { id: string; orderNo: string; type: OrderType; status: OrderStatus; tableRef?: string | null; subtotal: Money; taxTotal: Money; discount: Money; total: Money; version: number; items: OrderItem[]; kots: Kot[]; createdAt: string }
export interface Kot { id: string; orderId: string; kotNo: string; status: KotStatus; station?: string | null; itemIds: string[]; createdAt: string }

export interface BillInput { orderId: string; discount?: Money; tip?: Money; splitOf?: { index: number; count: number } }
export interface Bill { id: string; orderId: string; billNo: string; status: BillStatus; subtotal: Money; taxTotal: Money; discount: Money; tip: Money; roundOff: Money; total: Money; payments: Payment[]; finalizedAt?: string | null; createdAt: string }
export interface PaymentInput { mode: PaymentMode; amount: Money; reference?: string | null; idempotencyKey: string }
export interface Payment { id: string; billId: string; mode: PaymentMode; status: PaymentStatus; amount: Money; reference?: string | null; createdAt: string }

export interface CategoryInput { name: string; description?: string; sortOrder?: number; isActive?: boolean }
export interface ItemInput {
  categoryId: string; name: string; basePrice: Money; taxRateBps?: number; isVeg?: boolean; isAvailable?: boolean; sku?: string | null; description?: string | null; station?: string | null;
  variants?: { id?: string; name: string; priceDelta: Money; isDefault?: boolean }[];
  /** Simple add-ons (API sugar): options of the item's "<item> add-ons" group (min 0 / max all). */
  modifiers?: { id?: string; name: string; price: Money }[];
  /** Attach existing shared modifier groups (create only; PUT items/:id/modifier-groups on update). */
  modifierGroupIds?: string[];
}

export interface Outlet { id: string; code: string; name: string; address?: string | null; phone?: string | null; isActive: boolean }
export interface LoginInput { tenantSlug: string; email: string; password: string }
export interface Principal { userId: string; tenantId: string; roles: string[]; permissions: string[] }

/** The contract the POS + dashboard build against. Real + mock implement it identically. */
export interface PosApi {
  readonly mode: "mock" | "real" | "hybrid";
  auth: { login(input: LoginInput): Promise<Principal>; me(): Promise<Principal>; logout(): Promise<void> };
  outlets: {
    list(): Promise<Outlet[]>;
    /** The outlet this POS is bound to: NEXT_PUBLIC_OUTLET_ID if set, else the first active outlet. */
    current(): Promise<Outlet>;
  };
  menu: {
    categories(): Promise<MenuCategory[]>;
    /** Admin list: every item (incl. unavailable) with outlet pricing applied. */
    items(): Promise<MenuItem[]>;
    /** POS list: server-resolved effective menu for the current outlet (schedules + overrides + availability applied). */
    effective(): Promise<MenuItem[]>;
    createCategory(input: CategoryInput): Promise<MenuCategory>;
    updateCategory(id: string, input: Partial<CategoryInput>): Promise<MenuCategory>;
    deleteCategory(id: string): Promise<void>;
    createItem(input: ItemInput): Promise<MenuItem>;
    updateItem(id: string, input: Partial<ItemInput>): Promise<MenuItem>;
    deleteItem(id: string): Promise<void>;
  };
  tables: {
    list(): Promise<TableInfo[]>;
    /** Legal transitions enforced server-side (422 illegal, 409 stale version). */
    setStatus(id: string, status: TableStatus, version?: number): Promise<TableInfo>;
  };
  orders: {
    create(input: OrderInput): Promise<Order>;
    get(id: string): Promise<Order>;
    replaceItems(id: string, items: OrderItemInput[], version?: number): Promise<Order>;
    sendKot(orderId: string, orderItemIds: string[], station?: string): Promise<Kot>;
  };
  billing: {
    create(input: BillInput): Promise<Bill>;
    pay(billId: string, input: PaymentInput): Promise<Payment>;
    finalize(billId: string): Promise<Bill>;
  };
}
