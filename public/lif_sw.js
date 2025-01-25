/*global importScripts*/ // ServiceWorkerGlobalScope
// service worker must register handlers on first run (not async)
let lif_sw;
const ewait = ()=>{
  let _return, _throw;
  let promise = new Promise((resolve, reject)=>{
    _return = ret=>{ resolve(ret); return ret; };
    _throw = err=>{ reject(err); return err; };
  });
  promise.return = _return;
  promise.throw = _throw;
  return promise;
};
const esleep = ms=>{
  let p = ewait();
  setTimeout(()=>p.return(), ms);
  return p;
};
const eslow = (ms, arg)=>{
  let done, timeout;
  let p = (async()=>{
    await esleep(ms);
    timeout = true;
    if (!done)
      console.log('slow timeout('+ms+')', ...arg);
  })();
  eslow.set.add(p);
  p.end = ()=>{
    eslow.set.delete(p);
    if (timeout && !done)
      console.log('slow timeout('+ms+') done', ...arg);
    done = true;
  };
  p.print = ()=>console.log('slow print', ...arg);
  return p;
};
eslow.set = new Set();
eslow.print = ()=>{
  console.log('eslow print');
  for (let p of eslow.set)
    p.print();
}
self.esb = eslow;

lif_sw = {
  on_message: null,
  on_fetch: null,
  wait_activate: ewait(),
};

function sw_init_pre(){
  // this is needed to activate the worker immediately without reload
  // @see https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#clientsclaim
  self.addEventListener('activate', event=>event.waitUntil((async()=>{
    await self.clients.claim();
    await lif_sw.wait_activate;
  })()));
  self.addEventListener("message", event=>{
    if (!lif_sw.on_message)
      console.error('sw message event before inited');
    lif_sw.on_message(event);
  });
  self.addEventListener('fetch', event=>{
    if (!lif_sw.on_fetch)
      console.error('sw message fetch('+event.request.url+') event before inited');
    lif_sw.on_fetch(event);
  });
}
sw_init_pre();

