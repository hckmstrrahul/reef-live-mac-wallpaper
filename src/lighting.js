import * as T from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import studioHDR from "../assets/lighting/studio_small_08_1k.hdr";
import { planetPigmentGLSL } from "./planet-x.js";
export const LIGHT_ORIGIN = new T.Vector3(-6.5, 12.5, 1.0);
export const LIGHT_TARGET = new T.Vector3(0.8, 0.5, -2.0);
export const LIGHT_DIRECTION = LIGHT_TARGET.clone()
  .sub(LIGHT_ORIGIN)
  .normalize();

export const waterLightGLSL = `
float beamMask(vec3 p){
 vec3 delta=p-uLightOrigin;float along=dot(delta,uLightDirection);
 float radius=max(.4,along*.38);float radial=length(delta-uLightDirection*along);
 return (1.-smoothstep(radius*.48,radius,radial))*smoothstep(0.,2.,along);
}
float causticAt(vec3 p){
 float height=8.4-p.y;vec2 projected=p.xz+uLightDirection.xz*(height/uLightDirection.y);
 vec2 waterUV=vec2(projected.x/24.+.5,(projected.y+3.)/16.+.5);
 vec4 wave=texture2D(uWater,clamp(waterUV,.001,.999));
 vec2 warp=wave.ba*14.+vec2(sin(projected.y*.7+uTime*.25),cos(projected.x*.8-uTime*.21))*.17;
 return texture2D(uCaustics,fract((projected*1.65+warp)/32.)).r*(.13+.87*beamMask(p));
}`;
// Evaluate the moving caustic cells once, not inside every reef fragment and
// every volumetric ray step. This cache is shared by all fish and reef objects.
export function createCausticField(renderer, time) {
  const target = new T.WebGLRenderTarget(768, 768, {
    depthBuffer: false,
    type: T.UnsignedByteType,
    wrapS: T.RepeatWrapping,
    wrapT: T.RepeatWrapping,
  });
  const material = new T.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { uTime: time },
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader: `varying vec2 vUv;uniform float uTime;
float waterCells(vec2 p){
 vec2 cell=floor(p),f=fract(p);float nearest=10.,second=10.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 g=vec2(float(x),float(y));vec2 wrapped=mod(cell+g,32.);vec2 h=vec2(dot(wrapped,vec2(127.1,311.7)),dot(wrapped,vec2(269.5,183.3)));
  vec2 q=.5+.33*sin(uTime*.22+6.2831*fract(sin(h)*43758.5453));float d=length(g+q-f);
  if(d<nearest){second=nearest;nearest=d;}else second=min(second,d);
 }
 return pow(1.-smoothstep(.015,.11,second-nearest),2.);
}

    void main(){float c=waterCells(vUv*32.);gl_FragColor=vec4(vec3(c),1.);}`,
  });
  const quad = new FullScreenQuad(material);
  function update() {
    const previous = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    quad.render(renderer);
    renderer.setRenderTarget(previous);
  }
  update();
  return { texture: target.texture, update };
}
export function applyWaterLight(material, shared) {
  const previous = material.onBeforeCompile.bind(material),
    cache = material.customProgramCacheKey.bind(material)();
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    Object.assign(shader.uniforms, {
      uTime: shared.time,
      uWater: shared.water,
      uCaustics: shared.caustics,
      uNight: shared.night,
      uPlanetX: shared.planetX,
      uMineral: { value: material.userData.planetMineral ? 1 : 0 },
      uLightOrigin: { value: LIGHT_ORIGIN },
      uLightDirection: { value: LIGHT_DIRECTION },
    });
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vWaterWorld;",
      )
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
   vec4 waterWorld=vec4(transformed,1.);
   #ifdef USE_INSTANCING
    waterWorld=instanceMatrix*waterWorld;
   #endif
   vWaterWorld=(modelMatrix*waterWorld).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
   varying vec3 vWaterWorld;uniform float uTime,uNight,uPlanetX,uMineral;uniform sampler2D uWater,uCaustics;uniform vec3 uLightOrigin;uniform vec3 uLightDirection;
   ${waterLightGLSL}
   ${planetPigmentGLSL}`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        // Iron-rich stone and sand reflect the same copper light as the water.
        if(uPlanetX>.5 && uMineral>.5) {
          float ore=dot(diffuseColor.rgb,vec3(.3,.5,.2));
          diffuseColor.rgb=mix(diffuseColor.rgb,ore*vec3(1.28,.55,.36),.72);
        }`,
      )
      .replace(
        "#include <lights_fragment_end>",
        `#include <lights_fragment_end>
    vec3 worldSurfaceNormal=inverseTransformDirection(normal,viewMatrix);
    float facing=max(.10,dot(worldSurfaceNormal,-uLightDirection));
    float caustics=causticAt(vWaterWorld)*facing;
    vec3 causticColor=mix(vec3(.70,.94,1.05),vec3(1.65,.55,.20),uPlanetX);
    reflectedLight.directDiffuse+=diffuseColor.rgb*causticColor*caustics*.50*mix(1.,.50,uNight);`,
      );
  };
  material.customProgramCacheKey = () => cache + "-planet-caustics-11";
  material.needsUpdate = true;
}
// Fluorescence is local to living tissue; day reflectance and the surrounding
// rocks stay non-emissive. This is an artistic UV aquarium treatment.
export function applyNightPigment(
  material,
  shared,
  color = "#58e8be",
  strength = 1,
  uvEnabled = true,
) {
  const previous = material.onBeforeCompile.bind(material);
  const cache = material.customProgramCacheKey.bind(material)();
  material.onBeforeCompile = (shader, renderer) => {
    previous(shader, renderer);
    shader.uniforms.uvTissueColor = { value: new T.Color(color) };
    shader.uniforms.uvTissueGain = { value: strength };
    shader.uniforms.uvEnabled = { value: uvEnabled ? 1 : 0 };
    shader.uniforms.alienTissueSeed = {
      value:
        material.color.r * 7.1 +
        material.color.g * 11.7 +
        material.color.b * 5.3,
    };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform vec3 uvTissueColor;uniform float uvTissueGain,uvEnabled,alienTissueSeed;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        vec3 cell=vWaterWorld*91.;
        float tissue=sin(cell.x+sin(cell.z)) * sin(cell.y*.87-cell.z*.5);
        float dots=smoothstep(.45,.88,tissue);
        float rim=pow(1.-max(0.,dot(normal,normalize(vViewPosition))),3.);
        float pulse=.91+.09*sin(uTime*.7+vWaterWorld.x*.8);
        totalEmissiveRadiance+=uvTissueColor*(dots*.18+rim*.04+.006)*uvTissueGain*uNight*(1.-uPlanetX)*uvEnabled*pulse*sqrt(max(diffuseColor.rgb,vec3(.015)));
        if(uPlanetX>.5) {
          float family=alienTissueSeed;
          vec3 tissuePoint=vWaterWorld*(1.45+fract(family)*1.4)+vec3(family);
          float channels=alienChannels(tissuePoint);
          float colonies=smoothstep(-.65,.45,sin(tissuePoint.x*.9+sin(tissuePoint.z*1.5))+sin(tissuePoint.y*1.1)*.5);
          channels*=.18+.82*colonies;
          float wave=.68+.32*sin(vWaterWorld.y*3.-uTime*.72+family);
          vec3 tissueColor=alienPalette(family);
          totalEmissiveRadiance+=tissueColor*(channels*.75+rim*.10+.016)*wave*uvTissueGain;
        }
      `,
      );
  };
  material.customProgramCacheKey = () => cache + "-alien-living-tissue-11";
}
export function createCornerLighting(scene, renderer) {
  const ambience = new T.HemisphereLight(0xe5f4f0, 0x2e4949, 1.85);
  scene.add(ambience);
  const key = new T.SpotLight(0xfff3de, 360, 44, 0.36, 0.78, 1.45);
  key.position.copy(LIGHT_ORIGIN);
  key.target.position.copy(LIGHT_TARGET);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 44;
  key.shadow.normalBias = 0.032;
  key.shadow.bias = -0.00012;
  key.shadow.radius = 2.5;
  scene.add(key, key.target);
  const fill = new T.DirectionalLight(0xf0f5ff, 2.65);
  fill.position.set(-4, 9, 3);
  scene.add(fill);
  const bounce = new T.SpotLight(0xdfd4d2, 90, 25, 0.7, 0.95, 1.2);
  bounce.position.set(-5, 7.5, 5);
  bounce.target.position.set(-4.5, 1.5, 2);
  scene.add(bounce, bounce.target);
  // CC0 unclipped studio radiance supplies broad, physically based wet highlights.
  const bytes = Uint8Array.fromBase64
    ? Uint8Array.fromBase64(studioHDR)
    : Uint8Array.from(atob(studioHDR), (c) => c.charCodeAt(0));
  const hdr = new HDRLoader().parse(bytes.buffer);
  const source = new T.DataTexture(
    hdr.data,
    hdr.width,
    hdr.height,
    T.RGBAFormat,
    hdr.type,
  );
  source.mapping = T.EquirectangularReflectionMapping;
  source.needsUpdate = true;
  const pmrem = new T.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(source).texture;
  scene.environmentRotation.set(0, 1.2, 0);
  source.dispose();
  pmrem.dispose();
  return {
    key,
    setAppearance(mode) {
      const night = mode === "Night";
      if (mode === "Planet X") {
        ambience.color.set(0xb5a5cf);
        ambience.groundColor.set(0x4d1e32);
        ambience.intensity = 0.82;
        fill.color.set(0x81d9c3);
        fill.intensity = 0.85;
        key.color.set(0xffa36b);
        key.intensity = 245;
        bounce.color.set(0xef729b);
        bounce.intensity = 65;
        scene.environmentIntensity = 0.33;
        return;
      }
      bounce.intensity = night ? 70 : 90;
      bounce.color.set(night ? 0xdfd4d2 : 0xe1eafb);
      ambience.color.set(night ? 0x6485d7 : 0xdce8f3);
      ambience.groundColor.set(night ? 0x0b173a : 0x37423d);
      ambience.intensity = night ? 0.9 : 1.3;
      fill.color.set(night ? 0x8fa6df : 0xe6efff);
      fill.intensity = night ? 0.95 : 1.55;
      key.color.set(night ? 0x9db4ff : 0xf0f5ff);
      key.intensity = night ? 230 : 425;
      scene.environmentIntensity = night ? 0.38 : 0.52;
    },
  };
}
export function createVolumetricPass(camera, depthTexture, shared, key) {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null },
      uTime: shared.time,
      uNight: shared.night,
      uPlanetX: shared.planetX,
      uWater: { value: null },
      uCaustics: { value: null },
      uLightOrigin: { value: LIGHT_ORIGIN },
      uLightDirection: { value: LIGHT_DIRECTION },
      uCameraWorld: { value: camera.matrixWorld },
      uInverseProjection: { value: camera.projectionMatrixInverse },
      uShadowMap: { value: null },
      uShadowMatrix: { value: key.shadow.matrix },
      uHasShadow: { value: 0 },
    },
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `
 #include <packing>
 varying vec2 vUv;uniform sampler2D tDiffuse,tDepth,uWater,uCaustics,uShadowMap;uniform float uTime,uHasShadow,uNight,uPlanetX;uniform vec3 uLightOrigin,uLightDirection;uniform mat4 uCameraWorld,uInverseProjection,uShadowMatrix;
 ${waterLightGLSL}
 float visibleAt(vec3 p){vec4 c=uShadowMatrix*vec4(p,1.);vec3 q=c.xyz/c.w;if(uHasShadow<.5||q.x<0.||q.x>1.||q.y<0.||q.y>1.)return 1.;float d=unpackRGBAToDepth(texture2D(uShadowMap,q.xy));return q.z-.002<d?1.:.12;}
 void main(){float depth=texture2D(tDepth,vUv).x;vec4 endView=uInverseProjection*vec4(vUv*2.-1.,depth*2.-1.,1.);endView/=endView.w;vec3 origin=uCameraWorld[3].xyz;vec3 endWorld=(uCameraWorld*vec4(endView.xyz,1.)).xyz;vec3 ray=endWorld-origin;float lengthRay=min(length(ray),32.);ray=normalize(ray);float scattering=0.;
 // Irregular sunlight is refracted through broad moving surface patches. The
 // same projected coordinates continue along a ray; no painted parallel lines.
 for(int i=0;i<20;i++){
   float along=(float(i)+.5)/20.*lengthRay;vec3 p=origin+ray*along;
   float beam=beamMask(p);
   float phase=.32+.68*pow(max(0.,dot(-ray,-uLightDirection)),3.);
   float distanceToSurface=(8.4-p.y)/uLightDirection.y;
   vec2 surface=p.xz+uLightDirection.xz*distanceToSurface;
   vec2 q=surface*.8+vec2(uTime*.025,-uTime*.018);
   float cloud=sin(q.x*1.37+sin(q.y*.9))*.36+sin(q.y*1.81-q.x*.57)*.27+sin(q.x*3.13+q.y*2.24)*.12;
   float shafts=.12+.85*smoothstep(.10,.68,cloud);
   float caustic=.8+.2*causticAt(p);
   scattering+=beam*phase*shafts*caustic*visibleAt(p)*exp(-along*.035);
 }
 scattering*=lengthRay/20.*.023;scattering*=mix(.78,.38,uNight);
 vec3 light=mix(vec3(.77,.87,.90),vec3(.25,.39,1.),uNight)*scattering;
 light=mix(light,vec3(1.1,.32,.12)*scattering*1.3,uPlanetX);
 gl_FragColor=vec4(light,scattering);
 }`,
  });
  pass.uniforms.tDepth.value = depthTexture;
  pass.uniforms.uWater = shared.water;
  pass.uniforms.uCaustics = shared.caustics;
  pass.uniforms.uTime = shared.time;
  pass.uniforms.uNight = shared.night;
  pass.uniforms.uPlanetX = shared.planetX;
  pass.uniforms.uCameraWorld.value = camera.matrixWorld;
  pass.uniforms.uInverseProjection.value = camera.projectionMatrixInverse;
  pass.uniforms.uShadowMatrix.value = key.shadow.matrix;
  pass.update = () => {
    pass.uniforms.uShadowMap.value = key.shadow.map?.texture ?? null;
    pass.uniforms.uHasShadow.value = key.shadow.map ? 1 : 0;
  };
  const target = new T.WebGLRenderTarget(1, 1, {
    type: T.HalfFloatType,
    depthBuffer: false,
  });
  const composite = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null },
      uLight: { value: null },
      uSize: { value: new T.Vector2(1, 1) },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
    },
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `
    #include <packing>
    varying vec2 vUv;uniform sampler2D tDiffuse,tDepth,uLight;uniform vec2 uSize;uniform float uNear,uFar;
    float distanceAt(vec2 p){return -perspectiveDepthToViewZ(texture2D(tDepth,p).r,uNear,uFar);}
    void main(){
      vec4 source=texture2D(tDiffuse,vUv);float d=distanceAt(vUv);
      vec2 grid=vUv*uSize-.5,base=floor(grid),fraction=fract(grid);
      vec4 sum=vec4(0.);float total=0.;
      for(int y=0;y<2;y++)for(int x=0;x<2;x++){
        vec2 corner=vec2(float(x),float(y)),uv=clamp((base+corner+.5)/uSize,.001,.999);
        vec2 w=mix(1.-fraction,fraction,corner);
        float weight=w.x*w.y*exp(-abs(distanceAt(uv)-d)*3.);
        sum+=texture2D(uLight,uv)*weight;total+=weight;
      }
      vec4 light=total>.001?sum/total:vec4(0.);
      gl_FragColor=vec4(source.rgb*exp(-light.a*.12)+light.rgb,source.a);
    }`,
  });
  composite.uniforms.tDepth.value = depthTexture;
  composite.uniforms.uLight.value = target.texture;
  class VolumePass extends Pass {
    setSize(w, h) {
      target.setSize(
        Math.max(1, Math.ceil(w * 0.5)),
        Math.max(1, Math.ceil(h * 0.5)),
      );
      composite.uniforms.uSize.value.set(target.width, target.height);
    }
    update() {
      pass.update();
    }
    render(renderer, write, read) {
      // Shadow maps are now current because ScenePass has already rendered.
      pass.update();
      pass.render(renderer, target, read);
      composite.renderToScreen = this.renderToScreen;
      composite.render(renderer, write, read);
    }
    dispose() {
      pass.dispose();
      composite.dispose();
      target.dispose();
    }
  }
  return new VolumePass();
}
