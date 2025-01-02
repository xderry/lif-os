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

const is_prefix = (url, prefix)=>{
  if (url.startsWith(prefix))
    return {prefix: prefix, rest: url.substr(prefix.length)};
};
// see index.html for coresponding import maps
let mod_map = {
  'react': {type: 'amd',
    url: 'https://unpkg.com/react@18/umd/react.development.js',
    exports: qw`__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
      createPortal createRoot findDOMNode flushSync hydrate hydrateRoot render
      unmountComponentAtNode unstable_batchedUpdates
      unstable_renderSubtreeIntoContainer version`,
  },
  'react/jsx-runtime': {type: 'cjs',
    // https://unpkg.com/jsx-runtime@1.2.0/index.js
    url_base: 'https://unpkg.com/jsx-runtime@1.2.0/',
    require: qw`./lib/renderer ./lib/interpreter`,
    // cjs: require('./lib/renderer')
    // esm: await import('./lib/interpreter');
    exports: qw`default`,
    // cjs: module.exports =
    // esm: export exports as default;
  },
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
    // amd: exports.createPortal = ...
    // esm: export const createPortal = exports.createPortal;
  },
  'canvas-confetti': {type: 'cjs',
    url: 'https://unpkg.com/canvas-confetti@1.9.3/src/confetti.js',
    exports: qw`reset create shapeFromPath shapeFromText`,
    // cjs:      module.exports.reset =
    // esm:      export const reset = module.exports.reset;
  },
  'framer-motion': {type: 'esm',
    url: 'https://unpkg.com/framer-motion@11.11.17/dist/es/index.mjs'},
  'next/': { 
    // https://unpkg.com/next@15.0.4/dist/esm/shared/lib/dynamic.js
    type: 'esm', ext: '.js',
    url_base: 'https://unpkg.com/next@15.0.4/dist/esm/shared/lib/'},
};
const mod_get = pathname=>{
  let mod, v;
  if (mod=mod_map[pathname])
    return {...mod, name: pathname};
  for (let i in mod_map){
    mod = mod_map[i];
    if (i[i.length-1]=='/' && (v=is_prefix(pathname, i)))
      return {...mod, name: i, rest: v.rest, url: mod.url_base+v.rest};
  }
};
let ext_react = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
let pkg_map = {
  '/pages/': {path: '/.lif/pkgroot/pages/'},
  '/components/': {path: '/.lif/pkgroot/components/', ext: ext_react},
  '/hooks/': {path: '/.lif/pkgroot/hooks/', ext: ext_react},
  '/contexts/': {path: '/.lif/pkgroot/contexts/', ext: ext_react},
};
const pkg_get = pathname=>{
  let v;
  if (v=is_prefix(pathname, '/.lif/pkgroot/')){
    let pkgname = '/'+v.rest;
    for (let i in pkg_map){
      if (v=is_prefix(pkgname, i))
        return pkg_map[i];
    }
  }
};
const headers = new Headers({
  'Content-Type': 'application/javascript',
});
const url_ext = url=>url.pathname.match(/\.[^./]*$/)?.[0];
const url_file = url=>url.pathname.match(/(^|\/)?([^/]+)$/)?.[2];
const url_parse = url=>{
  const u = URL.parse(url);
  u.ext = url_ext(u);
  u.filename = url_file(u);
  return u;
};

async function _sw_fetch(event){
  let {request, request: {url}} = event;
  const _url = url; // orig
  let u = url_parse(url);
  let external = u.origin!=self.location.origin;
  let pathname = u.pathname;
  // console.log('before req', url);
  if (request.method!='GET')
    return fetch(request);
  let v;
  console.log('Req', _url, url, u.ext, u.pathname);
  let pkg = pkg_get(pathname);
  if (external)
    return fetch(request);
  if (v=is_prefix(pathname, '/.lif/esm/')){ // rename /.lif/global/
    let module = v.rest;
    let mod;
    if (!(mod=mod_get(module)))
      throw "no module found "+module;
    let response = await fetch(mod.url);
    let body = await response.text();
    let res = body;
    if (mod.type=='global'){
      res += `
        export default window.${mod.global};
      `;
    } else if (mod.type=='amd'){
      let mod_json = JSON.stringify(module);
      res = `
        let lif_boot = window.lif.boot;
        let define = function(id, deps, factory){
          return lif_boot.define_amd(${mod_json}, arguments); };
        define.amd = {};
        let require = function(deps, cb){
          return lif_boot.require_amd(${mod_json}, deps, cb); };
        `+res;
      res += `let mod = await lif_boot.module_get(${mod_json});\n`;
      mod.exports.forEach(e=>res += `export const ${e} = mod.exports.${e};\n`);
      res += `export default mod.exports;\n`;
    }
    console.log(`module ${mod.name} loaded ${pathname} ${mod.url}`);
    return new Response(res, {headers});
  }
  if (v=is_prefix(pathname, '/.lif/amd/')){
    let module = v.rest;
    let mod;
    if (!(mod=mod_get(module)))
      throw "no module found "+module;
    let response = await fetch(mod.url);
    let body = await response.text();
    let res = body;
    if (mod.type!='amd')
      throw "not amd module "+module+" (is "+mod.type+")";
    let l = [];
    l.push(`let mod_exports = await import('${mod.url}');`);
    mod.exports.forEach(e=>l.push(`export const ${e} = mod_exports.${e};`));
    l.push(`export default mod_exports;`);
    console.log(`amd module ${mod.name} loaded ${pathname} ${mod.url}`);
    return new Response(res+"\n"+array.to_nl(l), {headers});
  }
  if (u.ext=='.css'){
    let response = await fetch(pathname);
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
    let response, _pathname;
    if (u.ext)
      response = await fetch(pathname);
    else { // .ts .tsx module
      let ext, is_not = [], res_status;
      for (ext of pkg.ext){
        _pathname = pathname+ext;
        response = await fetch(pathname+ext);
        res_status = pathname+ext+' '+response.status;
        if (response.status==200)
          break;
        is_not.push(res_status);
      }
      if (response.status!=200){
        console.log('failed module '+pathname+'. is not:', is_not);
        return response;
      }
      console.log(res_status);
      u = url_parse(url+ext);
    }
    if (response?.status!=200)
      return response;
    let body = await response.text();
    console.log(response);
    let opt = {
      presets: [],
      plugins: [],
      sourceMaps: true,
    };
    if (u.ext=='.tsx' || u.ext=='.ts'){
      opt.presets.push('typescript');
      opt.filename = u.filename;
    }
    if (u.ext=='.tsx' || u.ext=='.jsx')
      opt.presets.push('react');
    let res;
    try {
      res = await Babel.transform(body, opt);
    } catch (err){
      console.log('babel FAILED: '+pathname, err);
      throw err;
    }
    // babel --presets typescript,react app.tsx
    console.log('babel: '+pathname);
    return new Response(res.code, {headers});
  }
  if (u.ext=='.js'){
    let response = await fetch(pathname);
    let body = await response.text();
    return new Response(body, {headers});
  }
  if (pathname=='/favicon.ico')
    return await fetch('https://raw.githubusercontent.com/DustinBrett/daedalOS/refs/heads/main/public/favicon.ico');
  return fetch(request);
}

async function sw_fetch(event){
  try {
    return _sw_fetch(event);
  } catch (err){
    console.log("ServiceWorker sw_fetch: "+err);
    return new Response('sw_fetch error: '+err, {status: 404});
  }
}

self.addEventListener('fetch', event=>{
  try {
    event.respondWith(sw_fetch(event));
  } catch (err){
    console.log("ServiceWorker NetworkError: "+err);
  }
});
