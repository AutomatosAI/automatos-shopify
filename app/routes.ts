import { type RouteConfig } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

/**
 * React Router 7 route configuration.
 *
 * Uses `flatRoutes()` so the existing flat-named modules under `app/routes/*`
 * (e.g. `app.tsx`, `app._index.tsx`, `webhooks.*.tsx`, `auth.$.tsx`) are
 * discovered by convention — matching the Shopify Remix template layout.
 *
 * Without this file `npx react-router routes` and `npm run build` fail with
 * "Route config file not found at app/routes.ts" (F013), which also means the
 * subscribed webhook URIs never resolve.
 */
export default flatRoutes({
  // Co-located *.test.ts(x) files must not be treated as routes (they would
  // otherwise be bundled by the build and collide on a `test` path).
  ignoredRouteFiles: ["**/*.test.{ts,tsx}"],
}) satisfies RouteConfig;
