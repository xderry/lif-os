/*global clients,importScripts*/ // ServiceWorkerGlobalScope

/*global Babel*/
importScripts('https://unpkg.com/@babel/standalone@7.26.4/babel.js');
let Babel = self.Babel;
// this is needed to activate the worker immediately without reload
// @see https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#clientsclaim
self.addEventListener('activate', event=>event.waitUntil(clients.claim()));

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
// shortcuts
let OF = Object.entries;
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
    if (msg.init=='init'){
      this.chan = event.ports[0];
      return true;
    }
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
  init_client(controller){
    this.chan = new MessageChannel();
    controller.postMessage({init: 'init'}, [this.chan.port2]);
    this.chan.port1.onmessage = event=>this.on_msg(event);
  }
}

// path.js
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
let npm_pkg = {};
let npm_file = {};

// see index.html for coresponding import maps
let npm_static = {
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
  'canvas-confetti': {type: 'cjs',
    url: 'https://unpkg.com/canvas-confetti@1.9.3/src/confetti.js',
    exports: qw`reset create shapeFromPath shapeFromText`,
  },
  */
  //'/lif_next_dynamic.js': {body:
  //  'export function dynamic(import_fn){ return import_fn(); }'},

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
for (const [name, m] of OF(npm_static)){
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

const npm_load_static = path=>{
  let mod, m, v, prefix;
  for (let name in npm_static){
    m = npm_static[name];
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

// require("file.js") -> (await require("file.js"))
let cjs_require_tr_await = function(js){
  // poor-man's require('module') scanner. in the future use a AST parser
  return js.replace(/\brequire\s*\(\s*(['"])([^'"\\]+)(['"])\s*\)/g,
    (match, q1, file, q2)=>
    `(await lb.require_single(module, ${q1}${file}${q2}))`);
};

const file_parse = f=>{
  if (f.parse)
    return f.parse;
  let parser = Babel.packages.parser;
  let traverse = Babel.packages.traverse.default;
  f.parse = parser.parse(f.body, {sourceType: 'script'});
  f.exports_cjs = [];
  traverse(f.parse, {
    AssignmentExpression: function(path){
      let n = path.node, l = n.left, r = n.right;
      if (n.operator=='=' &&
        l.type=='MemberExpression' &&
        l.object.name=='exports' && l.object.type=='Identifier' &&
        l.property.type=='Identifier')
      {
        f.exports_cjs.push(l.property.name);
      }
    },
  });
  return f.parse;
};

const file_body_amd = f=>{
  if (f.body_amd)
    return f.body_amd;
  let _exports = '';
  let uri_s = JSON.stringify(f.uri);
  file_parse(f);
  f.exports_cjs.forEach(e=>_exports +=
    `export const ${e} = mod.exports.${e};\n`);
  _exports += `export default mod.exports;\n`;
  return f.body_amd = `
    let lb = window.lif.boot;
    let define = function(id, deps, factory){
      return lb.define_amd(${uri_s}, arguments); };
    define.amd = {};
    let require = function(deps, cb){
      return lb.require_amd(${uri_s}, deps, cb); };
    (()=>{
    ${f.body}
    })();
    let mod = await lb.module_get(${uri_s});
    ${_exports}
  `;
};

const file_body_cjs_shim = async f=>{
  if (f.wait_body_cjs)
    return await f.wait_body_cjs;
  let p = f.wait_body_cjs = xpromise();
  let uri_s = JSON.stringify(f.uri);
  let _exports = '';
  let res = await app_chan.cmd('import', {url: '/.lif/npm.cjs'+f.uri});
  f.exports_cjs_shim = res.exports;
  f.exports_cjs_shim.forEach(e=>_exports +=
    `export const ${e} = _exports.${e};\n`);
  return p.return(f.body_cjs_shim = `
    import _export from ${JSON.stringify()};
    let mod = await lb.module_get(${uri_s});
    export default _export;
    ${_exports}
  `);
};

const file_body_global = f=>{
  if (f.body_global)
    return f.body_global;
  return f.body_global = `
    (()=>{
    ${f.body}
    })();
    export default window.${f.static.global};
  `;
}

const file_body_cjs = f=>{
  if (f.body_cjs)
    return f.body_cjs;
  let uri_s = JSON.stringify(f.uri);
  f.requires_cjs = cjs_require_scan(f.body);
  f.body_cjs_tr = cjs_require_tr_await(f.body);
  return f.body_cjs = `
    let lb = window.lif.boot;
    let module = {exports: {}};
    let exports = module.exports;
    let process = {env: {}};
    let require = module=>lb.require_cjs(${uri_s}, module);
    (()=>{
    ${f.body_cjs_tr}
    })();
    export default module.exports;
  `;
}

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
async function npm_pkg_load(log, uri){
  let npm, _uri, mod_ver, npm_s;
  if (!(_uri = npm_uri_parse(uri)))
    throw Error('invalid module name '+uri);
  mod_ver = _uri.name+_uri.version;
  if (npm = npm_pkg[mod_ver])
    return await npm.wait;
  npm = npm_pkg[mod_ver] = {uri, _uri, mod_ver, wait: xpromise()};
  npm.file_lookup = uri=>{
    let _uri;
    if (!(_uri = npm_uri_parse(uri)))
      throw Error('invalid module name '+uri);
    let ofile = _uri.path.replace(/^\//, '')||'.';
    let {file, type} = npm_file_lookup(npm.pkg, ofile);
    if (!file)
      throw Error('no module export found for '+uri);
    if (file=='.')
      throw Error('no module main '+uri);
    return {nfile: file, type, redirect: file!=ofile, ofile,
      url: npm.cdn+'/'+npm.mod_ver+'/'+file};
  };
  if ((npm_s = npm_load_static(mod_ver)) || (npm_s = npm_load_static(uri))){
    npm.static = npm_s;
    npm.pkg = npm_s.pkg;
    npm.body = npm_s.body;
    npm.type = npm_s.type;
    npm.url = npm_s.url;
    if (npm.body===undefined){
      let {response} = await fetch_try(log, npm.url);
      npm.body = await response.text();
    }
    return npm.wait.return(npm);
  }
  // load package.json to locate module's index.js
  try {
    let urls = [];
    npm_cdn.forEach(cdn=>urls.push(cdn+'/'+npm.mod_ver+'/package.json'));
    let {response, url, idx} = await fetch_try(log, urls);
    let msg = ' in '+uri+' '+url;
    npm.cdn = npm_cdn[idx];
    let pkg = npm.pkg = await response.json();
    if (!pkg)
      throw Error('empty package.json '+msg);
    if (!pkg.version)
      throw Error('invalid package.json '+msg);
    let main;
    if (!(main = pkg.module || pkg.exports?.['.'] || pkg.main))
      throw Error('missing module main: '+uri+' in '+url);
    if (typeof main=='string')
      npm.main = main;
    else if (main.default)
      npm.main = main.default;
    else
      throw Error('cannot parse main '+JSON.stringify(main)+msg);
    return npm.wait.return(npm);
  } catch(err){
    npm.wait.throw(err);
    throw(err);
  }
}

async function npm_file_load(log, uri){
  log('npm_file_load');
  let file, _uri;
  if (!(_uri = npm_uri_parse(uri)))
    throw Error('invalid module name '+uri);
  if (file = npm_file[uri])
    return await file.wait;
  file = npm_file[uri] = {uri, _uri, wait: xpromise()};
  file.npm = await npm_pkg_load(log, uri);
  let {url, type} = file.npm.file_lookup(uri);
  let {response} = await fetch_try(log, url);
  file.body = await response.text();
  return file.wait.return(file);
}
 
let app_chan;
async function _sw_fetch(event){
  let {request, request: {url}} = event;
  let u = url_parse(url);
  let ref = request.headers.get('referer');
  let external = u.origin!=self.location.origin;
  let log_mod = url+(ref && ref!=u.origin+'/' ? ' ref '+ref : '');
  let path = u.path;
  let log = function(){ if (!url.includes('')) return; console.log(url, ...arguments); };
  log.l = log;
  log.mod = log_mod;
  if (request.method!='GET')
    return fetch(request);
  let v, cjs;
  log('Req '+url);
  let pkg = pkg_get(path);
  if (external)
    return fetch(request);
  if (path=='/favicon.ico')
    return await fetch('https://raw.githubusercontent.com/DustinBrett/daedalOS/refs/heads/main/public/favicon.ico');
  if (v=str_prefix(path, '/.lif/npm/')){
    log('npm');
    let uri = v.rest;
    let f = await npm_file_load(log, uri);
    if (f.type=='global')
      body = file_body_global(f);
    else if (f.type=='amd'){
      body = file_body_amd(f);
    } else if (f.type=='cjs'){
      body = await file_body_cjs_shim(f);
    } else
      body = f.body;
    log(`module ${uri} loaded ${f.url}`);
    return new Response(f.body, {headers: headers.js});
  }
  if (v=str_prefix(path, '/.lif/npm.cjs/')){
    log('npm.cjs');
    let uri = v.rest;
    let f = await npm_file_load(log, uri);
    f.cjs = true;
    f.body = await file_body_cjs(f);
    log(`module ${uri} loaded ${f.url}`);
    return new Response(f.body, {headers: headers.js});
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

function sw_init(){
  let count = 0;
  self.addEventListener("message", event=>{
    console.log('sw msg', msg);
    if (app_chan.listen(event))
      console.log('sw msg handled', msg.id);
    return;
  });
  self.addEventListener('fetch', event=>{
    try {
      event.respondWith(sw_fetch(event));
    } catch (err){
      console.error("ServiceWorker NetworkError: "+err);
    }
  });
}

sw_init();

