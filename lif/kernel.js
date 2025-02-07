// LIF BIOS (Basic Input Output System)
let lif_version = '0.2.50';

const ewait = ()=>{
  let _return, _throw;
  let promise = new Promise((resolve, reject)=>{
    _return = ret=>{ resolve(ret); return ret; };
    _throw = err=>{ reject(err); return err; };
  });
  promise.return = _return;
  promise.throw = _throw;
  promise.catch(err=>{}); // catch un-waited wait() objects. avoid Uncaught in promise
  return promise;
};

let lif_kernel = {
  on_message: null,
  on_fetch: null,
  wait_activate: ewait(),
  version: lif_version,
};

// service worker must register handlers on first run (not async)
function sw_init_pre(){
  // this is needed to activate the worker immediately without reload
  // @see https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#clientsclaim
  self.addEventListener('activate', event=>event.waitUntil((async()=>{
    await lif_kernel.wait_activate;
    await self.clients.claim();
  })()));
  self.addEventListener("message", event=>{
    if (!lif_kernel.on_message)
      console.error('sw message event before inited', event);
    lif_kernel.on_message(event);
  });
  self.addEventListener('fetch', event=>{
    if (!lif_kernel.on_fetch)
      console.error('sw fetch('+event.request.url+') event before inited');
    lif_kernel.on_fetch(event);
  });
}
sw_init_pre();

