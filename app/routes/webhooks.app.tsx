import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { automatosClient } from "../automatos.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin, payload } =
    await authenticate.webhook(request);

  if (!admin && topic !== "SHOP_REDACT") {
    throw new Response();
  }

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        await db.session.deleteMany({ where: { shop } });
      }
      // Notify Automatos platform of uninstall
      await automatosClient.onShopUninstall(shop);
      break;

    case "SHOP_UPDATE":
      // Sync shop data changes to Automatos
      await automatosClient.syncShopData(shop, payload);
      break;

    case "ORDERS_CREATE":
      // Feed new orders to Automatos for agent context
      await automatosClient.onOrderCreate(shop, payload);
      break;

    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
      // GDPR mandatory webhooks — handled
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};
