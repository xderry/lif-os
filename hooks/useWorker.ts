import { useEffect, useRef } from "react";

const useWorker = <T>(
  workerInit?: (info?: string) => Worker,
  onMessage?: (message: MessageEvent<T>) => void,
  workerInfo?: string
): React.MutableRefObject<Worker | undefined> => {
  const worker = useRef<Worker>();

  useEffect(() => {
    if (workerInit && !worker.current) {
      worker.current = workerInit(workerInfo);

      if (onMessage) {
        worker.current.addEventListener("message", onMessage, {
          passive: true,
        });
      }
      // XXX bug in Chrome: {type: 'module'} workers miss during loading
      // the messages. Need to first wait for a message from the worker that
      // its ready, and only then to init.
      // gets missed between here and
      // components/system/Desktop/Wallpapers/ShaderToy/CoastalLandscape/wallpaper.worker.ts
      worker.current.postMessage("init");
    }

    return () => {
      worker.current?.terminate();
      worker.current = undefined;
    };
  }, [onMessage, workerInfo, workerInit]);

  return worker;
};

export default useWorker;