(async()=>{try {
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
      throw Error('sw import_module('+url+') failed fetch');
    let body = await response.text();
    let tr = body.replace(/\nexport default ([^;]+);\n/,
      (match, _export)=>'\n;module.exports = '+_export+';\n');
    mod.script = `'use strict';
      let module = {exports: {}};
      let exports = module.exports;
      (()=>{
      ${tr}
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
let util = await import_module('/lif/util.js');
let {postmessage_chan, str, OF, path_ext, path_file, path_dir, path_is_dir,
  url_parse, uri_parse, url_uri_parse, npm_uri_parse, npm_modver,
  esleep, eslow} = util;
let {qw} = str;
let json = JSON.stringify;
let clog = console.log.bind(console);
let cerr = console.error.bind(console);

let npm_cdn = ['https://cdn.jsdelivr.net/npm',
  //'https://unpkg.com',
];
let npm_map = {
  'lif.app': {base: '/lif.app'},
  'next': {base: '/lif', pkg: {exports: {dynamic: 'next_dynamic.js'}}},
};
let npm_pkg = {};
let npm_file = {};

// see index.html for coresponding import maps
let npm_static = {
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

let parser = Babel.packages.parser;
let traverse = Babel.packages.traverse.default;

let ast_get_scope_type = path=>{
  for (; path; path=path.parentPath){
    if (path.type=='TryStatement')
      return 'try';
    let b = path.scope.block;
    if (b.type=='FunctionExpression' ||
      b.type=='ArrowFunctionExpression' ||
      b.type=='FunctionDeclaration')
    {
      return b.async ? 'async' : 'sync';
    }
    if (b.type=='CatchClause')
      return 'catch';
    if (b.type=='Program')
      return 'program';
  }
};

let file_ast = f=>{
  if (f.ast)
    return;
  let tr_jsx_ts = ()=>{
    let ext = path_ext(f.uri);
    f.ast_is_ts = ext=='.ts' || ext=='.tsx';
    f.ast_is_jsx = ext=='.jsx' || ext=='.tsx';
    f.js = f.body;
    if (f.ast_is_ts || f.ast_is_jsx){
      let opt = {presets: [], plugins: [], sourceMaps: true,
        generatorOpts: {importAttributesKeyword: 'with'}};
      if (f.ast_is_ts){
        opt.presets.push('typescript');
        opt.filename = path_file(f.uri);
      }
      if (f.ast_is_jsx)
        opt.presets.push('react');
      try {
        ({code: f.js} = Babel.transform(f.body, opt));
      } catch (err){
        console.error('babel('+f.uri+') FAILED', err);
        throw err;
      }
    }
  };

  let parse_ast = ()=>{
    let opt = f.ast_opt = {presets: [], plugins: []};
    if (f.ast_is_ts)
      opt.plugins.push('typescript');
    if (f.ast_is_jsx)
      opt.plugins.push('jsx');
    opt.sourceType = 'module';
    try {
      f.ast = parser.parse(f.js, opt);
    } catch(err){
      throw Error('fail ast parse('+f.uri+'):'+err);
    }
  };

  let scan_ast = ()=>{
    f.ast_exports = [];
    f.ast_requires = [];
    f.ast_imports = [];
    f.ast_imports_dyn = [];
    let has_require, has_import, has_export, has_await;
    traverse(f.ast, {
      AssignmentExpression: path=>{
        let n = path.node, l = n.left, r = n.right;
        if (n.operator=='=' &&
          l.type=='MemberExpression' &&
          l.object.name=='exports' && l.object.type=='Identifier' &&
          l.property.type=='Identifier')
        {
          f.ast_exports.push(l.property.name);
        }
      },
      CallExpression: path=>{
        has_require = true;
        let n = path.node, v;
        if (n.callee.type=='Identifier' && n.callee.name=='require' &&
          n.arguments.length==1 && n.arguments[0].type=='StringLiteral')
        {
          v = n.arguments[0].value;
          let type = ast_get_scope_type(path);
          f.ast_requires.push({module: v, start: n.start, end: n.end, type});
        }
        if (n.callee.type=='Import')
          f.ast_imports_dyn.push({start: n.callee.start, end: n.callee.end});
      },
      ImportDeclaration: path=>{
        has_import = true;
        let n = path.node, v;
        if (n.source.type=='StringLiteral'){
          let s = n.source;
          v = s.value;
          let type = ast_get_scope_type(path);
          f.ast_imports.push({module: v, start: s.start, end: s.end, type});
        }
      },
      ExportNamedDeclaration: path=>{ has_export = true; },
      ExportDefaultDeclaration: path=>{ has_export = true; },
      ExportAllDeclaration: path=>{ has_export = true; },
      AwaitExpression: path=>{
        let type = ast_get_scope_type(path);
        if (type=='program')
          has_await = true;
      },
    });
    f.type_ast = has_import||has_export||has_await ? 'mjs' :
      has_require ? 'cjs' : '';
  };

  let ext = path_ext(f.uri);
  if (ext=='.json'){
    f.type = 'json';
    return;
  }
  tr_jsx_ts();
  parse_ast();
  scan_ast();
  f.type = f.type_ast||f.type_lookup;
};

const file_tr_amd = f=>{
  if (f.tr_amd)
    return f.tr_amd;
  let _exports = '';
  let uri_s = json(f.uri);
  f.ast_exports.forEach(e=>{
    if (e=='default')
      return;
    _exports += `export const ${e} = mod.exports.${e};\n`;
  });
  _exports += `export default mod.exports;\n`;
  return f.tr_amd = `
    let lif_boot = window.lif.boot;
    let define = function(id, deps, factory){
      return lif_boot.define_amd(${uri_s}, arguments); };
    define.amd = {};
    let require = function(deps, cb){
      return lif_boot.require_cjs_amd(${uri_s}, arguments); };
    (()=>{
    ${f.js}
    })();
    let mod = await lif_boot.module_get(${uri_s});
    ${_exports}
  `;
};

const file_tr_cjs_shim = async(f)=>{
  if (f.wait_tr_cjs)
    return await f.wait_tr_cjs;
  let p = f.wait_tr_cjs = ewait();
  let uri_s = json(f.uri);
  let _exports = '';
  let npm_cjs_uri = '/.lif/npm.cjs/'+f.uri;
  f.log('call import('+npm_cjs_uri+')');
  let res = await kern_chan.cmd('import', {url: npm_cjs_uri});
  f.log('ret  import('+npm_cjs_uri+')', res);
  f.exports_cjs_shim = res.exports;
  f.exports_cjs_shim.forEach(e=>{
    if (e=='default')
      return;
    _exports += `export const ${e} = _export.${e};\n`;
  });
  return p.return(f.tr_cjs_shim = `
    import _export from ${json(npm_cjs_uri)};
    export default _export;
    ${_exports}
  `);
};

let tr_cjs_require = f=>{
  let s = '', src = f.js, pos = 0;
  for (let r of f.ast_requires){
    s += src.slice(pos, r.start);
    if (r.type=='sync' || r.type=='try'){
      pos = r.start;
      continue;
    }
    s += '(await require_async('+json(r.module)+'))';
    pos = r.end;
  }
  s += src.slice(pos);
  return s;
};

const file_tr_cjs = f=>{
  if (f.tr_cjs)
    return f.tr_cjs;
  let uri_s = json(f.uri);
  let tr = tr_cjs_require(f);
  let pre = '';
  for (let r of f.ast_requires){
    if (r.type=='sync')
      pre += 'await require_async('+json(r.module)+');\n';
  }
  return f.tr_cjs = `
    let lif_boot = window.lif.boot;
    let module = {exports: {}};
    let exports = module.exports;
    let process = lif_boot.process;
    let require = module=>lif_boot.require_cjs(${uri_s}, module);
    let require_async = async(module)=>await lif_boot.require_single(${uri_s}, module);
    let define = function(id, deps, factory){
      return lif_boot.define_amd(${uri_s}, arguments, module); };
    define.amd = {};
    ${pre}
    await (async()=>{
    ${tr}
    })();
    export default module.exports;
  `;
}

let str_splice = (s, at, len, add)=>s.slice(0, at)+add+s.slice(at+len);

let tr_mjs_import = f=>{
  let tr_import = uri=>{
    let v, do_log = 0;
    let u = url_uri_parse(uri);
    if (u.is_based)
      return;
    if (!(u = npm_uri_parse(uri)))
      return void console.error('invalid npm tr import('+uri+')');
    if (v = f.npm.pkg.lif?.modmap?.[u.name+u.version]){
      if (v.startsWith('/'))
        v = 'lif.app'+v;
      uri = v+u.path;
    }
    if (!(u = npm_uri_parse(uri)))
      return void console.error('invalid npm tr import('+uri+')');
    if (!u.version)
    {
      u.version = npm_dep_ver_lookup(f.npm.pkg, uri)||'';
      if (u.version)
        do_log && console.log('import('+f.npm.base+': '+uri+') -> '+u.version);
    }
    return '/.lif/npm/'+u.name+u.version+u.path;
  };
  let s = '', src = f.js, pos = 0, v;
  for (let r of f.ast_imports){
    s += src.slice(pos, r.start);
    pos = r.start;
    if (!(v=tr_import(r.module)))
      continue;
    s += json(v);
    pos = r.end;
  }
  for (let r of f.ast_imports_dyn){
    s += src.slice(pos, r.start);
    pos = r.start;
    s += 'import_lif';
    pos = r.end;
  }
  s += src.slice(pos);
  return s;
};

const file_tr_mjs = f=>{
  if (f.tr_mjs)
    return f.tr_mjs;
  let uri_s = json(f.uri);
  let tr = tr_mjs_import(f);
  return f.tr_mjs = `
    let lif_boot = window.lif.boot;
    let import_lif = function(){ return lif_boot._import(${uri_s}, arguments); };
    ${tr}
  `;
};

let headers = {
  js: new Headers({'content-type': 'application/javascript'}),
  json: new Headers({'content-type': 'application/json'}),
  plain: new Headers({'content-type': 'plain/text'}),
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

let npm_dep_ver_lookup = (pkg, module)=>{
  let get_dep = dep=>{
    let ver, m, op;
    if (!(ver = dep?.[module]))
      return;
    ver = ver.replaceAll(' ', '');
    if (!(m = ver.match(/^([^0-9.]*)([0-9.]+)$/)))
      return void console.log('invalid dep('+module+') version '+ver);
    [, op, ver] = m;
    if (op=='>=')
      return;
    if (!(op=='^' || op=='=' || op==''))
      return void console.log('invalid dep('+module+') op '+op);
    return '@'+ver;
  };
  let ver
  if (ver = get_dep(pkg.dependencies))
    return ver;
  if (ver = get_dep(pkg.peerDependencies))
    return ver;
  if (ver = get_dep(pkg.devDependencies))
    return ver;
};

// TODO support longer matches first /a/b/c matches before /a/b
let file_match = (file, match)=>{
  let v, f = file, m = match;
  while (v=str.prefix(f, './'))
    f = v.rest;
  while (v=str.prefix(m, './'))
    m = v.rest;
  if (!(v=str.prefix(f, m)))
    return;
  if (v.rest && !path_is_dir(f))
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
    res.push(v = {file: dst.slice(0, -1)+dfile, type});
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
    return check_val(res, v.module, 'mjs') ||
      check_val(res, v.import, 'mjs') ||
      check_val(res, v.default, 'cjs') ||
      check_val(res, v.require, 'amd');
  };
  let parse_section = val=>{
    let v, res = [];
    for (let match in val){
      v = val[match];
      if (!patmatch(match))
        continue;
      parse_val(res, v);
    }
    let best = res[0];
    if (!best)
      return;
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
        check_val([], pkg.browser, 'cjs') ||
        check_val([], pkg.main, 'cjs') ||
        check_val([], 'index.js', 'cjs');
    }
    if (v = parse_section(pkg.browser))
      return v;
  };
  // start package.json lookup
  let v;
  let {file: f, type} = parse_pkg()||{file};
  type ||= pkg.lif?.type;
  if (f.startsWith('./'))
    f = f.slice(2);
  let alt, _alt = pkg.lif?.alt||['.js'];
  if (!['.js', '.json', '.css', '.mjs', '.esm', '.jsx', '.ts', '.tsx']
    .find(e=>f.endsWith(e)) && !_alt.find(e=>f.endsWith(e)))
  {
    alt = _alt;
  }
  return {file: f, type, alt};
};

async function npm_pkg_load(log, modver){
  let npm, npm_s;
  if (npm = npm_pkg[modver])
    return await npm.wait;
  npm = npm_pkg[modver] = {modver, wait: ewait(), log};
  npm.file_lookup = uri=>{
    let {path} = npm_uri_parse(uri);
    let ofile = path.replace(/^\//, '')||'.';
    let {file, type, alt} = npm_file_lookup(npm.pkg, ofile);
    let nfile = file||ofile;
    let redirect;
    if (nfile && nfile!=ofile)
      redirect = '/.lif/npm/'+npm.modver+'/'+nfile;
    type ||= npm.type;
    return {type, redirect, nfile, alt};
  };
  // load package.json to locate module's index.js
  try {
    let map = npm_map[npm.modver];
    npm.base = map ? map.base : npm_cdn+'/'+npm.modver;
    if (npm.pkg = map?.pkg)
      return npm.wait.return(npm);
    let u = npm_uri_parse(npm.modver);
    let url = npm.base+'/package.json';
    let response = await fetch(url);
    if (response.status!=200)
      throw Error('module('+log.mod+') failed fetch '+url);
    let pkg = npm.pkg = await response.json();
    if (!pkg)
      throw Error('empty package.json '+url);
    if (!(npm.version = pkg.version))
      throw Error('invalid package.json '+url);
    if (!u.version && !map)
      npm.redirect = '/.lif/npm/'+u.name+'@'+npm.version+u.path;
    return npm.wait.return(npm);
  } catch(err){
    throw npm.wait.throw(err);
  }
}

async function npm_file_load(log, uri, test_alt){
  let file, do_log = false, npm;
  if (file = npm_file[uri])
    return await file.wait;
  file = npm_file[uri] = {uri, wait: ewait(), log};
  npm = file.npm = await npm_pkg_load(log, npm_modver(uri));
  if (npm.redirect){
    let u = npm_uri_parse(uri);
    return file.wait.return({redirect: npm.redirect+u.path});
  }
  let {nfile, type, redirect, alt} = npm.file_lookup(uri);
  file.nfile = nfile;
  file.url = npm.base+'/'+nfile;
  file.type_lookup = type;
  file.redirect = redirect;
  file.alt = alt;
  if (file.redirect)
    return file.wait.return(file);
  // fetch the file
  let response = await fetch(file.url);
  if (response.status!=200){
    if (test_alt)
      throw file.wait.throw(Error('fetch failed '+file.url));
    if (alt){
      let afile, err;
      loop: for (let a of alt){
        try {
          afile = await npm_file_load(log, uri+a, true);
          break loop;
        } catch(err){}
      }
      if (afile){
        file.redirect = '/.lif/npm/'+afile.uri;
        do_log && console.log('fetch OK redirect '+file.url);
        return file.wait.return(file);
      }
    }
    let e = 'module('+log.mod+(alt ? ' alt '+alt.join(' ') : '')+
      ') failed fetch '+file.url;
    console.error(e);
    throw file.wait.throw(Error(e));
  }
  file.body = await response.text();
  do_log && console.log('fetch OK '+file.url);
  return file.wait.return(file);
}
 
let kern_chan;
async function _kernel_fetch(event){
  let {request, request: {url}} = event;
  let u = url_parse(url);
  let ref = request.headers.get('referer');
  let external = u.origin!=self.location.origin;
  let log_mod = url+(ref && ref!=u.origin+'/' ? ' ref '+ref : '');
  let path = u.path;
  let log = function(){ if (!url.includes('')) return;
    console.log(url, ...arguments); };
  log.mod = log_mod;
  if (request.method!='GET')
    return fetch(request);
  let v;
  log('Req');
  if (external)
    return fetch(request);
  if (path=='/favicon.ico')
    return await fetch('https://raw.githubusercontent.com/DustinBrett/daedalOS/refs/heads/main/public/favicon.ico');
  if (v=str.prefix(path, '/.lif/npm/')){
    let uri = v.rest;
    let f = await npm_file_load(log, uri);
    if (f.redirect){
      log(`module ${uri} -> ${f.redirect}`);
      return Response.redirect(f.redirect);
    }
    file_ast(f);
    log('npm', f.type);
    let js = f.js;
    if (f.type=='raw' || f.type=='json')
      js = f.body;
    else if (f.type=='amd')
      js = file_tr_amd(f);
    else if (f.type=='cjs' || !f.type)
      js = await file_tr_cjs_shim(f);
    else if (f.type=='mjs')
      js = file_tr_mjs(f);
    else
      throw Error('invalid type '+f.type);
    log(`module ${uri} served ${f.uri}`);
    return new Response(js, {
      headers: headers[f.type=='json' ? 'json' : 'js']});
  }
  if (v=str.prefix(path, '/.lif/npm.cjs/')){
    log('npm.cjs');
    let uri = v.rest;
    let f = await npm_file_load(log, uri);
    let tr = file_tr_cjs(f);
    log(`module ${uri} served ${f.url}`);
    return new Response(tr, {headers: headers.js});
  }
  if (u.ext=='.css'){
    let response = await fetch(path);
    if (response.status!=200)
      throw Error('failed fetch '+path);
    let body = await response.text();
    return new Response(`
        //TODO We don't track instances, so 2x imports will result
        // in 2x style tags
        const head = document.getElementsByTagName('head')[0];
        const style = document.createElement('style');
        style.setAttribute('type', 'text/css');
        style.appendChild(document.createTextNode(${json(body)}));
        head.appendChild(style);
        export default null; //TODO here we can export CSS module instead
      `,
      {headers: headers.js}
    );
  }
  return await fetch(request);
}

async function kernel_fetch(event){
  let slow;
  try {
    slow = eslow(5000, ['_kernel_fetch', event.request.url]);
    let res = await _kernel_fetch(event);
    slow.end();
    return res;
  } catch (err){
    console.error('kernel_fetch err', err);
    slow.end();
    return new Response(''+err, {status: 500, statusText: ''+err});
  }
}

let do_module_dep = async function({modver, dep}){
  let npm;
  modver ||= 'lif.app';
  let slow;
  try {
    slow = eslow(5000, ['do_module_dep', modver, dep]);
    npm = await npm_pkg_load(()=>{}, modver);
    slow.end();
    slow = eslow(5000, ['npm_pkg_load', modver, dep]);
    if (npm.redirect)
      npm = await npm_pkg_load(()=>{}, npm.redirect);
    slow.end();
  } catch(err){
    slow.end();
    console.error('do_module_dep err:', err);
    return null;
  }
  let ret = npm_dep_ver_lookup(npm.pkg, dep);
  console.log('modver '+modver+' dep '+dep+' ret '+ret);
  return ret;
};

function sw_init_post(){
  kern_chan = new util.postmessage_chan();
  kern_chan.add_server_cmd('version', arg=>({version: lif_version}));
  kern_chan.add_server_cmd('module_dep', ({arg})=>do_module_dep(arg));
  lif_kernel.on_message = event=>{
    if (kern_chan.listen(event))
      return;
  };
  lif_kernel.on_fetch = event=>{
    try {
      event.respondWith(kernel_fetch(event));
    } catch (err){
      console.error("lif kernel sw NetworkError: "+err);
    }
  };
  lif_kernel.wait_activate.return();
}
sw_init_post();
console.log('lif kernel sw '+lif_kernel.version+' util '+util.version);
} catch(err){console.error('lif kernel failed sw init', err);}})();

