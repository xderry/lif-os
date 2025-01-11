(function(){

const string = {}; // string.js
string.split_ws = s=>s.split(/\s+/).filter(s=>s);
string.es6_str = args=>{
  var parts = args[0], s = '';
  if (!Array.isArray(parts))
    return parts;
  s += parts[0];
  for (var i = 1; i<parts.length; i++){
    s += args[i];
    s += parts[i];
  }
  return s;
};
string.qw = function(s){
  if (Array.isArray(s) && !s.raw)
    return s;
  return string.split_ws(!Array.isArray(s) ? s : string.es6_str(arguments));
};
const qw = string.qw;

let importmap = {imports: {}};
let importmap_calc = ()=>{
  let m = importmap.imports, list = [];
  m['next/dynamic'] = './lif_next_dynamic.js';
  // core react
  list.push(...qw`react react-dom`);
  list.push(...qw`frameer-motion motion-dom styled-components stylis
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
  document.head.appendChild(im);
};

importmap_load();

})();
