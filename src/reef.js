import * as T from "three";
import { scannedCoralFactory } from "./scanned-corals.js";
import { arrangeReef } from "./reef-layout.js";
import { coralFactory, tissueMaps } from "./coral-colonies.js";
import { PlantHabitat } from "./plant-habitat.js";
import { createAquaticPlants } from "./plants.js";
import { applyWaterLight, applyNightPigment } from "./lighting.js";
import { textureFiles } from "./textures.js";
import { settleOnMesh } from "./grounding.js";
import {
  mergeGeometries,
  mergeVertices,
} from "three/addons/utils/BufferGeometryUtils.js";
export let seed = 7413;
export function rand(a = 0, b = 1) {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return a + ((b - a) * seed) / 4294967296;
}
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const sphere = new T.SphereGeometry(1, 6, 4),
  dummy = new T.Object3D();
function canvasTexture(draw, size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
export function mineralTexture(type = "rock") {
  return canvasTexture((c, s) => {
    c.fillStyle = type === "sand" ? "#9caba8" : "#514a55";
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 32000; i++) {
      const x = rand(0, s),
        y = rand(0, s),
        r = rand(0.3, type === "sand" ? 2.3 : 5);
      const v = rand(30, 170) | 0;
      c.fillStyle =
        type === "sand"
          ? `rgba(${v + 50},${v + 55},${v + 60},.55)`
          : `rgba(${v + 20},${v - 8},${v + 12},.4)`;
      c.beginPath();
      c.ellipse(x, y, r, r * rand(0.5, 1.4), 0, 0, 7);
      c.fill();
    }
    if (type === "rock")
      for (let i = 0; i < 900; i++) {
        c.fillStyle = ["#8e5468", "#78647c", "#334e49", "#af757f"][i % 4];
        c.globalAlpha = 0.28;
        c.beginPath();
        c.arc(rand(0, s), rand(0, s), rand(2, 13), 0, 7);
        c.fill();
      }
  });
}
export function makeReef(scene, uniforms, coralAssets) {
  const interactables = [],
    swayers = [],
    rockSurfaces = [];
  let shelfSupport, shelfContact;
  const loader = new T.TextureLoader();
  function map(name, color = false, repeat = 1) {
    const tex = loader.load(textureFiles[name]);
    tex.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.anisotropy = 8;
    return tex;
  }
  const rockTex = map("coast_color", true, 1),
    sandTex = map("coral_gravel_color", true, 16),
    rockNormal = map("coast_normal", false, 1),
    sandNormal = map("coral_gravel_normal", false, 16),
    rough = map("coast_roughness", false, 1);
  rockTex.wrapS =
    rockTex.wrapT =
    sandTex.wrapS =
    sandTex.wrapT =
      T.RepeatWrapping;
  sandTex.repeat.set(32, 21);
  rockTex.repeat.set(1, 1);
  const rockMat = new T.MeshStandardMaterial({
    map: rockTex,
    normalMap: rockNormal,
    normalScale: new T.Vector2(1.2, 1.2),
    roughnessMap: rough,
    roughness: 0.96,
    color: 0xffffff,
    aoMap: map("coast_ao", false, 1),
    aoMapIntensity: 0.65,
    vertexColors: true,
  });
  const sandMat = new T.MeshStandardMaterial({
    map: sandTex,
    normalMap: sandNormal,
    normalScale: new T.Vector2(0.65, 0.65),
    roughness: 0.9,
    color: 0xdfded1,
  });
  const materials = [rockMat, sandMat];
  rockMat.userData.planetMineral = true;
  sandMat.userData.planetMineral = true;
  const floorGeo = new T.PlaneGeometry(100, 160, 180, 160);
  floorGeo.rotateX(-Math.PI / 2);
  const fp = floorGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i),
      z = fp.getZ(i);
    fp.setY(
      i,
      0.07 * Math.sin(x * 1.8 + z * 0.8) +
        0.04 * Math.sin(z * 4 + x) +
        0.15 * Math.exp(-((x + 6) ** 2) / 8),
    );
  }
  floorGeo.computeVertexNormals();
  const floor = new T.Mesh(floorGeo, sandMat);
  floor.position.z = -2;
  floor.receiveShadow = true;
  floor.name = "Fine aragonite sand";
  scene.add(floor);
  interactables.push(floor);
  function rock(x, y, z, sx, sy, sz, preserveRandom = false) {
    const savedSeed = seed;
    const g = new T.SphereGeometry(1, 64, 40),
      p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = p.getX(i),
        b = p.getY(i),
        c = p.getZ(i);
      const n =
        1 +
        0.12 * Math.sin(a * 3.4 + b * 2.8) * Math.cos(c * 4.2 - b * 2.1) +
        0.025 * Math.sin(a * 17 + b * 13) * Math.sin(c * 19 + b * 11) +
        0.009 * Math.sin(a * 37 + c * 21);
      p.setXYZ(i, a * n, b * n, c * n);
    }
    const smooth = mergeVertices(g);
    smooth.computeVertexNormals();
    g.dispose();
    // Broad coralline pigment patches vary across each living-rock surface.
    const colors = [],
      pos = smooth.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const xx = pos.getX(i) + x,
        yy = pos.getY(i) + y,
        zz = pos.getZ(i) + z;
      const patch =
        0.5 +
        0.5 * Math.sin(xx * 3.7 + zz * 2.1) * Math.sin(yy * 6.3 - zz * 3.4);
      const c = new T.Color("#c8cfbf").lerp(
        new T.Color("#b898ad"),
        T.MathUtils.smoothstep(patch, 0.38, 0.78) * 0.4,
      );
      c.multiplyScalar(0.9 + patch * 0.15);
      c.toArray(colors, colors.length);
    }
    smooth.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    smooth.setAttribute("uv1", smooth.attributes.uv.clone());
    const m = new T.Mesh(smooth, rockMat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.rotation.set(rand(-0.3, 0.3), rand(0, 6), rand(-0.3, 0.3));
    m.castShadow = m.receiveShadow = true;
    m.name = "Porous living reef rock";
    scene.add(m);
    interactables.push(m);
    rockSurfaces.push(m);
    if (preserveRandom) {
      shelfSupport = m;
      m.name = "Rooted foundation below the golden coral shelf";
      seed = savedSeed;
    }
    return m;
  }
  // Physical gravel, instanced so thousands of pebbles require one draw call.
  const pebbles = new T.InstancedMesh(
    new T.IcosahedronGeometry(1, 0),
    sandMat,
    4200,
  );
  for (let i = 0; i < 4200; i++) {
    dummy.position.set(rand(-11, 11), rand(0.005, 0.08), rand(-7, 6));
    dummy.scale.set(rand(0.018, 0.06), rand(0.012, 0.038), rand(0.018, 0.065));
    dummy.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
    dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);
    pebbles.setColorAt(
      i,
      new T.Color().setHSL(rand(0.08, 0.16), rand(0.03, 0.2), rand(0.22, 0.73)),
    );
  }
  pebbles.name = "Aragonite gravel";
  scene.add(pebbles);
  // A shared porous tissue map: small recessed corallites rather than smooth plastic.
  const tissue = canvasTexture((c, s) => {
    c.fillStyle = "#efede8";
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 7000; i++) {
      const x = rand(0, s),
        y = rand(0, s),
        r = rand(0.5, 3.5);
      c.fillStyle = i % 3 ? "rgba(68,62,53,.16)" : "rgba(255,247,219,.23)";
      c.beginPath();
      c.ellipse(x, y, r, r * rand(0.55, 1.2), rand(0, 6), 0, Math.PI * 2);
      c.fill();
      if (i % 7 === 0) {
        c.strokeStyle = "rgba(249,233,200,.28)";
        c.lineWidth = 0.7;
        c.stroke();
      }
    }
  }, 1024);
  tissue.wrapS = tissue.wrapT = T.RepeatWrapping;
  tissue.repeat.set(2, 2);
  const tissueBump = tissue.clone();
  tissueBump.colorSpace = T.NoColorSpace;
  const coralMaps = tissueMaps(rand);
  function coralMat(color) {
    const mat = new T.MeshPhysicalMaterial({
      color,
      ...coralMaps,
      roughness: 0.89,
      metalness: 0,
      clearcoat: 0,
      normalScale: new T.Vector2(0.85, 0.85),
      envMapIntensity: 0.45,
    });
    const pigment = new T.Color(color);
    applyNightPigment(
      mat,
      uniforms,
      pigment.r > pigment.g ? "#e174e8" : "#60ecc2",
      0.78,
    );
    materials.push(mat);
    return mat;
  }
  function tube(points, radius, segments = 9, taper = 0) {
    const path = new T.CatmullRomCurve3(points);
    const sides = segments <= 9 ? 6 : 8;
    const g = new T.TubeGeometry(path, segments, radius, sides, false);
    if (taper > 0) {
      const p = g.attributes.position;
      for (let ring = 0; ring <= segments; ring++) {
        const t = ring / segments,
          center = path.getPointAt(t);
        const width = (1 - t * t * taper) * (1 + 0.045 * Math.sin(t * 17));
        for (let side = 0; side <= sides; side++) {
          const i = ring * (sides + 1) + side;
          p.setXYZ(
            i,
            center.x + (p.getX(i) - center.x) * width,
            center.y + (p.getY(i) - center.y) * width,
            center.z + (p.getZ(i) - center.z) * width,
          );
        }
      }
      g.computeVertexNormals();
    }
    return g;
  }
  function tissueColors(geometry, height) {
    const p = geometry.attributes.position,
      colors = new Float32Array(p.count * 3);
    const color = new T.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      const variation =
        0.87 + 0.07 * Math.sin(x * 7.3 + y * 5) * Math.sin(z * 9.2 - y * 3.1);
      const tip = T.MathUtils.smoothstep(y / height, 0.25, 0.9);
      color.setRGB(
        variation + tip * 0.13,
        variation + tip * 0.1,
        variation + tip * 0.08,
      );
      color.toArray(colors, i * 3);
    }
    geometry.setAttribute("color", new T.BufferAttribute(colors, 3));
  }
  const branchCoral = coralFactory(
    scene,
    uniforms,
    interactables,
    swayers,
    rand,
    coralMaps,
  );
  function anemone(x, y, z, size, color) {
    const group = new T.Group(),
      mat = coralMat(color),
      geos = [];
    group.position.set(x, y, z);
    mat.roughness = 0.7;
    mat.normalScale.set(0.05, 0.05);
    mat.bumpScale = 0.004;
    mat.vertexColors = true;
    const phase = rand(0, 6.28);
    function deform(shader) {
      shader.uniforms.tissueTime = uniforms.time;
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float tissueTime;",
        )
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
        float flex=pow(max(0.,position.y-.08),1.7);
        transformed.x+=sin(tissueTime*.65+position.z*4.+${phase.toFixed(4)})*flex*.045;
        transformed.z+=cos(tissueTime*.51+position.x*3.)*flex*.035;`,
        );
    }
    mat.onBeforeCompile = deform;
    mat.customProgramCacheKey = () => "anemone-soft-3-" + phase;
    const capGeo = new T.SphereGeometry(1, 10, 8);
    for (let i = 0; i < 150; i++) {
      const a = rand(0, Math.PI * 2),
        rad = Math.sqrt(rand()) * size * 0.47,
        h = rand(0.35, 0.7) * size;
      const base = V(Math.cos(a) * rad, 0.04, Math.sin(a) * rad),
        bend = V(
          Math.cos(a + 0.6) * size * 0.25,
          0,
          Math.sin(a + 0.6) * size * 0.25,
        );
      const tip = base
        .clone()
        .add(bend)
        .add(V(rand(-0.08, 0.08), h, rand(-0.08, 0.08)));
      const path = new T.CubicBezierCurve3(
        base,
        base.clone().add(V(-bend.x * 0.2, h * 0.45, -bend.z * 0.2)),
        tip.clone().add(V(-bend.x * 0.65, h * 0.1, -bend.z * 0.65)),
        tip,
      );
      const radius = size * rand(0.016, 0.025),
        segments = 28,
        sides = 10;
      const g = new T.TubeGeometry(path, segments, radius, sides, false),
        pos = g.attributes.position;
      for (let ring = 0; ring <= segments; ring++) {
        const t = ring / segments,
          center = path.getPointAt(t),
          r = 1 - t * 0.24;
        for (let k = 0; k <= sides; k++) {
          const idx = ring * (sides + 1) + k;
          pos.setXYZ(
            idx,
            center.x + (pos.getX(idx) - center.x) * r,
            center.y + (pos.getY(idx) - center.y) * r,
            center.z + (pos.getZ(idx) - center.z) * r,
          );
        }
      }
      g.computeVertexNormals();
      geos.push(g);
      geos.push(
        capGeo
          .clone()
          .scale(radius * 0.76, radius * 0.76, radius * 0.76)
          .translate(tip.x, tip.y, tip.z),
      );
    }
    capGeo.dispose();
    const geometry = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    tissueColors(geometry, size * 0.7);
    const mesh = new T.Mesh(geometry, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = "Soft flowing anemone tentacles";
    const depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
    depth.onBeforeCompile = deform;
    mesh.customDepthMaterial = depth;
    group.add(mesh);
    interactables.push(mesh);
    scene.add(group);
  }
  function softCoral(x, y, z, size, color) {
    const geos = [],
      mat = coralMat(color),
      group = new T.Group();
    group.position.set(x, y, z);
    group.rotation.y = rand(-1, 1);
    mat.vertexColors = true;
    mat.roughness = 0.8;
    mat.normalScale.set(0.3, 0.3);
    for (let l = 0; l < 29; l++) {
      const a = l * 2.39996,
        rad = Math.sqrt(l / 29) * size * 0.43;
      const root = V(Math.cos(a) * rad, size * 0.12, Math.sin(a) * rad * 0.7);
      const len = size * rand(0.35, 0.85),
        r = size * rand(0.07, 0.13);
      const end = root
        .clone()
        .add(
          V(
            Math.cos(a) * len * 0.52,
            len * (0.5 + rand(0, 0.3)),
            Math.sin(a) * len * 0.48,
          ),
        );
      const curve = new T.CatmullRomCurve3([
        root,
        root
          .clone()
          .lerp(end, 0.4)
          .add(V(0, len * 0.15, 0)),
        end,
      ]);
      const g = new T.TubeGeometry(curve, 16, r, 12, false),
        p = g.attributes.position;
      for (let j = 0; j <= 16; j++) {
        const t = j / 16,
          c = curve.getPointAt(t),
          width = (0.65 + 0.55 * Math.sin(t * Math.PI)) * (1 - 0.35 * t * t);
        for (let k = 0; k <= 12; k++) {
          const i = j * 13 + k;
          p.setXYZ(
            i,
            c.x + (p.getX(i) - c.x) * width,
            c.y + (p.getY(i) - c.y) * width,
            c.z + (p.getZ(i) - c.z) * width * 0.75,
          );
        }
      }
      const cap = new T.SphereGeometry(r * 0.42, 12, 8);
      cap.scale(1, 1, 0.75);
      cap.translate(end.x, end.y, end.z);
      g.computeVertexNormals();
      geos.push(g, cap);
    }
    const geometry = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    tissueColors(geometry, size);
    const mesh = new T.Mesh(geometry, mat);
    mesh.name = "Fleshy lobed leather coral";
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    scene.add(group);
    interactables.push(mesh);
  }
  function sponge(x, y, z, size, color) {
    const group = new T.Group(),
      mat = coralMat(color);
    group.position.set(x, y, z);
    for (let i = 0; i < 11; i++) {
      const h = rand(0.38, 0.92) * size,
        r = rand(0.036, 0.068) * size;
      const path = [];
      for (let j = 0; j <= 28; j++) {
        const t = j / 28;
        path.push(
          new T.Vector2(
            r * (0.83 + 0.14 * Math.sin(t * 3.5) + 0.08 * t),
            h * t,
          ),
        );
      }
      // Roll over a rounded lip into the shaded interior instead of a sharp cut.
      for (let j = 1; j <= 8; j++) {
        const a = (j / 8) * Math.PI;
        path.push(
          new T.Vector2(
            r * (0.79 + 0.13 * Math.cos(a)),
            h + r * 0.13 * Math.sin(a),
          ),
        );
      }
      path.push(
        new T.Vector2(r * 0.62, h * 0.82),
        new T.Vector2(r * 0.57, h * 0.45),
      );
      const geometry = new T.LatheGeometry(path, 40);
      const pos = geometry.attributes.position;
      for (let k = 0; k < pos.count; k++) {
        const yy = pos.getY(k),
          xx = pos.getX(k),
          zz = pos.getZ(k),
          theta = Math.atan2(zz, xx),
          t = yy / h;
        const bulge =
          1 +
          0.032 * Math.sin(theta * 5 + t * 7) +
          0.01 * Math.sin(theta * 13 - t * 23);
        pos.setXYZ(
          k,
          xx * bulge + Math.sin(t * 1.8) * h * 0.1,
          yy + Math.sin(theta * 3 + i) * 0.014 * t,
          zz * bulge,
        );
      }
      geometry.computeVertexNormals();
      tissueColors(geometry, h);
      mat.vertexColors = true;
      const mesh = new T.Mesh(geometry, mat);
      mesh.position.set(rand(-0.23, 0.23) * size, 0, rand(-0.2, 0.2) * size);
      mesh.rotation.z = rand(-0.25, 0.25);
      mesh.rotation.x = rand(0.12, 0.3);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.name = "Porous hollow tube sponge";
      group.add(mesh);
      interactables.push(mesh);
    }
    scene.add(group);
  }
  function brain(x, y, z, size, color, ridgeColor) {
    const mat = coralMat(color),
      base = new T.Mesh(new T.SphereGeometry(1, 32, 18), mat);
    base.scale.set(size, size * 0.48, size * 0.8);
    base.position.set(x, y, z);
    base.name = "Maze brain coral";
    base.castShadow = true;
    scene.add(base);
    interactables.push(base);
    const lines = [];
    for (let j = 0; j < 24; j++) {
      const theta = 0.18 + (j / 24) * 2.7,
        pts = [];
      for (let k = 0; k < 65; k++) {
        const phi = (k / 64) * Math.PI * 2;
        const t =
          theta +
          0.055 * Math.sin(phi * 16 + j * 0.8) +
          0.028 * Math.sin(phi * 29 + j * 2);
        pts.push(
          V(
            x + size * 1.01 * Math.sin(t) * Math.cos(phi),
            y + size * 0.49 * Math.cos(t),
            z + size * 0.81 * Math.sin(t) * Math.sin(phi),
          ),
        );
      }
      lines.push(tube(pts, size * 0.023, 180));
    }
    const ridge = new T.Mesh(
      mergeGeometries(lines),
      coralMat(
        ridgeColor || new T.Color(color).lerp(new T.Color("#f8e6c6"), 0.16),
      ),
    );
    lines.forEach((g) => g.dispose());
    scene.add(ridge);
  }
  function polypMound(x, y, z, size, color, centerColor) {
    const baseMat = coralMat(new T.Color(color).multiplyScalar(0.58));
    baseMat.map = rockTex;
    baseMat.normalScale.set(0.3, 0.3);
    const base = new T.Mesh(new T.SphereGeometry(1, 28, 18), baseMat);
    base.position.set(x, y, z);
    base.scale.set(size, size * 0.57, size * 0.78);
    base.name = "Living polyp colony";
    base.castShadow = base.receiveShadow = true;
    scene.add(base);
    interactables.push(base);
    const stem = new T.CylinderGeometry(0.42, 0.53, 0.55, 6);
    stem.translate(0, 0.26, 0);
    const crown = new T.TorusGeometry(0.64, 0.2, 4, 9);
    crown.rotateX(-Math.PI / 2);
    crown.translate(0, 0.58, 0);
    const body = mergeGeometries([stem, crown]);
    stem.dispose();
    crown.dispose();
    const n = 1200,
      polyps = new T.InstancedMesh(body, coralMat(color), n),
      mouths = new T.InstancedMesh(sphere, coralMat(centerColor), n);
    const up = V(0, 1, 0),
      center = V(x, y, z),
      normal = V();
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2),
        t = Math.acos(rand(0.06, 1)),
        radius = size * rand(0.031, 0.05);
      const local = V(
        size * Math.sin(t) * Math.cos(a),
        size * 0.57 * Math.cos(t),
        size * 0.78 * Math.sin(t) * Math.sin(a),
      );
      normal
        .set(
          local.x / (size * size),
          local.y / (size * size * 0.57 * 0.57),
          local.z / (size * size * 0.78 * 0.78),
        )
        .normalize();
      dummy.position.copy(local).add(center);
      dummy.quaternion.setFromUnitVectors(up, normal);
      dummy.rotateY(rand(0, 6.28));
      dummy.scale.setScalar(radius);
      dummy.updateMatrix();
      polyps.setMatrixAt(i, dummy.matrix);
      polyps.setColorAt(
        i,
        new T.Color().setRGB(
          rand(0.86, 1.12),
          rand(0.9, 1.08),
          rand(0.83, 1.02),
        ),
      );
      dummy.position.addScaledVector(normal, radius * 0.63);
      dummy.scale.set(radius * 0.4, radius * 0.13, radius * 0.4);
      dummy.updateMatrix();
      mouths.setMatrixAt(i, dummy.matrix);
    }
    polyps.name = "Colored coral polyp crowns";
    mouths.name = "Contrasting polyp mouths";
    polyps.receiveShadow = mouths.receiveShadow = true;
    scene.add(polyps, mouths);
    dummy.rotation.set(0, 0, 0);
  }
  function giantClam(x, y, z, size) {
    const shellGeometry = new T.SphereGeometry(1, 40, 20),
      sp = shellGeometry.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      const a = Math.atan2(sp.getZ(i), sp.getX(i)),
        flute = 1 + 0.065 * Math.sin(a * 16);
      sp.setXYZ(i, sp.getX(i) * flute, sp.getY(i), sp.getZ(i) * flute);
    }
    shellGeometry.computeVertexNormals();
    const shellMat = new T.MeshStandardMaterial({
      color: 0x939787,
      map: rockTex,
      normalMap: rockNormal,
      roughness: 0.94,
    });
    materials.push(shellMat);
    const shell = new T.Mesh(shellGeometry, shellMat);
    shell.position.set(x, y - 0.02, z);
    shell.scale.set(size, 0.11 * size, 0.55 * size);
    shell.name = "Ridged encrusted clam shell";
    shell.receiveShadow = true;
    scene.add(shell);
    interactables.push(shell);
    const mat = coralMat("#ffffff");
    mat.vertexColors = true;
    mat.roughness = 0.76;
    for (const side of [-1, 1]) {
      const positions = [],
        uvs = [],
        indices = [],
        colors = [],
        N = 96,
        M = 10;
      for (let i = 0; i <= N; i++)
        for (let j = 0; j <= M; j++) {
          const u = (i / N) * 2 - 1,
            v = j / M,
            width = Math.sqrt(Math.max(0.001, 1 - u * u)) * 0.51;
          const wave = Math.sin(u * 24 + side) * 0.044 * (0.3 + v * v);
          positions.push(
            x + u * size,
            y + size * (0.09 + wave + Math.sin(v * Math.PI) * 0.07 + v * 0.055),
            z + side * size * (0.035 + v * width),
          );
          uvs.push(i / N, v);
          const pigment = new T.Color("#064c9d").lerp(
            new T.Color("#3bb9d0"),
            0.25 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(u * 21 + v * 6), 2),
          );
          pigment.multiplyScalar(
            0.32 +
              0.68 *
                Math.pow(
                  0.5 + 0.5 * Math.sin(u * 97 + Math.sin(v * 19) * 3),
                  0.6,
                ),
          );
          pigment.toArray(colors, colors.length);
        }
      for (let i = 0; i < N; i++)
        for (let j = 0; j < M; j++) {
          const a = i * (M + 1) + j,
            b = a + M + 1;
          if (side === 1) indices.push(a, a + 1, b, b, a + 1, b + 1);
          else indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
      g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      const mantle = new T.Mesh(g, mat);
      mantle.name = "Blue patterned clam mantle";
      mantle.receiveShadow = true;
      scene.add(mantle);
      interactables.push(mantle);
    }
  }
  function plates(x, y, z, size, color) {
    const mat = coralMat(color);
    mat.vertexColors = true;
    // Closed radial cups retain thickness at folded edges and stable normals.
    const rings = 16,
      segments = 72,
      stride = segments + 1;
    for (let layer = 0; layer < 3; layer++) {
      const positions = [],
        uvs = [],
        indices = [],
        colors = [],
        phase = rand(0, 6.28);
      const n = (rings + 1) * stride;
      for (let side = 0; side < 2; side++)
        for (let ring = 0; ring <= rings; ring++)
          for (let k = 0; k <= segments; k++) {
            const r = ring / rings,
              a = (k / segments) * Math.PI * 2;
            const outline =
              1 +
              0.075 * Math.sin(a * 3 + phase) +
              0.023 * Math.sin(a * 9 + phase);
            const h =
              0.13 * r * r +
              0.075 * Math.sin(a * 7 + r * 8 + phase) * r * r * r;
            positions.push(
              Math.cos(a) * r * outline,
              h + (side === 0 ? 1 : -1) * 0.009,
              Math.sin(a) * r * outline * 0.84,
            );
            uvs.push(0.5 + Math.cos(a) * r * 0.5, 0.5 + Math.sin(a) * r * 0.5);
            const rim = T.MathUtils.smoothstep(r, 0.86, 1);
            colors.push(
              0.72 + rim * 0.28,
              0.69 + rim * 0.31,
              0.63 + rim * 0.37,
            );
          }
      for (let ring = 0; ring < rings; ring++)
        for (let k = 0; k < segments; k++) {
          const a = ring * stride + k,
            b = a + stride;
          indices.push(a, a + 1, b, b, a + 1, b + 1);
          indices.push(n + a, n + b, n + a + 1, n + b, n + b + 1, n + a + 1);
        }
      for (let k = 0; k < segments; k++) {
        const a = rings * stride + k;
        indices.push(a, a + 1, n + a, a + 1, n + a + 1, n + a);
      }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uvs, 2));
      g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      const m = new T.Mesh(g, mat);
      m.position.set(
        x + Math.sin(layer * 2.3) * size * 0.12,
        y + layer * 0.16 * size,
        z + Math.cos(layer * 1.8) * size * 0.12,
      );
      m.scale.setScalar(size * (1 - layer * 0.13));
      m.rotation.set(rand(-0.015, 0.015), rand(0, 6.28), rand(-0.015, 0.015));
      const count = 550,
        polypMat = coralMat(
          new T.Color(color).lerp(new T.Color("#fff2d7"), 0.52),
        );
      const polyps = new T.InstancedMesh(sphere, polypMat, count);
      for (let k = 0; k < count; k++) {
        const r = Math.sqrt(rand(0.015, 0.95)),
          a = rand(0, Math.PI * 2),
          outline =
            1 +
            0.075 * Math.sin(a * 3 + phase) +
            0.023 * Math.sin(a * 9 + phase);
        const h =
          0.13 * r * r + 0.075 * Math.sin(a * 7 + r * 8 + phase) * r * r * r;
        dummy.position.set(
          Math.cos(a) * r * outline,
          h + 0.035,
          Math.sin(a) * r * outline * 0.84,
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(
          rand(0.005, 0.008),
          rand(0.014, 0.025),
          rand(0.005, 0.008),
        );
        dummy.updateMatrix();
        polyps.setMatrixAt(k, dummy.matrix);
      }
      polyps.name = "Cream coral surface polyps";
      polyps.receiveShadow = true;
      m.add(polyps);
      m.name = "Ruffled Montipora growth plates";
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
      interactables.push(m);
    }
  }
  const scan = scannedCoralFactory(
    coralAssets,
    scene,
    uniforms,
    interactables,
    rand,
  );
  let softIndex = 0;
  arrangeReef({
    rock,
    branchCoral: (x, y, z, size, color, form) => {
      if (form === "finger") return scan("bush", x, y, z, size * 1.25, color);
      if (form === "table")
        return scan("table", x, y, z, size * 1.3, color, -0.75);
      return branchCoral(x, y, z, size, color, form);
    },
    sponge,
    softCoral: (x, y, z, size, color) =>
      scan(
        softIndex++ % 3 === 1 ? "bush" : "lettuce",
        x,
        y,
        z,
        size * 1.3,
        color,
      ),
    plates: (x, y, z, size, color, grounded = false) => {
      const colony = scan("plate", x, y, z, size * 1.8, color, -1.25);
      if (grounded) shelfContact = settleOnMesh(colony, shelfSupport);
      return colony;
    },
    brain: (x, y, z, size, color) => scan("brain", x, y, z, size * 2, color),
    polypMound,
    giantClam,
  });
  scan("lobed", -6.25, 1.1, 2.65, 1.35, "#c5aca4");
  scan("lettuce", 7.3, 1.55, 2.85, 2.2, "#a39db5");
  scan("bush", -6.6, 3.05, -0.25, 2.7, "#81999e");
  scan("bush", 6.8, 2.25, -1.1, 2.3, "#a88fba");
  // Root greenery and air outlets on the actual rock/sand surface, not a fixed
  // world height that hides plants inside a bank or leaves them suspended.
  scene.updateMatrixWorld(true);
  const habitat = new PlantHabitat(
    [floor, ...rockSurfaces],
    interactables.filter((m) => m !== floor && !rockSurfaces.includes(m)),
  );
  const surfaceHeight = (x, z) => habitat.height(x, z);
  const planting = createAquaticPlants(
    scene,
    uniforms,
    interactables,
    rand,
    surfaceHeight,
    (geometry, root) => habitat.clear(geometry, root),
  );
  planting.geometryQueries = habitat.queries;
  planting.preventedIntersections = habitat.intersections;
  const bubbleSites = [
    [-8.2, 2.5],
    [-6.0, -0.6],
    [-3.8, 1.3],
    [-1.7, -4.2],
    [1.0, -6.0],
    [3.8, -0.8],
    [6.0, 2.2],
    [8.2, -3.7],
    [-6.2, -8.5],
    [5.0, -8.0],
    [-1.3, 3.4],
    [2.0, 4.7],
  ].map(([x, z]) => [x, surfaceHeight(x, z) + 0.06, z]);
  // A small ceramic refuge tucked into the left bank.
  const potMat = new T.MeshStandardMaterial({
    color: 0x807365,
    roughness: 0.92,
    map: rockTex,
  });
  materials.push(potMat);
  const pot = new T.Mesh(new T.TorusGeometry(0.48, 0.16, 16, 36), potMat);
  pot.position.set(-5.7, 0.38, 1.9);
  pot.rotation.y = 0.5;
  pot.name = "Weathered ceramic fish refuge";
  scene.add(pot);
  interactables.push(pot);
  for (const m of materials) applyWaterLight(m, uniforms);
  return { interactables, swayers, bubbleSites, shelfContact, planting };
}
