import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import binary from "../assets/models/BarramundiFish.glb";
import { makeRoute, sampleRoute, makeCruiseRoute } from "./fish-motion.js";
import { applyWaterLight } from "./lighting.js";
import { planetFishPattern, planetFishGLSL } from "./planet-x-fish.js";

// Artistic, species-inspired interpretations of a shared CC0 anatomical base.
export const SPECIES = [
  {
    name: "Lyretail anthias",
    region: "Indian Ocean",
    shape: [1, 0.83, 0.85],
    pattern: 0,
    scale: 0.96,
    y: 3.6,
    z: 2.4,
    x: -0.6,
    speed: 0.35,
  },
  {
    name: "Jewel-spotted angelfish",
    region: "Artistic reef variety",
    shape: [0.91, 1.4, 0.64],
    pattern: 1,
    scale: 0.95,
    y: 6,
    z: -0.4,
    x: 3.2,
    speed: 0.29,
  },
  {
    name: "Yellow tang",
    region: "Central Pacific",
    shape: [0.83, 1.25, 0.57],
    pattern: 2,
    scale: 0.87,
    y: 4.9,
    z: 0.0,
    x: 0.1,
    speed: 0.34,
  },
  {
    name: "Blue tang",
    region: "Indo-Pacific",
    shape: [0.96, 1.12, 0.6],
    pattern: 3,
    scale: 1.05,
    y: 4.7,
    z: 1.5,
    x: -4.8,
    speed: 0.4,
  },
  {
    name: "Copperband butterflyfish",
    region: "Western Pacific",
    shape: [0.86, 1.48, 0.54],
    pattern: 4,
    scale: 0.84,
    y: 6.4,
    z: -2.5,
    x: -1.4,
    speed: 0.26,
  },
  {
    name: "Royal gramma",
    region: "Caribbean",
    shape: [1.08, 0.82, 0.75],
    pattern: 5,
    scale: 0.67,
    y: 5.8,
    z: -3,
    x: -4.7,
    speed: 0.3,
  },
  {
    name: "Clownfish",
    region: "Indo-Pacific",
    shape: [0.88, 1.03, 0.78],
    pattern: 6,
    scale: 0.7,
    y: 3.1,
    z: 2.7,
    x: 4.1,
    speed: 0.24,
  },
  {
    name: "Mandarinfish",
    region: "Western Pacific",
    shape: [1, 0.83, 1.02],
    pattern: 7,
    scale: 0.66,
    y: 3.3,
    z: 0.0,
    x: -2.8,
    speed: 0.23,
  },
  {
    name: "Turquoise discus",
    region: "Amazon Basin",
    shape: [0.74, 1.64, 0.55],
    pattern: 8,
    scale: 0.78,
    y: 5.2,
    z: -1.1,
    x: 3.3,
    speed: 0.23,
  },
  {
    name: "Threadfin butterflyfish",
    region: "Red Sea and Indo-Pacific",
    shape: [0.84, 1.48, 0.53],
    pattern: 9,
    scale: 0.76,
    y: 7.1,
    z: -3.5,
    x: 1.5,
    speed: 0.29,
  },
  {
    name: "Flame angelfish",
    region: "Tropical Pacific",
    shape: [0.85, 1.3, 0.66],
    pattern: 10,
    scale: 0.72,
    y: 2.8,
    z: 2.8,
    x: -5.4,
    speed: 0.27,
  },
  {
    name: "Powder blue tang",
    region: "Indian Ocean",
    shape: [0.83, 1.35, 0.55],
    pattern: 11,
    scale: 0.79,
    y: 6.9,
    z: -0.6,
    x: 5.1,
    speed: 0.31,
  },
  {
    name: "Purple tang",
    region: "Red Sea",
    shape: [0.85, 1.34, 0.56],
    pattern: 12,
    scale: 0.73,
    y: 4.3,
    z: 0.3,
    x: 5.1,
    speed: 0.28,
  },
  {
    name: "Clown triggerfish",
    region: "Indo-Pacific",
    shape: [1, 1.02, 0.85],
    pattern: 13,
    scale: 0.76,
    y: 2.15,
    z: 2.5,
    x: -3.5,
    speed: 0.25,
  },
  {
    name: "Sunset anthias",
    region: "Indo-Pacific",
    shape: [1.06, 0.82, 0.75],
    pattern: 0,
    scale: 0.55,
    y: 6.8,
    z: -3.8,
    x: -2.7,
    speed: 0.32,
  },
  {
    name: "Azure damselfish",
    region: "Western Pacific",
    shape: [0.91, 1.04, 0.66],
    pattern: 14,
    scale: 0.57,
    y: 3.9,
    z: -1.9,
    x: 2.6,
    speed: 0.33,
  },
];
for (const species of SPECIES) {
  species.scale *= 0.68;
  species.speed *= 1.12;
}
// Smaller companions share skin atlases and anatomy, with independent routes.
for (let i = 0; i < 28; i++) {
  const blue = i % 5 === 0,
    gold = i % 7 === 0;
  SPECIES.push({
    name: blue
      ? "Blue reef juvenile"
      : gold
        ? "Golden reef juvenile"
        : "Anthias shoal",
    region: "Reef water column",
    shape: [1.12, 0.77, 0.8],
    pattern: blue ? 14 : gold ? 2 : 0,
    scale: 0.18 + (i % 5) * 0.029,
    y: 3.0 + ((i * 17) % 43) / 10,
    z: -5.7 + (i % 6) * 1.12,
    x: -6.7 + ((i * 7) % 27) * 0.5,
    speed: 0.42 + (i % 4) * 0.07,
    juvenile: true,
  });
}
// One coordinate-space mask is shared by the baked skin and living UV pigment.
// Jittered cells keep the dots distinct, irregular and attached to the scales.
const jewelGLSL = `
vec3 jewelSpots(vec3 p){
 vec2 q=p.xy*vec2(12.,18.);q.x+=mod(floor(q.y),2.)*.43;
 vec2 cell=floor(q), f=fract(q)-.5;
 vec2 rnd=fract(sin(vec2(dot(cell,vec2(127.1,311.7)),dot(cell,vec2(269.5,183.3))))*43758.5453);
 f-=(rnd-.5)*.28;float d=length(f*vec2(1.,.88));float r=.18+.085*rnd.x;
 float region=smoothstep(-.73,-.49,p.x)*(1.-smoothstep(.57,.78,p.x))*(1.-smoothstep(.24,.40,abs(p.y)));
 float core=(1.-smoothstep(r-.025,r+.025,d))*region;
 float rim=(1.-smoothstep(r+.035,r+.09,d))*region;
 return vec3(core,rim,rnd.y);
}
`;
const patternGLSL =
  jewelGLSL +
  `
vec3 fishColor(vec3 p,float species){
 float x=p.x,y=p.y,z=p.z;vec3 color=vec3(1.);
 float dorsal=smoothstep(-.25,.38,y);float tail=smoothstep(.52,.84,x);
 if(species<.5){color=mix(vec3(1.,.32,.06),vec3(1.,.10,.32),dorsal);float saddle=exp(-pow((x+.06)*3.4,2.))*smoothstep(-.15,.1,y);color=mix(color,vec3(.96,.16,.70),saddle*.88);color=mix(color,vec3(1.,.46,.07),tail*.4);}
 else if(species<1.5){
  vec3 spots=jewelSpots(p);
  color=mix(vec3(.025,.18,.34),vec3(.025,.49,.47),1.-smoothstep(-.15,.28,y));
  color=mix(color,vec3(.19,.09,.39),smoothstep(.03,.34,y)*.55);
  float cheek=exp(-pow((x+.54)*9.,2.))*(1.-smoothstep(-.02,.23,y));
  color=mix(color,vec3(.80,.40,.20),cheek*.7);
  color=mix(color,vec3(.035,.105,.17),spots.y*.72);
  color=mix(color,mix(vec3(.32,.93,.82),vec3(1.,.73,.32),smoothstep(.42,.85,spots.z)),spots.x);
  float fin=smoothstep(.22,.37,abs(y))*(1.-smoothstep(.68,.95,abs(x)));
  vec3 finColor=mix(vec3(.39,.16,.36),vec3(.97,.42,.25),smoothstep(.23,.46,abs(y)));
  float rays=.78+.22*pow(.5+.5*cos(atan(y,x-.25)*33.),5.);
  finColor*=rays;finColor=mix(finColor,vec3(.99,.76,.38),smoothstep(.43,.52,abs(y))*.72);
  color=mix(color,finColor,fin);
  vec3 tailColor=mix(vec3(.77,.27,.30),vec3(1.,.70,.30),smoothstep(.64,.99,x));
  tailColor*=.82+.18*cos(atan(y,x-.5)*35.);
  color=mix(color,tailColor,tail);
 }
 else if(species<2.5){color=mix(vec3(.98,.72,.015),vec3(1.,.95,.10),dorsal);}
 else if(species<3.5){color=mix(vec3(.025,.18,.95),vec3(.045,.36,1.),dorsal);float oval=length(vec2((x+.02)*1.9,(y-.13)*7.));float black=1.-smoothstep(.77,1.04,oval);float hole=1.-smoothstep(.25,.47,length(vec2((x+.15)*2.3,(y-.10)*8.)));color=mix(color,vec3(.012,.027,.07),black*(1.-hole));color=mix(color,vec3(1.,.84,.12),tail);}
 else if(species<4.5){float stripe=smoothstep(.56,.68,cos((x+y*.18)*17.));color=mix(vec3(.84,.88,.85),vec3(.92,.52,.12),stripe);float eyeBand=1.-smoothstep(.055,.09,abs(x+.67));color=mix(color,vec3(.08,.055,.035),eyeBand);}
 else if(species<5.5){color=mix(vec3(.59,.035,.94),vec3(1.,.88,.035),smoothstep(-.12,.1,x));color+=vec3(.14,.04,.2)*smoothstep(.0,.28,y)*(1.-smoothstep(-.2,.2,x));}
 else if(species<6.5){color=vec3(1.,.35,.025);float band=min(abs(x+.58+y*.1),min(abs(x+.03-y*.2),abs(x-.55)));float white=1.-smoothstep(.065,.09,band),edge=1.-smoothstep(.095,.125,band);color=mix(color,vec3(.04,.028,.025),edge);color=mix(color,vec3(.96,.96,.89),white);color=mix(color,vec3(.10,.045,.025),smoothstep(.38,.49,abs(y))*.7);}
 else if(species<7.5){float wave=sin(x*24.+sin(y*27.)*1.7)+sin(y*34.+x*8.);float lines=1.-smoothstep(.10,.42,abs(wave));color=mix(vec3(.11,.53,.38),vec3(1.,.37,.065),smoothstep(-.2,.65,wave));color=mix(color,vec3(.12,.28,.78),lines);}
 else if(species<8.5){float maze=sin(y*45.+sin(x*6.)*2.+sin(x*13.)*.55);color=mix(vec3(.21,.11,.32),vec3(.12,.73,.84),smoothstep(-.1,.25,maze));float band=.86+.14*cos(x*26.);color*=band;}
 else if(species<9.5){color=mix(vec3(.90,.92,.87),vec3(1.,.84,.19),smoothstep(-.1,.45,x));float net=smoothstep(.8,.98,abs(sin(x*38.+y*26.)));color=mix(color,vec3(.20,.27,.28),net*.35*(1.-tail));color=mix(color,vec3(.025,.04,.07),1.-smoothstep(.065,.11,abs(x+.64+y*.2)));}
 else if(species<10.5){
  color=mix(vec3(1.,.22,.035),vec3(1.,.48,.06),smoothstep(-.3,.25,y));
  float bars=(1.-smoothstep(.07,.15,abs(sin((x+y*.11)*11.))))*(1.-smoothstep(.45,.70,abs(x)));
  color=mix(color,vec3(.10,.055,.11),bars*.98);color=mix(color,vec3(.15,.18,.78),smoothstep(.28,.42,abs(y))*.65);
 }
 else if(species<11.5){
  color=vec3(.20,.48,1.);color=mix(color,vec3(.06,.075,.18),1.-smoothstep(-.67,-.49,x));
  color=mix(color,vec3(1.,.91,.06),smoothstep(.15,.28,y));
  color=mix(color,vec3(.97,.97,.89),smoothstep(.59,.79,x));
 }
 else if(species<12.5){color=mix(vec3(.19,.095,.68),vec3(.43,.16,.88),dorsal);color=mix(color,vec3(1.,.90,.055),tail);float dots=step(.965,sin(x*120.)*sin(y*130.));color*=1.-dots*.12;}
 else if(species<13.5){
  color=vec3(.055,.045,.055);vec2 grid=vec2(x*9.,y*14.);grid.x+=step(.5,fract(grid.y*.5))*.5;
  float dots=1.-smoothstep(.29,.37,length(fract(grid)-.5));
  color=mix(color,vec3(.97,.95,.86),dots*(1.-smoothstep(.04,.13,y)));
  color=mix(color,vec3(.96,.71,.18),smoothstep(.11,.27,y)*(1.-smoothstep(.55,.8,abs(x)))*.85);
  color=mix(color,vec3(1.,.78,.10),1.-smoothstep(-.95,-.84,x));
 }
 else{color=mix(vec3(.02,.24,.95),vec3(.03,.49,1.),dorsal);color=mix(color,vec3(1.,.89,.04),tail*.92);}
 color*=.92+.08*smoothstep(-.33,.25,y);
 // Palette values above are display sRGB; lighting operates in linear light.
 return mix(color/12.92,pow((color+.055)/1.055,vec3(2.4)),step(vec3(.04045),color));
}`;
function bakeSkin(renderer, source, geometry, species, size = 1536) {
  const target = new T.WebGLRenderTarget(size, size, {
    type: T.UnsignedByteType,
    depthBuffer: false,
  });
  const material = new T.ShaderMaterial({
    side: T.DoubleSide,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      sourceMap: { value: source.material.map },
      species: { value: species },
    },
    vertexShader:
      "varying vec2 vUV;varying vec3 vFish;void main(){vUV=uv;vFish=position;gl_Position=vec4(uv*2.-1.,0.,1.);}",
    fragmentShader: `varying vec2 vUV;varying vec3 vFish;uniform sampler2D sourceMap;uniform float species;${patternGLSL}
 void main(){vec3 original=texture2D(sourceMap,vUV).rgb;float lum=dot(original,vec3(.2126,.7152,.0722));float detail=clamp(pow(max(.001,lum),.48)*1.28,.18,1.10);vec3 col=fishColor(vFish,species)*detail;
 float eye=(1.-smoothstep(.018,.05,lum))*(1.-smoothstep(-.68,-.48,vFish.x));col=mix(col,original*.8,eye*.9);col=pow(max(col,vec3(0.)),vec3(1./2.2));gl_FragColor=vec4(col,1.);}`,
  });
  const scene = new T.Scene();
  scene.add(new T.Mesh(geometry, material));
  const camera = new T.Camera();
  const previous = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.clear();
  renderer.render(scene, camera);
  const bytes = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(target, 0, 0, size, size, bytes);
  renderer.setRenderTarget(previous);
  // Typed pixels become an ordinary portable texture, also preserved in GLB/Blender.
  const map = new T.DataTexture(bytes, size, size, T.RGBAFormat);
  map.colorSpace = T.SRGBColorSpace;
  map.flipY = false;
  map.magFilter = T.LinearFilter;
  map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.anisotropy = 16;
  map.needsUpdate = true;
  target.dispose();
  material.dispose();
  return map;
}
export async function upgradeFish(fishState, renderer, uniforms) {
  const bytes = Uint8Array.fromBase64
    ? Uint8Array.fromBase64(binary)
    : Uint8Array.from(atob(binary), (c) => c.charCodeAt(0));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer, "");
  gltf.scene.updateMatrixWorld(true);
  let source;
  gltf.scene.traverse((o) => {
    if (o.isMesh) source = o;
  });
  const base = source.geometry.clone().applyMatrix4(source.matrixWorld);
  base.rotateY(-Math.PI / 2);
  base.computeBoundingBox();
  const size = base.boundingBox.getSize(new T.Vector3()),
    center = base.boundingBox.getCenter(new T.Vector3());
  base.translate(-center.x, -center.y, -center.z);
  base.scale(2.25 / size.x, 2.25 / size.x, 2.25 / size.x);
  const skins = new Map();
  for (const f of fishState.fishes) {
    f.planetPattern = planetFishPattern(f.index);
    const spec = f.species,
      geometry = base.clone(),
      map =
        skins.get(spec.pattern) ||
        bakeSkin(
          renderer,
          source,
          base,
          spec.pattern,
          spec.pattern === 1 || spec.pattern === 8 ? 2048 : 1536,
        );
    skins.set(spec.pattern, map);
    const p = geometry.attributes.position;
    if (spec.pattern === 1) geometry.setAttribute("jewelCoord", p.clone());
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i),
        body = 1 - T.MathUtils.smoothstep(Math.abs(x), 0.45, 0.96);
      let xx = x * spec.shape[0],
        yy = y * (1 + (spec.shape[1] - 1) * body),
        zz = z * spec.shape[2];
      if (spec.pattern === 4 && x < -0.7) xx -= (-x - 0.7) * 0.48;
      if ((spec.pattern === 0 || spec.pattern === 3) && x > 0.7)
        xx -= (x - 0.7) * 0.48 * Math.exp(-y * y * 80);
      if (spec.pattern === 1) {
        // Lengthen the existing dorsal/anal membranes continuously at their roots.
        const fin =
          T.MathUtils.smoothstep(Math.abs(y), 0.26, 0.46) *
          (1 - T.MathUtils.smoothstep(Math.abs(x), 0.64, 0.95));
        yy += Math.sign(y) * fin * (0.065 + 0.02 * Math.sin(x * 7));
      }
      p.setXYZ(i, xx, yy, zz);
    }
    geometry.deleteAttribute("tangent");
    geometry.computeVertexNormals();
    const material = new T.MeshPhysicalMaterial({
      map,
      normalMap: source.material.normalMap,
      normalScale: new T.Vector2(0.85, 0.85),
      roughnessMap: source.material.roughnessMap,
      aoMap: source.material.aoMap,
      aoMapIntensity: 0.4,
      roughness: 0.64,
      metalness: 0,
      clearcoat: 0,
      ior: 1.33,
      specularIntensity: 0.62,
      envMapIntensity: 0.5,
    });
    const deform = (shader) => {
      Object.assign(shader.uniforms, {
        fTime: f.time,
        fShy: f.shy,
        fPhase: f.phase,
        fRate: f.swimRate,
        fStroke: f.stroke,
        fBend: f.bend,
        fPattern: { value: spec.pattern },
        fUVGain: { value: spec.juvenile ? 0.48 : 1 },
        fAlienStyle: { value: f.planetPattern.style },
        fAlienSeed: { value: f.planetPattern.seed },
      });
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vPigment;uniform float fPattern,fUVGain,fAlienStyle,fAlienSeed;\n" +
            jewelGLSL +
            planetFishGLSL,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          float uvMask=0.;
          if(fPattern>6.5 && fPattern<8.5) {
            float line=fPattern<7.5
              ? sin(vPigment.x*24.+sin(vPigment.y*27.)*1.7)+sin(vPigment.y*34.+vPigment.x*8.)
              : sin(vPigment.y*45.+sin(vPigment.x*6.)*2.+sin(vPigment.x*13.)*.55);
            uvMask=1.-smoothstep(.085,.26,abs(line));
          } else if(fPattern>.5 && fPattern<1.5) {
            vec3 spots=jewelSpots(vPigment);
            // Uneven, slow scintillation; the pigment never flashes as a whole fish.
            uvMask=spots.x*(.72+.28*sin(uTime*.85+spots.z*6.28));
          } else if(fPattern>11.5 && fPattern<12.5) {
            float speckle=sin(vPigment.x*80.)*sin(vPigment.y*95.);
            uvMask=smoothstep(.76,.94,speckle)*.55;
          } else if(fPattern>4.5 && fPattern<5.5) {
            uvMask=smoothstep(.18,.3,vPigment.y)*(.5+.5*sin(vPigment.x*19.))* .55;
          } else if(fPattern>13.5) {
            uvMask=(1.-smoothstep(.009,.03,abs(vPigment.y-.025-sin(vPigment.x*4.)*.022)))*(1.-smoothstep(.65,.9,abs(vPigment.x)));
          }
          float viewIridescence=pow(1.-abs(dot(normal,normalize(vViewPosition))),2.);
          float shift=.5+.5*sin(uTime*.52+vPigment.x*1.6+fPattern+viewIridescence*2.);
          diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.72,1.12,1.18),uNight*(1.-uPlanetX)*uvMask*.35);
          vec3 uvPigment=mix(vec3(.045,1.1,1.5),vec3(.85,.12,1.35),shift);
          totalEmissiveRadiance+=uvPigment*uvMask*uNight*(1.-uPlanetX)*1.25*fUVGain;
          if(uPlanetX>.5) {
            float family=fAlienStyle<1.5 ? mod(fPattern*.73+.4,3.) : fAlienSeed*3.;
            vec3 primary=alienPalette(family),secondary=alienPalette(mod(family+.65,3.));
            totalEmissiveRadiance+=planetFishGlow(vPigment,fAlienStyle,fAlienSeed,fPattern,uTime,viewIridescence,primary,secondary)*fUVGain;
          }
        `,
        )
        .replace(
          "#include <roughnessmap_fragment>",
          "#include <roughnessmap_fragment>\nroughnessFactor=max(.36,roughnessFactor-uNight*.08);",
        );
      const swim = `
        uniform float fTime,fShy,fPhase,fRate,fStroke,fBend;
        varying vec3 vPigment;
        ${spec.pattern === 1 ? "attribute vec3 jewelCoord;" : ""}
        vec3 swimDeform(vec3 p){
          float x=p.x/${spec.shape[0].toFixed(4)};
          float tail=smoothstep(-.62,1.06,x);
          float wave=sin(x*4.9-fStroke+fPhase);
          float amplitude=(.135+.055*fRate+fShy*.048);
          p.z+=wave*(.025+tail*tail)*amplitude+fBend*tail*tail;
          float fin=smoothstep(.19,.43,abs(p.y))*(1.-smoothstep(.6,1.1,abs(x)));
          p.z+=sin(fStroke*1.25-x*7.+fPhase)*fin*.042;
          float gill=exp(-pow((x+.45)*13.,2.));
          p.z*=1.+gill*sin(fTime*3.7+fPhase)*.018;
          return p;
        }`;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\n" + swim)
        .replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
          float slopeX=(swimDeform(position+vec3(.002,0.,0.)).z-swimDeform(position-vec3(.002,0.,0.)).z)/.004;
          float slopeY=(swimDeform(position+vec3(0.,.002,0.)).z-swimDeform(position-vec3(0.,.002,0.)).z)/.004;
          objectNormal=normalize(vec3(objectNormal.x-slopeX*objectNormal.z,objectNormal.y-slopeY*objectNormal.z,objectNormal.z));`,
        )
        .replace(
          "#include <begin_vertex>",
          `vPigment=${spec.pattern === 1 ? "jewelCoord" : "position"};vec3 transformed=swimDeform(position);`,
        );
    };
    material.onBeforeCompile = deform;
    material.customProgramCacheKey = () =>
      "reef-fish-articulated-uv-v12-" +
      spec.shape[0] +
      (spec.pattern === 1 ? "-jewel" : "");
    applyWaterLight(material, uniforms);
    const mesh = new T.Mesh(geometry, material);
    mesh.name = spec.name + " — " + spec.region;
    mesh.userData = { fishIndex: f.index, species: spec.name };
    mesh.castShadow = mesh.receiveShadow = true;
    const depth = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
    depth.onBeforeCompile = deform;
    mesh.customDepthMaterial = depth;
    f.group.add(mesh);
    f.body = mesh;
    // Thin, ribbed pectoral membranes pivot at the gills instead of translating
    // with the torso. Their small, asynchronous strokes remain visible side-on.
    f.fins = [];
    const finColor = [
      "#f8a557",
      "#ffffff",
      "#eed75b",
      "#4388cc",
      "#d1c196",
      "#ab74ca",
      "#e99350",
      "#57aaa1",
      "#7badb3",
      "#d1c196",
      "#e48248",
      "#67a5df",
      "#8470b9",
      "#b9ae85",
      "#68a7db",
    ][spec.pattern];
    const finMat = new T.MeshPhysicalMaterial({
      color: finColor,
      roughness: 0.65,
      side: T.DoubleSide,
      transparent: true,
      opacity: spec.pattern === 1 ? 0.42 : 0.48,
      depthWrite: false,
      forceSinglePass: true,
      metalness: 0,
      vertexColors: true,
    });
    if (spec.pattern === 1) {
      finMat.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec2 vFinUV;",
          )
          .replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvFinUV=uv;",
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec2 vFinUV;",
          )
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
            float ray=pow(.5+.5*cos(vFinUV.x*87.96),12.);
            diffuseColor.rgb*=.75+.25*ray;
            diffuseColor.a*=.58+.32*ray+.1*vFinUV.y;`,
          )
          .replace(
            "#include <emissivemap_fragment>",
            `#include <emissivemap_fragment>
            totalEmissiveRadiance+=mix(vec3(.08,.35,.48),vec3(1.3,.32,.06),uPlanetX)*smoothstep(.87,1.,vFinUV.y)*uNight*mix(.12,.7,uPlanetX);`,
          );
      };
      finMat.customProgramCacheKey = () => "jewel-pectoral-membrane-v10";
    }
    applyWaterLight(finMat, uniforms);
    for (const side of [-1, 1]) {
      const positions = [],
        uv = [],
        colors = [],
        indices = [];
      for (let r = 0; r <= 6; r++)
        for (let k = 0; k <= 14; k++) {
          const v = r / 6,
            a = k / 14,
            angle = 0.15 + a * 1.7;
          positions.push(
            Math.sin(angle) * v * 0.34,
            -v * (0.07 + Math.cos(angle) * 0.18),
            side * v * (0.17 + Math.sin(angle) * 0.1),
          );
          uv.push(a, v);
          const stripe = k % 2 ? 0.64 : 1;
          if (spec.pattern === 1) {
            const tint = new T.Color("#147c88").lerp(
              new T.Color("#bd693f"),
              Math.pow(v, 0.8),
            );
            tint
              .multiplyScalar(0.84 + 0.16 * stripe)
              .toArray(colors, colors.length);
          } else colors.push(stripe, stripe, stripe);
          if (r < 6 && k < 14) {
            const n = r * 15 + k;
            indices.push(n, n + 1, n + 15, n + 1, n + 16, n + 15);
          }
        }
      const g = new T.BufferGeometry();
      g.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
      g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
      g.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
      g.setIndex(indices);
      g.computeVertexNormals();
      if (spec.pattern === 1) g.scale(1.16, 1.15, 1.12);
      const pivot = new T.Group();
      pivot.position.set(
        -0.43 * spec.shape[0],
        -0.055,
        side * 0.18 * spec.shape[2],
      );
      const fin = new T.Mesh(g, finMat);
      fin.name = "Articulated pectoral fin";
      fin.userData.fishIndex = f.index;
      pivot.add(fin);
      f.group.add(pivot);
      f.fins.push({ pivot, side });
    }
    fishState.pickables.push(mesh);
  }
  base.dispose();
}
export function createFishState(scene) {
  const fishes = SPECIES.map((species, index) => {
    const group = new T.Group();
    group.name = species.name;
    group.scale.setScalar(species.scale);
    group.userData.fishIndex = index;
    scene.add(group);
    const radius = 0.85 + (index % 3) * 0.18,
      route = makeRoute(0, species.y, species.z, 7.1, radius),
      right = index % 2 === 0;
    const routeDistance = right
      ? species.x + route.halfLength
      : route.length + route.arc + (route.halfLength - species.x);
    const headingDirection = new T.Vector3();
    sampleRoute(route, routeDistance, group.position, headingDirection);
    headingDirection.y = Math.sin(index * 2.1) * 0.065;
    headingDirection.z = Math.sin(index * 1.73 + 0.3) * 0.36;
    headingDirection.normalize();
    group.rotation.y = Math.atan2(headingDirection.z, -headingDirection.x);
    const depthBand = species.juvenile
      ? index % 5 === 0
        ? "distant"
        : index % 2 === 0
          ? "foreground"
          : "middle"
      : [4, 9].includes(index)
        ? "distant"
        : [0, 1, 2, 3, 6, 8, 10, 12, 13, 15].includes(index)
          ? "foreground"
          : "middle";
    group.position.z =
      depthBand === "foreground"
        ? 6.3 + (index % 5) * 0.14
        : depthBand === "distant"
          ? -4.8 + (index % 4) * 0.45
          : 2.6 + (index % 6) * 0.38;
    if (depthBand === "foreground") {
      group.position.x *= 0.72;
      group.position.y = 3.25 + (index % 6) * 0.43;
    }
    const cruise = makeCruiseRoute(
      group.position,
      headingDirection,
      index + 1,
      depthBand,
    );
    return {
      group,
      species,
      index,
      depthBand,
      route: cruise,
      routeDistance: 0,
      headingDirection,
      time: { value: 0 },
      shy: { value: 0 },
      phase: { value: index * 1.9 },
      swimRate: { value: 1 },
      stroke: { value: index * 2.7 },
      bend: { value: 0 },
      reaction: 0,
      speed: species.speed,
      resume: 1,
      dragging: false,
    };
  });
  return { fishes, pickables: [] };
}
