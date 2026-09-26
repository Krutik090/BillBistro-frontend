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
/** DRAFT → FINAL (finalize; required before payments) → SETTLED (paid ≥ total) ; VOID */
export type BillStatus = "DRAFT" | "FINAL" | "SETTLED" | "VOID";
export type PaymentMode = "CASH" | "UPI" | "CARD" | "WALLET" | "OTHER";
export type PaymentStatus = "PENDING" | "CAPTURED" | "FAILED" | "REFUNDED";

export type TableStatus = "FREE" | "OCCUPIED" | "RESERVED" | "BILLED" | "CLEANING" | "BLOCKED";
/** Flattened from GET /v1/floor/outlets/:outletId (sections[].tables[]). name = table code. */
export interface TableInfo { id: string; sectionId: string; section: string; name: string; seats: number; status: TableStatus; statusSince?: string | null; orderId?: string | null; posX?: number | null; posY?: number | null; version?: number }
export interface FloorView { counts: Record<string, number>; sections: { id: string; name: string; tables: { id: string; code: string; capacity: number; status: TableStatus; statusSince?: string | null; currentOrderId?: string | null; posX?: number | null; posY?: number | null; version: number }[] }[] }

/** modifierIds = ModifierOption ids (across groups). */
export interface OrderItemInput { itemId: string; qty: number; variantId?: string | null; modifierIds?: string[]; notes?: string | null; clientLineId?: string }
/** outletId is injected by the real client when absent; tableId seats a FREE/RESERVED table (409 otherwise) and links currentOrderId. */
export interface OrderInput { type: OrderType; outletId?: string; tableId?: string | null; tableRef?: string | null; guestCount?: number; notes?: string | null; items: OrderItemInput[]; clientKey?: string }
/** Server echoes clientLineId so optimistic cart lines reconcile by it (id is server-generated). */
export interface OrderItem { id: string; clientLineId?: string | null; itemId: string; name: string; variantId?: string | null; variantName?: string | null; modifiers?: { optionId: string; name: string; price: Money }[]; qty: number; unitPrice: Money; taxRateBps: number; lineTotal: Money; notes?: string | null; kotId?: string | null }
export interface Order { id: string; orderNo: string; type: OrderType; status: OrderStatus; tableId?: string | null; tableRef?: string | null; table?: { id: string; code: string; status: TableStatus } | null; guestCount?: number | null; subtotal: Money; taxTotal: Money; discount: Money; total: Money; version: number; items: OrderItem[]; kots: Kot[]; createdAt: string }
export interface Kot { id: string; orderId?: string; kotNo: string; status: KotStatus; station?: string | null; itemIds: string[]; createdAt?: string }
/** KDS feed row (GET /v1/kots): ticket + order/table context + lines with modifiers. */
export interface KotTicket extends Kot { orderNo?: string; tableRef?: string | null; items?: { id: string; name: string; qty: number; variantName?: string | null; notes?: string | null; modifiers?: { name: string }[] }[] }

export interface BillInput { orderId: string; mergeOrderIds?: string[]; discount?: Money; discountNote?: string; tip?: Money; splitOf?: { index: number; count: number }; clientKey?: string }
export interface BillLine { name: string; qty: number; unitPrice: Money; lineTotal: Money; discount: Money; taxable: Money; taxRateBps: number; cgst: Money; sgst: Money; hsnCode?: string | null }
export interface Bill {
  id: string; orderId: string; billNo: string; status: BillStatus; splitIndex?: number; splitCount?: number;
  subtotal: Money; discount: Money; taxable?: Money; cgst?: Money; sgst?: Money; taxTotal: Money; tip: Money; roundOff: Money; total: Money;
  paidTotal?: Money; refundTotal?: Money; due?: Money; version?: number; businessDate?: string | null;
  lines?: BillLine[]; payments: Payment[]; order?: { orderNo: string; status: OrderStatus; tableRef?: string | null } | null; finalizedAt?: string | null; createdAt?: string;
}
/** tendered (cash) lets the server compute change; reference is required for non-cash modes. */
export interface PaymentInput { mode: PaymentMode; amount: Money; tendered?: Money; reference?: string | null; idempotencyKey: string }
export interface Payment { id: string; billId: string; mode: PaymentMode; status: PaymentStatus; amount: Money; tendered?: Money | null; change?: Money; due?: Money; reference?: string | null; createdAt: string }
export interface RefundInput { amount: Money; reason: string; reference?: string | null; idempotencyKey: string }
export interface Refund { id: string; paymentId: string; amount: Money; reason: string; reference?: string | null; createdAt?: string }
export interface DayClose {
  status: "OPEN" | "CLOSED"; businessDate?: string; closedAt?: string | null; note?: string | null;
  totals: { bills: number; orders: number; grossSales: Money; discounts: Money; taxableSales: Money; cgst: Money; sgst: Money; taxTotal: Money; tips: Money; roundOff: Money; netSales: Money; collected: Money; refunded: Money; byMode: Record<string, { collected: Money; refunded: Money; count: number }>; voids: number; cashExpected: Money };
}
/** GET /v1/bills/:id/receipt — 80mm-ready. */
export interface Receipt {
  business: { name: string; gstin?: string | null }; outlet: { name: string; address?: string | null; phone?: string | null };
  bill: { billNo: string; date: string; orderNo?: string; table?: string | null; cashier?: string | null; split?: string | null };
  lines: BillLine[]; totals: { subtotal: Money; discount: Money; taxable: Money; cgst: Money; sgst: Money; taxTotal: Money; tip: Money; roundOff: Money; total: Money; paid: Money; refunded: Money; due: Money };
  taxSummary: { taxRateBps: number; taxable: Money; cgst: Money; sgst: Money }[]; payments: { mode: PaymentMode; amount: Money; tendered?: Money | null; change?: Money | null; reference?: string | null }[]; footer?: string | null;
}

