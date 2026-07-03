import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Verifies each of the three mandatory Shopify GDPR webhooks routes to the
 * correct platform GDPR client method (Wave 11 entrypoints). `authenticate.webhook`
 * (which performs the HMAC verification) and the platform client are mocked.
 */

const webhookMock = vi.fn();
const eraseDataSubject = vi.fn();
const eraseWorkspace = vi.fn();
const exportDataSubject = vi.fn();

vi.mock("../shopify.server", () => ({
  authenticate: { webhook: webhookMock },
}));

vi.mock("../automatos.server", () => ({
  automatosClient: { eraseDataSubject, eraseWorkspace, exportDataSubject },
}));

const { action } = await import("./webhooks.compliance");

function req() {
  return new Request("https://app.example/webhooks/compliance", {
    method: "POST",
  });
}

describe("webhooks.compliance action (mandatory GDPR)", () => {
  beforeEach(() => {
    webhookMock.mockReset();
    eraseDataSubject.mockReset();
    eraseWorkspace.mockReset();
    exportDataSubject.mockReset();
  });

  it("CUSTOMERS_REDACT → eraseDataSubject(shop, customerId)  [POST /api/verticals/shopify/gdpr/erase-subject]", async () => {
    webhookMock.mockResolvedValue({
      topic: "CUSTOMERS_REDACT",
      shop: "demo.myshopify.com",
      payload: { customer: { id: 42 } },
    });

    await action({ request: req() } as never);

    expect(eraseDataSubject).toHaveBeenCalledWith("demo.myshopify.com", "42");
    expect(eraseWorkspace).not.toHaveBeenCalled();
    expect(exportDataSubject).not.toHaveBeenCalled();
  });

  it("SHOP_REDACT → eraseWorkspace(shop)  [POST /api/verticals/shopify/gdpr/erase]", async () => {
    webhookMock.mockResolvedValue({
      topic: "SHOP_REDACT",
      shop: "demo.myshopify.com",
      payload: { shop_domain: "demo.myshopify.com" },
    });

    await action({ request: req() } as never);

    expect(eraseWorkspace).toHaveBeenCalledWith("demo.myshopify.com");
    expect(eraseDataSubject).not.toHaveBeenCalled();
  });

  it("CUSTOMERS_DATA_REQUEST → exportDataSubject(shop, customerId)  [GET /api/verticals/shopify/gdpr/export]", async () => {
    webhookMock.mockResolvedValue({
      topic: "CUSTOMERS_DATA_REQUEST",
      shop: "demo.myshopify.com",
      payload: { customer: { id: 42 } },
    });

    await action({ request: req() } as never);

    expect(exportDataSubject).toHaveBeenCalledWith("demo.myshopify.com", "42");
    expect(eraseWorkspace).not.toHaveBeenCalled();
  });

  it("always returns a Response (acks the HMAC-verified receipt)", async () => {
    webhookMock.mockResolvedValue({
      topic: "SHOP_REDACT",
      shop: "demo.myshopify.com",
      payload: {},
    });

    const res = await action({ request: req() } as never);
    expect(res).toBeInstanceOf(Response);
  });
});
