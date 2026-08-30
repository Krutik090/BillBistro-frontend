export * from "./types";
export { createClient, ApiError, type ApiClient, type ClientOptions, type HealthResponse } from "./client";
export { createMockApi, priceLine, MOCK_CATEGORIES, MOCK_ITEMS, MOCK_TABLES } from "./mock";
export { createRealApi, NotImplementedError, type RealApiOptions } from "./real";

import type { PosApi } from "./types";
import { createMockApi } from "./mock";
import { createRealApi } from "./real";

export type ApiMode = "mock" | "real" | "hybrid";

/**
 * Single switch for the POS + dashboard. NEXT_PUBLIC_API_MODE:
 *  - mock   (default) everything in-memory
 *  - hybrid auth + menu + orders from the API (phase1-backend), tables/billing from the mock (until T-101/T-103 land)
 *  - real   everything from the API
 * NEXT_PUBLIC_API_URL (default http://localhost:4000), NEXT_PUBLIC_OUTLET_ID (optional: use the outlet's effective menu).
 */
export function createPosApi(mode: ApiMode = (process.env.NEXT_PUBLIC_API_MODE as ApiMode) || "mock"): PosApi {
  if (mode === "mock") return createMockApi();
  const real = createRealApi();
  if (mode === "real") return real;
  const mock = createMockApi();
  return { mode: "hybrid", auth: real.auth, menu: real.menu, orders: real.orders, tables: mock.tables, billing: mock.billing };
}
