import { build } from "esbuild";
import { mkdir, copyFile, rm } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  outfile: "dist/aquarium.js",
  format: "iife",
  target: "safari17",
  minify: true,
  legalComments: "eof",
  sourcemap: false,
  loader: {
    ".vert": "text",
    ".frag": "text",
    ".glb": "base64",
    ".hdr": "base64",
    ".jpg": "dataurl",
  },
});
await copyFile("src/index.html", "dist/index.html");

// All runtime images, GLBs and HDR lighting are embedded above.
// Remove obsolete duplicate assets from older builds.
await rm("dist/textures", { recursive: true, force: true });
await rm("dist/aquarium.js.map", { force: true });
