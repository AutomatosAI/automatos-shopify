# Widget SDK — Rollback Runbook

**Applies to:** `https://sdk.automatos.app/` (S3 + CloudFront)
**Linked PRD:** [SHOPIFY-003](../PRDS/PRD-003-CDN-DISTRIBUTION.md)
**When to use:** a widget release is broken in the wild (console errors, hangs, broken rendering) and you need to restore the previous version or disable the widget entirely without redeploying the Partner app.

---

## Rollback paths (pick by severity)

| Severity | Symptom | Path |
|---|---|---|
| 1 — Minor regression, no console errors | Users report a rendering bug | **Roll forward:** cut a patch release (`v1.4.4`) via the normal pipeline |
| 2 — Widget broken but page unaffected | Widget doesn't render, no JS errors | **Restore previous version** (§1) |
| 3 — Widget causes JS errors on merchant pages | Storefronts show console errors, possibly breaking other scripts | **Kill-switch** (§2) |
| 4 — CDN itself is down / returns 5xx | Merchant stores getting `ERR_NAME_NOT_RESOLVED` or 503 | **CDN failover** (§3) — limited; this is a CloudFront uptime issue |

---

## 1. Restore previous version (Severity 2)

You're replacing the contents of `/v1/widget.js` with the contents of a known-good pinned version (e.g. `v1.4.2`).

```bash
# Prerequisites: AWS CLI authenticated as the widget-sdk deploy user/role
BUCKET=automatos-widget-sdk
DISTRIBUTION_ID=REPLACE_DISTRIBUTION_ID
GOOD_VERSION=v1.4.2   # the version you want to restore

# Confirm the good version still exists
aws s3 ls s3://$BUCKET/$GOOD_VERSION/

# Copy it into the stable channel
aws s3 cp s3://$BUCKET/$GOOD_VERSION/widget.js s3://$BUCKET/v1/widget.js \
  --cache-control "public, max-age=3600" \
  --content-type "application/javascript" \
  --metadata-directive REPLACE

# Invalidate the stable channel
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/v1/*"
```

**Time to effect:** ~60 seconds for CloudFront invalidation to propagate globally.

**Verify:**
```bash
curl -s https://sdk.automatos.app/v1/widget.js | head -c 200
# Should show the known-good build signature or version comment
```

**Merchants pinned to `/v1.4.3/`** (the bad version) stay on it until they re-pin. That's acceptable because pinned URLs are opt-in; merchants who pin take responsibility for tracking releases.

**After rollback:**
1. Open an incident issue in the `automatos-widget-sdk` repo.
2. Don't re-tag `v1.4.3` — increment to `v1.4.4` with the fix.

---

## 2. Kill-switch (Severity 3)

Upload a no-op IIFE to `/v1/widget.js` so storefronts still load the script (no 404, no CSP violation) but the widget renders nothing.

```bash
BUCKET=automatos-widget-sdk
DISTRIBUTION_ID=REPLACE_DISTRIBUTION_ID

cat > /tmp/widget-noop.js <<'EOF'
/* Automatos widget kill-switch — installed <TIMESTAMP> by <OPERATOR> */
(function(){
  window.AutomatosWidget = {
    init: function(){ /* no-op */ },
    version: "killswitch"
  };
})();
EOF

aws s3 cp /tmp/widget-noop.js s3://$BUCKET/v1/widget.js \
  --cache-control "public, max-age=60" \
  --content-type "application/javascript" \
  --metadata-directive REPLACE

aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/v1/*"
```

**Important differences from §1:**
- Cache-control lowered to 60s so recovery is fast when you re-deploy.
- The no-op still exports `window.AutomatosWidget.init` so merchant pages that call it don't throw.

**Communicate:**
- Post in `#incidents` / merchant Slack: "widget temporarily disabled pending fix".
- Update the Automatos dashboard status banner.

**Recovery** after the fix ships:
```bash
aws s3 cp s3://$BUCKET/<good_version>/widget.js s3://$BUCKET/v1/widget.js \
  --cache-control "public, max-age=3600" --metadata-directive REPLACE
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/v1/*"
```

---

## 3. CDN failover (Severity 4)

CloudFront's own SLA is 99.9%. When it's down, there's no CNAME-level dodge that helps — DNS is cached, TLS certs are tied to the distribution, and merchant storefronts will just fail to load the widget until CloudFront recovers.

**Mitigations on the merchant side:**
- Widgets are `defer`-loaded. Storefronts still render; only widgets are missing.
- Page consoles show a network error, not a JavaScript error — does not break merchant site functionality.

**What we can do:**
- Post status update to merchants.
- Monitor CloudFront Service Health Dashboard.
- If prolonged (>30 min): consider publishing a temporary bypass endpoint on the orchestrator that serves widget.js directly (authenticated, not for production long-term).

**What we should NOT do:**
- Do NOT re-point the CNAME. DNS TTL means changes take minutes to hours to propagate, and browsers + ISPs will cache the CloudFront address. The fix is always faster than DNS re-point at this scale.

---

## Rollback decision tree (tl;dr)

```
Does the bad release throw JS errors on merchant pages?
├── Yes → §2 Kill-switch (now)
└── No
    ├── Is it worth holding users on broken widget while we fix forward?
    │   ├── Hold → roll forward (cut patch release)
    │   └── No → §1 Restore previous version
    └── CDN itself down? → §3 (limited)
```

---

## Post-incident

1. Write a 1-page post-mortem in `docs/INCIDENTS/YYYY-MM-DD-widget-sdk-<slug>.md`.
2. Link to the tag/commit of the bad release, the error reports, the restore/kill-switch timestamp, the fix PR.
3. Add at least one regression check to the SDK test suite (playwright storybook snapshot, unit test, etc.).
4. If kill-switch was used: track time from detection → kill-switch → recovery. Target: <10 min detection, <2 min kill-switch.
