import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// BLOOM_LAYER kept as a named export so objects that call .layers.enable(BLOOM_LAYER)
// don't break — the layer just has no visual effect now that bloom is removed.
export const BLOOM_LAYER = 1;

export class PostFX {
  constructor(renderer, scene, camera, { pixelSize = 5 } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    const w = window.innerWidth;
    const h = window.innerHeight;

    this.composer = new EffectComposer(renderer);
    this.pixelPass = new RenderPixelatedPass(pixelSize, scene, camera);
    this.pixelPass.normalEdgeStrength = 0.5;
    this.pixelPass.depthEdgeStrength = 0.45;
    this.composer.addPass(this.pixelPass);
    this.composer.addPass(new OutputPass());

    this.setSize(w, h);
  }

  setPixelSize(px) { this.pixelPass.setPixelSize(px); }

  // No-op kept so call sites in main.js / menus don't throw.
  setBloom() {}

  setSize(w, h) {
    this.composer.setSize(w, h);
    this.pixelPass.setSize(w, h);
  }

  render() {
    this.composer.render();
  }
}
