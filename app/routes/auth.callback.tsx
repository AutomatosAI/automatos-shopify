import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { provisionAndStore } from "../provision.server";

/**
 * Post-install callback — provisions Automatos workspace and stores credentials.
 *
 * Flow:
 * 1. Shopify OAuth completes → we have access token + shop info
 * 2. provisionAndStore → mints the public widget key, stores the Shopify
 *    token, and caches the key against the shop so Settings can show it
 * 3. Redirect to embedded app
 *
 * Failures are logged but don't block the install — the merchant can
 * re-trigger provisioning from app settings if anything failed.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  try {
    const workspace = await provisionAndStore(admin, session);
    console.log(
      `[automatos] provisioned ${session.shop}: workspace=${workspace.public_id} ` +
        `agents=${workspace.agents_installed} is_new=${workspace.is_new} ` +
        `key_prefix=${workspace.api_key.slice(0, 12)}...`,
    );
  } catch (error) {
    console.error(
      `[automatos] provisioning failed for ${session.shop} — install will continue, retry from app settings:`,
      error,
    );
  }

  throw new Response(null, {
    status: 302,
    headers: { Location: "/app" },
  });
};
