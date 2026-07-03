import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { automatosClient } from "../automatos.server";

/**
 * Catalog-mutation webhooks → platform /events (PRD-183 S1).
 *
 * Topics: PRODUCTS_CREATE/UPDATE/DELETE, COLLECTIONS_CREATE/UPDATE/DELETE.
 * These drive the incremental commerce-graph refresh (PRD-009 sub-60s freshness).
 *
 * F032: the platform's incremental graph builder filters pending sources on the
 * `type`/`id` keys, so we forward `{type: "<resource>", id: "<gid>", ...}` via
 * `onCatalogEvent`.
 */

/** Map a Shopify webhook topic to (resource, verb). */
function parseCatalogTopic(
  topic: string,
): { resource: "products" | "collections"; verb: "create" | "update" | "delete" } | null {
  switch (topic) {
    case "PRODUCTS_CREATE":
      return { resource: "products", verb: "create" };
    case "PRODUCTS_UPDATE":
      return { resource: "products", verb: "update" };
    case "PRODUCTS_DELETE":
      return { resource: "products", verb: "delete" };
    case "COLLECTIONS_CREATE":
      return { resource: "collections", verb: "create" };
    case "COLLECTIONS_UPDATE":
      return { resource: "collections", verb: "update" };
    case "COLLECTIONS_DELETE":
      return { resource: "collections", verb: "delete" };
    default:
      return null;
  }
}

/** Extract the Shopify GID from a catalog webhook payload. */
function extractGid(
  resource: "products" | "collections",
  payload: Record<string, unknown>,
): string | undefined {
  // Shopify includes the GraphQL global id on most catalog webhooks.
  const gql = payload["admin_graphql_api_id"];
  if (typeof gql === "string" && gql.length > 0) return gql;
  // DELETE topics send only a numeric id — synthesise the GID so downstream
  // filtering still has a stable identifier.
  const numericId = payload["id"];
  if (numericId !== undefined && numericId !== null) {
    const kind = resource === "products" ? "Product" : "Collection";
    return `gid://shopify/${kind}/${String(numericId)}`;
  }
  return undefined;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  const parsed = parseCatalogTopic(topic);
  if (!parsed) {
    // Not a catalog topic we subscribe to — ack so Shopify stops retrying.
    return new Response();
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const id = extractGid(parsed.resource, body);

  await automatosClient.onCatalogEvent(
    shop,
    parsed.resource,
    parsed.verb,
    id,
    body,
  );

  return new Response();
};
