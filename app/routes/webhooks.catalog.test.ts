import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Verifies the catalog webhook route forwards to `automatosClient.onCatalogEvent`
 * with the right (resource, verb, gid) derived from the Shopify topic + payload.
 * Both `authenticate.webhook` (HMAC/parse) and the platform client are mocked.
 */

const webhookMock = vi.fn();
const onCatalogEvent = vi.fn();

vi.mock("../shopify.server", () => ({
  authenticate: { webhook: webhookMock },
}));

vi.mock("../automatos.server", () => ({
  automatosClient: { onCatalogEvent },
}));

// Imported after the mocks are registered.
const { action } = await import("./webhooks.catalog");

function req() {
  return new Request("https://app.example/webhooks/catalog", { method: "POST" });
}

describe("webhooks.catalog action", () => {
  beforeEach(() => {
    webhookMock.mockReset();
    onCatalogEvent.mockReset();
  });

  it("PRODUCTS_UPDATE → onCatalogEvent(products, update, gid from admin_graphql_api_id)", async () => {
    webhookMock.mockResolvedValue({
      topic: "PRODUCTS_UPDATE",
      shop: "demo.myshopify.com",
      payload: {
        id: 123,
        admin_graphql_api_id: "gid://shopify/Product/123",
        title: "Widget",
      },
    });

    const res = await action({ request: req() } as never);

    expect(onCatalogEvent).toHaveBeenCalledTimes(1);
    expect(onCatalogEvent).toHaveBeenCalledWith(
      "demo.myshopify.com",
      "products",
      "update",
      "gid://shopify/Product/123",
      expect.objectContaining({ id: 123 }),
    );
    expect(res).toBeInstanceOf(Response);
  });

  it("COLLECTIONS_DELETE with no admin_graphql_api_id synthesises a Collection gid", async () => {
    webhookMock.mockResolvedValue({
      topic: "COLLECTIONS_DELETE",
      shop: "demo.myshopify.com",
      payload: { id: 55 },
    });

    await action({ request: req() } as never);

    expect(onCatalogEvent).toHaveBeenCalledWith(
      "demo.myshopify.com",
      "collections",
      "delete",
      "gid://shopify/Collection/55",
      expect.any(Object),
    );
  });

  it("ignores a non-catalog topic without forwarding", async () => {
    webhookMock.mockResolvedValue({
      topic: "ORDERS_CREATE",
      shop: "demo.myshopify.com",
      payload: {},
    });

    const res = await action({ request: req() } as never);

    expect(onCatalogEvent).not.toHaveBeenCalled();
    expect(res).toBeInstanceOf(Response);
  });
});
