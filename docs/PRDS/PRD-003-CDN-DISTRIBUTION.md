# PRD: Widget SDK CDN Distribution

**PRD ID:** SHOPIFY-003
**Status:** Draft
**Owner:** Gerard
**Date:** 2026-04-16
**Priority:** P1 — Unblocks fast widget iteration without theme-extension re-releases

---

## Problem

`widget.js` (IIFE build of `@automatos/loader`) is currently copied into `extensions/automatos-theme/assets/` via `scripts/build-widgets.sh` and served from Shopify's theme CDN. This means:

1. **Every widget code change requires a theme-extension release.** `shopify app deploy` is slow, rate-limited, and touches the whole app release (not just widgets).
2. **No rollback granularity.** If v1.3.1 breaks on iOS, you can't pin merchants to v1.3.0 without re-releasing the extension.
3. **No channel separation.** Can't ship beta-quality widgets to ourselves while stable merchants pin to the released version.
4. **Bundle size coupled to extension.** Adding the next 7 widgets bloats the extension payload even for merchants who don't install all of them.

The SDK README already anticipates this: it documents `https://sdk.automatos.app/v1/widget.js` as the install URL. That domain does not resolve yet.

---

## Goal

Stand up `sdk.automatos.app` as the authoritative CDN for widget JS, decouple widget releases from Partner-app releases, and put a versioning pattern in place before adding more widgets.

---

## Success Criteria

| Check | Pass condition |
|---|---|
| `sdk.automatos.app/v1/widget.js` returns 200 | Yes |
| Theme extension app blocks load from CDN, not bundled asset | Yes |
| Widget update deploys in < 5 minutes | From `pnpm build` to live |
| Version pinning supported | `/v1/`, `/v1.4.2/`, `/beta/` all resolve |
| Cache-control + invalidation working | Stable channel cached 1hr, version-pinned immutable |
| Existing chat widget on 1lovefragrance keeps working through the cutover | Yes |

---

## Scope

### In scope
- Provision `sdk.automatos.app` (DNS + TLS + CDN)
- Decide origin: object store (S3 / R2 / etc.) — container-backed origin is overkill for static assets
- Build + deploy pipeline from `automatos-widget-sdk` repo to CDN
- Versioning scheme: `/vMAJOR/<file>` (stable channel) + `/vMAJOR.MINOR.PATCH/<file>` (immutable) + `/beta/<file>` (internal)
- Cache-control headers per path pattern
- Update `extensions/automatos-theme/blocks/*.liquid` to load from CDN URL
- Update `scripts/build-widgets.sh` — either retire it or repurpose for a local dev fallback
- Rollback procedure documented

### Out of scope
- Widget SDK architecture changes (packages stay as-is)
- Multi-region edge optimization (single origin is fine for MVP; measure latency first)
- Per-merchant bundle customization (all merchants get the same widget.js)
- Private / per-tenant CDN paths

---

## Implementation plan

### 1. Infrastructure — AWS S3 + CloudFront

**Decision:** use existing AWS footprint. S3 origin + CloudFront distribution + ACM cert for `sdk.automatos.app`. Rationale: infra is already provisioned, IAM / billing / CloudWatch integrated, zero new-provider onboarding.

**Concrete pieces:**

- **Bucket:** `automatos-widget-sdk` (private — access only via CloudFront OAC, never direct S3 URLs)
- **Distribution:** new CloudFront distribution with origin = the bucket, OAC (Origin Access Control) enforced
- **Cert:** ACM in `us-east-1` (CloudFront requirement) for `sdk.automatos.app`
- **DNS:** Route 53 `sdk.automatos.app` A/AAAA alias → CloudFront distribution
- **Cache policies:**
  - `/v1/*` — TTL 1hr (stable channel, invalidated on release)
  - `/v[0-9]+\.[0-9]+\.[0-9]+/*` — TTL 1 year, immutable (pinned versions never change)
  - `/beta/*` — TTL 5 min, no public indexing
- **CORS:** `Access-Control-Allow-Origin: *` on JS assets (public by design, same as any npm CDN); restrict via content, not origin

**Known CloudFront gotchas worth planning around:**

- Cache invalidation takes ~60s to fully propagate. Immutable version paths sidestep this — release path is *upload v1.4.3 → flip `/v1/` alias → invalidate only `/v1/*`*. Merchants on pinned versions are unaffected.
- First 1,000 invalidation paths/month are free. Budget for the stable `/v1/*` pattern only; never invalidate version-pinned paths.
- Signed URLs not needed for widgets — they're public.

