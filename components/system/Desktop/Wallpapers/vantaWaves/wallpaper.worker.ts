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

let waveEffect: VantaWaves;
globalThis.addEventListener(
  "message",
  async({ data }: { data: DOMRect | OffscreenRenderProps | string }) => {
    if (typeof WebGLRenderingContext === "undefined") return;

    if (data === "init") {
      console.log('libs', ...libs); // XXX
      for (let i of libs){
        console.log('load', i); // XXX
        await import(i);
        console.log('loaded', i); // XXX
      }
      console.log('global', globalThis); // XXX
      //globalThis.importScripts(...libs);
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