(async()=>{
// service worker import() implementation
let import_modules = {};
let import_module = async(url)=>{
  let mod;
  if (mod = import_modules[url])
    return await mod.wait;
  mod = import_modules[url] = {url, wait: ewait()};
  try {
    let response = await fetch(url);
    if (response.status!=200)
      throw Error('import('+url+') failed fetch');
    let body = await response.text();
    let body_tr = body.replace(/\nexport default ([^;]+);\n/,
      (match, _export)=>'\n;module.exports = '+_export+';\n');
    mod.script = `'use strict';
      let module = {exports: {}};
      let exports = module.exports;
      (()=>{
      ${body_tr}
      })();
      module.exports;
    `;
  } catch(err){
    console.error('import('+url+') failed', err);
    throw mod.wait.throw(err);
  }
  try {
    mod.exports = await eval(mod.script);
    return mod.wait.return(mod.exports);
  } catch(err){
    console.error('import('+url+') failed eval', err, err?.stack);
    throw mod.wait.throw(err);
  }
};

let Babel = await import_module('https://unpkg.com/@babel/standalone@7.26.4/babel.js');
let util = await import_module('./lif_util.js');
let {postmessage_chan, str, OF, path_ext, path_file, path_dir, path_is_dir,
  url_parse, uri_parse, npm_uri_parse} = util;
let {qw} = str;

const npm_modver = uri=>uri.name+uri.version;
let npm_cdn = ['https://cdn.jsdelivr.net/npm',
  //'https://unpkg.com',
];
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
  'react/jsx-runtime': {type: 'mjs',
    url: 'https://unpkg.com/jsx-runtime@1.2.0/index.js'},
  'react-dom': {type: 'amd',
    url: 'https://unpkg.com/react-dom@18/umd/react-dom.development.js',
    exports: qw`__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
      createPortal createRoot findDOMNode flushSync hydrate hydrateRoot render
      unmountComponentAtNode unstable_batchedUpdates
      unstable_renderSubtreeIntoContainer version`,
  },
  'canvas-confetti': {type: 'cjs',
    url: 'https://unpkg.com/canvas-confetti@1.9.3/src/confetti.js',
    exports: qw`reset create shapeFromPath shapeFromText`,
  },
  */
  //'/lif_next_dynamic.js': {body:
  //  'export function dynamic(import_fn){ return import_fn(); }'},

  /*
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
  */
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
    if (m.is_dir && (v=str.prefix(path, name))){
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

const file_parse = f=>{
  if (f.parse)
    return f.parse;
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
  f.exports_cjs.forEach(e=>{
    if (e=='default')
      return;
    _exports += `export const ${e} = mod.exports.${e};\n`;
  });
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

const file_body_cjs_shim = async(log, f)=>{
  if (f.wait_body_cjs)
    return await f.wait_body_cjs;
  let p = f.wait_body_cjs = ewait();
  let uri_s = JSON.stringify(f.uri);
  let _exports = '';
  log('call import('+f.uri+')');
  let npm_cjs_uri = '/.lif/npm.cjs/'+f.uri;
  let res = await app_chan.cmd('import', {url: npm_cjs_uri});
  log('ret  import('+f.uri+')', res);
  f.exports_cjs_shim = res.exports;
  f.exports_cjs_shim.forEach(e=>{
    if (e=='default')
      return;
    _exports += `export const ${e} = _export.${e};\n`;
  });
  return p.return(f.body_cjs_shim = `
    import _export from ${JSON.stringify(npm_cjs_uri)};
    //let mod = await lb.require_cjs_shim(${uri_s});
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

let ast_get_scope_type = path=>{
  for (; path; path=path.parentPath){
    let b = path.scope.block;
    if (b.async)
      return 'async';
    if (b.type=='FunctionExpression' ||
      b.type=='ArrowFunctionExpression' ||
      b.type=='FunctionDeclaration')
    {
      return b.async ? 'async' : 'sync';
    }
    if (b.type=='Program')
      return 'program';
  }
};

let parser = Babel.packages.parser;
let traverse = Babel.packages.traverse.default;
let file_ast = f=>{
  try {
    f.ast = parser.parse(f.body, {sourceType: 'module'});
  } catch(err){
    throw Error('fail parse('+f.uri+'):'+err);
  }
  f.ast_exports = [];
  f.ast_requires = [];
  traverse(f.ast, {
    AssignmentExpression: path=>{
      let n = path.node, l = n.left, r = n.right, v;
      if (n.operator=='=' &&
        l.type=='MemberExpression' &&
        l.object.name=='exports' && l.object.type=='Identifier' &&
        l.property.type=='Identifier')
      {
        f.ast_exports.push(v=l.property.name);
      }
    },
    CallExpression: path=>{
      let n = path.node, v;
      if (n.callee.type=='Identifier' && n.callee.name=='require' &&
        n.arguments.length==1 && n.arguments[0].type=='StringLiteral')
      {
        v = n.arguments[0].value;
        let type = ast_get_scope_type(path);
        f.ast_requires.push({module: v, start: n.start, end: n.end, type});
      }
    },
  });
};

let cjs_require_tr_await = f=>{
  let s = '', src = f.body, pos = 0;
  for (let r of f.ast_requires){
    s += src.slice(pos, r.start);
    if (r.type=='sync'){
      pos = r.start;
      continue;
    }
    s += '(await require_async('+JSON.stringify(r.module)+'))';
    pos = r.end;
  }
  s += src.slice(pos);
  return s;
};

const file_body_cjs = f=>{
  if (f.body_cjs)
    return f.body_cjs;
  let uri_s = JSON.stringify(f.uri);
  f.requires_cjs = cjs_require_scan(f.body);
  file_ast(f);
  let tr = cjs_require_tr_await(f);
  let pre = '';
  for (let r of f.ast_requires){
    if (r.type=='sync')
      pre += 'await require_async('+JSON.stringify(r.module)+');\n';
  }
  return f.body_cjs = `
    let lb = window.lif.boot;
    let module = {exports: {}};
    let exports = module.exports;
    let process = {env: {}};
    let require = module=>lb.require_cjs(${uri_s}, module);
    let require_async = async(module)=>await lb.require_single(${uri_s}, module);
    ${pre}
    await (async()=>{
    ${tr}
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
  if (v=str.prefix(path, '/.lif/pkgroot/')){
    let name = '/'+v.rest;
    for (let i in pkg_map){
      if (v=str.prefix(name, i))
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
    throw Error('failed fetch module '+urls[0]+' for '+log.mod);
  return {response, url, idx};
}

// TODO support longer matches first /a/b/c matches before /a/b
let file_match = (file, match)=>{
  let v;
  if (!str.prefix(file, './'))
    return;
  if (!(v=str.prefix(file, match)))
    return;
  if (v.rest && !path_is_dir(file))
    return;
  return true;
};
// parse package.exports
// https://webpack.js.org/guides/package-exports/
let npm_file_lookup = (pkg, file)=>{
  let check_val = (res, dst, type)=>{
    let v;
    if (typeof dst!='string')
      return;
    if (!dst.includes('*')){
      res.push(v = {file: dst, type});
      return v;
    }
    let dfile = path_file(dst);
    let ddir = path_dir(dst);
    if (ddir.includes('*') || dfile!='*')
      throw Error('module('+pkg.name+' dst match * ('+dst+') unsupported');
    res.push(v = {file: dst.slice(dst.length-1)+dfile, type});
    return v;
  };
  let patmatch = match=>{
    if (!match.includes('*'))
      return file_match(file, match);
    let mfile = path_file(match);
    let mdir = path_dir(match);
    if (!file_match(file, mdir))
      return;
    if (mfile=='*')
      return true;
    throw Error('module('+pkg.name+' dst match * ('+match+') unsupported');
  };
  let parse_val = (res, v)=>{
    if (typeof v=='string')
      return check_val(res, v, null);
    if (typeof v!='object')
      return;
    if (Array.isArray(v)){
      for (let e of v){
        if (parse_val(e))
          return;
      }
      return;
    }
    return check_val(res, v.import, 'mjs') ||
      check_val(res, v.default, 'cjs') ||
      check_val(res, v.require, 'amd');
  };
  let parse_section = val=>{
    let v, res = [];
    for (let match in val){
      v = val[match];
      if (!patmatch(match))
        continue;
      parse_section(v);
    }
    if (res.length)
      return;
    let best = res[0];
    res.forEach(r=>{
      if (r.file.length > best.file.length)
        best = r;
    });
    return best;
  }
  let parse_pkg = ()=>{
    let exports = pkg.exports, v;
    if (typeof exports=='string')
      exports = {'.': exports};
    if (v = parse_section(exports))
      return v;
    if (file=='.'){
      return check_val([], pkg.module, 'mjs') ||
        check_val([], pkg.main, 'cjs') ||
        check_val([], 'index.js', 'cjs');
    }
    if (v = parse_section(pkg.browser))
      return v;
  };
  // start package.json lookup
  let v = parse_pkg();
  if (!v)
    v = {file};
  let mfile = path_file(v.file);
  if (mfile && !mfile.includes('.'))
    v.file = mfile+'.js';
  return v;
};

async function npm_pkg_load(log, uri){
  let npm, _uri, mod_ver, npm_s;
  if (!(_uri = npm_uri_parse(uri)))
    throw Error('invalid module name '+uri);
  mod_ver = npm_modver(_uri);
  if (npm = npm_pkg[mod_ver])
    return await npm.wait;
  npm = npm_pkg[mod_ver] = {uri, _uri, mod_ver, wait: ewait()};
  npm.file_lookup = uri=>{
    let _uri, redirect;
    if (!(_uri = npm_uri_parse(uri)))
      throw Error('invalid module name '+uri);
    let ofile = _uri.path.replace(/^\//, '')||'.';
    let {file, type} = npm_file_lookup(npm.pkg, ofile);
    let nuri = '/'+npm.mod_ver+'/'+(file||ofile);
    if (!file)
      type = npm.type;
    else if (file!=ofile)
      redirect = nuri;
    type ||= npm.type;
    return {type, redirect, nuri};
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
    let {file, type} = npm_file_lookup(npm.pkg, '.');
    npm.type = type;
    return npm.wait.return(npm);
  } catch(err){
    throw npm.wait.throw(err);
  }
}

async function npm_file_load(log, uri){
  let file, _uri;
  if (!(_uri = npm_uri_parse(uri)))
    throw Error('invalid module name '+uri);
  if (file = npm_file[uri])
    return await file.wait;
  file = npm_file[uri] = {uri, _uri, wait: ewait()};
  file.npm = await npm_pkg_load(log, uri);
  let v;
  let {nuri, type, redirect} = v = file.npm.file_lookup(uri);
  file.nuri = nuri;
  file.url = npm_cdn[0]+nuri;
  file.type = type;
  file.redirect = redirect;
  if (file.redirect)
    return file.wait.return(file);
  let {response} = await fetch_try(log, file.url);
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
  let log = function(){ if (!url.includes('fs_stats')) return; console.log(url, ...arguments); };
  log.l = log;
  log.mod = log_mod;
  if (request.method!='GET')
    return fetch(request);
  let v, cjs;
  log('Req');
  let pkg = pkg_get(path);
  if (external)
    return fetch(request);
  if (path=='/favicon.ico')
    return await fetch('https://raw.githubusercontent.com/DustinBrett/daedalOS/refs/heads/main/public/favicon.ico');
  if (v=str.prefix(path, '/.lif/npm/')){
    let uri = v.rest, body;
    let f = await npm_file_load(log, uri);
    if (f.redirect){
      log(`module ${uri} -> ${f.nuri}`);
      return Response.redirect('/.lif/npm'+f.nuri);
    }
    log('npm', f.type);
    if (f.type=='raw')
      body = f.body;
    if (f.type=='global')
      body = file_body_global(f);
    else if (f.type=='amd')
      body = file_body_amd(f);
    else if (f.type=='cjs' || !f.type){
      body = await file_body_cjs_shim(log, f);
    } else
      body = f.body;
    log(`module ${uri} loaded ${f.uri}`);
    return new Response(body, {headers: headers.js});
  }
  if (v=str.prefix(path, '/.lif/npm.cjs/')){
    log('npm.cjs');
    let uri = v.rest;
    let f = await npm_file_load(log, uri);
    let tr = file_body_cjs(f);
    log(`module ${uri} loaded ${f.url}`);
    return new Response(tr, {headers: headers.js});
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
  if (v=str.prefix(path, '/.lif/pkgroot/')){
    let response = await fetch(path);
    return response;
    //let body = await response.text();
    //return new Response(res.code, {headers: headers.js});
  }
  return await fetch(request);
}

async function sw_fetch(event){
  let slow;
  try {
    slow = eslow(5000, ['_sw_fetch timeout', event.request.url]);
    let res = await _sw_fetch(event);
    slow.end();
    return res;
  } catch (err){
    slow.end();
    console.error('ServiceWorker sw_fetch err', err);
    return new Response(''+err, {status: 500, statusText: ''+err});
  }
}

function sw_init_post(){
  app_chan = new util.postmessage_chan();
  lif_sw.on_message = event=>{
    if (app_chan.listen(event))
      return;
  };
  lif_sw.on_fetch = event=>{
    try {
      event.respondWith(sw_fetch(event));
    } catch (err){
      console.error("ServiceWorker NetworkError: "+err);
    }
  };
  lif_sw.wait_activate.return();
}
sw_init_post();
})();

