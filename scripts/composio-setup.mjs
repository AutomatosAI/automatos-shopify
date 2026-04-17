#!/usr/bin/env node
/**
 * Composio ↔ Shopify setup + connection test.
 *
 * Usage:
 *   nvm use 20
 *   node --env-file=.env.local scripts/composio-setup.mjs
 */

import { Composio } from "@composio/core";

const {
  COMPOSIO_API_KEY,
  SHOPIFY_CLIENT_ID,
  SHOPIFY_CLIENT_SECRET,
  SHOPIFY_DEV_STORE,
  COMPOSIO_ENTITY_ID,
} = process.env;

for (const [k, v] of Object.entries({
  COMPOSIO_API_KEY, SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET,
  SHOPIFY_DEV_STORE, COMPOSIO_ENTITY_ID,
})) {
  if (!v) { console.error(`MISSING ENV: ${k}`); process.exit(1); }
}

const FULL_SCOPES = [
  "read_products", "write_products",
  "read_orders", "write_orders", "read_all_orders",
  "read_customers", "write_customers",
  "read_inventory", "write_inventory",
  "read_content", "write_content",
  "read_discounts", "write_discounts",
  "read_price_rules", "write_price_rules",
  "read_fulfillments", "write_fulfillments",
  "read_gift_cards", "write_gift_cards",
  "read_draft_orders", "write_draft_orders",
  "read_shipping", "write_shipping",
  "read_analytics", "read_reports",
  "read_marketing_events", "write_marketing_events",
  "read_themes", "write_themes",
  "read_script_tags", "write_script_tags",
  "read_checkouts", "write_checkouts",
  "read_product_listings",
  "read_locations",
].join(",");

const composio = new Composio({ apiKey: COMPOSIO_API_KEY });

const divider = (label) =>
  console.log(`\n─── ${label} ${"─".repeat(Math.max(0, 60 - label.length))}`);

async function main() {
  // 1. Discover required fields for OAuth2 auth config creation
  divider("1. Discover Shopify OAuth2 auth config fields");
  const createFields = await composio.toolkits.getAuthConfigCreationFields(
    "SHOPIFY", "OAUTH2", { requiredOnly: false }
  );
  console.log(JSON.stringify(createFields, null, 2));

  // 2. Discover required fields for connection initiation
  divider("2. Discover Shopify connection init fields");
  const initFields = await composio.toolkits.getConnectedAccountInitiationFields(
    "SHOPIFY", "OAUTH2", { requiredOnly: false }
  );
  console.log(JSON.stringify(initFields, null, 2));

  // 3. Create custom OAuth2 auth config with full scopes
  divider("3. Create custom OAuth2 auth config");
  const authConfig = await composio.authConfigs.create("SHOPIFY", {
    type: "use_custom_auth",
    name: "Automatos Shopify OAuth (PoC)",
    authScheme: "OAUTH2",
    credentials: {
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      scopes: FULL_SCOPES,
    },
  });
  console.log("Auth config:", JSON.stringify(authConfig, null, 2));

  // 4. Initiate connection for dev store
  divider("4. Initiate connection for dev store");
  const connection = await composio.connectedAccounts.initiate(
    COMPOSIO_ENTITY_ID,
    authConfig.id,
    {
      config: {
        authScheme: "OAUTH2",
        val: { shop: SHOPIFY_DEV_STORE },
      },
    }
  );
  console.log("Connection:", JSON.stringify(connection, null, 2));

  divider("5. Authorize on Shopify");
  const url = connection.redirectUrl || connection.redirect_url;
  console.log(`\n👉 Open this URL in your browser and click Install:\n\n${url}\n`);

  console.log("Polling every 3s for ACTIVE (5 min timeout)...");
  const deadline = Date.now() + 5 * 60 * 1000;
  let active = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const status = await composio.connectedAccounts.get(connection.id);
      process.stdout.write(`  status=${status.status} `);
      if (status.status === "ACTIVE") {
        active = status;
        console.log("\n✅ ACTIVE");
        break;
      }
    } catch (err) {
      console.error("  poll error:", err?.message || err);
    }
  }

  if (!active) {
    console.error("\n❌ Timed out. Check Composio dashboard.");
    process.exit(1);
  }

  // 6. Smoke test
  divider("6. Smoke test: SHOPIFY_LIST_PRODUCTS");
  const result = await composio.tools.execute("SHOPIFY_LIST_PRODUCTS", {
    userId: COMPOSIO_ENTITY_ID,
    arguments: { limit: 3 },
  });
  console.log("Result:", JSON.stringify(result, null, 2));

  divider("DONE");
  console.log(`auth_config_id:    ${authConfig.id}`);
  console.log(`connected_account: ${active.id}`);
  console.log(`entity_id:         ${COMPOSIO_ENTITY_ID}`);
}

main().catch((err) => {
  console.error("\nFATAL:", err?.message || err);
  if (err?.cause) console.error("Cause:", err.cause?.message || err.cause);
  if (err?.meta) console.error("Meta:", JSON.stringify(err.meta, null, 2));
  console.error("\nFull:", err);
  process.exit(1);
});
