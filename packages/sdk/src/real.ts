// Real PosApi over Jim's NestJS API. Endpoints that don't exist yet throw NotImplemented so the
// hybrid mode can route them to the mock until T-102/T-103 land.
import type { PosApi } from "./types";
import { createClient, type ApiClient } from "./client";

export class NotImplementedError extends Error { constructor(what: string) { super(`${what} is not available on the API yet`); } }

export function createRealApi(client: ApiClient = createClient()): PosApi {
  const notYet = (what: string) => async () => { throw new NotImplementedError(what); };
  return {
    mode: "real",
    menu: {
      categories: () => client.request("/menu/categories"),
      items: () => client.request("/menu/items"),
    },
    tables: { list: notYet("tables API (T-101)") },
    orders: {
      // POST /orders exists (T-102 in progress) — body shape to be confirmed with Jim's CreateOrder zod schema.
      create: (input) => client.request("/orders", { method: "POST", body: JSON.stringify(input) }),
      get: (id) => client.request(`/orders/${id}`),
      replaceItems: notYet("PATCH /orders/:id/items (T-102)"),
      sendKot: notYet("POST /orders/:id/kots (T-102)"),
    },
    billing: {
      create: notYet("POST /bills (T-103)"),
      pay: notYet("POST /bills/:id/payments (T-103)"),
      finalize: notYet("POST /bills/:id/finalize (T-103)"),
    },
  };
}
