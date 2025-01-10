/*global clients,importScripts*/ // ServiceWorkerGlobalScope

/*global Babel*/
importScripts('https://unpkg.com/@babel/standalone@7.26.4/babel.js');

// this is needed to activate the worker immediately without reload
// @see https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#clientsclaim
self.addEventListener('activate', event=>event.waitUntil(clients.claim()));

const array = {}; // array.js
array.compact = a=>a.filter(e=>e);
array.to_nl = a=>!a?.length ? '' : a.join("\n")+"\n";
const string = {}; // string.js
string.split_trim = (s, sep, limit)=>array.compact(s.split(sep, limit));
string.split_ws = s=>string.split_trim(s, /\s+/);
string.qw = function(s){
  if (Array.isArray(s) && !s.raw)
    return s;
  return string.split_ws(!Array.isArray(s) ? s : string.es6_str(arguments));
};
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
const qw = string.qw;

const str_prefix = (url, prefix)=>{
  if (url.startsWith(prefix))
    return {prefix: prefix, rest: url.substr(prefix.length)};
};
const path_ext = path=>path.match(/\.[^./]*$/)?.[0];
const path_file = path=>path.match(/(^|\/)?([^/]*)$/)?.[2];
const path_dir = path=>path.slice(0, path.length-path_file(path).length);
const path_is_dir = path=>path.endsWith('/');
const url_parse = (url, base)=>{
  const u = URL.parse(url, base);
  if (!u)
    throw Error('cannot parse url: '+url);
  u.path = u.pathname;
  u.ext = path_ext(u.path);
  u.file = path_file(u.path);
  u.dir = path_dir(u.path);
  return u;
};
const uri_parse = uri=>{
  let u = {...url_parse(uri, 'http://x')};
  u.host = u.hostname = u.origin = u.href = u.protocol = '';
  return u;
};

let npm_root = ['https://unpkg.com'];
let mod_load = {};

