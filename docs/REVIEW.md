# Initial public-source review

Reef 0.12.0, reviewed locally on 4 October 2026 before its first public commit. This is a basic code, dependency and packaging review, not an independent security audit.

## Security and publication scope

- `npm audit` with TLS verification enabled reports **zero known dependency vulnerabilities** in the locked dependency set.
- Reviewed the native event bridge, web loading, desktop input routing, local dev server and asset download scripts.
- Restricted native navigation and bridge messages to the bundled main HTML page; appearance values are validated against fixed modes.
- Added a restrictive Content Security Policy and made WebKit inspection an explicit local opt-in.
- The app has no analytics, account system, remote content loader, automatic updater or runtime credential requirement. The dev server binds only to loopback and rejects path traversal.
- Original code is MIT; upstream notices and CC0 asset provenance are included. Private reference images, generated Blender files, local work notes and build outputs are excluded from Git. Blender export no longer packs private references.
- CI uses read-only repository permissions, commit-pinned actions and no deployment credentials.

## Optimization review

- Removed redundant loose texture copies from the app: runtime assets were already embedded in the JavaScript bundle.
- Minified the production bundle and omitted production source maps. No texture resolution, simulation behavior or theme effects were reduced.
- The installed local app fell from approximately **101 MiB to 77 MiB**.
- Confirmed bounded bubble allocation, shared resources, construction-only plant mesh checks, cached optical passes, adaptive resolution and sleep/hidden-preview pauses.

## Validation

- **25 numerical tests**, **8 Chrome interaction tests**, and **9 Swift tests** passed.
- Bundled `file://` playback and interaction checks passed in Playwright WebKit with no renderer errors.
- A fresh checkout containing only staged public files completed `npm ci` and built the ad-hoc-signed Mac app successfully. Strict code-signature verification passed.
- Captured and visually reviewed Daylight, UV Night and Planet X screenshots.
- Reviewed staged files for credentials, private paths, personal reference images and oversized artifacts; no findings remained. Git whitespace checks passed.

Short local sample on an **Apple M5 Max**, Playwright WebKit, Daylight, 2560 × 1440 CSS viewport, DPR 2. Each mode warmed up for 15 seconds and was sampled for about 6.5 seconds:

| Mode | Observed FPS | Median / p95 frame time | Render size |
| :--- | ---: | :--- | :--- |
| High, adaptive | 61.2 | 16 / 27 ms | 3328 × 1872 |
| Balanced | 59.9 | 17 / 21 ms | 2560 × 1440 |

Simulation time tracked elapsed time in both samples and neither produced renderer errors. These are brief observations on one machine, not performance guarantees or a battery benchmark.

## Limits

Native policy and display tests use hidden windows; they do not prove Finder gesture delivery, Spaces behavior or physical trackpad compatibility. Browser tests do not substitute for sustained native energy or multi-display testing. Intel builds, universal binaries, notarization and automated login/startup are not covered. The app is locally ad-hoc signed and has not been published as a binary release.
