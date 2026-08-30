// Domain types mirroring prisma/schema.prisma + apps/api response shapes. Money = integer paise.
export type Money = number;

export interface MenuCategory { id: string; name: string; sortOrder: number; isActive: boolean }
export interface MenuVariant { id: string; itemId: string; name: string; priceDelta: Money }
export interface MenuModifier { id: string; itemId: string; name: string; price: Money }
export interface MenuItem {
  id: string; categoryId: string; sku?: string | null; name: string; description?: string | null;
  basePrice: Money; taxRateBps: number; isVeg: boolean; isAvailable: boolean;
  variants: MenuVariant[]; modifiers: MenuModifier[];
}

export type OrderType = "DINE_IN" | "TAKEAWAY" | "DELIVERY";
export type OrderStatus = "OPEN" | "BILLED" | "SETTLED" | "CANCELLED";
export type KotStatus = "PENDING" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
export type BillStatus = "DRAFT" | "FINAL" | "VOID";
export type PaymentMode = "CASH" | "UPI" | "CARD" | "WALLET" | "OTHER";
export type PaymentStatus = "PENDING" | "CAPTURED" | "FAILED" | "REFUNDED";

export interface TableInfo { id: string; section: string; name: string; seats: number; status: "FREE" | "OCCUPIED" | "BILLED"; orderId?: string | null }

export interface OrderItemInput { itemId: string; qty: number; variantId?: string | null; modifierIds?: string[]; notes?: string | null; clientLineId?: string }
export interface OrderInput { type: OrderType; tableRef?: string | null; items: OrderItemInput[]; clientKey?: string }
export interface OrderItem { id: string; itemId: string; name: string; variantName?: string | null; qty: number; unitPrice: Money; taxRateBps: number; lineTotal: Money; notes?: string | null; kotId?: string | null }
export interface Order { id: string; orderNo: string; type: OrderType; status: OrderStatus; tableRef?: string | null; subtotal: Money; taxTotal: Money; discount: Money; total: Money; version: number; items: OrderItem[]; kots: Kot[]; createdAt: string }
export interface Kot { id: string; orderId: string; kotNo: string; status: KotStatus; station?: string | null; itemIds: string[]; createdAt: string }

export interface BillInput { orderId: string; discount?: Money; tip?: Money; splitOf?: { index: number; count: number } }
export interface Bill { id: string; orderId: string; billNo: string; status: BillStatus; subtotal: Money; taxTotal: Money; discount: Money; tip: Money; roundOff: Money; total: Money; payments: Payment[]; finalizedAt?: string | null; createdAt: string }
export interface PaymentInput { mode: PaymentMode; amount: Money; reference?: string | null; idempotencyKey: string }
export interface Payment { id: string; billId: string; mode: PaymentMode; status: PaymentStatus; amount: Money; reference?: string | null; createdAt: string }

export interface CategoryInput { name: string; sortOrder?: number; isActive?: boolean }
export interface ItemInput {
  categoryId: string; name: string; basePrice: Money; taxRateBps?: number; isVeg?: boolean; isAvailable?: boolean; sku?: string | null; description?: string | null;
  variants?: { id?: string; name: string; priceDelta: Money }[];
  modifiers?: { id?: string; name: string; price: Money }[];
}

/** The contract the POS + dashboard build against. Real + mock implement it identically. */
export interface PosApi {
  readonly mode: "mock" | "real" | "hybrid";
  menu: {
    categories(): Promise<MenuCategory[]>; items(): Promise<MenuItem[]>;
    createCategory(input: CategoryInput): Promise<MenuCategory>;
    updateCategory(id: string, input: Partial<CategoryInput>): Promise<MenuCategory>;
    deleteCategory(id: string): Promise<void>;
    createItem(input: ItemInput): Promise<MenuItem>;
    updateItem(id: string, input: Partial<ItemInput>): Promise<MenuItem>;
    deleteItem(id: string): Promise<void>;
  };
  tables: { list(): Promise<TableInfo[]> };
  orders: {
    create(input: OrderInput): Promise<Order>;
    get(id: string): Promise<Order>;
    replaceItems(id: string, items: OrderItemInput[]): Promise<Order>;
    sendKot(orderId: string, orderItemIds: string[], station?: string): Promise<Kot>;
  };
  billing: {
    create(input: BillInput): Promise<Bill>;
    pay(billId: string, input: PaymentInput): Promise<Payment>;
    finalize(billId: string): Promise<Bill>;
  };
}
