import lif from 'lif-kernel/boot_worker.js';
console.log("HERE wallpaper");
import { libs } from "components/system/Desktop/Wallpapers/ShaderToy/CoastalLandscape";
import { type OffscreenRenderProps } from "components/system/Desktop/Wallpapers/types";

/* eslint-disable vars-on-top, no-var  */
declare global {
  var effectInit: (canvas: OffscreenCanvas) => void;
  var updateLandscapeSize: () => void;
  var demoCanvasRect: DOMRect;
  var devicePixelRatio: number;
}
/* eslint-enable vars-on-top, no-var */
let boot_chan;
function lif_start(){
  boot_chan = new util.postmessage_chan();
  boot_chan.add_server_cmd('version', arg=>({version: lif_boot.version}));
  globalThis.addEventListener("message", event=>{
    if (boot_chan.listen(event))
      return;
  });
}
lif.worker_start();

globalThis.addEventListener(
  "message",
  ({ data }: { data: DOMRect | OffscreenRenderProps | string }) => {
    if (typeof WebGLRenderingContext === "undefined") return;

    if (data === "init") {
      console.log(...libs);
      globalThis.importScripts(...libs);
    } else if (data instanceof DOMRect) {
      globalThis.demoCanvasRect = data;
      globalThis.updateLandscapeSize();
    } else {
      const { canvas, devicePixelRatio } = data as OffscreenRenderProps;

      globalThis.devicePixelRatio = devicePixelRatio;

      try {
        globalThis.effectInit(canvas);
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
