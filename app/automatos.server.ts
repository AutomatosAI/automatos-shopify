/**
 * Automatos Platform API Client
 *
 * Server-side client for the Automatos orchestrator's Shopify integration API.
 * This is the single seam between the Shopify Remix admin and the platform.
 *
 * Endpoint contract (PRD-183 Wave 13):
 *   POST /api/verticals/shopify/provision  — workspace + agents + public widget API key (S5 generic vertical path)
 *   POST /api/shopify/connect              — store the merchant's Shopify access token
 *   POST /api/shopify/sync                 — shop/update webhook
 *   POST /api/shopify/events               — catalog + other webhooks (S1: body carries type/id for the incremental graph builder, F032)
 *   POST /api/shopify/deactivate           — app uninstall
 *   POST /api/verticals/shopify/gdpr/erase-subject  — customers/redact  (Wave 11 erase_data_subject cascade)
 *   POST /api/verticals/shopify/gdpr/erase          — shop/redact       (Wave 11 whole-workspace erase)
 *   GET  /api/verticals/shopify/gdpr/export         — customers/data_request (Wave 11 export bundle)
 *
 * Auth: Bearer <AUTOMATOS_API_KEY> (the platform's internal key) on every call.
 * The platform resolves the workspace from the shop domain (`external_id`) for
 * BOTH the catalog/lifecycle path AND the GDPR path — a compliance webhook is
 * machine-to-machine with no logged-in workspace admin, so the GDPR calls target
 * the internal-key-authed vertical surface (not the user-facing /api/v1/gdpr/*
 * endpoints, which resolve the workspace from a browser session).
 */

const AUTOMATOS_API_URL =
  process.env.AUTOMATOS_API_URL || "https://api.automatos.app";
const AUTOMATOS_API_KEY = process.env.AUTOMATOS_API_KEY || "";

export interface ProvisionResponse {
  id: string;
  public_id: string;
  name: string;
  api_key: string;
  agents_installed: number;
  is_new: boolean;
}

export interface ConnectResponse {
  status: "connected";
  shop: string;
}

export interface DeactivateResponse {
  status: "deactivated" | "not_found";
  workspace_id?: string;
}

export interface SyncResponse {
  status: "synced" | "not_found";
}

export interface EventResponse {
  status: "received";
  event: string;
}

export interface GdprResponse {
  [key: string]: unknown;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${AUTOMATOS_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(AUTOMATOS_API_KEY
        ? { Authorization: `Bearer ${AUTOMATOS_API_KEY}` }
        : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Automatos API error ${res.status} on ${path}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export const automatosClient = {
  /**
   * Provision an Automatos workspace for a Shopify store (PRD-183 S5).
   * Idempotent on shop domain. Single call creates the workspace,
   * clones the Shopify marketplace agents, and mints a public widget API key.
   * Goes through the generic vertical path so vertical #2 never forks api/shopify.py.
   */
  async provisionWorkspace(
    shop: string,
    shopData: Record<string, unknown>,
  ): Promise<ProvisionResponse> {
    return request<ProvisionResponse>("/api/verticals/shopify/provision", {
      method: "POST",
      body: JSON.stringify({
        source: "shopify",
        external_id: shop,
        name: String(shopData.name || shop),
        metadata: {
          shopify_domain: shop,
          plan: shopData.plan_name,
          country: shopData.country_code,
          currency: shopData.currency,
          is_dev: shopData.is_dev,
          domain: shopData.domain,
          email: shopData.email,
        },
      }),
    });
  },

  /**
   * Store the Shopify access token so Composio can use it for Admin API calls.
   */
  async storeShopifyCredentials(
    workspaceId: string,
    shop: string,
    accessToken: string,
  ): Promise<ConnectResponse> {
    return request<ConnectResponse>("/api/shopify/connect", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: workspaceId,
        shop_domain: shop,
        access_token: accessToken,
      }),
    });
  },

  /**
   * Soft-delete the workspace on app uninstall.
   * Errors are logged but never thrown — webhook handlers must not retry on auth failure.
   */
  async onShopUninstall(shop: string): Promise<void> {
    await request<DeactivateResponse>("/api/shopify/deactivate", {
      method: "POST",
      body: JSON.stringify({ external_id: shop, source: "shopify" }),
    }).catch((err) => {
      console.error(`[automatos] deactivate failed for ${shop}:`, err);
    });
  },

  /**
   * Sync shop metadata changes (shop/update webhook).
   */
  async syncShopData(shop: string, payload: unknown): Promise<void> {
    await request<SyncResponse>("/api/shopify/sync", {
      method: "POST",
      body: JSON.stringify({ shop, data: payload }),
    }).catch((err) => {
      console.error(`[automatos] sync failed for ${shop}:`, err);
    });
  },

