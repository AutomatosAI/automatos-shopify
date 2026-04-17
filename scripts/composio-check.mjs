import { Composio } from "@composio/core";
const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

const CONN_ID = "ca_Bb9ryRq8djvH";
const status = await composio.connectedAccounts.get(CONN_ID);
console.log(JSON.stringify(status, null, 2));

if (status.status === "ACTIVE") {
  console.log("\n✅ ACTIVE — running smoke test");
  try {
    const result = await composio.tools.execute("SHOPIFY_LIST_PRODUCTS", {
      userId: process.env.COMPOSIO_ENTITY_ID,
      arguments: { limit: 3 },
    });
    console.log("\n✅ Tool call succeeded");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("❌ Tool call failed:", err?.message || err);
  }
} else {
  console.log(`\n⏳ Still ${status.status} — authorize URL probably not clicked yet.`);
  console.log("Authorize URL:  https://backend.composio.dev/api/v3/s/DEo7k3VL");
}
