var modules = [];
var pending = [];
var loaded = [];

// Define a module with deps.
// @param  {String} 	name          Name of the module.
// @param  {Array}  	deps          Array of deps. (Optional)
// @param  {Function} 	module        Function returing the module object.
var define = function(name, deps, module){
  console.log('define', name, 'deps', deps);
  if (typeof deps=="function")
    [module, deps] = [deps, require.extractDependencies(deps)];
  if (!deps?.length){
    // Push into loaded for fast iteration
    loaded.push(name);
    // Module has no deps, i.e. immediately loaded
    // console.log("Module loaded: ", name);
    modules[name] = {
      name,
      cb: module,
      module: module(),
      loaded: true,
      deps: [],
    }
  } else {
    // Has deps, defer loading until deps have loaded
    // console.log("Deferring loading of ", name, "with deps", deps);
    modules[name] = {
      name,
      cb: module,
      loaded: false,
      deps,
    };
  }
  console.log('define', name, 'deps', deps, 'cb', modules[name].cb);
  unroll();
  // Fire onModule event
  if (require.onModule)
    require.onModule(modules[name]);
  return modules[name];
};

// Call a function with deps.
// @param  {Array}   deps Array of deps.
// @param  {Function} cb    Callback with deps as parameters.
var require = function(deps, cb) {
  if (typeof deps=="function")
    [cb, deps] = [deps, require.extractDependencies(deps)];
  var module = {cb, deps};
  console.log('require deps', deps, 'cb', cb);
  // console.log("Require defined with deps", deps);
  // Push it into the modules
  modules.push(module);
  // Fire onModule event
  if (require.onModule)
    require.onModule(module);
  // Test dependancies
  unroll();
  return module;
};

// Loop over any unloaded modules to check if their deps
// have loaded. If so, run the module.
// @private
var unroll = function() {
  // Loop over the modules and requires.
  Object.keys(modules).map(name=>modules[name]).concat(modules)
  .forEach(module=>{
    // Test to see if the modules deps each have loaded.
    if (!module.loaded && module.deps.every(depn=>loaded.includes(depn)))
      return;
    // Module's deps have loaded, execute it and update it's state
    // console.log("Module loaded: ", module.name, "with deps", module.deps);
    loaded.push(module.name);
    module.loaded = true;
    module.module = module.cb.apply(null,
      module.deps.map(depn=>modules[depn].module));
    // And unroll again with newly added modules
    unroll();
  });
};

// Extract named function parameters as deps from a function.
// @param  {Function} fn 
// @return {Array}      Array of deps
require.extractDependencies = function(fn){
  fn = fn.toString();
  // Remove any /* */ comments in the function body (because they can occur in the parameters)
  fn = fn.replace(/\/\*[^(?:\*\/)]+\*\//g, "");
  // Extract the deps
  fn = fn.match(/function \(([^\)]*)\)/)[1];
  // Split and trim them, return an array
  return !fn ? [] : fn.split(",").map(depn=>depn.trim());
};

// Load a script.
// @param  {String}   src      Script location.
// @param  {Function} callback 
require.loadScript = function(src, cb){
  var script = document.createElement("script");
  script.onload = cb;
  document.head.appendChild(script);
  script.src = src;
};

require.modules = modules;
define.amd = {}; // for detection of AMD by UMD
// export require;
// export define;

window.define = define;
window.require = require;

(async()=>{
  try {
    const registration = await navigator.serviceWorker.register('/lif_sw.js');
    await navigator.serviceWorker.ready;
    const launch = async()=>{
      await import(window.launch_url || './pages/index.tsx');
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
