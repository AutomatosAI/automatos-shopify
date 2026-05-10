/**
 * Automatos Platform API Client
 *
 * Server-side client for the Automatos orchestrator's Shopify integration API.
 *
 * Endpoint contract: orchestrator/api/shopify.py
 *   POST /api/shopify/provision   — workspace + agents + public widget API key (one call)
 *   POST /api/shopify/connect     — store the merchant's Shopify access token
 *   POST /api/shopify/sync        — shop/update webhook
 *   POST /api/shopify/events      — orders/create + other webhooks
 *   POST /api/shopify/deactivate  — app uninstall
 *
 * Auth: Bearer <AUTOMATOS_API_KEY> against SHOPIFY_INTERNAL_API_KEY on the
 * orchestrator. Dev mode (no key configured server-side) accepts all calls.
 */

const AUTOMATOS_API_URL = process.env.AUTOMATOS_API_URL || "https://api.automatos.app";
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${AUTOMATOS_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(AUTOMATOS_API_KEY ? { Authorization: `Bearer ${AUTOMATOS_API_KEY}` } : {}),
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
   * Provision an Automatos workspace for a Shopify store.
   * Idempotent on shop domain. Single call creates the workspace,
   * clones the Shopify marketplace agents, and mints a public widget API key.
   */
  async provisionWorkspace(
    shop: string,
    shopData: Record<string, unknown>,
  ): Promise<ProvisionResponse> {
    return request<ProvisionResponse>("/api/shopify/provision", {
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
   * Forward a Shopify webhook event for agent context.
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
};
