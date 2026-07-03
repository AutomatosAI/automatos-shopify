import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { automatosClient } from "../automatos.server";
import db from "../db.server";

/**
 * app/uninstalled → clear local sessions + soft-delete the Automatos workspace.
 *
 * Registered at URI `/webhooks/app/uninstalled` (see shopify.app.toml). The old
 * single catch-all lived at `/webhooks/app`, which never matched the TOML URI —
 * that mismatch is the "webhook URIs 404" half of F013.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  if (topic !== "APP_UNINSTALLED") {
    return new Response();
  }

  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  await automatosClient.onShopUninstall(shop);

  return new Response();
};
