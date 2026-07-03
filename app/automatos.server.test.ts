import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { automatosClient } from "./automatos.server";

/**
 * These tests pin the platform seam contract (PRD-183): the exact URL + body
 * shape the Shopify admin POSTs to for each webhook / lifecycle event. They mock
 * the network entirely (global.fetch) so nothing hits a real platform.
 */

interface CapturedCall {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

let calls: CapturedCall[] = [];

function mockFetchOk(responseBody: unknown = { status: "received" }) {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({
      url: String(url),
      method: (init?.method as string) || "GET",
      body: init?.body ? JSON.parse(init.body as string) : undefined,
      headers: (init?.headers as Record<string, string>) || {},
    });
    return {
      ok: true,
      status: 200,
      json: async () => responseBody,
      text: async () => JSON.stringify(responseBody),
    } as Response;
  });
}

describe("automatosClient — platform seam contract", () => {
  beforeEach(() => {
    calls = [];
    // Default base URL is https://api.automatos.app (config/env). Assert on the path.
    vi.stubGlobal("fetch", mockFetchOk());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("catalog events → POST /api/shopify/events (S1, F032)", () => {
    it("forwards a products/update with type + id + shop + event (F032 filter keys)", async () => {
      await automatosClient.onCatalogEvent(
        "demo.myshopify.com",
        "products",
        "update",
        "gid://shopify/Product/123",
        { id: 123, title: "Widget" },
      );

      expect(calls).toHaveLength(1);
      const [call] = calls;
      expect(call.url).toBe("https://api.automatos.app/api/shopify/events");
      expect(call.method).toBe("POST");
      // F032: the incremental graph builder filters on `type` and `id`.
      expect(call.body).toMatchObject({
        shop: "demo.myshopify.com",
        event: "products/update",
        type: "products",
        id: "gid://shopify/Product/123",
        data: { id: 123, title: "Widget" },
      });
    });

    it("forwards a collections/create with the collection resource type", async () => {
      await automatosClient.onCatalogEvent(
        "demo.myshopify.com",
        "collections",
        "create",
        "gid://shopify/Collection/9",
        { id: 9 },
      );

      expect(calls[0].body).toMatchObject({
        event: "collections/create",
        type: "collections",
        id: "gid://shopify/Collection/9",
      });
    });
  });

  describe("GDPR webhooks → platform /api/verticals/shopify/gdpr/* (Wave 11 internal surface)", () => {
    it("customers/redact → POST /api/verticals/shopify/gdpr/erase-subject with external_id + subject_id", async () => {
      await automatosClient.eraseDataSubject("demo.myshopify.com", "cust-42");

      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe(
        "https://api.automatos.app/api/verticals/shopify/gdpr/erase-subject",
      );
      expect(calls[0].method).toBe("POST");
      // Machine surface: the workspace is resolved from external_id (the shop),
      // not a browser session.
      expect(calls[0].body).toMatchObject({
        external_id: "demo.myshopify.com",
        subject_id: "cust-42",
      });
    });

    it("shop/redact → POST /api/verticals/shopify/gdpr/erase with external_id", async () => {
      await automatosClient.eraseWorkspace("demo.myshopify.com");

      expect(calls[0].url).toBe(
        "https://api.automatos.app/api/verticals/shopify/gdpr/erase",
      );
      expect(calls[0].method).toBe("POST");
      expect(calls[0].body).toMatchObject({ external_id: "demo.myshopify.com" });
    });

    it("customers/data_request → GET /api/verticals/shopify/gdpr/export with external_id + customer_id query", async () => {
      await automatosClient.exportDataSubject("demo.myshopify.com", "cust-42");

      expect(calls[0].method).toBe("GET");
      expect(calls[0].url).toBe(
        "https://api.automatos.app/api/verticals/shopify/gdpr/export?external_id=demo.myshopify.com&customer_id=cust-42",
      );
    });
  });

  describe("provisioning → POST /api/verticals/shopify/provision (S5)", () => {
    it("posts the generic vertical provision body", async () => {
      vi.stubGlobal(
        "fetch",
        mockFetchOk({
          id: "w1",
          public_id: "pub1",
          name: "Demo",
          api_key: "ak_pub_xxxxxxxxxxxx",
          agents_installed: 9,
          is_new: true,
        }),
      );

      const res = await automatosClient.provisionWorkspace(
        "demo.myshopify.com",
        { name: "Demo", plan_name: "Basic", currency: "USD" },
      );

      expect(calls[0].url).toBe(
        "https://api.automatos.app/api/verticals/shopify/provision",
      );
      expect(calls[0].method).toBe("POST");
      expect(calls[0].body).toMatchObject({
        source: "shopify",
        external_id: "demo.myshopify.com",
        name: "Demo",
        metadata: { shopify_domain: "demo.myshopify.com", plan: "Basic" },
      });
      expect(res.public_id).toBe("pub1");
    });
  });

  describe("resilience", () => {
    it("catalog/GDPR forwards swallow platform errors (webhook must still 200)", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: false,
          status: 500,
          json: async () => ({}),
          text: async () => "boom",
        })) as unknown as typeof fetch,
      );

      // None of these should throw despite the 500.
      await expect(
        automatosClient.onCatalogEvent("s", "products", "update", "gid://x", {}),
      ).resolves.toBeUndefined();
      await expect(
        automatosClient.eraseDataSubject("s", "c"),
      ).resolves.toBeUndefined();
      await expect(automatosClient.eraseWorkspace("s")).resolves.toBeUndefined();
      await expect(
        automatosClient.exportDataSubject("s"),
      ).resolves.toBeUndefined();
    });
  });
});
