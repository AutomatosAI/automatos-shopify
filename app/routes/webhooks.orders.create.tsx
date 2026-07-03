import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { automatosClient } from "../automatos.server";

/**
 * orders/create → forward to the platform /events endpoint for agent context.
 * Registered at URI `/webhooks/orders/create` (see shopify.app.toml).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  if (topic !== "ORDERS_CREATE") {
    return new Response();
  }

  await automatosClient.onShopifyEvent(shop, "orders/create", payload);

  return new Response();
};
