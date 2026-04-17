#!/bin/bash
# Build the widget SDK and copy widget.js into the Shopify theme extension assets.
#
# Usage:
#   ./scripts/build-widgets.sh
#
# Prerequisites:
#   - Node 20+ (nvm use 20)
#   - pnpm installed in automatos-widget-sdk

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHOPIFY_DIR="$(dirname "$SCRIPT_DIR")"
SDK_DIR="$(dirname "$SHOPIFY_DIR")/automatos-widget-sdk"
EXTENSION_ASSETS="$SHOPIFY_DIR/extensions/automatos-theme/assets"

echo "==> Building widget SDK..."
cd "$SDK_DIR"

if ! command -v pnpm &> /dev/null; then
    echo "pnpm not found, installing..."
    npm install -g pnpm
fi

pnpm install --frozen-lockfile 2>/dev/null || pnpm install
pnpm build

echo "==> Copying widget.js to theme extension..."
WIDGET_FILE="$SDK_DIR/packages/loader/dist/widget.global.js"

if [ ! -f "$WIDGET_FILE" ]; then
    echo "ERROR: widget.global.js not found at $WIDGET_FILE"
    echo "Check the loader build output."
    exit 1
fi

cp "$WIDGET_FILE" "$EXTENSION_ASSETS/widget.js"

FILESIZE=$(wc -c < "$EXTENSION_ASSETS/widget.js" | tr -d ' ')
echo "==> Done! widget.js copied ($FILESIZE bytes)"
echo "    → $EXTENSION_ASSETS/widget.js"
