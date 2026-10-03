import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { ScenePass } from "./scene-pass.js";
import { createDepthSoftening } from "./depth-softening.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import {
  createCornerLighting,
  createVolumetricPass,
  createCausticField,
} from "./lighting.js";
import { createUVGlowPass } from "./uv-glow.js";
import { createWaterSurface } from "./water-surface.js";
import { createBubbles } from "./bubbles.js";
import { reefObstacles } from "./obstacles.js";
import { makeCruiseRoute } from "./fish-motion.js";
import { createAppearance } from "./appearance.js";
import { createNavigation } from "./navigation.js";
import { animateFish, triggerShy } from "./fish-motion.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { Water } from "../vendor/threejs-water/Water.ts";
import { loadScannedCorals } from "./scanned-corals.js";
import { makeReef, rand } from "./reef.js";
import { createFishState, upgradeFish } from "./fish.js";
import { AdaptiveResolution } from "./adaptive-resolution.js";
import { FrameClock, FixedStepper } from "./frame-clock.js";
import { CurrentField } from "./fluid.js";

const showError = (e) => {
  document.querySelector("#error").style.display = "block";
  document.querySelector("#error").textContent =
    "The aquarium could not render: " + (e.message || e);
};
window.addEventListener("error", (e) => showError(e.error || e.message));
init().catch(showError);
async function init() {
  console.info("Reef: renderer initialization");
  const renderer = new T.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  const adaptiveResolution = new AdaptiveResolution(
    Math.min(devicePixelRatio, 1.5),
  );
  renderer.setPixelRatio(adaptiveResolution.scale);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.13;
  renderer.info.autoReset = false;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  document.body.prepend(renderer.domElement);
  const scene = new T.Scene();
  scene.background = new T.Color("#368b9b");
  scene.fog = new T.FogExp2("#348a98", 0.018);
  const camera = new T.PerspectiveCamera(43, innerWidth / innerHeight, 0.1, 65);
  camera.position.set(0, 4.0, 14.9);
  camera.lookAt(0, 3.35, -0.8);
  const lighting = createCornerLighting(scene, renderer);
  const { key } = lighting;
  console.info("Reef: water simulation");
  const water = new Water(renderer),
    fluid = new CurrentField(),
    uniforms = {
      time: { value: 0 },
      water: { value: water.textureA.texture },
      night: { value: 0 },
      planetX: { value: 0 },
    };
  const caustics = createCausticField(renderer, uniforms.time);
  uniforms.caustics = { value: caustics.texture };
  console.info("Reef: reef geometry");
  const coralAssets = await loadScannedCorals();
  const reef = makeReef(scene, uniforms, coralAssets),
    fish = createFishState(scene);
  console.info("Reef: loading detailed fish");
  await upgradeFish(fish, renderer, uniforms);
  const obstacles = reefObstacles(reef.interactables);
  for (const f of fish.fishes) {
    f.body.geometry.computeBoundingSphere();
    f.collisionRadius =
      (f.body.geometry.boundingSphere.radius +
        f.body.geometry.boundingSphere.center.length() +
        0.25) *
        f.group.scale.x +
      0.025;
    f.obstacles = obstacles;
    obstacles.place(f.group.position, f.collisionRadius);
    f.route = makeCruiseRoute(
      f.group.position,
      f.headingDirection,
      f.index + 1,
      f.depthBand,
    );
    f.routeDistance = 0;
  }
  console.info("Reef: fish ready");
  const backdrop = new T.Mesh(
    new T.PlaneGeometry(65, 35),
    new T.ShaderMaterial({
      depthWrite: false,
      vertexShader:
        "varying vec2 vUV;varying vec3 vWorld;void main(){vUV=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      uniforms: {
        uTime: uniforms.time,
        uNight: uniforms.night,
        uPlanetX: uniforms.planetX,
      },
      fragmentShader: `varying vec2 vUV;varying vec3 vWorld;uniform float uTime,uNight,uPlanetX;void main(){
       float height=smoothstep(-2.,12.,vWorld.y);
       vec2 delta=(vWorld.xy-vec2(-2.,8.3))*vec2(.105,.09);
       float opening=exp(-dot(delta,delta)*2.);
       vec3 night=mix(vec3(.002,.005,.026),vec3(.009,.026,.10),height);
       night+=vec3(.007,.040,.235)*opening;
       vec3 c=mix(vec3(.003,.025,.065),vec3(.024,.145,.255),height);
       c+=vec3(.016,.135,.205)*opening;
       vec3 mars=mix(vec3(.006,.002,.013),vec3(.048,.006,.021),height);
       mars+=vec3(.135,.029,.009)*opening;
       gl_FragColor=vec4(mix(mix(c,night,uNight),mars,uPlanetX),1.);}`,
    }),
  );
  backdrop.position.set(0, 7, -18);
  backdrop.name = "Deep aquarium backdrop";
  scene.add(backdrop);
  const waterSurface = createWaterSurface(scene, camera, uniforms);
  const bubbleSystem = createBubbles(
    camera,
    fluid,
    water,
    uniforms,
    reef.bubbleSites,
  );
  const emit = bubbleSystem.emit;
  // Suspended particulate catches the blue light and makes depth visible.
  const dustGeo = new T.BufferGeometry(),
    dustPos = new Float32Array(700 * 3);
  for (let i = 0; i < dustPos.length; i += 3) {
    dustPos[i] = rand(-11, 11);
    dustPos[i + 1] = rand(0.2, 9);
    dustPos[i + 2] = rand(-7, 6);
  }
  dustGeo.setAttribute("position", new T.BufferAttribute(dustPos, 3));
  const dust = new T.Points(
    dustGeo,
    new T.PointsMaterial({
      size: 0.014,
      color: 0x91c5d2,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  dust.name = "Suspended plankton";
  scene.add(dust);
  const composer = new EffectComposer(renderer);
  const scenePass = new ScenePass(scene, camera);
  composer.addPass(scenePass);
  const volume = createVolumetricPass(
    camera,
    scenePass.target.depthTexture,
    uniforms,
    key,
  );
  composer.addPass(volume);
  composer.addPass(bubbleSystem.createPass(scenePass.target.depthTexture));
  const depthSoftening = createDepthSoftening(
    camera,
    scenePass.target.depthTexture,
  );
  composer.addPass(depthSoftening);
  const uvGlow = createUVGlowPass(uniforms);
  composer.addPass(uvGlow);
  const grade = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      time: uniforms.time,
      night: uniforms.night,
    },
    vertexShader:
      "varying vec2 vUV;void main(){vUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `uniform sampler2D tDiffuse;uniform float time,night;varying vec2 vUV;void main(){vec2 uv=vUV;uv.x+=sin(uv.y*26.+time*.32)*.00007*night;vec3 c=texture2D(tDiffuse,uv).rgb;float vignette=1.-.10*pow(length((uv-.5)*vec2(1.15,1.)),1.3);c*=vignette;float luma=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(luma),c,mix(.99,1.025,night));c=max(c,vec3(0.));gl_FragColor=vec4(c,1.);}`,
  });
  grade.uniforms.time = uniforms.time;
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  let t = 0,
    paused = false,
    quality = "High",
    clock = new FrameClock(),
    fluidSteps = new FixedStepper(),
    frames = 0,
    nextDrop = 0,
    nextShadow = 0,
    nextStatus = 0,
    nextCaustics = 0,
    frameMs = 16.67,
    lastInteraction = "none",
    pausedByHost = false,
    viewDirty = true;
  const appearance = createAppearance((mode) => {
    const planetX = mode === "Planet X";
    const night = mode === "Night" || planetX;
    uniforms.night.value = night ? 1 : 0;
    uniforms.planetX.value = planetX ? 1 : 0;
    lighting.setAppearance(mode);
    uvGlow.enabled =
      night && !new URLSearchParams(location.search).has("noGlow");
    renderer.toneMappingExposure = planetX ? 1.12 : night ? 1.08 : 1.06 * 1.2;
    scene.background.set(planetX ? "#290d24" : night ? "#07103d" : "#247d9a");
    scene.fog.color.set(planetX ? "#492132" : night ? "#102765" : "#277f9c");
    scene.fog.density = planetX ? 0.02 : night ? 0.026 : 0.007;
    depthSoftening.enabled = night && quality === "High";
    dust.material.opacity = planetX ? 0.3 : night ? 0.12 : 0.13;
    dust.material.color.set(planetX ? 0xffb578 : 0x91c5d2);
    waterSurface.invalidate();
    renderer.shadowMap.needsUpdate = true;
    viewDirty = true;
  });
  appearance.apply();
  const raycaster = new T.Raycaster();
  function click(x, y, selectedFishIndex) {
    if (paused || pausedByHost) return;
    raycaster.setFromCamera(new T.Vector2(x * 2 - 1, 1 - y * 2), camera);
    const hits = raycaster.intersectObjects(
      [...fish.pickables, ...reef.interactables],
      false,
    );
    const selected = fish.fishes[selectedFishIndex];
    if (!selected && !hits.length) return;
    const hit = selected
        ? { object: selected.body, point: selected.group.position }
        : hits[0],
      id = hit.object.userData.fishIndex;
    if (id !== undefined) {
      triggerShy(fish.fishes[id]);
      lastInteraction = "fish";
      fluid.impulse(hit.point.x, hit.point.y, hit.point.z, 0.2, 0, 0.25, 0.8);
    } else {
      emit(hit.point, Math.floor(rand(14, 29)));
      lastInteraction = "reef";
    }
    water.addDrop(hit.point.x / 9.6, (hit.point.z + 1.6) / 4.8, 0.035, 0.018);
  }
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const navigation = createNavigation({
    camera,
    canvas: renderer.domElement,
    fish,
    reef,
    onClick: click,
    onChange: () => {
      viewDirty = true;
    },
    onFishMove: () => {
      lastInteraction = "fish-drag";
      renderer.shadowMap.needsUpdate = true;
    },
  });
  function renderFrame(dt) {
    depthSoftening.uniforms.focus.value = navigation.state().distance;
    volume.update();
    renderer.info.reset();
    composer.render(dt);
    viewDirty = false;
  }
  function setPaused(value) {
    paused = value;
    clock.suspend();
    document.querySelector("#pause").textContent = paused ? "Resume" : "Pause";
    document
      .querySelector("#pause")
      .setAttribute(
        "aria-label",
        paused ? "Resume aquarium" : "Pause aquarium",
      );
  }
  function setQuality(value) {
    const changed = quality !== value;
    quality = value;
    if (changed && value === "High")
      adaptiveResolution.reset(Math.min(devicePixelRatio, 1.5));
    waterSurface.setQuality(value);
    depthSoftening.enabled = value === "High" && uniforms.night.value > 0.5;
    volume.enabled = value !== "Eco";
    renderer.setPixelRatio(
      Math.min(
        devicePixelRatio,
        value === "High"
          ? adaptiveResolution.scale
          : value === "Balanced"
            ? 1
            : 0.75,
      ),
    );
    resize();
    document.querySelector("#quality").textContent = "Quality: " + value;
  }
  function reset() {
    viewDirty = true;
    navigation.reset();
  }
  document.querySelector("#pause").onclick = () => setPaused(!paused);
  document.querySelector("#quality").onclick = () =>
    setQuality(
      quality === "High" ? "Balanced" : quality === "Balanced" ? "Eco" : "High",
    );
  document.querySelector("#reset").onclick = reset;
  document.addEventListener("keydown", (e) => {
    if (e.target.closest("select,input,textarea,[contenteditable='true']"))
      return;
    if (e.code === "Space") {
      e.preventDefault();
      setPaused(!paused);
    }
    if (e.key.toLowerCase() === "h") document.body.classList.toggle("quiet");
    if (e.key.toLowerCase() === "d") document.body.classList.toggle("debug");
    if (e.key === "Escape") reset();
  });
  function resize() {
    viewDirty = true;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
  }
  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => clock.suspend());
  function stats() {
    return {
      fish: fish.fishes.length,
      maxShy: Math.max(...fish.fishes.map((f) => f.shy.value)),
      coralTargets: reef.interactables.length,
      shelfContact: reef.shelfContact,
      planting: reef.planting,
      nightEffects: {
        enabled: uniforms.night.value > 0.5,
        selectiveGlow: uvGlow.enabled,
        animatedPigments: true,
        palette: uniforms.planetX.value > 0.5 ? "Planet X" : "UV",
      },
      daylightClarity: {
        exposure: renderer.toneMappingExposure,
        fogDensity: scene.fog.density,
        distantBlur: depthSoftening.enabled,
      },
      collisions: {
        obstacles: obstacles.boxes.length,
        contacts: obstacles.contacts,
        overlaps: fish.fishes.filter((f) =>
          obstacles.blocked(f.group.position, f.collisionRadius),
        ).length,
      },
      bubbles: bubbleSystem.stats().count,
      bubbleOptics: bubbleSystem.stats(),
      waterReflection: waterSurface.stats(),
      navigation: navigation.state(),
      fishStates: fish.fishes.map((f) => ({
        name: f.species.name,
        planetPattern: f.planetPattern.name,
        depthBand: f.depthBand,
        position: f.group.position.toArray(),
        rotation: f.group.rotation.toArray().slice(0, 3),
        routeDistance: f.routeDistance,
        laneY: f.route.laneY,
        dragging: f.dragging,
        stroke: f.stroke.value,
        bend: f.bend.value,
        fins: f.fins.map((fin) => fin.pivot.rotation.toArray().slice(0, 3)),
      })),
      lastInteraction,
      paused,
      hostPaused: pausedByHost,
      quality,
      appearance: appearance.state(),
      time: t,
      performance: {
        fps: 1000 / frameMs,
        frameMs,
        renderScale: renderer.getPixelRatio(),
        adaptiveResolution: quality === "High",
        width: renderer.domElement.width,
        height: renderer.domElement.height,
      },
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      fluidDivergence: fluid.divergence(),
      camera: [camera.position.x, camera.position.y, camera.position.z],
    };
  }
  if (new URLSearchParams(location.search).has("inspect"))
    window.reefInspect = {
      scene,
      camera,
      renderer,
      composer,
      uniforms,
      uvGlow,
      scenePass,
    };
  window.aquarium = {
    click,
    pointer: navigation.pointer,
    zoom: navigation.zoom,
    setPaused,
    setQuality,
    setAppearance: appearance.set,
    reset,
    hostPause: (value) => {
      pausedByHost = value;
      clock.suspend();
      if (!value) appearance.refresh();
    },
    wallpaper: (value) => document.body.classList.toggle("wallpaper", value),
    stats,
    targets: () => {
      scene.updateMatrixWorld(true);
      return fish.fishes.map((f) => {
        const p = f.group.position.clone().project(camera);
        return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 };
      });
    },
    async exportGLB() {
      const copy = scene.clone(true),
        instances = [],
        remove = [];
      copy.traverse((o) => {
        if ((o.isMesh && o.material?.isShaderMaterial) || o.isPoints)
          remove.push(o);
        else if (o.isInstancedMesh) instances.push(o);
      });
      remove.forEach((o) => o.removeFromParent());
      for (const mesh of instances) {
        const geometries = [],
          matrix = new T.Matrix4(),
          color = new T.Color();
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, matrix);
          const g = mesh.geometry.clone().applyMatrix4(matrix);
          if (mesh.instanceColor) {
            mesh.getColorAt(i, color);
            const colors = new Float32Array(g.attributes.position.count * 3);
            for (let j = 0; j < colors.length; j += 3) {
              colors[j] = color.r;
              colors[j + 1] = color.g;
              colors[j + 2] = color.b;
            }
            g.setAttribute("color", new T.BufferAttribute(colors, 3));
          }
          geometries.push(g);
        }
        const merged = mergeGeometries(geometries);
        geometries.forEach((g) => g.dispose());
        const material = mesh.material.clone();
        material.vertexColors = !!mesh.instanceColor;
        const replacement = new T.Mesh(merged, material);
        replacement.name = mesh.name;
        replacement.position.copy(mesh.position);
        replacement.quaternion.copy(mesh.quaternion);
        replacement.scale.copy(mesh.scale);
        mesh.parent.add(replacement);
        mesh.removeFromParent();
      }
      copy.updateMatrixWorld(true);
      return await new GLTFExporter().parseAsync(copy, {
        binary: true,
        onlyVisible: true,
      });
    },
  };
  let reported = false;
  function frame(now) {
    requestAnimationFrame(frame);
    const active = !(pausedByHost || document.hidden || paused);
    const dt = clock.tick(now, active, quality === "Eco" ? 30 : 0);
    if (!active) {
      if (paused && !pausedByHost && !document.hidden && viewDirty)
        renderFrame(0);
      return;
    }
    if (dt === null) return;
    if (dt > 0) frameMs += (dt * 1000 - frameMs) * 0.08;
    t += dt;
    if (quality === "High" && t > 1) {
      const scale = adaptiveResolution.sample(dt);
      if (scale !== null) {
        renderer.setPixelRatio(scale);
        resize();
      }
    }
    uniforms.time.value = t;
    const steps = fluidSteps.advance(dt, (step) => {
      fluid.impulse(-7, 1.4, -3, 0.006, 0.014, 0, 1.4);
      fluid.impulse(7, 1.4, -3, -0.006, 0.014, 0, 1.4);
      fluid.step(step);
      water.stepSimulation();
    });
    if (t >= nextDrop) {
      water.addDrop(
        rand(-0.9, 0.9),
        rand(-0.9, 0.9),
        0.045,
        rand(-0.012, 0.012),
      );
      nextDrop = t + 0.5;
    }
    if (steps > 0) water.updateNormals();
    uniforms.water.value = water.textureA.texture;
    if (t >= nextCaustics) {
      caustics.update();
      nextCaustics = t + 1 / 30;
    }
    animateFish(fish.fishes, t, dt, reducedMotion.matches);
    for (const s of reef.swayers) {
      const flow = fluid.sample(
        s.group.position.x,
        s.group.position.y + 1,
        s.group.position.z,
      );
      s.group.rotation.z =
        s.base + Math.sin(t * 0.65 + s.phase) * s.amount + flow[0] * 0.04;
    }
    bubbleSystem.update(t, dt);
    dust.rotation.y = Math.sin(t * 0.025) * 0.03;
    dust.position.y = Math.sin(t * 0.1) * 0.08;
    if (t >= nextShadow) {
      renderer.shadowMap.needsUpdate = true;
      nextShadow = t + 1 / 20;
    }
    renderFrame(dt);
    frames++;
    if (t >= nextStatus) {
      document.querySelector("#status").textContent =
        `${quality} · ${Math.round(1000 / frameMs)} fps · ${bubbleSystem.stats().count} bubbles`;
      nextStatus = t + 1;
    }
    if (!reported) {
      reported = true;
      document.querySelector("#loading").style.opacity = 0;
      window.webkit?.messageHandlers?.reef?.postMessage({ event: "ready" });
    }
  }
  console.info("Reef: starting animation");
  requestAnimationFrame(frame);
}
