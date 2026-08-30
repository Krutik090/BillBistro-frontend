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
 *  - hybrid (alias of real since T-103) everything from the API (phase1-backend)
 *  - real   everything from the API
 * NEXT_PUBLIC_API_URL (default http://localhost:4000), NEXT_PUBLIC_OUTLET_ID (optional: pin an outlet; default = first active from GET /v1/outlets).
 */
export function createPosApi(mode: ApiMode = (process.env.NEXT_PUBLIC_API_MODE as ApiMode) || "mock"): PosApi {
  if (mode === "mock") return createMockApi();
  const real = createRealApi();
  if (mode === "real") return real;
  // Every domain is real since T-103 landed; hybrid is kept as an alias so env files don't break.
  return { ...real, mode: "hybrid" };
}
