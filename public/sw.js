/*global clients,importScripts*/ // ServiceWorkerGlobalScope

/*global Babel*/
importScripts('https://unpkg.com/@babel/standalone@7.26.4/babel.js');

// this is needed to activate the worker immediately without reload
// @see https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#clientsclaim
self.addEventListener('activate', event=>event.waitUntil(clients.claim()));

// see index.html for coresponding import maps
let mod_map = {
  'react': {global: 'React',
    url: 'https://unpkg.com/react@18/umd/react.development.js'},
  'react-dom': {global: 'ReactDOM',
    url: 'https://unpkg.com/react-dom@18/umd/react-dom.development.js'},
  'framer-motion': {global: 'FramerMotion',
    url: 'https://unpkg.com/framer-motion@11.11.17/dist/es/index.mjs'},
   // next/dynamic ->
   //   https://unpkg.com/browse/next@15.0.4/dist/esm/shared/lib/dynamic.js
  'next/': { 
    ext: '.js',
    url_base: 'https://unpkg.com/browse/next@15.0.4/dist/esm/shared/lib/'},
};
const mod_get = name=>{
    let mod;
    if (mod=mod_map[name])
      return mod;
    //for (let m of mod_map)
};
let ext_react = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
let pkg_map = {
  '/pages/': {path: '/.lif/pkgroot/pages/'},
  '/components/': {path: '/.lif/pkgroot/components/', ext: ext_react},
  '/hooks/': {path: '/.lif/pkgroot/hooks/', ext: ext_react},
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
const is_prefix = (url, prefix)=>{
  if (url.startsWith(prefix))
    return {prefix: prefix, rest: url.substr(prefix.length)};
};
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
  let pathname = u.pathname;
  // console.log('before req', url);
  if (request.method!='GET')
    return fetch(request);
  let v;
  console.log('Req', url, u.ext, u.pathname);
  let pkg = pkg_get(pathname);
  if (v=is_prefix(pathname, '/.lif/esm/')){
    let module = v.rest;
    let pkg;
    if (!(pkg=mod_map[module]))
      throw "no module found "+module;
    let response = await fetch(pkg.url);
    let body = await response.text();
    let res = body;
    if (pkg.global){
      res = `
        const head = document.getElementsByTagName('head')[0];
        const script = document.createElement('script');
        script.setAttribute('type', 'text/javascript');
        script.appendChild(document.createTextNode(${JSON.stringify(body)}));
        head.appendChild(script);
        export default window.${pkg.global};
      `;
    }
    console.log(`module ${pathname} loaded`);
    return new Response(res, {headers});
  } else if (pathname=='/favicon.ico'){
    return await fetch('https://www.google.com/favicon.ico');
  } else if (u.ext=='.css'){
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
  } else if (u.ext=='.jsx' || u.ext=='.tsx' || u.ext=='.ts' ||
      pkg?.ext && !u.ext){
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
  } else if (u.ext=='.js'){
    let response = await fetch(pathname);
    let body = await response.text();
    return new Response(body, {headers});
  } else
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
