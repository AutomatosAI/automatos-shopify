import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { automatosClient } from "../automatos.server";

/**
 * shop/update → sync shop metadata changes to the Automatos workspace.
 * Registered at URI `/webhooks/shop/update` (see shopify.app.toml).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  if (topic !== "SHOP_UPDATE") {
    return new Response();
  }

  await automatosClient.syncShopData(shop, payload);

  return new Response();
};