**Out of scope:** multi-region replication (S3 + CloudFront is already global-edge; bucket region choice is admin-only concern).

### 2. Domain + TLS
- Register `sdk.automatos.app` as a CNAME to the CDN
- Issue TLS cert (auto via CDN provider)
- Verify browsers accept cert from a Shopify storefront (no mixed-content warnings)

### 3. Path layout

```
https://sdk.automatos.app/
  v1/
    widget.js           ← stable latest (1hr cache, invalidated on release)
    chat.js             ← chat-only bundle (future split)
    blog.js             ← blog-only bundle
  v1.4.2/               ← immutable pinned version (1yr cache)
    widget.js
  beta/                 ← internal only, short cache, no-index
    widget.js
```

### 4. Build + deploy pipeline

Live in `automatos-widget-sdk`. GitHub Actions workflow triggered on release tag:

1. `pnpm install && pnpm build` — produces `packages/loader/dist/widget.global.js` + per-widget bundles
2. `aws s3 sync` to both paths:
   - `s3://automatos-widget-sdk/v1.4.3/` (immutable version path)
   - `s3://automatos-widget-sdk/v1/` (stable channel alias)
3. `aws cloudfront create-invalidation --paths "/v1/*"` — only the stable channel
4. Smoke test: `curl -I https://sdk.automatos.app/v1/widget.js` returns 200 + expected `Cache-Control`

**Secrets:** AWS IAM deploy user with least-privilege policy scoped to the one bucket + one distribution, credentials stored as GitHub Actions repo secrets (`AWS_SDK_DEPLOY_ACCESS_KEY_ID`, `AWS_SDK_DEPLOY_SECRET_ACCESS_KEY`). Rotate on a schedule.

**Alternative:** OIDC federation (GitHub → AWS) instead of long-lived keys — strictly better if the AWS account is already OIDC-wired for other deploys. Worth doing if low-effort, not a blocker for MVP.

### 5. Theme extension cutover

Update `extensions/automatos-theme/blocks/chat-widget.liquid` from:

```liquid
<script src="{{ 'widget.js' | asset_url }}" defer></script>
```

to:

```liquid
<script src="https://sdk.automatos.app/v1/widget.js" defer></script>
```

Same pattern for `blog-widget.liquid`, `product-qa.liquid`, `review-summary.liquid`.

After cutover, `extensions/automatos-theme/assets/widget.js` can be deleted. `scripts/build-widgets.sh` retires (or repurposes for local dev with a `?dev=1` override).

### 6. Rollback procedure

Document in `COMPOSIO-SHOPIFY-SETUP.md` + this PRD:

- **Ship bad version:** `aws s3 cp s3://automatos-widget-sdk/v1.4.2/widget.js s3://automatos-widget-sdk/v1/widget.js && aws cloudfront create-invalidation --paths "/v1/*"`. Prior version restores in ~60s. Merchants pinned to `/v1.4.3/` stay on the bad version until they pin forward again — acceptable because pinned merchants are opt-in.
- **Emergency kill-switch:** upload a no-op IIFE (`(function(){window.AutomatosWidget={init:function(){}};})();`) to `/v1/widget.js`. Storefronts still load the script successfully but widgets render nothing, preventing console errors and hangs even if the backend is down.
- **Runbook location:** `docs/RUNBOOKS/widget-sdk-rollback.md` (new file, link from this PRD once created).

---

## Risks

| Risk | Mitigation |
|---|---|
| Shopify CSP rejects external CDN script | Verify `script-src` compatibility with `sdk.automatos.app` on a real storefront before cutover; may need a theme permission adjustment |
| Cache stampede on release | Version-immutable path absorbs load; stable `/v1/` invalidation is small payload anyway |
| CDN outage takes down all merchant widgets | CloudWatch alarm on 5xx rate; kill-switch bundle; CloudFront's own uptime SLA (99.9%) is the realistic floor — don't over-engineer |
| Asset-url breakage during cutover | Roll out to 1lovefragrance first, monitor, then deploy extension change to all |

---

## Open questions

- Are we building per-widget split bundles now (`chat.js`, `blog.js`) or deferring until size matters? Current combined `widget.js` is ~9.3 KB gzip, can carry several widgets before splitting pays off.
- Public API key handling when widget code is fully client-side — see SHOPIFY-006.
- SLO for CDN availability? "99.9%" might be stricter than the CDN provider itself — document realistic floor.
