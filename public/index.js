(async()=>{
  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const launch = async()=>{
      await import("./pages/index.tsx");
    };
    // this launches the React app if the SW has been installed before or
    // immediately after registration
    // https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#clientsclaim
    if (navigator.serviceWorker.controller)
      await launch();
    else
      navigator.serviceWorker.addEventListener('controllerchange', launch);
  } catch (error){
      console.error('Service worker registration failed', error.stack);
  }
})();
