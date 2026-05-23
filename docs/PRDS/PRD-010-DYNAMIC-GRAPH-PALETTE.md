# PRD: Platform-agnostic Business Graph viz — palette + chips from data

**PRD ID:** SHOPIFY-010
**Status:** Draft v0.1 — queued post PRD-009 stabilisation
**Owner:** Gerard
**Date:** 2026-05-23
**Priority:** P2 — non-blocking for InbuildUK but blocking for the second non-Shopify merchant or any non-ecommerce workspace.

**Related work:**
- PRD-009 (Product Knowledge Grounding) — Layer 1, 2 shipped. The graph viz built for it has Shopify-specific assumptions hard-coded.
- Future: WooCommerce, BigCommerce, Amazon Selling Partner, plus non-ecommerce workspaces (document graphs, codebase graphs, process graphs).

---

## Why this PRD exists

The Business Graph view (`frontend/components/knowledge/BusinessGraphVisualization.tsx` + `BusinessGraphPanel.tsx`) currently ships with hard-coded mappings:

```ts
const TYPE_COLORS: Record<string, string> = {
  shopify_product:    "#ff5e3a",
  shopify_variant:    "#ffb347",
  shopify_vendor:     "#c084fc",
  shopify_collection: "#10e89e",
  shopify_metafield:  "#38bdf8",
};

const RELATION_COLORS: Record<string, string> = {
  variant_of:             "#ffb347",
  in_collection:          "#10e89e",
  by_vendor:              "#c084fc",
  has_metafield:          "#38bdf8",
  frequently_bought_with: "#ff3d8c",
};

const TYPE_DISPLAY = { shopify_product: { label: 'Products', ... } }
const RELATION_DISPLAY = { frequently_bought_with: { label: 'Order pairs', ... } }
```

This works for the InbuildUK PoC but breaks the moment any workspace's graph contains node types or relations the viz doesn't know about. The chips disappear, fallback colours are dull greys, and the user sees a generic blob with no semantic meaning.

The data model is already platform-agnostic — `graph_extraction.py` accepts any `_node(file_type=...)` and `_edge(relation=...)` strings. The visualisation should be too.

---

## Goal

The graph viz works out-of-the-box for any workspace, regardless of which platform / data source seeded the graph. Specifically:

1. **Auto-discover** the set of node types and edge relations from `graph.json` + `meta.json`
2. **Auto-assign** stable, visually distinct colours per type and per relation, deterministically (so the same type always gets the same colour across reloads, even if its position in the discovery order changes)
3. **Auto-label** node types and relations from the type/relation string when no human-friendly label exists in metadata
4. **Honour explicit overrides** — workspaces can ship a `palette.json` (or expose via meta) that says "in this graph, `customer_segment` should be #00ddaa labelled 'Segments'". Falls back to auto-assign when no override is present.
5. Keep the Shopify experience pixel-identical (this is a refactor + extension, not a redesign).

---

## Non-goals

- Not redesigning the graph viz itself (force layout, drill-in, fullscreen, etc. all stay).
- Not auto-detecting node/edge SEMANTICS (e.g. "this looks like a product catalog"). Just colour + label.
- Not introducing per-merchant configurable colour pickers in the UI. Override is via metadata, not in-app config.

---

## Current state

| Component | Hard-coded? | Source of truth |
|---|---|---|
| `TYPE_COLORS` | ✗ Yes — 5 shopify_* keys + 5 catch-alls | `BusinessGraphVisualization.tsx` |
| `COMMUNITY_COLORS` | ✓ Generic — 24-colour wheel | `BusinessGraphVisualization.tsx` |
| `RELATION_COLORS` | ✗ Yes — 5 Shopify relations | `BusinessGraphVisualization.tsx` |
| `TYPE_DISPLAY` (chip labels + order) | ✗ Yes — 5 shopify_* keys | `BusinessGraphPanel.tsx` |
| `RELATION_DISPLAY` (chip labels + order) | ✗ Yes — 5 Shopify relations | `BusinessGraphPanel.tsx` |

Anything not in these tables falls through to a dull grey or `.replace(/_/g, ' ')`. Functional but not WOW.

---

## Architecture — the four moving parts

### 1. Palette resolver (new — `frontend/lib/graph/palette.ts`)

```ts
export function resolvePalette(graph: GraphData, meta?: GraphMeta) {
  // 1. Collect distinct node types + edge relations from the data
  // 2. Check workspace meta for an `overrides.types` / `overrides.relations` block
  // 3. For uncovered types/relations, deterministically assign from the
  //    24-colour wheel using a stable hash of the type-name string.
  //    Same type-name → same colour across sessions, merchants, workspaces.
  // 4. Generate prettyLabel from the type-name (snake_case → Title Case),
  //    overridable by metadata.
  // 5. Return { nodeTypes: [{ type, label, color, count }],
  //             relations: [{ relation, label, color, count }] }
}
```

### 2. Built-in domain packs (new — `frontend/lib/graph/domain-packs.ts`)

Bundled overrides for known domains. Auto-applied when the resolver detects their signature node types.

