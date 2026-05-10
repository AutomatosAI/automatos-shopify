#!/usr/bin/env node
/**
 * Status check + smoke test for an existing Composio connected account.
 *
 * Required env (.env.local):
 *   COMPOSIO_API_KEY    ak_*
 *   COMPOSIO_ENTITY_ID  workspace public_id
 *
 * Optional env:
 *   COMPOSIO_CONNECTION_ID   ca_* — defaults to the 1lovefragrance PoC connection
 *
 * Usage:
 *   node --env-file=.env.local scripts/composio-check.mjs
 */

import { Composio } from "@composio/core";

const TOOLKIT_VERSION = "20260414_00";
const DEFAULT_CONN_ID = "ca_Bb9ryRq8djvH";

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
  toolkitVersions: { shopify: TOOLKIT_VERSION },
});

const connId = process.env.COMPOSIO_CONNECTION_ID || DEFAULT_CONN_ID;
const status = await composio.connectedAccounts.get(connId);
console.log(JSON.stringify(status, null, 2));

if (status.status === "ACTIVE") {
  console.log("\n✅ ACTIVE — running smoke test");
  try {
    const shop = await composio.tools.execute("SHOPIFY_GET_SHOP_DETAILS", {
      userId: process.env.COMPOSIO_ENTITY_ID,
      arguments: {},
    });
    console.log("\n✅ SHOPIFY_GET_SHOP_DETAILS OK");
    console.log(JSON.stringify(shop, null, 2));
  } catch (err) {
    console.error("❌ Tool call failed:", err?.message || err);
    process.exit(1);
  }
} else {
  console.log(`\n⏳ Still ${status.status} — authorize URL probably not clicked yet.`);
  if (status.redirectUrl || status.redirect_url) {
    console.log(`Authorize URL: ${status.redirectUrl || status.redirect_url}`);
  }
}