  /**
   * Forward a catalog-mutation webhook (products/*, collections/*) to the
   * platform /events endpoint (PRD-183 S1).
   *
   * F032: the incremental commerce-graph builder filters pending sources on the
   * `type`/`id` keys, so the forwarded body MUST carry them. We send the shop +
   * event (which the platform keys off to resolve the workspace and trigger a
   * catalog re-sync) alongside the explicit `type`/`id` and the raw payload.
   *
   * @param shop      myshopify domain
   * @param resource  "products" | "collections" | ...
   * @param verb      "create" | "update" | "delete"
   * @param id        the Shopify GID of the mutated resource (may be undefined on some delete topics)
   * @param payload   the raw webhook payload
   */
  async onCatalogEvent(
    shop: string,
    resource: string,
    verb: string,
    id: string | undefined,
    payload: unknown,
  ): Promise<void> {
    const event = `${resource}/${verb}`;
    await request<EventResponse>("/api/shopify/events", {
      method: "POST",
      body: JSON.stringify({
        shop,
        event,
        // F032: type/id must be present for the incremental graph builder filter.
        type: resource,
        id,
        data: payload,
      }),
    }).catch((err) => {
      console.error(`[automatos] catalog event ${event} failed for ${shop}:`, err);
    });
  },

  /**
   * Forward a generic (non-catalog) Shopify webhook event for agent context.
   */
  async onShopifyEvent(
    shop: string,
    event: string,
    payload: unknown,
  ): Promise<void> {
    await request<EventResponse>("/api/shopify/events", {
      method: "POST",
      body: JSON.stringify({ shop, event, data: payload }),
    }).catch((err) => {
      console.error(`[automatos] event ${event} failed for ${shop}:`, err);
    });
  },

  /**
   * GDPR: customers/redact — erase a single data subject within the workspace
   * resolved from the shop domain (Wave 11 erase_data_subject cascade).
   *
   * Targets the internal-key-authed vertical GDPR surface
   * (POST /api/verticals/shopify/gdpr/erase-subject). A Shopify webhook has no
   * logged-in workspace admin, so the user-facing /api/v1/gdpr/* endpoints (which
   * resolve the workspace from the session) cannot serve it. The internal surface
   * resolves the workspace from `external_id` (the shop) and 404s if none matches,
   * so an erasure can never land on a wrong/blank workspace.
   *
   * Errors are logged, never thrown — Shopify retries compliance webhooks on
   * non-2xx, but we must ack the HMAC-verified receipt regardless of platform
   * availability.
   */
  async eraseDataSubject(shop: string, subjectId: string): Promise<void> {
    await request<GdprResponse>("/api/verticals/shopify/gdpr/erase-subject", {
      method: "POST",
      body: JSON.stringify({ external_id: shop, subject_id: subjectId }),
    }).catch((err) => {
      console.error(
        `[automatos] gdpr erase-subject failed for ${shop} subject=${subjectId}:`,
        err,
      );
    });
  },

  /**
   * GDPR: shop/redact — erase the whole workspace for a shop 48h after uninstall
   * (Wave 11 whole-workspace erase cascade).
   *
   * Targets POST /api/verticals/shopify/gdpr/erase. The platform resolves the
   * workspace from `external_id` server-side (no confirmation echo is needed or
   * possible — the caller cannot name a workspace id); a non-matching shop 404s
   * rather than erasing anything.
   */
  async eraseWorkspace(shop: string): Promise<void> {
    await request<GdprResponse>("/api/verticals/shopify/gdpr/erase", {
      method: "POST",
      body: JSON.stringify({ external_id: shop }),
    }).catch((err) => {
      console.error(`[automatos] gdpr erase failed for ${shop}:`, err);
    });
  },

  /**
   * GDPR: customers/data_request — export the data held for a subject/shop
   * (Wave 11 export bundle).
   *
   * Targets GET /api/verticals/shopify/gdpr/export. `external_id` (the shop)
   * resolves the workspace; `customer_id` is passed for audit provenance /
   * subject scoping.
   */
  async exportDataSubject(shop: string, customerId?: string): Promise<void> {
    const params = new URLSearchParams({ external_id: shop });
    if (customerId) params.set("customer_id", customerId);
    await request<GdprResponse>(
      `/api/verticals/shopify/gdpr/export?${params.toString()}`,
      {
        method: "GET",
      },
    ).catch((err) => {
      console.error(`[automatos] gdpr export failed for ${shop}:`, err);
    });
  },
};
