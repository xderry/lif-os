let lif = {};
window.lif = lif;
let modules = {};
let lb;
// Promise with return() and throw()
let promise_ex = ()=>{
  let _resolve, _reject;
  let promise = new Promise((resolve, reject)=>{
    _resolve = resolve; _reject = reject;});
  promise.return = _resolve;
  promise.throw = _reject;
  return promise;
};

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
      throw Error('define('+module_id+') already defined');
    let promise = promise_ex();
    let m = modules[module_id] = {module_id, deps, factory, loaded: false,
      promise, module: {exports: {}}};
    lb.require_amd(module_id, deps, function(...deps){
      let exports = m.factory.apply(m.module.exports, deps);
      if (exports)
        m.module.exports = exports;
      m.loaded = true;
      promise.return(m.module.exports);
    });
    return promise;
  },
  require_amd: function(mod_self, deps, cb){
    if (!cb)
      return lb.require_cache(deps);
    let _deps = [];
    let m = modules[mod_self] || {module: {exports: {}}};
    return (async()=>{
      for (let i=0; i<deps.length; i++){
        let dep = deps[i], v;
        switch (dep){
        case 'require':
          v = function(deps, cb){
            return lb.require_amd(mod_self, deps, cb); };
          break;
        case 'exports': v = m.module.exports; break;
        case 'module': v = m.module; break;
        default: v = await lb.require_single(mod_self, dep);
        }
        _deps[i] = v;
      }
      cb(..._deps);
    })();
  },
  module_get: async function(module_id){
    let m = modules[module_id];
    if (!m)
      throw Error('module '+module_id+' not loaded');
    await m.promise;
    return m.module;
  },
  require_single: async function(mod_self, module_id){
    let m = modules[module_id];
    if (m){
      await m.promise;
      return m.module.exports;
    }
    let resolve, promise = new Promise(res=>resolve = res);
    m = modules[module_id] = {module_id, deps: [], promise,
      loaded: false, module: {exports: {}}};
    try {
      m.mod = await import(module_id);
    } catch(error){
      console.log('import('+module_id+') failed fetch from '+mod_self,
        error);
      throw error;
    }
    m.loaded = true;
    m.module.exports = m.mod.default || m.mod;
    resolve(m.modules.exports);
    return m.module.exports;
  },
};
lb = lif.boot;
lb.define_amd.amd = {};
window.define = lb.define_amd;
window.require = lb.require_amd;

let importmap = {imports: {}};
let importmap_calc = ()=>{
  let m = importmap.imports, list = [];
  m['next/dynamic'] = './lif_next_dynamic.js';
  // core react
  list,push(...qw`react react-dom`);
  list,push(...qw`frameer-motion motion-dom styled-components stylis
    stylis-rule-sheet @emotion react-is memoize-one prop-types
    merge-anything`);
  // core node modules
  list.push(...qw`path assert buffer child_process cluster console
    constants crypto dgram dns domain events fs http https http2 inspector
    module net os path perf_hooks punycode querystring readline repl stream
    _stream_duplex _stream_passthrough _stream_readable _stream_transform
    _stream_writable string_decoder sys timers tls tty url util vm zlib
    _process`);
  list.forEach(e=>m[e] = '/.lif/esm/'+e);
  return importmap;
};
let importmap_load = ()=>{
  let importmap = importmap_calc();
  let im = document.createElement('script');
  im.type = 'importmap';
  im.textContent = JSON.stringify(importmap);
  document.currentScript.after(im);
};

(async()=>{
  try {
    importmap_install();
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
