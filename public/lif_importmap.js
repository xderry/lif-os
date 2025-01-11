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
  return string.split_ws(!Array.isArray(s) ? s : string.es6_str(arguments)); };
const qw = string.qw;

let importmap = {imports: {}};
let importmap_calc = ()=>{
  let m = importmap.imports, a;
  m['next/dynamic'] = './lif_next_dynamic.js';
  // core react
  a = [];
  a.push(...qw`react react-dom`);
  a.push(...qw`frameer-motion motion-dom styled-components stylis
    stylis-rule-sheet @emotion react-is memoize-one prop-types
    merge-anything framer-motion motion-utils`);
  // core node modules
  a.push(...qw`path assert buffer child_process cluster console
    constants crypto dgram dns domain events fs http https http2 inspector
    module net os path perf_hooks punycode querystring readline repl stream
    _stream_duplex _stream_passthrough _stream_readable _stream_transform
    _stream_writable string_decoder sys timers tls tty url util vm zlib
    _process`);
  a.forEach(e=>{
    m[e] = '/.lif/esm/'+e;
    m[e+'/'] = '/.lif/esm/'+e+'/';
  });
  a = [];
  a.push(...qw`components hooks contexts pages utils`);
  a.forEach(e=>{
    m[e+'/'] = '/.lif/pkgroot/'+e+'/';
    m['/'+e+'/'] = '/.lif/pkgroot/'+e+'/';
  });
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
