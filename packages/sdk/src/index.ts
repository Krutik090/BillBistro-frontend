export * from "./types";
export { createClient, ApiError, type ApiClient, type ClientOptions, type HealthResponse } from "./client";
export { createMockApi, priceLine, MOCK_CATEGORIES, MOCK_ITEMS, MOCK_TABLES, TABLE_TRANSITIONS } from "./mock";
export { createRealApi, NotImplementedError, type RealApiOptions } from "./real";

import type { PosApi } from "./types";
import { createMockApi } from "./mock";
import { createRealApi } from "./real";

export type ApiMode = "mock" | "real" | "hybrid";

/**
 * Single switch for the POS + dashboard. NEXT_PUBLIC_API_MODE:
 *  - mock   (default) everything in-memory
 *  - hybrid auth + menu + floor/tables from the API (phase1-backend); orders + billing from the mock (until T-102/T-103 land)
 *  - real   everything from the API
 * NEXT_PUBLIC_API_URL (default http://localhost:4000), NEXT_PUBLIC_OUTLET_ID (required for floor + effective menu; no outlets endpoint yet).
 */
export function createPosApi(mode: ApiMode = (process.env.NEXT_PUBLIC_API_MODE as ApiMode) || "mock"): PosApi {
  if (mode === "mock") return createMockApi();
  const real = createRealApi();
  if (mode === "real") return real;
  const mock = createMockApi();
  return { mode: "hybrid", auth: real.auth, menu: real.menu, tables: real.tables, orders: mock.orders, billing: mock.billing };
}
