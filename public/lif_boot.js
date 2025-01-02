let lif = {};
window.lif = lif;
let modules = {};
let lb;
lif.boot = {
  define_amd: function(module_id, args){
    var _module_id /* ignored */, deps, factory;
    var deps_default = ["require", "exports", "module"];
    var exports_val; /* not supported */
    if (args.length==1){
      factory = args[0];
      deps = deps_default;
    } else if (args.length==2){
      if (typeof args[0]=='string'){
        _module_id = args[0];
        deps = deps_default;
      } else
        deps = args[0];
      factory = args[1];
    } else
      [_module_id, deps, factory] = args;
    if (typeof factory!='function'){
      throw Error('define() non-function factory not supported');
      exports_val = factory;
      factory = undefined;
    }
    if (modules[module_id])
      throw Error('defile('+module_id+') already defined');
    console.log('define('+module_id+') loading');
    let m = modules[module_id] = {module_id, deps, factory, loaded: false,
      module: {exports: {}}};
    let resolve, promise = new Promise(res=>resolve = res);
    lb.require_amd(module_id, deps, function(...deps){
      console.log('define('+module_id+') pre-factory');
      let exports = m.factory.apply(m.module.exports, deps);
      if (exports)
        m.module.exports = exports;
      console.log('define('+module_id+') post factory', m.module.exports);
      m.module.loaded = true;
      resolve(m.module.exports);
    });
    return promise;
  },
  require_amd: function(module_ctx, deps, cb){
    if (!cb)
      return lb.require_cache(deps);
    let _deps = [];
    let m = modules[module_ctx] || {module: {exports: {}}};
    return (async()=>{
      for (let i=0; i<deps.length; i++){
        let dep = deps[i], v;
        switch (dep){
        case 'require':
          v = function(deps, cb){
            return lb.require_amd(module_ctx, deps, cb); };
          break;
        case 'exports': v = m.module.exports; break;
        case 'module': v = m.module; break;
        default: v = await lb.require_single(dep);
        }
        _deps[i] = v;
      }
      cb(..._deps);
    })();
  },
  require_cache: function(module_id){
    let m = modules[module_id];
    console.log('require_cache('+module_id+')', m);
    if (!m?.loaded)
      throw Error('module '+module_id+' not loaded');
    return m.module.exports;
  },
  require_cache_wait: function(module_id){
    let m = modules[module_id];
    console.log('require_cache('+module_id+')', m);
    if (!m?.loaded)
      throw Error('module '+module_id+' not loaded');
    await m.promise;
    return m.module.exports;
  },
  require_single: async function(module_id){
    let m = modules[module_id];
    if (m?.loaded)
      return m.module.exports;
    if (m){
      await m.promise;
      return m.module.exports;
    }
    m = modules[module_id] = {module_id, deps: [],
      loaded: false, module: {exports: {}}};
    m.mod = await import(module_id);
    m.loaded = true;
    m.module.exports = m.mod.default || m.mod;
    return m.module.exports;
  },
};
lb = lif.boot;
lb.define_amd.amd = {};
window.define = lb.define_amd;
window.require = lb.require_amd;

(async()=>{
  try {
    const registration = await navigator.serviceWorker.register('/lif_sw.js');
    await navigator.serviceWorker.ready;
    const launch = async()=>{
      let url = window.launch_url || './pages/index.tsx';
      try {
        await import(url);
      } catch (error){
        console.log('import('+url+') failed', error);
        throw error;
      }
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
