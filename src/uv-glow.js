import * as T from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
// A small, quarter-size optical bloom on HDR fluorescent markings. Disabled in
// daylight; its threshold leaves ordinary blue water and lit rocks unaffected.
export function createUVGlowPass(shared) {
  const target = new T.WebGLRenderTarget(1, 1, {
    type: T.HalfFloatType,
    depthBuffer: false,
  });
  const scratch = target.clone();
  const vertexShader =
    "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}";
  const bright = new T.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    vertexShader,
    uniforms: {
      source: { value: null },
      pixel: { value: new T.Vector2() },
      uPlanetX: shared.planetX,
    },
    fragmentShader: `varying vec2 vUv;uniform sampler2D source;uniform vec2 pixel;uniform float uPlanetX;
      vec3 glow(vec2 uv){vec3 c=texture2D(source,uv).rgb;float peak=max(c.r,max(c.g,c.b));return min(c,vec3(3.))*smoothstep(mix(1.15,.78,uPlanetX),mix(2.5,1.8,uPlanetX),peak);}
      void main(){vec3 c=vec3(0.);for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++)c+=glow(vUv+vec2(float(x),float(y))*pixel*1.6);gl_FragColor=vec4(c/9.,1.);}`,
  });
  const blend = new T.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    vertexShader,
    uniforms: {
      source: { value: null },
      bloom: { value: target.texture },
      uPlanetX: shared.planetX,
    },
    fragmentShader: `varying vec2 vUv;uniform sampler2D source,bloom;uniform float uPlanetX;
      void main(){gl_FragColor=vec4(texture2D(source,vUv).rgb+texture2D(bloom,vUv).rgb*mix(.18,.27,uPlanetX),1.);}`,
  });
  // The Gaussian is separable. Blur at quarter resolution instead of taking
  // 25 bloom samples for every full-resolution pixel (especially costly at 4K).
  const blur = new T.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    vertexShader,
    uniforms: {
      source: { value: null },
      direction: { value: new T.Vector2() },
    },
    fragmentShader: `varying vec2 vUv;uniform sampler2D source;uniform vec2 direction;
      void main(){vec3 halo=vec3(0.);float total=0.;for(int i=-2;i<=2;i++){float d=float(i);float w=exp(-d*d*.6);halo+=texture2D(source,vUv+direction*d*1.5).rgb*w;total+=w;}gl_FragColor=vec4(halo/total,1.);}`,
  });
  const a = new FullScreenQuad(bright),
    b = new FullScreenQuad(blend),
    c = new FullScreenQuad(blur);
  return new (class extends Pass {
    setSize(w, h) {
      target.setSize(Math.ceil(w / 4), Math.ceil(h / 4));
      scratch.setSize(target.width, target.height);
      bright.uniforms.pixel.value.set(1 / w, 1 / h);
    }
    render(renderer, write, read) {
      bright.uniforms.source.value = read.texture;
      renderer.setRenderTarget(target);
      a.render(renderer);
      blur.uniforms.source.value = target.texture;
      blur.uniforms.direction.value.set(1 / target.width, 0);
      renderer.setRenderTarget(scratch);
      c.render(renderer);
      blur.uniforms.source.value = scratch.texture;
      blur.uniforms.direction.value.set(0, 1 / target.height);
      renderer.setRenderTarget(target);
      c.render(renderer);
      blend.uniforms.source.value = read.texture;
      renderer.setRenderTarget(this.renderToScreen ? null : write);
      b.render(renderer);
    }
    dispose() {
      target.dispose();
      scratch.dispose();
      bright.dispose();
      blend.dispose();
      blur.dispose();
      a.dispose();
      b.dispose();
      c.dispose();
    }
  })();
}