```ts
export const DOMAIN_PACKS = {
  shopify: {
    detect: (types) => types.has('shopify_product'),
    types: {
      shopify_product:    { label: 'Products',    color: '#ff5e3a', order: 1 },
      shopify_variant:    { label: 'Variants',    color: '#ffb347', order: 2 },
      // ... existing mapping
    },
    relations: { /* existing */ },
  },
  // Future:
  woocommerce: { detect: (types) => types.has('woo_product'), ... },
  bigcommerce: { ... },
  codebase:    { detect: (types) => types.has('python_module'), ... },
  documents:   { detect: (types) => types.has('document_chunk'), ... },
};
```

A workspace pulls the matching domain pack automatically. Multi-domain workspaces (e.g. a graph mixing Shopify + Documents) layer both packs.

### 3. Workspace-level overrides (new — `meta.json` extension)

`GraphifyService` already exports `meta.json`. Extend the export to include:

```json
{
  "node_count": 24505,
  "edge_count": 29889,
  "palette_overrides": {
    "types": {
      "custom_segment": { "label": "Customer Segments", "color": "#7c3aed" }
    },
    "relations": {
      "bought_via_promotion": { "label": "Promo-driven", "color": "#facc15" }
    }
  }
}
```

Merchant- / workspace-specific overrides take precedence over domain packs.

### 4. Viz component refactor

`BusinessGraphVisualization.tsx` and `BusinessGraphPanel.tsx` stop hard-coding `TYPE_COLORS`/`RELATION_COLORS`/`TYPE_DISPLAY`/`RELATION_DISPLAY`. They accept a resolved palette as a prop (computed once per graph load in the panel). The viz becomes pure render-with-palette.

---

## Stable colour assignment for unknown types

```ts
// Deterministic: same type-name always gets the same wheel index,
// even before any domain pack is registered.
const PALETTE_24 = [...]   // existing community palette
function colorFor(typeName: string): string {
  let hash = 0;
  for (const c of typeName) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return PALETTE_24[Math.abs(hash) % PALETTE_24.length];
}
```

So `'customer_lead'` always lands on PALETTE_24[7] across reloads. No flicker, no random reshuffling on every graph rebuild.

---

## Backwards compatibility

| Workspace | Today | After this PRD |
|---|---|---|
| InbuildUK (Shopify) | Hard-coded Shopify chips | Same chips, same colours — domain-pack resolves identically |
| New WooCommerce merchant | All grey, no labels | Auto-discovered + WooCommerce pack labels & colours |
| Document graph | All grey | Auto-coloured by hash, prettified labels |
| Custom workspace with `palette_overrides` set | Ignored | Honoured |

No data migration. No breaking change. Same chips for Shopify users.

---

## Implementation phases

### Phase 1 — Resolver + viz refactor (no Shopify visual change)
- Extract palette resolution into `frontend/lib/graph/palette.ts`
- Move existing Shopify mapping into `frontend/lib/graph/domain-packs.ts`
- Pass resolved palette as a prop to `BusinessGraphVisualization` and chip renderers
- Add deterministic hash-based fallback for unknown types
- **Acceptance:** InbuildUK graph viz is byte-identical to today's render
- **Effort:** 2-3 hours

### Phase 2 — `meta.json` override schema + GraphifyService support
- Extend `GraphifyService._build_meta` to include `palette_overrides` from workspace settings if present
- Frontend resolver picks up overrides from meta
- **Acceptance:** Setting `workspace.settings.graph_palette_overrides` in DB applies immediately to next graph load
- **Effort:** 1-2 hours

### Phase 3 — Additional built-in domain packs (as integrations land)
- WooCommerce, BigCommerce, Amazon SP-API
- Code-graph (when codebase ingestion lands)
- Document-graph (already partly there via the existing extraction pipeline)
- **Acceptance:** Each new integration ships with a domain pack alongside the data mapper
- **Effort:** ~30 min per pack

---

## Acceptance criteria — what "done" looks like

| Check | Pass condition |
|---|---|
| InbuildUK Business Graph view | Visually identical to current Shopify experience |
| Graph with type `custom_segment` (no pack, no override) | Gets a deterministic colour from the 24-wheel + "Custom Segment" label |
| Graph with workspace `palette_overrides.types.custom_segment` set | Uses the override colour and label |
| Multi-domain graph (Shopify + Documents) | Both packs' chips appear, no collision in colours |
| Same workspace reloaded twice | Same colours assigned to the same types (no flicker) |
| Adding a new platform integration | Engineer ships a domain pack file alongside the data mapper — no viz changes needed |

---

## Open questions

| # | Question | Default |
|---|---|---|
| 1 | Should domain packs live in `frontend/` or in the orchestrator (so backend can render server-side too)? | Frontend for v1; backend can re-import same JSON later if SSR needed |
| 2 | Many node types (>24 unique) → palette wraps. Acceptable? | Yes — adjacent same-colour types disambiguated by chip labels |
| 3 | Should chips be reorderable by the user? | Defer — `order` field in overrides is enough for v1 |
| 4 | When a type has no count (>0 nodes), still show its chip? | No — chips only for types/relations actually present in the data |

---

## Cross-references

- Existing viz: `frontend/components/knowledge/BusinessGraphVisualization.tsx`
- Existing palette code (to be moved): `BusinessGraphVisualization.tsx` lines ~90-130 + `BusinessGraphPanel.tsx` lines ~270-330
- Data shape: `orchestrator/modules/knowledge/graph_extraction.py` (already platform-agnostic — uses arbitrary `file_type` / `relation` strings)
- GraphifyService meta export: `orchestrator/modules/knowledge/graph_service.py::_build_meta`
