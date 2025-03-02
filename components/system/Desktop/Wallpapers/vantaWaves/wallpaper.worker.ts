import 'kernel-lif/boot_worker.js';
console.log("HERE");
import { type OffscreenRenderProps } from "components/system/Desktop/Wallpapers/types";
import {
  config,
  disableControls,
  libs,
} from "components/system/Desktop/Wallpapers/vantaWaves/config";
import {
  type VantaObject,
  type VantaWaves,
  type VantaWavesConfig,
} from "components/system/Desktop/Wallpapers/vantaWaves/types";

declare global {
  // eslint-disable-next-line vars-on-top, no-var
  var VANTA: VantaObject;
}

import "/System/Vanta.js/three.min.js"; // static import, dyn not available
import "/System/Vanta.js/vanta.waves.min.js";
let waveEffect: VantaWaves;
globalThis.addEventListener(
  "message",
  async({ data }: { data: DOMRect | OffscreenRenderProps | string }) => {
    if (typeof WebGLRenderingContext === "undefined") return;

    if (data === "init") {
      // libs: /System/Vanta.js/three.min.js /System/Vanta.js/vanta.waves.min.js
      for (let i of libs)
        ; // await import(i); no dynamic import() in web worker
    } else if (data instanceof DOMRect) {
      const { width, height } = data;

      waveEffect?.renderer.setSize(width, height);
      waveEffect?.resize();
    } else {
      const {
        canvas,
        config: offscreenConfig,
        devicePixelRatio,
      } = data as OffscreenRenderProps;
      const { VANTA: { current: currentEffect = waveEffect, WAVES } = {} } =
        globalThis;

      if (!canvas || !WAVES) return;
      if (currentEffect) currentEffect.destroy();

      try {
        waveEffect = WAVES({
          ...((offscreenConfig || config) as VantaWavesConfig),
          ...disableControls,
          canvas,
          devicePixelRatio,
        });
      } catch (error) {
        globalThis.postMessage({
          message: (error as Error)?.message,
          type: "[error]",
        });
      }
    }
  },
  { passive: true }
);
