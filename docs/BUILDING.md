# Building and using Reef

## Native Mac app

- macOS 14+, Node.js 22+, npm, and a Swift 6 toolchain via Xcode or Command Line Tools.
- Recommended: Apple silicon with 16 GB RAM or more, starting with Balanced quality. Pro/Max GPU capacity is preferable for High or multiple large displays. This is guidance, not a benchmarked minimum; only Apple M5 Max has been measured.
- Tested locally on Apple silicon. The build targets the current machine’s architecture, not a universal binary.
- No Blender, Python or paid developer account is needed for the normal app build.

```sh
npm ci
npm run app
open build/Reef.app
```

`npm run app` bundles the renderer and assets, generates the icon sizes with macOS `sips`/`iconutil`, compiles Swift and applies a local ad-hoc signature. It writes only generated outputs under `dist/`, `build/` and the ignored `assets/icons/Reef.icns`.

To update a running copy, quit Reef first, replace the app, reopen it and choose **Start desktop wallpaper**. The appearance choice is saved locally; wallpaper startup is manual. No login item is installed.

## Troubleshooting

- **Nothing behind your windows:** choose Start desktop wallpaper, then reveal the desktop. A full-screen app/Space may cover it.
- **Clicks do nothing:** enable Interact with desktop aquarium and unpause. Start the gesture on exposed desktop, not an app window or widget. An icon click can also affect the reef behind it.
- **Desktop pinch varies by setup:** try scrolling to zoom, or use the preview window. The preview also supports Option/right-drag orbit.
- **Slow playback or high battery use:** select Balanced or Eco. Each monitor renders a separate scene, so several large displays cost more. High adapts its resolution under load; it does not slow simulation time.
- **macOS blocks a shared local build:** if you trust its source, follow [Apple’s Open Anyway instructions](https://support.apple.com/en-us/102445). Do not disable Gatekeeper. A managed Mac may disallow exceptions.
- **Blank view:** check for WebGL2 support, rebuild with `npm ci && npm run app`, and include your macOS version, chip, display arrangement and quality setting in an issue. Remove private desktop content from screenshots.

## Browser development

```sh
npm run dev
# Open http://127.0.0.1:4187
```

The server binds to loopback only. It builds on startup, but does not hot-reload: run `npm run build` and reload after source edits. Browser preview is useful for visual work; wallpaper hosting is macOS-only.

## Checks

Install Google Chrome for the browser tests. Install Playwright’s WebKit once:

```sh
npx playwright install webkit
npm test                 # numerical tests and Chrome interactions
npm run test:native      # Swift display geometry and resource-policy checks
npm run app
node scripts/check-webkit.mjs --app
npm audit
```

Native tests require a logged-in Mac display session; they create hidden windows without operating your desktop. CI runs numerical tests and builds the renderer. Browser tests do not establish real Finder/Spaces/physical-trackpad behavior.

With the dev server running:

```sh
npm run screenshots
node scripts/profile-performance.mjs build/performance.json --webkit --retina --steady
```

The profiler measures one renderer, not sustained power use or simultaneous monitors. `REEF_WEB_INSPECTOR=1 build/Reef.app/Contents/MacOS/Reef` opts a local launch into WebKit inspection; shipping builds leave inspection disabled by default.

## Optional Blender workflow

Install Blender at `/Applications/Blender.app`. Python 3 and `curl` are needed only for restoring source assets. The prepared runtime assets are already in the repository.

```sh
# Keep npm run dev running in another terminal.
npm run blender
# Optional offline still render:
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/create-blender.py -- --render-preview
```

This generates `assets/blender/reef.glb` and `Reef.blend`, with packed licensed textures and a separate Cycles lighting setup. The files are intentionally excluded from Git. Private visual references are neither distributed nor packed. Live fish deformation, currents, click behavior and theme shaders are not baked animation tracks. Editing the export does not automatically modify the app.

To restore/reprocess source assets:

```sh
python3 scripts/fetch-textures.py
python3 scripts/fetch-corals.py
mkdir -p build
/Applications/Blender.app/Contents/MacOS/Blender --background \
  --python scripts/prepare-corals.py
```

The download scripts contact Poly Haven and Smithsonian using the recorded source URLs. Preserve provenance and license notices when replacing assets.
