# BillBistro — frontend

The four client apps for BillBistro, a multi-tenant restaurant POS / management SaaS.
The NestJS API lives in the sibling `billbistro-backend` repo — see `PLAN.md` here for
the product spec (authoritative).

## Layout

```
apps/pos          Cashier billing terminal — catalog, cart, KOT, payment, receipt, floor, day-close (PWA)
apps/dashboard     Owner/admin — menu management is fully wired; overview is a static mockup
apps/kds           Kitchen Display System — static mockup, not yet wired to the API
apps/qr            Customer-facing QR menu — static mockup, not yet wired to the API
packages/sdk       Shared typed PosApi client (fetch-based), plus a full in-memory mock implementation
packages/ui        Shared component library (Radix + CVA + Tailwind v4), Storybook at :6006
packages/types     Shared Zod schemas + TS types (mirrors the backend's request/response shapes)
packages/config    tsconfig presets, design tokens, tailwind theme
docs/design        Design-system reference (tokens, Figma, hero screens)
```

## Run (local dev)

```bash
pnpm install
pnpm dev              # turbo runs every app: POS :3000, Dashboard :3001, KDS :3002, QR :3003
# or one at a time:
pnpm pos:dev
pnpm dashboard:dev
```

Each app reads `NEXT_PUBLIC_API_MODE` (`mock` | `real`) from its own `.env.local` — copy the
`.env.example` in `apps/pos` / `apps/dashboard` to get started. `mock` runs entirely in-memory,
no backend required. `real` talks to `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`) —
run the `billbistro-backend` API alongside it and log in with tenant `demo`,
`owner@demo.local` / `Password123!`.

## What's actually wired up

- **POS** (`/`, `/tables`, `/day-close`) — fully implemented against the real API: catalog,
  cart, KOT, payment/split/change, receipt print, live floor map, day-close Z-report.
- **Dashboard** (`/menu`) — full menu CRUD wired to the real API. The overview page (`/`) is
  static sample data — no charts or live KPIs yet.
- **KDS** and **QR** are UI mockups only: hardcoded sample tickets/menu, no `PosApi` calls.

## State management

- Server state: TanStack React Query (POS, Dashboard) — table statuses poll every 5s, the
  effective menu every 60s, day-close every 30s.
- Local state: Zustand, POS only — the in-progress cart persists to `localStorage`
  (`bb-pos-v1`) so a refresh doesn't lose the order.
- Auth: httpOnly cookies set by the backend; the SDK always sends `credentials: "include"` and
  never touches a token directly. `AuthGate` blocks the app tree until `GET /v1/auth/me` succeeds.

## The shared SDK

`packages/sdk` exports one `PosApi` contract (`createPosApi(mode)`) implemented twice — once
against the real backend (`src/real.ts`), once fully in-memory (`src/mock.ts`, seeded with a
sample "Spice Route" restaurant: categories, items, tables, GST rates). Every frontend app
imports the same contract, so switching an app between mock and real is a one-line env change.
