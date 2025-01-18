let lif = {};
window.lif = lif;
let modules = {};
let lb;
// Promise with return() and throw()
let xpromise = ()=>{
  let _return, _throw;
  let promise = new Promise((resolve, reject)=>{
    _return = ret=>{ resolve(ret); return ret; };
    _throw = err=>{ reject(err); return err; };
  });
  promise.return = _return;
  promise.throw = _throw;
  return promise;
};
// chan.js
class postmessage_chan {
  req = {};
  cmd_cb = {};
  chan = null;
  async cmd(cmd, req){
    let id = ''+(id++);
    let cq = this.req[id] = xpromise();
    this.chan.postMessage({cmd, req, id});
    return await cq;
  }
  async cmd_server_cb(msg){
    let cmd_cb = this.cmd_cb[msg.cmd];
    if (!cmd_cb)
      throw Error('invalid cmd', msg.cmd);
    try {
      let res = await cmd_cb({chan: this, cmd: msg.cmd, arg: msg.arg});
      this.chan.postMessage({cmd_res: msg.cmd, id_res: msg.id, res});
    } catch(err){
      this.chan.postMessage({cmd_res: msg.cmd, id_res: msg.id, err: ''+err});
      throw err;
    }
  }
  on_msg(event){
    let msg = event.data;
    if (!this.chan)
      throw Error('chan not init');
    if (msg.cmd)
      return this.cmd_server_cb(msg);
    if (msg.id){
      if (!this.req[msg.id])
        throw Error('invalid char msg.id', msg.id);
      let cb = this.req[msg.id];
      delete this.req[msg.id];
      cb.return(msg.res);
    }
    return true;
  }
  init_server_cmd(cmd, cb){
    this.cmd_cb[cmd] = cb;
  }
  // controller = navigator.serviceWorker.controller
  connect(controller){
    this.chan = new MessageChannel();
    controller.postMessage({connect: true}, [this.chan.port2]);
    this.chan.port1.onmessage = event=>this.on_msg(event);
  }
  listen(event){
    if (event.data?.connect){
      this.chan = event.ports[0];
      return true;
    }
  }
}
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
    let promise = xpromise();
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
  require_cjs: function(mod_self, module_id){
    let m = modules[module_id];
    if (!m)
      throw Error('module '+module_id+' not loaded beforehand');
    if (!m.loaded)
      throw Error('module '+module_id+' not loaded completion');
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

let import_do = async({url, opt})=>{
  try {
    let ret = {};
    let exports = await import(url, opt);
    if (opt.exports){
      ret.exports = [];
      for (let i in exports)
        ret.exports.push(i);
    }
    return ret;
  } catch(err){
    console.log('import_do('+url+') failed', err);
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
      sw_chan.init_server_cmd('import', async(req)=>
        await import_do({url: req.url, opt: {exports: true}}));
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
};
lif_boot_start();
