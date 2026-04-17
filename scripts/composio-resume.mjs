#!/usr/bin/env node
/**
 * Resume: reuse existing auth config, start fresh connection, poll, smoke test.
 *
 * Usage: node --env-file=.env.local scripts/composio-resume.mjs
 */

import { Composio } from "@composio/core";

const AUTH_CONFIG_ID = "ac_iOROGtpG6qVR";
const {
  COMPOSIO_API_KEY,
  SHOPIFY_DEV_STORE,
  COMPOSIO_ENTITY_ID,
} = process.env;

const composio = new Composio({ apiKey: COMPOSIO_API_KEY });

const divider = (l) => console.log(`\n─── ${l} ${"─".repeat(Math.max(0, 60 - l.length))}`);

async function main() {
  divider("1. Initiate fresh connection");
  const connection = await composio.connectedAccounts.initiate(
    COMPOSIO_ENTITY_ID,
    AUTH_CONFIG_ID,
    {
      config: {
        authScheme: "OAUTH2",
        val: { shop: SHOPIFY_DEV_STORE },
      },
    }
  );
  console.log(JSON.stringify(connection, null, 2));

  divider("2. Authorize");
  const url = connection.redirectUrl || connection.redirect_url;
  console.log(`\n🔗 OPEN THIS URL NOW:\n\n   ${url}\n`);
  console.log("After Shopify install + approve, this script will detect ACTIVE and smoke-test.\n");

  console.log("Polling every 3s (10 min window)...");
  const deadline = Date.now() + 10 * 60 * 1000;
  let active = null;
  let lastStatus = "";
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const status = await composio.connectedAccounts.get(connection.id);
      if (status.status !== lastStatus) {
        console.log(`  [${new Date().toISOString().slice(11, 19)}] status=${status.status}`);
        lastStatus = status.status;
      } else {
        process.stdout.write(".");
      }
      if (status.status === "ACTIVE") {
        active = status;
        console.log("\n✅ ACTIVE");
        break;
      }
      if (status.status === "FAILED" || status.status === "EXPIRED") {
        console.error(`\n❌ Connection ${status.status}`);
        console.error(JSON.stringify(status, null, 2));
        process.exit(1);
      }
    } catch (err) {
      console.error("poll err:", err?.message || err);
    }
  }

  if (!active) {
    console.error("\n❌ Timeout waiting for ACTIVE.");
    process.exit(1);
  }

  divider("3. Smoke test: SHOPIFY_LIST_PRODUCTS");
  try {
    const result = await composio.tools.execute("SHOPIFY_LIST_PRODUCTS", {
      userId: COMPOSIO_ENTITY_ID,
      arguments: { limit: 3 },
    });
    console.log("✅ Tool call succeeded");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("❌ Tool call failed:", err?.message || err);
    console.error("Full:", err);
    process.exit(1);
  }

  divider("DONE 🎉");
  console.log(`auth_config_id:    ${AUTH_CONFIG_ID}`);
  console.log(`connected_account: ${active.id}`);
  console.log(`entity_id:         ${COMPOSIO_ENTITY_ID}`);
  console.log(`shop:              ${SHOPIFY_DEV_STORE}.myshopify.com`);
}

main().catch((err) => {
  console.error("\nFATAL:", err?.message || err);
  if (err?.cause) console.error("Cause:", err.cause?.message || err.cause);
  console.error("\nFull:", err);
  process.exit(1);
});
