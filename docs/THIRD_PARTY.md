# Sources, credits and licenses

Reef’s original source code and procedural content are released under the [MIT license](../LICENSE). The material below retains its own license. No endorsement by an upstream author, institution or brand is implied.

## Runtime code

| Project | Author / source | License and use |
| :--- | :--- | :--- |
| Three.js 0.186.1 | [mrdoob and contributors](https://github.com/mrdoob/three.js) | [MIT notice](../LICENSES/Three.js-MIT.txt). Renderer, loaders, exporters, geometry helpers and postprocessing. |
| three-mesh-bvh 0.9.15 | [Garrett Johnson and contributors](https://github.com/gkjohnson/three-mesh-bvh) | [MIT notice](../LICENSES/three-mesh-bvh-MIT.txt). Triangle-level plant clearance and ground probes during construction. |
| threejs-water | [Yong Su’s port](https://github.com/jeantimex/threejs-water), based on Evan Wallace’s water work | [MIT notice](../vendor/threejs-water/LICENSE). Original work © 2011 Evan Wallace; modified work © 2026 Yong Su. |

Only `Water.ts` and its shader dependencies are vendored from threejs-water, unchanged at commit [`f35a700a16fe386beac997806ed4471018c93ef7`](https://github.com/jeantimex/threejs-water/tree/f35a700a16fe386beac997806ed4471018c93ef7). Reef integrates the heightfield solver; the upstream pool renderer and ray-traced caustics are not included. [Vendored source record](../vendor/threejs-water/SOURCE.txt).

## Fish model

- **Barramundi Fish**, Microsoft, distributed in [Khronos glTF Sample Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/BarramundiFish).
- **CC0 1.0**, as recorded in the [upstream model notice](../assets/models/BarramundiFish-LICENSE.md). [CC0 text](../LICENSES/CC0-1.0.txt).
- File: `assets/models/BarramundiFish.glb`.
- Reef adds species-inspired skin palettes/patterns, shape adjustments, fin geometry and runtime deformation. All fish share this anatomical base; the names/colors are artistic interpretations rather than separate scanned species.

## Coral scans

**Smithsonian Institution, National Museum of Natural History**, [Shape & Structure collection](https://3d.si.edu/corals/shape-structure), CC0 Open Access. The digitization project was created in collaboration with [The Hydrous](https://thehydro.us/).

| Reef file | Specimen | Original object |
| :--- | :--- | :--- |
| `table.glb` | Madrepora spicifera, USNM 244 | [Smithsonian record](https://3d.si.edu/object/3d/madrepora-spicifera:debebbb8-f7ee-4a6d-941c-12ea01dec71a) |
| `lobed.glb` | Goniopora columna, USNM 5781 | [Smithsonian record](https://3d.si.edu/object/3d/goniopora-columna:d85d7078-a2fd-4872-8a81-9d87ba2045cc) |
| `bush.glb` | Pocillopora damicornis, USNM 1128565 | [Smithsonian record](https://3d.si.edu/object/3d/pocillopora-damicornis:3310773f-822e-4376-bd03-2f9d69cfb22c) |
| `lettuce.glb` | Pavonia praetorta, USNM 152 | [Smithsonian record](https://3d.si.edu/object/3d/pavonia-praetorta-detail-view:09121e7e-c113-4f2c-a739-cdce13a33cfc) |
| `plate.glb` | Echinopora reflexa, USNM 164 | [Smithsonian record](https://3d.si.edu/object/3d/echinopora-reflexa:9922a8a1-e0bd-4c72-8511-aaf633ef6c2f) |
| `brain.glb` | Diploria labyrinthiformis, USNM 74947 | [Smithsonian record](https://3d.si.edu/object/3d/diploria-labyrinthiformis:87738412-3acd-45d1-bff4-3ab67093470e) |

Prepared files live in `assets/models/corals/`. Display plinths were trimmed where present, models normalized, triangle counts reduced with UV atlases retained, and Draco compression removed for offline WebKit. Reef artistically tints preserved specimens; these are not scans of living pigmentation. Exact download URLs, per-object provenance and modifications are in [credits.json](../assets/models/corals/credits.json). Original downloads can be restored with `scripts/fetch-corals.py`. The manifest also records license-verification pages; the bush specimen is listed in the [Smithsonian 3D Open Access file API](https://3d-api.si.edu/api/v1.0/content/file/search?model_url=3310773f-822e-4376-bd03-2f9d69cfb22c&file_type=glb&rows=100), covered by its [Open Access API documentation](https://3d-api.si.edu/api-docs/).

[Smithsonian Open Access FAQ](https://www.si.edu/openaccess/faq) · [CC0 text](../LICENSES/CC0-1.0.txt)

## Textures and lighting

**Poly Haven**, CC0 assets under its [asset license](https://polyhaven.com/license).

| Asset | Files / purpose |
| :--- | :--- |
| [Coast Land Rocks 01](https://polyhaven.com/a/coast_land_rocks_01) | 2K color, OpenGL normal, roughness and ambient occlusion maps for rocks. |
| [Coral Gravel](https://polyhaven.com/a/coral_gravel) | 1K gravel maps; color and normal used at runtime, roughness retained as source material. |
| [Coral Ground 02](https://polyhaven.com/a/coral_ground_02) | 1K color, normal and roughness maps for reef materials. |
| [Studio Small 08](https://polyhaven.com/a/studio_small_08) | 1K HDR environment, prefiltered for material reflections and wet highlights. |

[Per-file download URLs](../assets/textures/credits.json) · [Poly Haven HDRI workflow](https://docs.polyhaven.com/en/guides/hdris) · [CC0 text](../LICENSES/CC0-1.0.txt)

## Original artwork and visual references

- Reef geometry, plants, skin pattern shaders, pigments, custom current field, interaction and native host were authored for this project with Codex assistance.
- The **Reef icon** was generated with OpenAI’s image-generation tool. [Full prompt and provenance](../assets/icons/generation.json). It is included under the project license to the extent applicable rights exist. The menu icon is an original vector silhouette based on that fish.
- README theme screenshots are captures of Reef using the assets credited above.
- [Pixelstalk’s aquarium gallery](https://www.pixelstalk.net/fish-tank-backgrounds-download/) informed visual direction. Its reference images are **not redistributed** or included in generated Blender exports.
- Morphology references only: NOAA’s [staghorn coral](https://www.fisheries.noaa.gov/species/staghorn-coral), [coral growth forms](https://oceanservice.noaa.gov/education/tutorial_corals/coral03_growth.html) and [seagrass meadows](https://sanctuaries.noaa.gov/visit/ecosystems/seagrass.html); UF/IFAS [Caulerpa taxifolia](https://plant-directory.ifas.ufl.edu/plant-directory/caulerpa-taxifolia/); University of Alabama [green-algae lecture](https://phycolab.ua.edu/wp-content/uploads/2019/06/4-ALGAE-copy.pdf). No photographs or models from these references are bundled.
- The aquarium mixes artistic marine forms. Its UV glow and alien colors do not imply natural biological behavior.

## Build and testing tools

These tools are used during development, not required by someone running a built app:

- [Blender](https://www.blender.org/about/license/), GPL, for mesh preparation and optional scene export. Blender itself is not distributed with Reef.
- [esbuild](https://github.com/evanw/esbuild), MIT, for the offline JavaScript bundle.
- [Playwright](https://github.com/microsoft/playwright), Apache-2.0, for browser interaction, screenshots and profiling.
- [Swift Testing](https://github.com/swiftlang/swift-testing), Apache-2.0 with Runtime Library Exception, for native policy/geometry checks.
- [Prettier](https://github.com/prettier/prettier), MIT, for formatting.
- Apple’s Swift toolchain, AppKit, WebKit, `sips`, `iconutil` and code-signing tools are supplied by macOS/Xcode. Reef does not redistribute these tools or frameworks.

`package-lock.json` records exact npm versions. The app build copies the Reef, Three.js, three-mesh-bvh, water and CC0 notices, plus asset credit manifests, into its Resources directory.
