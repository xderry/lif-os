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
let pkgroot_map = {
  '/pages/': '/.lif/pkgroot/pages/',
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

async function _sw_fetch(event){
  let {request, request: {url}} = event;
  const _url = url; // orig
  const u = URL.parse(url);
  u.ext = url_ext(u);
  u.filename = url_file(u);
  let pathname = u.pathname;
  // console.log('before req', url);
  if (request.method!='GET')
    return fetch(request);
  let v;
  console.log('Req', url, u.ext, u.pathname);
  for (let i in pkgroot_map){
    if (v=is_prefix(pathname, i)){
      url = pathname = pkgroot_map[i]+v.rest;
      break;
    }
  }
  if (v=is_prefix(pathname, '/.lif/esm/')){
    let module = v.prefix;
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
  } else if (u.ext=='.jsx' || u.ext=='.tsx'){
    let response = await fetch(pathname);
    let body = await response.text();
    let babel_opt = {
      presets: ['react'],
      plugins: [],
      sourceMaps: true,
    };
    if (u.ext=='.tsx'){
      babel_opt.presets.push('typescript');
      babel_opt.filename = u.filename;
    }
    let res = await Babel.transform(body, babel_opt);
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
    return await _sw_fetch(event);
  } catch (err){
    console.log("Serviceworker sw_fetch: "+err);
  }
}

self.addEventListener('fetch', event=>{
  try {
    event.respondWith(sw_fetch(event));
  } catch (err){
    console.log("Serviceworker NetworkError: "+err);
  }
});
