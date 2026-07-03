import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { automatosClient } from "../automatos.server";

/**
 * The three mandatory Shopify GDPR / compliance webhooks (PRD-183 S6, Wave 11).
 *
 *   customers/redact       → platform POST /api/verticals/shopify/gdpr/erase-subject
 *   shop/redact            → platform POST /api/verticals/shopify/gdpr/erase
 *   customers/data_request → platform GET  /api/verticals/shopify/gdpr/export
 *
 * Shopify requires these to be registered and to respond 2xx after HMAC
 * verification. `authenticate.webhook` performs the HMAC check; if it fails it
 * throws a 401 before we get here. Compliance webhooks can arrive after the app
 * is uninstalled, so there is intentionally no `admin` guard.
 *
 * The payload identifiers (per Shopify's compliance payload schema):
 *   - customers/redact & customers/data_request: `payload.customer.id`
 *   - shop/redact: `payload.shop_domain` (+ the authenticated `shop`)
 */

interface CompliancePayload {
  shop_id?: number;
  shop_domain?: string;
  customer?: { id?: number | string; email?: string };
  data_request?: { id?: number | string };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);
  const body = (payload ?? {}) as CompliancePayload;
  const customerId =
    body.customer?.id !== undefined ? String(body.customer.id) : undefined;

  switch (topic) {
    case "CUSTOMERS_REDACT":
      // Erase a single data subject's data within the workspace.
      await automatosClient.eraseDataSubject(shop, customerId ?? "");
      break;

    case "SHOP_REDACT":
      // Erase the whole workspace 48h after uninstall.
      await automatosClient.eraseWorkspace(shop);
      break;

    case "CUSTOMERS_DATA_REQUEST":
      // Export the data held for the subject.
      await automatosClient.exportDataSubject(shop, customerId);
      break;

    default:
      // Unknown compliance topic — ack so Shopify stops retrying.
      break;
  }

  return new Response();
};
