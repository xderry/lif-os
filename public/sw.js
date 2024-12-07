/*global clients,importScripts*/ // ServiceWorkerGlobalScope

/*global Babel*/
importScripts('https://unpkg.com/@babel/standalone@7.26.2/babel.min.js');

// this is needed to activate the worker immediately without reload
// @see https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#clientsclaim
self.addEventListener('activate', event=>event.waitUntil(clients.claim()));

let module_map = {
  'react': {global: 'React',
    url: 'https://unpkg.com/react@18/umd/react.development.js'},
  'react-dom': {global: 'ReactDOM',
    url: 'https://unpkg.com/react-dom@18/umd/react-dom.development.js'},
};
let ext_react = ['.ts', '.tsx', '/index.ts', '/index.tsx'];
let pkgroot_map = {
  '/pages/': {path: '/.lif/pkgroot/pages/'},
  '/components/': {path: '/.lif/pkgroot/components/', ext: ext_react},
  '/hooks/': {path: '/.lif/pkgroot/hooks/', ext: ext_react},
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
  const u = url_parse(url);
  let pathname = u.pathname;
  // console.log('before req', url);
  if (request.method!='GET')
    return fetch(request);
  let v;
  console.log('Req', url, u.ext, u.pathname);
  let mod;
  if (v=is_prefix(pathname, '/.lif/pkgroot/')){
    let pkgname = '/'+v.rest;
    for (let i in pkgroot_map){
      if (v=is_prefix(pkgname, i)){
        mod = pkgroot_map[i];
        break;
      }
    }
  }
  if (v=is_prefix(pathname, '/.lif/esm/')){
    let module = v.rest;
    if (!(v=module_map[module]))
      throw "no module found "+module;
    let response = await fetch(v.url);
    let body = await response.text();
    let res = `
      const head = document.getElementsByTagName('head')[0];
      const script = document.createElement('script');
      script.setAttribute('type', 'text/javascript');
      script.appendChild(document.createTextNode(${JSON.stringify(body)}));
      head.appendChild(script);
      export default window.${v.global};
    `;
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
      mod?.ext && !u.ext){
    let response, _pathname;
    if (u.ext)
      response = await fetch(pathname);
    else { // .ts .tsx module
      for (let i=0; i<mod.ext.length; i++){
        _pathname = pathname+mod.ext[i];
        response = await fetch(_pathname);
        if (response.status==200){
          console.log(pathname, ' + ', mod.ext[i], response.status);
          break;
        }
        console.log('is not', pathname, ' + ', mod.ext[i], response.status);
      }
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
    let res = await Babel.transform(body, opt);
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
