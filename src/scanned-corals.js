import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import table from "../assets/models/corals/table.glb";
import lobed from "../assets/models/corals/lobed.glb";
import bush from "../assets/models/corals/bush.glb";
import lettuce from "../assets/models/corals/lettuce.glb";
import plate from "../assets/models/corals/plate.glb";
import brain from "../assets/models/corals/brain.glb";
import { applyWaterLight, applyNightPigment } from "./lighting.js";

// Smithsonian NMNH specimen photogrammetry, with artistic living pigmentation.
// Geometry and texture atlases are shared by instances; each colony has its own
// pigment/placement, not another copy of the same procedural branch pattern.
export async function loadScannedCorals() {
  const loader = new GLTFLoader();
  const entries = await Promise.all(
    Object.entries({ table, lobed, bush, lettuce, plate, brain }).map(
      async ([name, binary]) => {
        const bytes = Uint8Array.fromBase64
          ? Uint8Array.fromBase64(binary)
          : Uint8Array.from(atob(binary), (c) => c.charCodeAt(0));
        const gltf = await loader.parseAsync(bytes.buffer, "");
        return [name, gltf.scene];
      },
    ),
  );
  return Object.fromEntries(entries);
}

export function scannedCoralFactory(
  assets,
  scene,
  uniforms,
  interactables,
  random,
) {
  return function colony(kind, x, y, z, width, color, pitch = 0) {
    const root = new T.Group(),
      model = assets[kind].clone(true);
    root.name = `Scanned ${kind} coral colony`;
    model.rotation.set(pitch + random(-0.08, 0.08), 0, random(-0.06, 0.06));
    model.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(model),
      extent = box.getSize(new T.Vector3());
    const scale = width / Math.max(extent.x, extent.z, extent.y * 0.8);
    model.scale.set(scale, scale * random(0.9, 1.1), scale);
    model.updateMatrixWorld(true);
    box.setFromObject(model);
    model.position.y -= box.min.y;
    model.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.name = `Scanned ${kind} coral`;
      const source = mesh.material;
      mesh.material = new T.MeshStandardMaterial({
        map: source.map,
        normalMap: source.normalMap,
        normalScale: new T.Vector2(0.8, 0.8),
        color,
        roughness: 0.88,
        metalness: 0,
        side: T.DoubleSide,
      });
      if (source.map) source.map.anisotropy = 8;
      {
        const uv =
          kind === "bush"
            ? "#70ffbb"
            : kind === "brain"
              ? "#7be5ff"
              : "#da70ff";
        applyNightPigment(
          mesh.material,
          uniforms,
          uv,
          kind === "bush" ? 1.45 : 1.0,
          ["bush", "brain", "lobed"].includes(kind),
        );
      }
      applyWaterLight(mesh.material, uniforms);
      mesh.castShadow = mesh.receiveShadow = true;
      interactables.push(mesh);
    });
    root.add(model);
    root.position.set(x, y, z);
    root.rotation.y = random(0, Math.PI * 2);
    scene.add(root);
    return root;
  };
}