// see index.html for coresponding import maps
let mod_map = {
  'react': {type: 'amd',
    url: 'https://unpkg.com/react@18/umd/react.development.js',
    exports: qw`__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
      createPortal createRoot findDOMNode flushSync hydrate hydrateRoot render
      unmountComponentAtNode unstable_batchedUpdates
      unstable_renderSubtreeIntoContainer version`,
  },
  'react/jsx-runtime/': {type: 'cjs',
    url: 'https://unpkg.com/jsx-runtime@1.2.0/index.js'},
  // https://esm.sh/react-dom@18.2.0/client
  // import "/v135/react-dom@18.2.0/es2022/react-dom.mjs";
  // export * from "/v135/react-dom@18.2.0/es2022/client.js";
  // export {default} from "/v135/react-dom@18.2.0/es2022/client.js";
  'react-dom': {type: 'amd',
    url: 'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
    exports: qw`__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
      createPortal createRoot findDOMNode flushSync hydrate hydrateRoot render
      unmountComponentAtNode unstable_batchedUpdates
      unstable_renderSubtreeIntoContainer version`,
    // amd: exports.createPortal = ...
    // esm: export createPortal = exports.createPortal;
  },
  'react-dom-global': {type: 'global', global: 'ReactDOM',
    url: 'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
    exports: qw`__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
      createPortal createRoot findDOMNode flushSync hydrate hydrateRoot render
      unmountComponentAtNode unstable_batchedUpdates
      unstable_renderSubtreeIntoContainer version`,
  },
  'canvas-confetti': {type: 'cjs',
    url: 'https://unpkg.com/canvas-confetti@1.9.3/src/confetti.js',
    exports: qw`reset create shapeFromPath shapeFromText`,
    // cjs:      module.exports.reset =
    // esm:      export const reset = module.exports.reset;
  },
  'framer-motion/': {type: 'esm',
    url: 'https://unpkg.com/framer-motion@11.11.17/dist/es/index.mjs'},
  'styled-components': {type: 'esm',
    url: 'https://unpkg.com/styled-components@4.3.2/dist/styled-components.esm.js'},
  'stylis/stylis.min': {type: 'esm',
    url: 'https://unpkg.com/stylis@4.3.4/index.js'},
  'stylis-rule-sheet': "/.lif/esm/stylis-rule-sheet",
  '@emotion/': {type: 'esm',
  '/.lif/esm/@emotion/',
  'react-is': '/.lif/esm/react-is',
  'memoize-one': '/.lif/esm/memoize-one',
  'prop-types': '/.lif/esm/prop-types',
  'merge-anything': '/.lif/esm/merge-anything',

  // browserify dummy nodes:
  'object.assign': {body:
    `export default function(){ return Object.assign; }`},
  // node.js core modules - npm browserify
  'assert': {node: 'assert/assert.js'},
  'buffer': {node: 'buffer/index.js'},
  'child_process': {node: 'empty'},
  'cluster':{node: 'empty'},
  'console': {node: 'console-browserify/index.js'},
  'constants': {node: 'constants-browserify/constants.json'},
  'crypto': {node: 'crypto-browserify/index.js'},
  'dgram': {node: 'empty'},
  'dns': {node: 'empty'},
  'domain': {node: 'domain-browser/source/index.js'},
  'events': {node: 'events/events.js'},
  'fs': {node: 'empty'},
  'http': {node: 'stream-http/index.js'},
  'https': {node: 'https-browserify/index.js'},
  'http2': {node: 'empty'},
  'inspector': {node: 'empty'},
  'module': {node: 'empty'},
  'net': {node: 'empty'},
  'os': {node: 'os-browserify/browser.js'},
  'path': {node: 'path-browserify/index.js'},
  'perf_hooks': {node: 'empty'},
  'punycode': {node: 'punycode/punycode.js'},
  'querystring': {node: 'querystring-es3/index.js'},
  'readline': {node: 'empty'},
  'repl': {node: 'empty'},
  'stream': {node: 'stream-browserify/index.js'},
  '_stream_duplex': {node: 'readable-stream/duplex.js'},
  '_stream_passthrough': {node: 'readable-stream/passthrough.js'},
  '_stream_readable': {node: 'readable-stream/readable.js'},
  '_stream_transform': {node: 'readable-stream/transform.js'},
  '_stream_writable': {node: 'readable-stream/writable.js'},
  'safe-buffer': {node: 'safe-buffer/index.js'}, // for string_decoder
  'string_decoder': {node: 'string_decoder/lib/string_decoder.js'},
  'sys': {node: 'util/util.js'},
  'timers': {node: 'timers-browserify/main.js'},
  'tls': {node: 'empty'},
  'tty': {node: 'tty-browserify/index.js'},
  'url': {node: 'url/url.js'},
  'util': {node: 'util/util.js'},
  'vm': {node: 'vm-browserify/index.js'},
  'zlib': {node: 'browserify-zlib/lib/index.js'},
  '_process': {node: 'process/browser.js'},
};
for (const [name, m] of Object.entries(mod_map)){
  m.is_dir = path_is_dir(name);
  if (m.node){
    m.type = 'cjs';
    m.add_dir = '/browserify/node_modules'
    if (m.node=='empty')
      m.uri = '/lif_mod_empty.js';
    else if (m.node=='error')
      m.uri = '/lif_mod_error.js';
    else {
      m.uris = ['/.lif/pkgroot/node_modules'+m.add_dir+'/'+m.node,
        '/.lif/pkgroot/node_modules/'+m.node];
      m.uri = m.uris[m.uris.length-1];
    }
  }
  if (m.body!==undefined)
    m.type = 'body';
}

const mod_get = path=>{
  let mod, m, v, prefix;
  for (let name in mod_map){
    m = mod_map[name];
    if (name==path){
      mod = {m, name, rest: ''};
      break;
    }
    if (m.is_dir && (v=str_prefix(path, name))){
      mod = {m, name, rest: v.rest};
      break;
    }
  }
  if (!mod)
    return;
  if (m.url){
    let u = url_parse(m.url);
    mod.url = m.is_dir && mod.rest ? u.origin+u.dir+mod.rest : m.url;
  } else if (m.uri){
    let u = uri_parse(m.uri);
    mod.url = m.is_dir && mod.rest ? u.dir+mod.rest : m.uri;
  }
  return mod;
};

const mod_to_esm = (module, body)=>{
  let mod = mod_get(module);
  let m = mod.m;
  let mod_json = JSON.stringify(module);
  let res = '';
  let exports = '';
  m?.exports?.forEach(e=>exports += `export const ${e} = mod.exports.${e};\n`);
  exports += `export default mod.exports;\n`;
  let lb_header = `
    let lb = window.lif.boot;
    let define = function(id, deps, factory){
      return lb.define_amd(${mod_json}, arguments); };
    define.amd = {};
    let require = function(deps, cb){
      return lb.require_amd(${mod_json}, deps, cb); };
  `;
  if (m.type=='global'){
    res = body+`;
      export default window.${mod.global};
    `;
  } else if (m.type=='amd'){
    res = lb_header+body;
    res += `let mod = await lb.module_get(${mod_json});\n`;
    res += exports;
  } else if (m.type=='cjs'){
    let paths = cjs_require_scan(body);
    res = lb_header;
    paths.forEach(p=>res += `await require_single(module, ${JSON.stringify(p)});\n`);
    res += body+';\n'+exports;
  }
  if (!res)
    res = body;
  return res;
};

// "const mod = require('module');" -> ["module"]
let cjs_require_scan = function(js){
  // poor-man's require('module') scanner. in the future use a AST parser
  let requires = [...js.matchAll(
    /\brequire\s*\(\s*(['"])([^'"\\]+)(['"])\s*\)/g)];
  let paths = [];
  requires.forEach(([, q1, file, q2])=>{
    if (q1!=q2)
      return;
    paths.push(file);
  });
  return paths;
};

let ext_react = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
let ext_esm = ['/index.mjs'];
let pkg_map = {
  '/pages/': {path: '/.lif/pkgroot/pages/'},
  '/components/': {path: '/.lif/pkgroot/components/', ext: ext_react},
  '/hooks/': {path: '/.lif/pkgroot/hooks/', ext: ext_react},
  '/contexts/': {path: '/.lif/pkgroot/contexts/', ext: ext_react},
  '/utils/': {path: '/.lif/pkgroot/utils/', ext: ext_react},
};
const pkg_get = path=>{
  let v;
  if (v=str_prefix(path, '/.lif/pkgroot/')){
    let name = '/'+v.rest;
    for (let i in pkg_map){
      if (v=str_prefix(name, i))
        return pkg_map[i];
    }
  }
};
const headers = new Headers({
  'Content-Type': 'application/javascript',
});
async function fetch_try(urls){
  let response, url;
  for (url of urls){
    response = await fetch(url);
    if (response.status==200)
      break;
  }
  if (response?.status!=200)
    console.error('failed module '+urls);
  return {response, url};
}

//let log = console.log.bind(console);
let log = ()=>0;
//let log = function(){ if (!url.includes('sty')) return; console.log(url, ...arguments); };
async function _sw_fetch(event){
  let {request, request: {url}} = event;
  let u = url_parse(url);
  let ref = request.headers.get('referer');
  let external = u.origin!=self.location.origin;
  let path = u.path;
  if (request.method!='GET')
    return fetch(request);
  let v;
  log('Req '+url);
  let pkg = pkg_get(path);
  if (external)
    return fetch(request);
  if (v=str_prefix(path, '/.lif/esm/')){ // rename /.lif/global/
    let module = v.rest, mod, mod_l;
    mod = mod_get(module);
    if (!mod?.url){
      if (!(mod_l = mod_load[module])){
        mod_l = mod_load[module] = {mod: mod, loaded: false, wait: [],
        mod_l.pkg_json_uri = (mod.?ver && !module.includes('@') ? '@'+mod.ver)
            +'/'+module+'/package.json';
      }
      if (!mod_l.loaded){
      let pkg_json = npm_root[0]+mod_l.pkg_json;
      let response = await fetch(pkg_json);
      if (response.status!=200)
        throw Error('failed fetch '+pkg_url);
      let body = await response.json();
    }
    if (!(mod=mod_get(module)))
      throw Error('no module found: '+module);
    if (!mod.url)
    if (mod.type=='esm' && !mod.url){
      let response = await fetch(mod.url);
      mod.url = await mod_esm_get_url(
    await 
    }
    let response = await fetch(mod.url);
    if (response.status!=200)
      throw Error('failed fetch '+mod.url);
    let body = mod.body!==undefined ? mod.body : await response.text();
    let res = mod_to_esm(module, body);
    log(`module ${mod.name} loaded ${path} ${mod.url}`);
    return new Response(res, {headers});
  }
  if (u.ext=='.css'){
    let response = await fetch(path);
    if (response.status!=200)
      throw Error('failed fetch '+path);
    let body = await response.text();
    return new Response(`
        //TODO We don't track instances, so 2x imports will result in 2x style tags
        const head = document.getElementsByTagName('head')[0];
        const style = document.createElement('style');
        style.setAttribute('type', 'text/css');
        style.appendChild(document.createTextNode(${JSON.stringify(body)}));
        head.appendChild(style);
        export default null; //TODO here we can export CSS module instead
      `,
      {headers}
    );
  }
  if (['.jsx', '.tsx', '.ts'].includes(u.ext) || pkg?.ext && !u.ext){
    let response, res_status;
    log('babel '+u.ext, url);
    let urls = [], __url;
    if (u.ext)
      urls.push(url);
    else
      pkg.ext.forEach(ext=>urls.push(url+ext));
    ({response, url: __url} = await fetch_try(urls));
    if (response?.status!=200)
      return response;
    u = url_parse(__url);
    log('babel loaded module src '+__url);
    let body = await response.text();
    // console.log(response);
    let opt = {presets: [], plugins: [], sourceMaps: true};
    if (u.ext=='.tsx' || u.ext=='.ts'){
      opt.presets.push('typescript');
      opt.filename = u.file;
    }
    if (u.ext=='.tsx' || u.ext=='.jsx')
      opt.presets.push('react');
    let res;
    try {
      res = await Babel.transform(body, opt);
    } catch (err){
      console.error('babel FAILED: '+path, err);
      throw err;
    }
    // babel --presets typescript,react app.tsx
    // console.log('babel: '+path);
    return new Response(res.code, {headers});
  }
  if (u.ext=='.js'){
    let response = await fetch(path);
    let body = await response.text();
    return new Response(body, {headers});
  }
  if (path=='/favicon.ico')
    return await fetch('https://raw.githubusercontent.com/DustinBrett/daedalOS/refs/heads/main/public/favicon.ico');
  return await fetch(request);
}

async function sw_fetch(event){
  try {
    return await _sw_fetch(event);
  } catch (err){
    console.error('ServiceWorker sw_fetch err', err);
    return new Response(''+err, {status: 500, statusText: ''+err});
  }
}

self.addEventListener('fetch', event=>{
  try {
    event.respondWith(sw_fetch(event));
  } catch (err){
    console.error("ServiceWorker NetworkError: "+err);
  }
});
