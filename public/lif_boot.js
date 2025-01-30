let lif = window.lif = {};
import util from './lif_util.js';
let {ewait, esleep, eslow, postmessage_chan, path_file,
  url_uri_parse, npm_uri_parse} = util;

let modules = {};
let lb;
let sw_chan;

let process =  {env: {}};
function define(){ return define_amd(arguments[0], arguments); }
define.amd = {};
function require(){ return require_cjs_amd(null, arguments); }

function define_amd(mod_self, args, module){
  let module_id /* ignored */, deps, factory;
  let deps_default = ['require', 'exports', 'module'];
  let exports_val; /* not supported */
  if (args.length==1){
    factory = args[0];
    deps = deps_default;
  } else if (args.length==2){
    if (typeof args[0]=='string'){
      module_id = args[0];
      deps = deps_default;
    } else
      deps = args[0];
    factory = args[1];
  } else if (args.length==3)
    [module_id, deps, factory] = args;
  else
    throw Error('define() invalid num args');
  if (typeof factory!='function'){
    throw Error('define() non-function factory not supported');
    exports_val = factory;
    factory = undefined;
  }
  if (modules[mod_self])
    throw Error('define('+mod_self+') already defined');
  let promise = ewait();
  let m = modules[mod_self] = {mod_self, deps, factory, loaded: false,
    promise, module: module||{exports: {}}};
  require_amd(mod_self, [deps, function(...deps){
    let exports = m.factory.apply(m.module.exports, deps);
    if (exports)
      m.module.exports = exports;
    m.loaded = true;
    promise.return(m.module.exports);
  }]);
  return promise;
}

function require_amd(mod_self, [deps, cb]){
  let _deps = [];
  let m = modules[mod_self] || {module: {exports: {}}};
  return (async()=>{
    for (let i=0; i<deps.length; i++){
      let dep = deps[i], v;
      switch (dep){
      case 'require':
        v = (deps, cb)=>require_amd(mod_self, [deps, cb]);
        break;
      case 'exports': v = m.module.exports; break;
      case 'module': v = m.module; break;
      default: v = await require_single(mod_self, dep);
      }
      _deps[i] = v;
    }
    cb(..._deps);
  })();
}

async function module_get(module_id){
  let m = modules[module_id];
  if (!m)
    throw Error('module '+module_id+' not loaded');
  await m.promise;
  return m.module;
}

function require_cjs(mod_self, module_id){
  let m = modules[module_id];
  if (!m)
    throw Error('module '+module_id+' not loaded beforehand');
  if (!m.loaded)
    throw Error('module '+module_id+' not loaded completion');
  return m.module.exports;
}

function require_cjs_amd(mod_self, args){
  if (args.length==1)
    return require_cjs(mod_self, args[0]);
  if (args.length==2)
    return require_amd(mod_self, args);
  throw Error('invalid call to require()');
}

async function require_single(mod_self, module_id){
  let m = modules[module_id];
  if (m){
    await m.promise;
    return m.module.exports;
  }
  let resolve, promise = new Promise(res=>resolve = res);
  m = modules[module_id] = {module_id, deps: [], promise,
    loaded: false, module: {exports: {}}};
  let uri = module_get_uri(mod_self, module_id);
  let slow;
  try {
    slow = eslow(5000, ['import('+module_id+')', uri]);
    m.mod = await import(uri);
    slow.end();
  } catch(err){
    console.error('import('+module_id+') failed. required from '+mod_self, err);
    slow.end();
    throw err;
  }
  m.loaded = true;
  m.module.exports = m.mod.default || m.mod;
  resolve(m.module.exports);
  return m.module.exports;
}

function require_cjs_shim(mod_self, module_id){
  let m = modules[module_id];
  if (!m)
    throw Error('module '+module_id+' not loaded beforehand');
  if (!m.loaded)
    throw Error('module '+module_id+' not loaded completion');
  return m.module;
}

function module_get_uri(mod_self, module_id){
  let u = url_uri_parse(module_id, '/'+mod_self);
  return u.is_based ? '/.lif/npm'+u.pathname : '/.lif/npm/'+module_id;
}

lb = lif.boot = {
  process,
  define,
  require,
  define_amd,
  require_amd,
  module_get,
  require_cjs,
  require_cjs_amd,
  require_single,
  require_cjs_shim,
  module_get_uri,
};
lb = lif.boot;
window.define = define;
window.require = require;
window.process = process;

let import_do = async({url, opt})=>{
  let slow;
  try {
    let ret = {};
    //console.log('import_do('+url+')');
    slow = eslow(5000, ['import_do', url]);
    let exports = await import(url, opt);
    slow.end();
    //console.log('import DONE('+url+')', exports);
    ret.exports = [];
    if (typeof exports=='object' && !Array.isArray(exports.default)){
      for (let i in exports.default)
        ret.exports.push(i);
    }
    return ret;
  } catch(err){
    console.error('import_do('+url+') failed', err);
    slow.end();
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
