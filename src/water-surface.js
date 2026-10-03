import * as T from "three";
import { Reflector } from "three/addons/objects/Reflector.js";

// A real mirrored scene capture, distorted by the solver's surface normals.
// Small polyps/gravel are omitted from the reflection's dedicated layer.
export function createWaterSurface(scene, camera, shared) {
  scene.traverse((o) => {
    if (
      o.isLight ||
      (o.isMesh && !o.isInstancedMesh && !/tentacles/i.test(o.name))
    )
      o.layers.enable(1);
  });
  const surface = new Reflector(new T.PlaneGeometry(140, 180, 1, 1), {
    textureWidth: 768,
    textureHeight: 384,
    multisample: 0,
    clipBias: 0.001,
    shader: {
      uniforms: {
        color: { value: null },
        tDiffuse: { value: null },
        textureMatrix: { value: null },
        uWater: { value: null },
        uTime: { value: 0 },
        uNight: { value: 0 },
        uPlanetX: { value: 0 },
      },
      vertexShader: `uniform mat4 textureMatrix;varying vec4 vReflection;varying vec3 vWorld;varying vec2 vUV;
        void main(){vUV=uv;vReflection=textureMatrix*vec4(position,1.);vWorld=(modelMatrix*vec4(position,1.)).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform sampler2D tDiffuse,uWater;uniform float uTime,uNight,uPlanetX;
        varying vec4 vReflection;varying vec3 vWorld;varying vec2 vUV;
        void main(){
          vec2 p=vWorld.xz;vec4 w=texture2D(uWater,clamp(vec2(p.x/24.+.5,(p.y+3.)/16.+.5),.001,.999));
          vec2 waves=vec2(sin(p.x*2.3+p.y*3.2+uTime*.85)+.45*sin(p.y*7.-uTime*.7),
            cos(p.y*3.6+p.x*1.4-uTime*.62)+.4*cos(p.x*6.+uTime*.9));
          vec2 slope=waves*.10+w.ba*3.;
          vec2 uv=vReflection.xy/vReflection.w+slope*.035;
          vec3 reflected=texture2D(tDiffuse,clamp(uv,.001,.999)).rgb*.4;
          reflected+=(texture2D(tDiffuse,clamp(uv+vec2(.003,.004),.001,.999)).rgb+texture2D(tDiffuse,clamp(uv-vec2(.003,.004),.001,.999)).rgb)*.3;
          vec3 N=normalize(vec3(slope.x,-1.,slope.y)),V=normalize(cameraPosition-vWorld);
          float facing=abs(dot(N,V));
          // Underwater grazing angles approach total internal reflection.
          float fresnel=mix(.08,.93,1.-smoothstep(.40,.78,facing));
          vec3 sky=mix(vec3(.10,.29,.39),vec3(.004,.009,.055),uNight);
          sky=mix(sky,vec3(.16,.034,.045),uPlanetX);
          float sun=pow(max(0.,dot(reflect(-V,N),normalize(vec3(-.35,-.9,.18)))),95.);
          float ripple=pow(.5+.5*sin(p.x*2.8+p.y*5.3+waves.x*1.3+uTime*.45),18.);
          vec3 color=mix(sky,reflected*1.12,fresnel);
          color+=mix(vec3(.50,.66,.64),vec3(1.4,.48,.14),uPlanetX)*(sun*.75+ripple*.025)*mix(1.,.17+.22*uPlanetX,uNight);
          float fade=1.-smoothstep(13.,30.,length(vWorld.xz-cameraPosition.xz));
          gl_FragColor=vec4(color,fade);
        }`,
    },
  });
  surface.rotation.x = Math.PI / 2;
  surface.position.set(0, 8.4, -12);
  surface.material.transparent = true;
  surface.material.depthWrite = false;
  surface.name = "Live rippling water reflection";
  surface.material.uniforms.uWater = shared.water;
  surface.material.uniforms.uTime = shared.time;
  surface.material.uniforms.uNight = shared.night;
  surface.material.uniforms.uPlanetX = shared.planetX;
  const reflect = surface.onBeforeRender;
  const lastPosition = new T.Vector3(Infinity, 0, 0),
    lastRotation = new T.Quaternion();
  let nextCapture = -1,
    enabled = true,
    captureDirty = true,
    captures = 0;
  surface.onBeforeRender = function (renderer, scene, view) {
    const moved =
      view.position.distanceToSquared(lastPosition) > 0.0001 ||
      1 - Math.abs(view.quaternion.dot(lastRotation)) > 0.000001;
    if (
      !captureDirty &&
      (!enabled || (shared.time.value < nextCapture && !moved))
    )
      return;
    const reflectionCamera = this.getReflectionCamera(view);
    reflectionCamera.layers.set(1);
    const shadow = renderer.shadowMap.needsUpdate;
    renderer.shadowMap.needsUpdate = false;
    reflect.call(this, renderer, scene, view);
    renderer.shadowMap.needsUpdate = shadow;
    lastPosition.copy(view.position);
    lastRotation.copy(view.quaternion);
    nextCapture = shared.time.value + 1 / 15;
    captureDirty = false;
    captures++;
  };
  scene.add(surface);
  return {
    surface,
    invalidate() {
      captureDirty = true;
      nextCapture = -1;
    },
    setQuality(q) {
      enabled = q !== "Eco";
      captureDirty = true;
      nextCapture = -1;
    },
    stats: () => ({ live: enabled, captures, width: 768, height: 384 }),
  };
}
