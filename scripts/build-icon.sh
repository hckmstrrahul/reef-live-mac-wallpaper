#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
SOURCE="assets/icons/Reef.png"
ICONSET="build/Reef.iconset"
mkdir -p "$ICONSET"
# Preserve the generated alpha while making every native 1x / Retina size.
for size in 16 32 128 256 512; do
    sips -z "$size" "$size" "$SOURCE" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
    retina=$((size * 2))
    sips -z "$retina" "$retina" "$SOURCE" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o assets/icons/Reef.icns
