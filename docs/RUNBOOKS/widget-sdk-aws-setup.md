# Widget SDK CDN — AWS Setup Checklist

**Runbook for:** standing up `sdk.automatos.app` (S3 + CloudFront + Route 53 + ACM) for the first time.
**Prerequisite PRD:** [SHOPIFY-003](../PRDS/PRD-003-CDN-DISTRIBUTION.md)
**Status:** DRAFT — work through in order. One-way steps are flagged. Stop and think before running them.

---

## 0. Pre-flight

- [ ] Confirm AWS account: `aws sts get-caller-identity` — must be the Automatos prod account.
- [ ] Confirm Route 53 hosted zone for `automatos.app` exists. `aws route53 list-hosted-zones --query "HostedZones[?Name=='automatos.app.']"`.
- [ ] Pick primary bucket region. **Recommended: `us-east-1`** (CloudFront + ACM require `us-east-1` for cert, keeping the bucket there too simplifies ops). If you already run everything in `eu-west-1`, the bucket can live there — only the ACM cert must be `us-east-1`.
- [ ] Decide stage handling: single bucket for all envs (use prefix paths like `/staging/v1/`) vs separate bucket per env. **Recommended: single bucket, one distribution, use channel paths (`/v1/`, `/beta/`).**

---

## 1. S3 bucket

```bash
BUCKET=automatos-widget-sdk
REGION=us-east-1

aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$REGION"
# If region != us-east-1, add: --create-bucket-configuration LocationConstraint="$REGION"

aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicAccess=true

aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled
```

Versioning enabled so that a bad deploy can be restored via S3 object-version pin even if the rollback alias is slow.

---

## 2. ACM certificate (must be us-east-1)

```bash
aws acm request-certificate \
  --region us-east-1 \
  --domain-name sdk.automatos.app \
  --validation-method DNS \
  --key-algorithm RSA_2048
```

- [ ] Capture `CertificateArn` from output.
- [ ] `aws acm describe-certificate --certificate-arn $CERT_ARN --region us-east-1` to get the DNS CNAME validation record.
- [ ] Create the validation CNAME in Route 53. Cert status → `ISSUED` in ~2–5 minutes.

---

## 3. CloudFront distribution

Create a distribution with:

- **Origin:** the S3 bucket (REST endpoint, not website endpoint).
- **Origin access:** **Origin Access Control (OAC)** — not legacy OAI. Create OAC named `automatos-widget-sdk-oac` (SigV4, always sign). CloudFront console will offer "Update bucket policy" — allow it.
- **Viewer protocol policy:** Redirect HTTP → HTTPS.
- **Allowed methods:** GET, HEAD, OPTIONS.
- **Alternate domain name (CNAME):** `sdk.automatos.app`.
- **SSL certificate:** the ACM cert from step 2.
- **Price class:** `Use All Edge Locations` (first deploy — tune down later if cost matters).
- **Default cache behaviour:**
  - Cache policy: `CachingOptimized` baseline, overridden per path below.
  - Origin request policy: `CORS-S3Origin`.
  - Response headers policy: create `automatos-widget-sdk-cors` (Access-Control-Allow-Origin: `*`, Access-Control-Allow-Methods: `GET, HEAD, OPTIONS`).
- **Path-specific cache behaviours** (add AFTER distribution creation; CloudFront needs the default behaviour first):

  | Path pattern | TTL (default / min / max) | Notes |
  |---|---|---|
  | `/v1/*` | 3600 / 0 / 3600 | Stable channel — invalidated on every release |
  | `/v[0-9]*.[0-9]*.[0-9]*/*` | 31536000 / 31536000 / 31536000 | Immutable pinned versions — never invalidate |
  | `/beta/*` | 300 / 0 / 300 | Internal-only; robots `noindex` header via response policy |

- [ ] Record `DistributionId` and `DomainName` (e.g. `d123abc.cloudfront.net`).

