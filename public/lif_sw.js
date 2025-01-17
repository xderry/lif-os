/*global clients,importScripts*/ // ServiceWorkerGlobalScope

/*global Babel*/
importScripts('https://unpkg.com/@babel/standalone@7.26.4/babel.js');
let Babel = self.Babel;
// this is needed to activate the worker immediately without reload
// @see https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#clientsclaim
self.addEventListener('activate', event=>event.waitUntil(clients.claim()));

// Promise with return() and throw()
let xpromise = ()=>{
  let _resolve, _reject;
  let promise = new Promise((resolve, reject)=>{
    _resolve = resolve; _reject = reject;});
  promise.return = _resolve;
  promise.throw = _reject;
  return promise;
};

// string.js
const string = {};
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

// parse-package-name
const npm_uri_parse = path=>{
  const RE_SCOPED = /^(@[^\/]+\/[^@\/]+)(?:@([^\/]+))?(\/.*)?$/
  const RE_NON_SCOPED = /^([^@\/]+)(?:@([^\/]+))?(\/.*)?$/
  const m = RE_SCOPED.exec(path) || RE_NON_SCOPED.exec(path)
  return !m ? null : {name: m[1]|| '', version: m[2]|| '', path: m[3]||''};
};
let npm_cdn = ['https://unpkg.com'];
let npm_mem = {};

