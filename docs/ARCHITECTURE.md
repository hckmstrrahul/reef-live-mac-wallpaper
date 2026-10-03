# How Reef works

## Native shell

`native/ReefApp.swift` owns a menu-bar item, a resizable preview and one borderless `WKWebView` window per connected display. Wallpaper windows sit below desktop icons and ordinary apps. Stable display IDs preserve a view when the display moves or changes resolution.

A read-only mouse monitor forwards gestures starting on Finder’s exposed desktop. It uses the actual receiving window, with AppKit hit testing as fallback, rather than treating transparent overlay rectangles as blockers. Drag coordinates stay attached to their starting display. No clicks are intercepted from other applications and no keyboard events are monitored globally.

Only the bundled main HTML page may navigate or send native messages. The bridge accepts fixed events and enumerated appearance modes. A Content Security Policy restricts executable scripts to the local bundle. There is no remote page, plugin loader or account service.

## Renderer and simulation

| Area | Implementation |
| :--- | :--- |
| Scene | Three.js meshes, scanned GLBs and original procedural rocks, coral, plants, gravel and aquarium objects. |
| Fish | 44 swimmers with shared species-inspired skin atlases. Arc-length 3D routes, horizontal vertex bending, articulated fins and a short click-response envelope. |
| Avoidance | Conservative whole-body spheres sweep against reef mesh bounds; this also constrains fish dragging. |
| Water | MIT threejs-water GPU heightfield solver at fixed steps; a custom 24 × 12 × 12 semi-Lagrangian velocity grid with pressure projection. |
| Bubbles | Bounded population, six independent sources, varied birth sizes, current sampling, drag and buoyant rise. A depth-tested optics pass adds restrained refraction/reflection. |
| Light | A corner spotlight and fill, a CC0 HDR environment, cached projected caustics and half-resolution volumetric scattering. |
| Reflections | A 768 × 384 mirrored scene capture, updated up to 15 Hz, distorted each frame by evolving wave normals. |
| Themes | Daylight, UV Night and Planet X shaders; manual, system or local-clock scheduling, refreshed on wake. |

## Performance choices

- Fish deformation runs on the GPU; geometry/materials are shared where practical.
- Plant clumps and fine reef details use merged geometry or instancing. Triangle-level plant placement checks run during construction, not every frame.
- High adapts between 1× and 1.5× pixel density without changing elapsed simulation time.
- Balanced caps density at 1× and disables distant softening. Eco caps it at 0.75×/30 fps, disables volumetric scattering and retains cached reflections.
- Caustics, reflection captures and shadows update less often than fish movement. Depth is reused across optical passes.
- Daylight avoids full-frame blur. Night/Planet X use a quarter-resolution, brightness-limited glow pass.
- Display sleep and hidden preview windows suspend animation. Each monitor still has its own GPU workload.
- Assets are embedded in the minified bundle for offline WebKit; redundant loose texture copies and production source maps are omitted.

See [the initial review](REVIEW.md) for measured checks and their limits. A smooth short browser run is not a battery-life or all-hardware guarantee.

## Boundaries

- This is not a full-volume, two-phase water/air solver. Currents do not resolve individual coral obstacles, and bubbles can intersect scenery.
- Caustics, fluorescence and water optics are artistic real-time approximations, not ray-traced or biologically calibrated effects.
- All fish derive from one base anatomical model. Color/pattern variety does not imply anatomically accurate species.
- Solid reef collisions use conservative bounds; soft foliage remains permeable. Fish-to-fish rigid-body collisions are not simulated.
- Blender export is an editable geometry/material snapshot with separate offline lighting, not the runtime simulation.

## Code map

- `src/main.js`: scene assembly, render passes, lifecycle and native bridge.
- `src/fish*.js`, `src/navigation.js`, `src/obstacles.js`: fish, routes, interaction and avoidance.
- `src/reef*.js`, `src/plants.js`, `src/scanned-corals.js`: environment construction.
- `src/fluid.js`, `src/water-surface.js`, `src/bubbles.js`, `src/lighting.js`: currents and optics.
- `src/appearance.js`, `src/planet-x*.js`, `src/uv-glow.js`: themes and daily schedule.
- `native/`: AppKit host, geometry/input/resource policies and Swift tests.
- `scripts/`, `tests/`: builds, asset preparation, captures, profiling and regressions.
- `vendor/`, `LICENSES/`, `assets/**/credits.json`: upstream code and asset provenance.