/** GET /v1/reports/sales — same shape as DayClose.totals, generalised to a date range. */
export interface SalesReport {
  outletId: string; from: string; to: string;
  bills: number; orders: number; grossSales: Money; discounts: Money; taxableSales: Money; cgst: Money; sgst: Money; taxTotal: Money;
  tips: Money; roundOff: Money; netSales: Money; collected: Money; refunded: Money; byMode: Record<string, { collected: Money; refunded: Money; count: number }>; voids: number;
}
/** GET /v1/reports/items — qty + revenue per menu line (grouped by frozen bill-line name). */
export interface ItemSalesReport { outletId: string; from: string; to: string; items: { name: string; qty: number; grossAmount: Money; discount: Money; taxable: Money; tax: Money; netAmount: Money }[] }
/** GET /v1/reports/tax — GST by rate bracket, for filing. */
export interface TaxReport { outletId: string; from: string; to: string; brackets: { taxRateBps: number; taxable: Money; cgst: Money; sgst: Money; tax: Money }[]; totals: { taxable: Money; cgst: Money; sgst: Money; tax: Money } }

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
    /** FULL-list replace. Lines already on a KOT must be resent unchanged (same clientLineId/id, qty, variant) or the API returns 422. */
    replaceItems(id: string, items: OrderItemInput[], version?: number): Promise<Order>;
    sendKot(orderId: string, orderItemIds: string[], station?: string): Promise<Kot>;
    /** Void the order: open KOTs cancelled, table freed. */
    cancel(id: string, reason: string, version?: number): Promise<Order>;
  };
  kots: {
    /** KDS feed for the current outlet. */
    list(filter?: { status?: KotStatus; station?: string }): Promise<KotTicket[]>;
    /** PENDING→PREPARING→READY→SERVED (READY→PREPARING allowed; CANCELLED from PENDING/PREPARING). */
    setStatus(id: string, status: KotStatus): Promise<KotTicket>;
  };
  billing: {
    create(input: BillInput): Promise<Bill>;
    /** DRAFT only: change discount / tip; server recomputes. */
    update(billId: string, input: { discount?: Money; tip?: Money; discountNote?: string }, version?: number): Promise<Bill>;
    /** DRAFT → FINAL. Required before payments; stamps businessDate, order/table → BILLED. */
    finalize(billId: string, version?: number): Promise<Bill>;
    pay(billId: string, input: PaymentInput): Promise<Payment>;
    refund(paymentId: string, input: RefundInput): Promise<Refund>;
    /** Only when paid − refunded == 0; order → OPEN, table → OCCUPIED. */
    void(billId: string, reason: string): Promise<Bill>;
    get(billId: string): Promise<Bill>;
    receipt(billId: string): Promise<Receipt>;
  };
  dayClose: {
    get(businessDate?: string): Promise<DayClose>;
    /** 409 while unpaid FINAL bills exist; afterwards finalize/pay on that date → 409. */
    close(businessDate: string, note?: string): Promise<DayClose>;
  };
  reports: {
    sales(from: string, to: string): Promise<SalesReport>;
    items(from: string, to: string): Promise<ItemSalesReport>;
    tax(from: string, to: string): Promise<TaxReport>;
  };
}
