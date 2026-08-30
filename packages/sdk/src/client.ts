// @billbistro/sdk low-level HTTP client for the NestJS API (phase1-backend).
// All routes live under /v1 except /health. Auth = httpOnly cookies (credentials: include).

export interface HealthResponse { status: "ok" | string; db?: "up" | "down"; version?: string; time?: string; [k: string]: unknown }

/** Shared API error shape: {statusCode, error, message, requestId, path, issues?[]} */
export class ApiError extends Error {
  constructor(public status: number, public body: unknown, message?: string) {
    super(message ?? (typeof body === "object" && body && "message" in body ? String((body as { message: unknown }).message) : `API error ${status}`));
  }
  get issues() { return (this.body as { issues?: unknown[] } | null)?.issues ?? []; }
}

export interface ClientOptions {
  /** API origin, e.g. http://localhost:4000 (no /v1). */
  baseUrl?: string;
  fetch?: typeof fetch;
}

export function createClient(opts: ClientOptions = {}) {
  const origin = (opts.baseUrl ?? (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : undefined) ?? "http://localhost:4000").replace(/\/$/, "");
  const f = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));

  async function raw<T>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await f(url, { credentials: "include", ...init, headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers ?? {}) } });
    const text = await res.text();
    const body = text && res.headers.get("content-type")?.includes("json") ? JSON.parse(text) : text;
    if (!res.ok) throw new ApiError(res.status, body);
    return body as T;
  }
  /** Request against /v1. */
  const request = <T,>(path: string, init: RequestInit = {}) => raw<T>(`${origin}/v1${path}`, init);
  const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

  return {
    origin,
    health: () => raw<HealthResponse>(`${origin}/health`),
    request,
    get: <T,>(p: string) => request<T>(p),
    post: <T,>(p: string, b?: unknown) => request<T>(p, json("POST", b)),
    patch: <T,>(p: string, b?: unknown) => request<T>(p, json("PATCH", b)),
    put: <T,>(p: string, b?: unknown) => request<T>(p, json("PUT", b)),
    del: <T,>(p: string) => request<T>(p, { method: "DELETE" }),
  };
}

export type ApiClient = ReturnType<typeof createClient>;
