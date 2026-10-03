import * as T from "three";
import { Pass, FullScreenQuad } from "three/addons/postprocessing/Pass.js";
import { CopyShader } from "three/addons/shaders/CopyShader.js";
// Dedicated depth attachment remains available to optics after composer swaps.
export class ScenePass extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = false;
    this.target = new T.WebGLRenderTarget(1, 1, {
      type: T.HalfFloatType,
      depthBuffer: true,
      samples: 4,
    });
    this.target.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType);
    this.material = new T.ShaderMaterial({
      uniforms: T.UniformsUtils.clone(CopyShader.uniforms),
      vertexShader: CopyShader.vertexShader,
      fragmentShader: CopyShader.fragmentShader,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }
  setSize(w, h) {
    this.target.setSize(w, h);
  }
  render(renderer, write, read) {
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    this.material.uniforms.tDiffuse.value = this.target.texture;
    renderer.setRenderTarget(read);
    this.quad.render(renderer);
  }
}