// see index.html for coresponding import maps
let mod_map = {
  /*
  'react': {type: 'amd',
    url: 'https://unpkg.com/react@18/umd/react.development.js',
    exports: qw`Children Component Fragment Profiler PureComponent StrictMode
      Suspense __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
      act cloneElement createContext createElement createFactory createRef
      forwardRef isValidElement lazy memo startTransition unstable_act
      useCallback useContext useDebugValue useDeferredValue useEffect useId
      useImperativeHandle useInsertionEffect useLayoutEffect useMemo useReducer
      useRef useState useSyncExternalStore useTransition version`,
  },
  /*
  'react/jsx-runtime': {type: 'esm',
    url: 'https://unpkg.com/jsx-runtime@1.2.0/index.js'},
  */
  /*
  'react-dom': {type: 'amd',
    url: 'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
    exports: qw`__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
      createPortal createRoot findDOMNode flushSync hydrate hydrateRoot render
      unmountComponentAtNode unstable_batchedUpdates
      unstable_renderSubtreeIntoContainer version`,
  },
  */
  /*
  'react-dom-global': {type: 'global', global: 'ReactDOM',
    url: 'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
    exports: qw`__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
      createPortal createRoot findDOMNode flushSync hydrate hydrateRoot render
      unmountComponentAtNode unstable_batchedUpdates
      unstable_renderSubtreeIntoContainer version`,
  },
  */
  /*
  'canvas-confetti': {type: 'cjs',
    url: 'https://unpkg.com/canvas-confetti@1.9.3/src/confetti.js',
    exports: qw`reset create shapeFromPath shapeFromText`,
  },
  */
  //'/lif_next_dynamic.js': {body:
  //  'export function dynamic(import_fn){ return import_fn(); }'},
  /*
  'framer-motion/': {type: 'esm',
    url: 'https://unpkg.com/framer-motion@11.11.17/dist/es/index.mjs'},
  'styled-components': {type: 'esm',
    url: 'https://unpkg.com/styled-components@4.3.2/dist/styled-components.esm.js'},
  'stylis/stylis.min': {type: 'esm',
    url: 'https://unpkg.com/stylis@4.3.4/index.js'},
  */

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
    if (name==path || name+'/'==path){ // /react -> /react/
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

const mod_to_esm = mod_load=>{
  let m = mod_load;
  let _mod_id = JSON.stringify(m.mod_id);
  let b = '';
  if (m.type=='global'){
    return `
      (()=>{
      ${m.body}
      })();
      export default window.${m.global};
    `;
  }
  let parser = Babel.packages.parser;
  let traverse = Babel.packages.traverse.default;
  let p = parser.parse(m.body);
  let exports = [];
  traverse(p, {
    AssignmentExpression: function(path){
      let n = path.node, l = n.left, r = n.right;
      if (n.operator=='=' &&
        l.type=='MemberExpression' &&
        l.object.name=='exports' && l.object.type=='Identifier' &&
        l.property.type=='Identifier')
      {
        exports.push(l.property.name);
      }
    },
  });
  if (m.type=='amd'){
    let _exports = '';
    exports.forEach(e=>_exports +=
      `export const ${e} = mod.exports.${e};\n`);
    _exports += `export default mod.exports;\n`;
    b = `
      let lb = window.lif.boot;
      let define = function(id, deps, factory){
        return lb.define_amd(${_mod_id}, arguments); };
      define.amd = {};
      let require = function(deps, cb){
        return lb.require_amd(${_mod_id}, deps, cb); };
      (()=>{
      ${m.body}
      })();
      let mod = await lb.module_get(${_mod_id});
      ${_exports}
    `;
  } else if (m.type=='cjs'){
    let requires = cjs_require_scan(m.body), _exports = '', _requires = '';
    exports.forEach(e=>_exports +=
      `export const ${e} = module.exports.${e};\n`);
    _exports += `export default module.exports;\n`;
    requires.forEach(p=>_requires +=
      `await require_single(module, ${JSON.stringify(p)});\n`);
    b = `
      let lb = window.lif.boot;
      let module = {exports: {}};
      let exports = module.exports;
      let process = {env: {}};
      let require = function(module){
        return lb.require_cjs(${_mod_id}, module); };
      ${_requires}
      (()=>{
      ${m.body}
      })();
      let mod = await lb.module_get(${_mod_id});
      ${_exports}
    `;
  }
  return b || m.body;
};

let headers = {
  js: new Headers({'content-type': 'application/javascript'}),
  json: new Headers({'content-type': 'application/json'}),
};

let ext_react = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
let pkg_map = {
  '/pages/': {path: '/.lif/pkgroot/pages/'},
  '/components/': {path: '/.lif/pkgroot/components/', ext: ext_react},
  '/hooks/': {path: '/.lif/pkgroot/hooks/', ext: ext_react},
  '/contexts/': {path: '/.lif/pkgroot/contexts/', ext: ext_react},
  '/utils/': {path: '/.lif/pkgroot/utils/', ext: ext_react},
  '/styles/': {path: '/.lif/pkgroot/styles/', ext: ext_react},
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
let content_type_get = destination=>{
  // audio, audioworklet, document, embed, fencedframe, font, frame, iframe,
  // image, json, manifest, object, paintworklet, report, script,
  // sharedworker, style, track, video, worker or xslt
  let types = {
    script: 'application/javascript',
    json: 'application/json',
  };
  return types[destination] || types.script;
};
async function fetch_try(log, urls){
  let response, url, idx;
  if (typeof urls=='string')
    urls = [urls];
  for (idx in urls){
    url = urls[idx];
    response = await fetch(url);
    if (response.status==200)
      break;
  }
  if (response?.status!=200)
    throw Error('failed fetch module '+urls+' for '+log.mod);
  return {response, url, idx};
}

// TODO support longer matches first /a/b/c matches before /a/b
let file_match = (file, match)=>{
  let v;
  if (!str_prefix(file, './'))
    return;
  if (!(v=str_prefix(file, match)))
    return;
  if (v.rest && !path_is_dir(file))
    return;
  return true;
};
// parse package.exports
// https://webpack.js.org/guides/package-exports/
let npm_file_lookup = (pkg, file)=>{
  let f, v, res = [];
  let exports = pkg.exports;
  if (typeof exports=='string')
    exports = {'.': exports};
  for (f in exports){
    v = exports[f];
    if (f=='./')
      continue;
    if (f.includes('*'))
      throw Error('module '+pkg.name+' match * ('+f+') unsupported');
    if (!file_match(file, f))
      continue;
    if (typeof v=='string'){
      res.push({file: v});
      continue;
    }
    if (typeof v!='object')
      continue;
    // default import require types
    if (typeof v.import=='string'){
      res.push({file: v.import, type: 'esm'});
      continue;
    }
    if (typeof v.default=='string'){
      res.push({file: v.default, type: 'cjs'});
      continue;
    }
    if (typeof v.require=='string'){
      res.push({file: v.require, type: 'amd'});
      continue;
    }
  }
  if (res.length){
    let best = res[0];
    res.forEach(r=>{
      if (r.file.length > best.file.length)
        best = r;
    });
    return best;
  }
  if (file=='.'){
    if (typeof pkg.module=='string')
      return {file: pkg.module, type: 'esm'};
    if (typeof pkg.main=='string')
      return {file: pkg.main, type: 'amd'};
  }
  return {};
};
async function npm_load(log, module){
  let npm, uri, mod_ver;
  if (!(uri = npm_uri_parse(module)))
    throw Error('invalid module name '+module);
  mod_ver = uri.name+uri.version;
  if (npm = npm_mem[mod_ver]){
    await npm.wait;
    return npm;
  }
  npm = npm_mem[mod_ver] = {module, uri, mod_ver};
  npm.file_lookup = module=>{
    let uri;
    if (!(uri = npm_uri_parse(module)))
      throw Error('invalid module name '+module);
    let ofile = uri.path.replace(/^\//, '')||'.';
    let {file, type} = npm_file_lookup(npm.pkg, ofile);
    if (!file)
      throw Error('no module export found for '+module);
    if (file=='.')
      throw Error('no module main '+module);
    return {nfile: file, type, redirect: file!=ofile, ofile,
      url: npm.cdn+'/'+npm.mod_ver+'/'+file};
  };
  // load package.json to locate module's index.js
  try {
    let urls = [];
    npm.wait = xpromise();
    npm_cdn.forEach(cdn=>urls.push(cdn+'/'+npm.mod_ver+'/package.json'));
    let {response, url, idx} = await fetch_try(log, urls);
    let msg = ' in '+module+' '+url;
    npm.cdn = npm_cdn[idx];
    let pkg = npm.pkg = await response.json();
    if (!pkg)
      throw Error('empty package.json '+msg);
    if (!pkg.version)
      throw Error('invalid package.json '+msg);
    let main;
    if (!(main = pkg.module || pkg.exports?.['.'] || pkg.main))
      throw Error('missing module main: '+module+' in '+url);
    if (typeof main=='string')
      npm.main = main;
    else if (main.default)
      npm.main = main.default;
    else
      throw Error('cannot parse main '+JSON.stringify(main)+msg);
    npm.wait.return();
  } catch(error){
    npm.wait.throw(error);
    throw(error);
  }
  await npm.wait;
  return npm;
}

async function _sw_fetch(event){
  let {request, request: {url}} = event;
  let u = url_parse(url);
  let ref = request.headers.get('referer');
  let external = u.origin!=self.location.origin;
  let log_mod = url+(ref && ref!=u.origin+'/' ? ' ref '+ref : '');
  let path = u.path;
  let log = function(){ if (!url.includes('react')) return; console.log(url, ...arguments); };
  log.l = log;
  log.mod = log_mod;
  if (request.method!='GET')
    return fetch(request);
  let v;
  log('Req '+url);
  let pkg = pkg_get(path);
  if (external)
    return fetch(request);
  if (path=='/favicon.ico')
    return await fetch('https://raw.githubusercontent.com/DustinBrett/daedalOS/refs/heads/main/public/favicon.ico');
  if (v=str_prefix(path, '/.lif/npm/')){
    let mod_id = v.rest, mod, type, body, load;
    if (mod = mod_get(mod_id)){
      // static module
      load = {url: mod.url, body: mod.body, type: mod.type, mod_id};
    } else {
      // npm module
      let npm = await npm_load(log, mod_id);
      let get = npm.file_lookup(mod_id);
      if (0 && get.redirect)
        return Response.redirect(get.url, 302);
      load = {url: get.url, type: get.type, mod_id};
    }
    if (load.body===undefined){
      let {response} = await fetch_try(log, load.url);
      load.body = await response.text();
    }
    let nbody = load.body;
    if (load.type && load.type!='esm')
      nbody = mod_to_esm(load);
    log(`module ${mod_id} loaded ${load.url}`);
    return new Response(nbody, {headers: headers.js});
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
      {headers: headers.js}
    );
  }
  if (['.jsx', '.tsx', '.ts'].includes(u.ext) || pkg?.ext && !u.ext){
    let response, res_status;
    log.l('babel '+u.ext, url);
    let urls = [], __url;
    if (u.ext)
      urls.push(url);
    else
      pkg.ext.forEach(ext=>urls.push(url+ext));
    ({response, url: __url} = await fetch_try(log, urls));
    if (response?.status!=200)
      return response;
    u = url_parse(__url);
    log.l('babel loaded module src '+__url);
    let body = await response.text();
    let opt = {presets: [], plugins: [], sourceMaps: true,
      generatorOpts: {'importAttributesKeyword': 'with'}}
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
    return new Response(res.code, {headers: headers.js});
  }
  if (v=str_prefix(path, '/.lif/pkgroot/')){
    let response = await fetch(path);
    return response;
    //let body = await response.text();
    //return new Response(res.code, {headers: headers.js});
  }
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
