#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
APP="build/Reef.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
bash scripts/build-icon.sh
xcrun swiftc -swift-version 6 -target "$(uname -m)-apple-macosx14.0" -O -framework AppKit -framework WebKit native/DesktopGeometry.swift native/DesktopInput.swift native/ResourcePolicy.swift native/ReefStatusIcon.swift native/ReefApp.swift -o "$APP/Contents/MacOS/Reef"
# These images are embedded in aquarium.js; remove older duplicate copies.
rm -rf "$APP/Contents/Resources/textures"
cp dist/index.html dist/aquarium.js "$APP/Contents/Resources/"
cp assets/icons/Reef.icns "$APP/Contents/Resources/"
cp assets/models/BarramundiFish-LICENSE.md "$APP/Contents/Resources/"
cp assets/models/corals/credits.json "$APP/Contents/Resources/Coral-credits.json"
cp assets/textures/credits.json "$APP/Contents/Resources/Texture-credits.json"
cp docs/THIRD_PARTY.md "$APP/Contents/Resources/"
cp LICENSE "$APP/Contents/Resources/Reef-LICENSE.txt"
cp LICENSES/CC0-1.0.txt "$APP/Contents/Resources/"
cp vendor/threejs-water/LICENSE "$APP/Contents/Resources/Water-LICENSE.txt"
cp node_modules/three-mesh-bvh/LICENSE "$APP/Contents/Resources/Three-mesh-bvh-LICENSE.txt"
cp node_modules/three/LICENSE "$APP/Contents/Resources/Three-LICENSE.txt"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleExecutable</key><string>Reef</string><key>CFBundleIdentifier</key><string>local.reef.aquarium</string><key>CFBundleName</key><string>Reef</string><key>CFBundleIconFile</key><string>Reef.icns</string><key>CFBundleVersion</key><string>20</string><key>CFBundleShortVersionString</key><string>1.0.1</string><key>CFBundlePackageType</key><string>APPL</string><key>NSHumanReadableCopyright</key><string>Copyright © 2026 Rahul Chakraborty. Original code licensed under MIT.</string><key>LSMinimumSystemVersion</key><string>14.0</string><key>LSUIElement</key><true/><key>NSHighResolutionCapable</key><true/></dict></plist>
PLIST
# Finder may add these metadata attributes after the last build.
# Strip only signing-incompatible metadata from this generated bundle.
xattr -dr com.apple.FinderInfo "$APP" 2>/dev/null || true
xattr -dr com.apple.ResourceFork "$APP" 2>/dev/null || true
codesign --force --deep --sign - "$APP"
printf 'Built %s\n' "$APP"
