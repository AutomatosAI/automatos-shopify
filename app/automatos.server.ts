/**
 * Automatos Platform API Client
 *
 * Server-side client for communicating with the Automatos orchestrator.
 * Handles workspace provisioning, agent seeding, and event forwarding.
 */

const AUTOMATOS_API_URL = process.env.AUTOMATOS_API_URL || "https://api.automatos.app";
const AUTOMATOS_API_KEY = process.env.AUTOMATOS_API_KEY || "";

interface AutomatosWorkspace {
  id: number;
  public_id: string;
  name: string;
  api_key: string;
}

interface AgentSummary {
  id: number;
  name: string;
  slug: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${AUTOMATOS_API_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AUTOMATOS_API_KEY}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Automatos API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export const automatosClient = {
  /**
   * Provision a new Automatos workspace for a Shopify store.
   * Called on first install — idempotent via shop domain.
   */
  async provisionWorkspace(shop: string, shopData: Record<string, unknown>): Promise<AutomatosWorkspace> {
    return request<AutomatosWorkspace>("/api/workspaces/provision", {
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
        },
      }),
    });
  },

  /**
   * Install marketplace agents into the workspace.
   * Seeds the 12 Shopify agents from marketplace catalog.
   */
  async seedAgents(workspaceId: number): Promise<AgentSummary[]> {
    return request<AgentSummary[]>(`/api/workspaces/${workspaceId}/agents/seed`, {
      method: "POST",
      body: JSON.stringify({
        catalog: "shopify",
        agents: [
          "shopify-ops",
          "shopify-support",
          "shopify-product-expert",
          "shopify-merchandiser",
          "shopify-review-analyst",
          "shopify-gift-concierge",
          "shopify-seo-content",
          "shopify-business-analyst",
          "shopify-inventory-watchdog",
        ],
      }),
    });
  },

  /**
   * Store the Shopify access token for Composio connection.
   */
  async storeShopifyCredentials(
    workspaceId: number,
    shop: string,
    accessToken: string
  ): Promise<void> {
    await request("/api/integrations/shopify/connect", {
      method: "POST",
      body: JSON.stringify({
        workspace_id: workspaceId,
        shop_domain: shop,
        access_token: accessToken,
      }),
    });
  },

  /**
   * Handle shop uninstall — deactivate workspace.
   */
  async onShopUninstall(shop: string): Promise<void> {
    await request("/api/workspaces/deactivate", {
      method: "POST",
      body: JSON.stringify({ external_id: shop, source: "shopify" }),
    }).catch((err) => {
      console.error(`Failed to deactivate workspace for ${shop}:`, err);
    });
  },

  /**
   * Sync shop data changes.
   */
  async syncShopData(shop: string, payload: unknown): Promise<void> {
    await request("/api/integrations/shopify/sync", {
      method: "POST",
      body: JSON.stringify({ shop, data: payload }),
    }).catch((err) => {
      console.error(`Failed to sync shop data for ${shop}:`, err);
    });
  },

  /**
   * Forward new order for agent context enrichment.
   */
  async onOrderCreate(shop: string, payload: unknown): Promise<void> {
    await request("/api/integrations/shopify/events", {
      method: "POST",
      body: JSON.stringify({ shop, event: "orders/create", data: payload }),
    }).catch((err) => {
      console.error(`Failed to forward order event for ${shop}:`, err);
    });
  },

  /**
   * Get widget configuration for a shop.
   */
  async getWidgetConfig(workspaceId: number): Promise<Record<string, unknown>> {
    return request(`/api/workspaces/${workspaceId}/widgets/config`);
  },

  /**
   * Get the public API key for widget initialization.
   */
  async getPublicApiKey(workspaceId: number): Promise<string> {
    const result = await request<{ api_key: string }>(
      `/api/workspaces/${workspaceId}/api-keys/public`
    );
    return result.api_key;
  },
};
