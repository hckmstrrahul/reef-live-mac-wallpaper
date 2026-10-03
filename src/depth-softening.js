import * as T from "three";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

// Soften only distant scenery. Reject samples across depth discontinuities so
// colorful fish never bleed into the surrounding water as a luminous halo.
export function createDepthSoftening(camera, depthTexture) {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      tDepth: { value: null },
      resolution: { value: new T.Vector2(1, 1) },
      focus: { value: 16 },
      nearClip: { value: camera.near },
      farClip: { value: camera.far },
    },
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `
      #include <packing>
      varying vec2 vUv;
      uniform sampler2D tDiffuse,tDepth;
      uniform vec2 resolution;
      uniform float focus,nearClip,farClip;
      float distanceAt(vec2 uv){return -perspectiveDepthToViewZ(texture2D(tDepth,uv).r,nearClip,farClip);}
      void main(){
        float depth=distanceAt(vUv);float blur=smoothstep(focus+3.,focus+12.,depth)*1.35;
        vec3 color=texture2D(tDiffuse,vUv).rgb;
        if(blur<.03){gl_FragColor=vec4(color,1.);return;}
        vec3 sum=color*4.;float weight=4.;
        for(int i=0;i<4;i++){
          vec2 offset=i==0?vec2(-1.,0.):i==1?vec2(1.,0.):i==2?vec2(0.,-1.):vec2(0.,1.);
          vec2 uv=clamp(vUv+offset*blur/resolution,.001,.999);
          float sampleDepth=distanceAt(uv);
          float accepted=(1.-smoothstep(.25,1.,abs(sampleDepth-depth)))*step(focus+3.,sampleDepth);
          sum+=texture2D(tDiffuse,uv).rgb*accepted;weight+=accepted;
        }
        gl_FragColor=vec4(sum/weight,1.);
      }`,
  });
  pass.uniforms.tDepth.value = depthTexture;
  pass.setSize = (w, h) => pass.uniforms.resolution.value.set(w, h);
  return pass;
}
