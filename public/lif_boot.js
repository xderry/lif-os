// amdlite.js
var global_amd = {};
//  @param {Object} global
(function(global){
  const E_REQUIRE_FAILED = 'malformed require';
  // Modules waiting for deps to be exported.
  //  @type {Array.<Module>}
  var pendingModules = [];
  // New modules since the last script loaded.
  //  @type {Array.<Module>}
  var newModules = [];
  // Loaded modules, keyed by id.
  //  @type {Object.<Module>}
  var cache = {};
  // Names of modules which are loading/loaded.
  //  @type {Object.<boolean>}
  var loads = {};
  // Module definition.
  //  @name Module
  //  @constructor
  //  @param {string?=} id
  //      Optional string identifying the module.
  //  @param {Array.<string>?=} deps
  //      Optional array of strings identifying the module's deps.
  //  @param {function(...)?=} factory
  //      Optional function returning the export value of the module.
  //  @param {?=} exportValue
  //      Optional export value for modules without a factory.
  //  @param {function(Module)?=} generator
  //      Optional function returning a dynamic export value for the module.
  function Module(id, deps, factory, exportValue, generator){
    this.id = id;
    this.deps = deps;
    this.factory = factory;
    this.exports = {};
    this.generator = generator;
    if (!factory)
      this.exportValue = exportValue || this.exports;
    if (id){
      loads[id] = true;
      cache[id] = this;
    }
  }
  Module.prototype.loadDependencies = function(){
    var deps = this.deps;
    var id, i;
    for (i = deps.length; i--;){
      id = deps[i];
      // normalize relative deps
      // TODO: normalize 'dot dot' segments
      if (id[0]=='.'){
        if (this.id.includes('/'))
          id = this.id.replace(/\/[^/]*$/, '/') + id;
        else
          id = '/' + id;
        id = id.replace(/[/]\.[/]/g, '/');
        deps[i] = id;
      }
      // load deps that haven't started loading yet
      if (!loads[id])
        this.loadScript(id);
    }
  };
  // Check deps.
  //  Checks if all deps of a module are ready.
  //  @param {string=} ignore
  //      Module name to ignore, for circular reference check.
  //  @return {boolean} true if all deps are ready, else false.
  Module.prototype.checkDependencies = function(ignore){
    var deps = this.deps || []; 
    var dep, i;
    for (i = deps.length; i--;){
      dep = getCached(deps[i]);
      // if the dependency doesn't exist, it's not ready
      if (!dep)
        return false;
      // if the dependency already exported something, it's ready
      if (dep.exportValue)
        continue;
      // if the dependency is only blocked by this module, it's ready
      // (circular reference check, this module)
      if (!ignore && dep.checkDependencies(this.id))
        continue;
      // if we're ignoring this dependency, it's ready
      // (circular reference check, dependency of dependency)
      if (ignore && (ignore == dep.id))
        continue;
      // else it's not ready
      return false;
    }
    return true;
  };
  // Get dependency value.
  //  Gets the value of a cached or builtin dependency module by id.
  //  @return the dependency value.
  Module.prototype.getDependencyValue = function(id){
    // @type {Module}
    var dep = getCached(id);
    return dep.generator ? dep.generator(this) : dep.exportValue;
  };
  // Load a script by module id.
  //  @param {string} id
  //      Module id.
  Module.prototype.loadScript = function(id){
    var script = document.createElement('script');
    var parent = document.documentElement.children[0];
    loads[id] = true;
    script.onload = script.onreadystatechange = function(){
      var hasDefinition; // anonymous or matching id
      var module;
      // exit early if the script isn't loaded
      if (typeof script.readyState=='string' &&
          !script.readyState.match(/^(loaded|complete)$/))
        return;
      // loading amd modules
      while (module = newModules.pop()){
        if (!module.id || module.id==id){
          hasDefinition = true;
          module.id = id;
        }
        if (!getCached(module.id))
          cache[module.id] = module;
      }
      // loading alien script
      if (!hasDefinition){
        module = new Module(id);
        cache[id] = module;
      }
      // set export values for modules that have all deps ready
      exportValues();
      parent.removeChild(script);
    };
    script.src = id+'.js';
    parent.appendChild(script);
  };
  // Define a module.
  //  Wrap Module constructor and fiddle with optional arguments.
  //  @param {?=} id
  //      Module id.
  //  @param {?=} deps
  //      Module deps.
  //  @param {?=} factory
  //      Module factory.
  function define(id, deps, factory){
    var argc = arguments.length;
    var defaultDeps = ["require", "exports", "module"];
    var module, exportValue;
    if (argc==1){
      factory = id;
      deps = defaultDeps;
      id = undefined;
    } else if (argc==2){
      factory = deps;
      if (typeof id=='string')
        deps = defaultDeps;
      else {
        deps = id;
        id = undefined;
      }
    }
    if (typeof factory!='function'){
      exportValue = factory;
      factory = undefined;
    }
    module = new Module(id, deps, factory, exportValue);
    newModules.push(module);
    pendingModules.push(module);
    setTimeout(()=>module.loadDependencies(), 0);
    exportValues();
    return module;
  }
  // Get a cached module.
  //  @param {string} id
  //      Module id.
  function getCached(id){
    if (cache[id])
      return cache[id];
  }
  // Export module values.
  //  For each module with all deps ready, set the
  //  export value from the factory or exports object.
  function exportValues(){
    var count = 0;
    var lastCount = 1;
    var i, j, module, factory, args, id, value;
    while (count != lastCount){
      lastCount = count;
      for (i = pendingModules.length; i--;){
        module = pendingModules[i];
        if (!module.exportValue && module.checkDependencies()){
          pendingModules.splice(i, 1);
          factory = module.factory;
          args = [];
          for (j = module.deps.length; j--;){
            id = module.deps[j];
            args.unshift(module.getDependencyValue(id));
          }
          value = factory.apply(module.exports, args);
          module.exportValue = value || module.exports;
          ++count;
        }
      }
    }
  }
  // Built-in require function.
  //  If callback is present, call define, else return the export value
  //  of the cached module identified by the first argument.
  //  https://github.com/amdjs/amdjs-api/blob/master/require.md
  //  @param {string|Array.<string>} deps
  //      Module deps.
  //  @param {function()=} callback
  //      Module factory.
  //  @return {Module|undefined}
  function require(deps, callback){
    if (deps.push && callback){ // amd require()
      define(undefined, deps, callback);
      return;
    }
    if (typeof deps=='string') // cjs require()
      return getCached(deps).exportValue;
    throw Error(E_REQUIRE_FAILED);
  }
  // Built-in dynamic modules
  function dynamic(id, generator){
    cache[id] = new Module(id, undefined, undefined, undefined, generator);
    loads[id] = true;
  }
  dynamic('require', function(module){
    function r(){
      return require.apply(null, arguments); }
    r.toUrl = path=>module.id + '/' + path;
    return r;
  });
  dynamic('exports', module=>module.exports);
  dynamic('module', module=>module);
  define.amd = {};
  define.getCached = getCached;
  // Exports, closure compiler style
  global.define = define;

}(global_amd));

// export global_amd.define as define;
// export global_amd.require as require;
// window.define = global_amd.define;
// window.require = global_amd.require;
window.lif = {};
let lif = window.lif;
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
    let m = modules[module_id] = {module_id, deps, factory, loaded: false,
      module: {exports: {}}};
    let resolve, promise = new Promise(res=>resolve = res);
    lb.require_amd(module_id, deps, function(...deps){
      let exports = m.factory.apply(m.module.exports, deps);
      if (exports)
        m.module.exports = exports;
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
    if (!m?.loaded)
      throw Error('module '+module_id+' not loaded');
    return m.exports;
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
