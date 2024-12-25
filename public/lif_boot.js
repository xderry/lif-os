/*
var modules = [];
var pending = [];
var loaded = [];

// Define a module with dependencies.
// @param  {String} 	name          Name of the module.
// @param  {Array}  	dependencies  Array of dependencies. (Optional)
// @param  {Function} 	module        Function returing the module object.
var define = function(name, _dependencies, _module){
  var dependencies, module;
  if (typeof _dependencies=="function"){
    module = _dependencies;
    dependencies = require.extractDependencies(module);
  } else {
    dependencies = _dependencies;
    module = _module;
  }
  if (!dependencies || !dependencies.length){
    // Push into loaded for fast iteration
    loaded.push(name);
    // Module has no dependencies, i.e. immediately loaded
    // console.log("Module loaded: ", name);
    modules[name] = {
      name: name,
      callback: module,
      module: module(),
      loaded: true,
      dependencies: [],
    }
  } else {
    // Has dependencies, defer loading until dependencies have loaded
    // console.log("Deferring loading of ", name, "with dependencies", dependencies);
    modules[name] = {
      name: name,
      callback: module,
      loaded: false,
      dependencies: dependencies,
    };
  }
  unroll();
  // Fire onModule event
  if (require.onModule)
    require.onModule(modules[name]);
  return modules[name];
};

// Call a function with dependencies.
// @param  {Array}   dependencies Array of dependencies.
// @param  {Function} callback    Callback with dependencies as parameters.
var require = function(_dependencies, _callback) {
  var dependencies, callback;
  if (typeof _dependencies=="function"){
    callback = _dependencies;
    dependencies = require.extractDependencies(callback);
  } else {
    dependencies = _dependencies;
    callback = _callback;
  }
  var module = {
    callback: callback,
    dependencies: dependencies,
  };
  // console.log("Require defined with dependencies", dependencies);
  // Push it into the modules
  modules.push(module);
  // Fire onModule event
  if (require.onModule)
    require.onModule(module);
  // Test dependancies
  unroll();
  return module;
};

// Loop over any unloaded modules to check if their dependencies
// have loaded. If so, run the module.
// @private
var unroll = function() {
  // Loop over the modules and requires.
  Object.keys(modules).map(name=>modules[name]).concat(modules)
  .forEach(module=>{
    // Test to see if the modules dependencies each have loaded.
    if (!module.loaded && module.dependencies.every(depn=>loaded.includes(depn)))
      return;
    // Module's dependencies have loaded, execute it and update it's state
    // console.log("Module loaded: ", module.name, "with dependencies", module.dependencies);
    loaded.push(module.name);
    module.loaded = true;
    module.module = module.callback.apply(null,
      module.dependencies.map(depn=>modules[depn].module));
    // And unroll again with newly added modules
    unroll();
  });
};

// Extract named function parameters as dependencies from a function.
// @param  {Function} fn 
// @return {Array}      Array of dependencies
require.extractDependencies = function(fn){
  fn = fn.toString();
  // Remove any /* */ /*comments in the function body (because they can occur in the parameters)
  fn = fn.replace(/\/\*[^(?:\*\/)]+\*\//g, "");
  // Extract the dependencies
  fn = fn.match(/function \(([^\)]*)\)/)[1];
  // Split and trim them, return an array
  return !fn ? [] : fn.split(",").map(depn=>depn.trim();
};

// Load a script.
// @param  {String}   src      Script location.
// @param  {Function} callback 
require.loadScript = function(src, callback){
  var script = document.createElement("script");
  script.onload = callback;
  document.head.appendChild(script);
  script.src = src;
};

require.modules = modules;
exports.require = require;
exports.define = define;

window.define = define;
window.require = require;
*/

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
