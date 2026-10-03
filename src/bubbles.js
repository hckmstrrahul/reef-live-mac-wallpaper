import * as T from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { CopyShader } from "three/addons/shaders/CopyShader.js";
import { LIGHT_ORIGIN, LIGHT_DIRECTION } from "./lighting.js";
import { rand } from "./reef.js";
import { BubbleEmission } from "./bubble-emission.js";
export function createBubbles(camera, fluid, water, shared, sites) {
  const scene = new T.Scene(),
    max = 280,
    body = new T.Object3D(),
    bubbles = [];
  const material = new T.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uNight: shared.night,
      uPlanetX: shared.planetX,
      uBackground: { value: null },
      uDepth: { value: null },
      uResolution: { value: new T.Vector2() },
      uLightOrigin: { value: LIGHT_ORIGIN },
      uLightDirection: { value: LIGHT_DIRECTION },
    },
    vertexShader: `varying vec3 vNormal,vView,vWorld;varying float vRadius;void main(){vec4 local=instanceMatrix*vec4(position,1.);vec4 world=modelMatrix*local;vec4 view=modelViewMatrix*local;vWorld=world.xyz;vNormal=normalize(normalMatrix*mat3(instanceMatrix)*normal);vView=view.xyz;vRadius=length(instanceMatrix[0].xyz);gl_Position=projectionMatrix*view;}`,
    fragmentShader: `
 varying vec3 vNormal,vView,vWorld;varying float vRadius;uniform sampler2D uBackground,uDepth;uniform vec2 uResolution;uniform vec3 uLightOrigin,uLightDirection;uniform float uNight,uPlanetX;
 void main(){vec2 uv=gl_FragCoord.xy/uResolution;if(gl_FragCoord.z>texture2D(uDepth,uv).r+.00001)discard;vec3 N=normalize(vNormal),V=normalize(-vView);float facing=max(0.,dot(N,V));float rim=pow(1.-facing,4.);vec2 offset=N.xy*vRadius/max(1.,-vView.z)*.48;vec3 transmitted=texture2D(uBackground,clamp(uv+offset,.001,.999)).rgb;
 vec3 L=normalize((viewMatrix*vec4(uLightOrigin-vWorld,0.)).xyz);float glint=pow(max(0.,dot(N,normalize(L+V))),160.);vec3 delta=vWorld-uLightOrigin;float axial=dot(delta,uLightDirection);float inBeam=1.-smoothstep(axial*.18,axial*.34,length(delta-uLightDirection*axial));
 // Bright canopy reflections alternate with a dark lower crescent. There is
 // no emissive/additive halo: every bubble refracts and replaces its background.
 vec3 reflection=mix(vec3(.018,.037,.052),vec3(.76,.91,.94),smoothstep(-.15,.72,N.y));
 reflection*=mix(vec3(1.),vec3(.18,.25,.42),uNight);
 reflection=mix(reflection,mix(vec3(.045,.008,.018),vec3(.68,.32,.17),smoothstep(-.15,.72,N.y)),uPlanetX);
 float edge=pow(1.-facing,2.8);
 vec3 col=mix(transmitted*.97,reflection,.025+edge*.72);
 float crescent=pow(1.-facing,6.)*smoothstep(.05,.72,N.y);
 col+=mix(vec3(.68,.77,.76),vec3(1.2,.55,.23),uPlanetX)*(glint*(.55+.9*inBeam)+crescent*.25)*mix(1.,.24+.20*uPlanetX,uNight);
 col*=1.-.32*pow(1.-facing,10.)*(1.-smoothstep(-.55,.2,N.y));
 gl_FragColor=vec4(col,1.);
 }`,
  });
  const mesh = new T.InstancedMesh(
    new T.SphereGeometry(1, 20, 14),
    material,
    max,
  );
  mesh.frustumCulled = false;
  mesh.name = "Refracting air bubbles";
  scene.add(mesh);
  let cursor = 0;
  const schedule = new BubbleEmission(sites, () => rand());
  const candidate = new T.Vector3();
  for (let i = 0; i < max; i++) {
    bubbles.push({
      alive: false,
      p: new T.Vector3(),
      v: new T.Vector3(),
      r: 0.03,
      age: 0,
    });
    body.scale.setScalar(0);
    body.updateMatrix();
    mesh.setMatrixAt(i, body.matrix);
  }
  function spawn(point, radius, burst = false) {
    // Reject crowded birth positions, including other sources and click bursts.
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = rand(0, Math.PI * 2),
        spread = Math.sqrt(rand()) * (burst ? 0.48 : 0.34);
      candidate.set(
        point[0] + Math.cos(angle) * spread,
        point[1] + radius + rand(0.035, 0.14),
        point[2] + Math.sin(angle) * spread,
      );
      if (
        bubbles.some(
          (b) =>
            b.alive &&
            b.p.distanceToSquared(candidate) <
              (radius + b.r * 1.14 + 0.09) ** 2,
        )
      )
        continue;
      const b = bubbles[cursor++ % max];
      b.alive = true;
      b.p.copy(candidate);
      b.v.set(
        rand(-0.075, 0.075),
        0.25 + Math.sqrt(radius) * 1.5,
        rand(-0.075, 0.075),
      );
      b.r = radius;
      b.age = 0;
      return true;
    }
    return false;
  }
  function emit(p, count = 18) {
    const point = p.toArray();
    spawn(point, schedule.radius(), true);
    schedule.burst(point, count - 1);
    fluid.impulse(p.x, p.y, p.z, 0, 0.16, 0, 1.1);
  }
  // Populate several loose trails for a finished view immediately after launch.
  for (let i = 0; i < 48; i++) {
    const vent = schedule.vents[i % schedule.vents.length],
      p = sites[vent.site];
    spawn(
      [
        p[0] + rand(-0.3, 0.3),
        rand(p[1] + 0.25, 7.7),
        p[2] + rand(-0.25, 0.25),
      ],
      schedule.radius(),
    );
  }
  function update(t, dt) {
    schedule.tick(dt, spawn);
    for (let i = 0; i < max; i++) {
      const b = bubbles[i];
      if (b.alive) {
        b.age += dt;
        const flow = fluid.sample(b.p.x, b.p.y, b.p.z),
          terminal = 0.25 + Math.sqrt(b.r) * 1.6;
        b.v.x += (flow[0] - b.v.x) * dt * 2;
        b.v.z += (flow[2] - b.v.z) * dt * 2;
        b.v.y += (terminal + flow[1] - b.v.y) * dt * 2.5;
        b.p.addScaledVector(b.v, dt);
        b.p.x += Math.sin(t * 2.1 + i * 1.71) * dt * b.r * 0.7;
        if (b.p.y > 8.35 || b.age > 30) {
          b.alive = false;
          water.addDrop(b.p.x / 9.6, (b.p.z + 1.6) / 4.8, 0.012, 0.003);
        }
        body.position.copy(b.p);
        const r = b.r * (1 + b.p.y * 0.016);
        body.scale.set(r, r * (1 - Math.min(0.17, b.r) * 0.85), r);
      } else body.scale.setScalar(0);
      body.updateMatrix();
      mesh.setMatrixAt(i, body.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  class BubblePass extends Pass {
    constructor(depthTexture) {
      super();
      this.depthTexture = depthTexture;
      this.copy = new T.ShaderMaterial({
        uniforms: T.UniformsUtils.clone(CopyShader.uniforms),
        vertexShader: CopyShader.vertexShader,
        fragmentShader: CopyShader.fragmentShader,
        depthTest: false,
        depthWrite: false,
      });
      this.quad = new FullScreenQuad(this.copy);
    }
    render(renderer, write, read) {
      renderer.setRenderTarget(this.renderToScreen ? null : write);
      this.copy.uniforms.tDiffuse.value = read.texture;
      this.quad.render(renderer);
      material.uniforms.uBackground.value = read.texture;
      material.uniforms.uDepth.value = this.depthTexture;
      material.uniforms.uResolution.value.set(write.width, write.height);
      const auto = renderer.autoClear;
      renderer.autoClear = false;
      renderer.render(scene, camera);
      renderer.autoClear = auto;
    }
  }
  return {
    emit,
    update,
    createPass: (depth) => new BubblePass(depth),
    stats: () => ({
      count: bubbles.filter((b) => b.alive).length,
      minRadius: 0.014,
      maxRadius: 0.205,
      ...schedule.stats(),
      sizes: {
        tiny: bubbles.filter((b) => b.alive && b.r < 0.05).length,
        medium: bubbles.filter((b) => b.alive && b.r >= 0.05 && b.r < 0.11)
          .length,
        large: bubbles.filter((b) => b.alive && b.r >= 0.11).length,
      },
      refraction: true,
    }),
  };
}
