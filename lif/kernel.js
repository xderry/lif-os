let lif = window.lif = {};
let lif_version = '0.2.31';
import util from './util.js';
let {ewait, esleep, eslow, postmessage_chan, path_file,
  url_uri_parse, npm_uri_parse, _debugger} = util;

let modules = {};
let lb;
let bios_chan;

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
  let url = module_get_url_uri(mod_self, module_id);
  let slow;
  try {
    slow = eslow(5000, ['import('+module_id+')', url]);
    m.mod = await import(url);
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

function module_get_url_uri(mod_self, module_id){
  let u = url_uri_parse(module_id, '/'+mod_self);
  return u.is_based=='url' ? module_id :
    u.is_based ? '/.lif/npm'+u.pathname :
    '/.lif/npm/'+module_id;
}

async function _import(mod_self, [url, opt]){
  let _url = module_get_url_uri(mod_self, url);
  return await import(_url, opt);
}
lif.kernel = {
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
  _import,
  version: lif_version,
};
lb = lif.kernel;
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
let lif_app_boot = async()=>{
  let url = window.lif_boot_url || 'lif.app/pages/index.tsx';
  console.log('kernel: boot '+url);
  try {
    return await _import('/', [url]);
  } catch (err){
    console.error('import('+url+') failed', err);
    throw err;
  }
};
let lif_kernel_boot = async()=>{
  let wait = ewait();
  try {
    const registration = await navigator.serviceWorker.register('/lif_bios_sw.js');
    await navigator.serviceWorker.ready;
    const boot_bios = async()=>{
      bios_chan = new postmessage_chan();
      bios_chan.connect(navigator.serviceWorker.controller);
      bios_chan.add_server_cmd('import', async({arg})=>await import_do(arg));
      bios_chan.add_server_cmd('version', arg=>({version: lif_version}));
      console.log('lif kernel version: '+lif_version+' util '+util.version);
      console.log('lif bios sw version: '+(await bios_chan.cmd('version')).version);
      wait.return();
    };
    // this boots the React app if the SW has been installed before or
    // immediately after registration
    // https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#clientsclaim
    if (navigator.serviceWorker.controller)
      await boot_bios();
    else
      navigator.serviceWorker.addEventListener('controllerchange', boot_bios);
    return wait;
  } catch (err){
    console.error('ServiceWorker registration failed', err, err.stack);
    wait.throw(err);
  }
  return await wait;
};
await lif_kernel_boot();
await lif_app_boot();
console.log('kernel: boot complete');