**Bucket policy** (CloudFront console will draft it; the canonical form is):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "AllowCloudFrontOAC",
    "Effect": "Allow",
    "Principal": { "Service": "cloudfront.amazonaws.com" },
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::automatos-widget-sdk/*",
    "Condition": {
      "StringEquals": {
        "AWS:SourceArn": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"
      }
    }
  }]
}
```

---

## 4. Route 53 alias

Create an A record (and optionally AAAA):

- Name: `sdk.automatos.app`
- Type: A — Alias
- Alias target: the CloudFront distribution (`d123abc.cloudfront.net`)
- Evaluate target health: No

Verify with `dig sdk.automatos.app` after a minute. Then:

```bash
curl -sI https://sdk.automatos.app/
# Expect 403 (bucket root — no default object), but TLS handshakes cleanly.
```

---

## 5. Deploy IAM user (least privilege)

Create a dedicated IAM user (or, preferred, an OIDC federated role — see step 5b).

### 5a. IAM user (MVP path — long-lived keys)

```bash
aws iam create-user --user-name automatos-widget-sdk-deploy
aws iam put-user-policy \
  --user-name automatos-widget-sdk-deploy \
  --policy-name WidgetSdkDeploy \
  --policy-document file://infra/iam/widget-sdk-deploy-policy.json
aws iam create-access-key --user-name automatos-widget-sdk-deploy
```

- [ ] Stash the `AccessKeyId` + `SecretAccessKey` **once** (won't be shown again).
- [ ] Add to `automatos-widget-sdk` GitHub repo secrets as `AWS_SDK_DEPLOY_ACCESS_KEY_ID` + `AWS_SDK_DEPLOY_SECRET_ACCESS_KEY`.
- [ ] Calendar rotation: every 90 days.

### 5b. OIDC federation (preferred — zero long-lived creds)

Only if the AWS account already has `token.actions.githubusercontent.com` as an OIDC provider, or if you're comfortable creating one.

1. Create the OIDC provider (one-time per account).
2. Create role `automatos-widget-sdk-deploy` with trust policy restricted to `repo:automatos-ai/automatos-widget-sdk:ref:refs/tags/v*` (only release tags can assume).
3. Attach the same `WidgetSdkDeploy` policy.
4. In the workflow: `aws-actions/configure-aws-credentials@v4` with `role-to-assume` + `role-session-name`.

**Recommendation:** ship 5a first to unblock PRD-003, then migrate to 5b within the same sprint.

---

## 6. Initial seed

Before flipping theme extensions over, seed the bucket with a placeholder so merchants who hit the URL don't see a 403:

```bash
# Upload a minimal no-op bundle to the stable channel
echo '(function(){window.AutomatosWidget={init:function(){console.warn("widget.js placeholder — CDN seeded but no build deployed yet");}};})();' \
  | aws s3 cp - s3://automatos-widget-sdk/v1/widget.js \
      --cache-control "public, max-age=3600" \
      --content-type "application/javascript"

aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/v1/*"
```

Verify:
```bash
curl -s https://sdk.automatos.app/v1/widget.js | head -c 200
curl -sI https://sdk.automatos.app/v1/widget.js | grep -Ei "content-type|cache-control"
```

Expect 200, correct content-type, cache-control.

---

## 7. Run the real deploy pipeline (in `automatos-widget-sdk`)

Once secrets are wired:

1. Tag a release in `automatos-widget-sdk`: `git tag v1.4.3 && git push --tags`.
2. GitHub Actions workflow runs → `pnpm build` → `aws s3 sync` → invalidation → smoke test.
3. Verify: `curl -sI https://sdk.automatos.app/v1/widget.js` — 200, fresh `Last-Modified`.

---

## 8. Theme extension cutover (separate PR)

**ONLY do this after step 7 succeeds.** The cutover PR is small and reversible but DOES require a `shopify app deploy` to take effect on merchant storefronts.

For each file in `extensions/automatos-theme/blocks/*.liquid`:

- Remove `"javascript": "widget.js"` from the `{% schema %}` block (stops Shopify auto-bundling the local copy).
- Replace `<script src="{{ 'widget.js' | asset_url }}" defer></script>` with `<script src="https://sdk.automatos.app/v1/widget.js" defer></script>`.

Then:

- `shopify app deploy` — pushes updated theme extension.
- Test on `1lovefragrance` dev store first (the block still reads from `v1` which is unchanged — zero risk if step 7 seeded correctly).
- Delete `extensions/automatos-theme/assets/widget.js` in the same PR.

See [widget-sdk-rollback.md](./widget-sdk-rollback.md) before doing anything irreversible.

---

## 9. Observability (day 2)

- CloudWatch alarm: `5xx-rate > 1% for 5 min` on the distribution → PagerDuty.
- CloudWatch alarm: `Requests` dropping to zero for 15 min (merchant storefronts still load widget.js constantly — zero means the URL died).
- Budget alarm: $50/mo hard cap for the distribution (widget JS is tiny; if bill spikes, something's wrong).

---

## Costs (ballpark)

For 100 merchants × 1000 pageviews/day × 10 KB widget.js = 1 GB/day egress.
- S3: storage pennies.
- CloudFront: ~$0.085/GB egress × 30 GB/mo = $2.55/mo.
- Invalidations: first 1000 paths/mo free. We invalidate one path per release (`/v1/*`).

Rounds to **under $5/mo for the PoC scale.** Budget alarm at $50 gives 10x headroom.

---

## Decision points flagged

- **OIDC vs IAM user:** long-term answer is OIDC. Ship IAM user for PRD-003 unblocking.
- **Bucket region:** `us-east-1` unless you have strong reasons otherwise.
- **Price class:** `All` for first month; downgrade to `100` if you only serve EU/NA and cost matters.
- **Multi-distribution for staging/prod:** single distribution with path-prefixed channels (`/v1/`, `/beta/`, `/staging/`) is simpler; revisit only if beta traffic starts evicting stable cache entries (it won't at PoC scale).

---

## "Done" definition

- [ ] `curl -sI https://sdk.automatos.app/v1/widget.js` returns 200 with `content-type: application/javascript`.
- [ ] A fresh `git tag v1.4.x && git push --tags` flows through GitHub Actions → bucket → invalidation → live URL inside 5 minutes.
- [ ] Rollback runbook tested once in staging.
- [ ] IAM key / OIDC role documented in 1Password under "Automatos Widget SDK".
- [ ] Theme extension cutover PR merged; `extensions/automatos-theme/assets/widget.js` deleted.
