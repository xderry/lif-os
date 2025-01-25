let lif = window.lif = {};
import util from './lif_util.js';
let {ewait, esleep, eslow, postmessage_chan, path_file} = util;

let modules = {};
let lb;
let sw_chan;

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
    let promise = ewait();
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
          v = (deps, cb)=>lb.require_amd(mod_self, deps, cb);
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
  module_get: async(module_id)=>{
    let m = modules[module_id];
    if (!m)
      throw Error('module '+module_id+' not loaded');
    await m.promise;
    return m.module;
  },
  require_cjs: (mod_self, module_id)=>{
    let m = modules[module_id];
    if (!m)
      throw Error('module '+module_id+' not loaded beforehand');
    if (!m.loaded)
      throw Error('module '+module_id+' not loaded completion');
    return m.module.exports;
  },
  require_single: async(mod_self, module_id)=>{
    let m = modules[module_id];
    if (m){
      await m.promise;
      return m.module.exports;
    }
    let resolve, promise = new Promise(res=>resolve = res);
    m = modules[module_id] = {module_id, deps: [], promise,
      loaded: false, module: {exports: {}}};
    let slow;
    try {
      let uri = lb.module_get_uri(mod_self, module_id);
      let ufile = path_file(uri);
      if (!ufile.includes('.'))
        uri += '.js';
      //console.log('require_single', mod_self, module_id, uri);
      slow = eslow(5000, ['import('+module_id+') timeout', uri]);
      m.mod = await import(uri);
      slow.end();
    } catch(err){
      slow.end();
      console.error('import('+module_id+') failed fetch from '+mod_self, err);
      throw err;
    }
    m.loaded = true;
    m.module.exports = m.mod.default || m.mod;
    resolve(m.module.exports);
    return m.module.exports;
  },
  require_cjs_shim: (mod_self, module_id)=>{
    let m = modules[module_id];
    if (!m)
      throw Error('module '+module_id+' not loaded beforehand');
    if (!m.loaded)
      throw Error('module '+module_id+' not loaded completion');
    return m.module;
  },
  module_get_uri: (mod_self, module_id)=>{
    let dir = module_id.split('/')[0];
    let base = '/.lif/npm/'+mod_self;
    let module = '/.lif/npm/'+module_id;
    if (dir=='.' || dir=='..' || dir==''){
      let uri = URL.parse(module_id, 'http://xxx'+base);
      return !uri ? module : uri.pathname;
    }
    return module;
  },
};
lb = lif.boot;
lb.define_amd.amd = {};
window.define = lb.define_amd;
window.require = lb.require_amd;

let import_do = async({url, opt})=>{
  try {
    let ret = {};
    // console.log('import_do('+url+')');
    let exports = await import(url, opt);
    ret.exports = [];
    if (typeof exports=='object' && !Array.isArray(exports.default)){
      for (let i in exports.default)
        ret.exports.push(i);
    }
    return ret;
  } catch(err){
    console.error('import_do('+url+') failed', err);
    throw err;
  }
};
let lif_boot_start = async()=>{
  try {
    const registration = await navigator.serviceWorker.register('/lif_sw.js');
    await navigator.serviceWorker.ready;
    const launch = async()=>{
      sw_chan = new postmessage_chan();
      sw_chan.connect(navigator.serviceWorker.controller);
      sw_chan.add_server_cmd('import', async({arg})=>await import_do(arg));
      let url = window.launch_url || './pages/index.tsx';
      try {
        await import(url);
      } catch (err){
        console.error('import('+url+') failed', err);
        throw err;
      }
    };
    // this launches the React app if the SW has been installed before or
    // immediately after registration
    // https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#clientsclaim
    if (navigator.serviceWorker.controller)
      await launch();
    else
      navigator.serviceWorker.addEventListener('controllerchange', launch);
  } catch (err){
    console.error('Service worker registration failed', err.stack);
  }
};
lif_boot_start();
