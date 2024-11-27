/*global clients,importScripts*/ // ServiceWorkerGlobalScope

/*global Babel*/
importScripts('https://unpkg.com/@babel/standalone@7.26.2/babel.min.js');

// this is needed to activate the worker immediately without reload
// @see https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#clientsclaim
self.addEventListener('activate', event=>event.waitUntil(clients.claim()));

let map = {
  'react': {global: 'React',
    url: 'https://unpkg.com/react@18/umd/react.development.js'},
  'react-dom': {global: 'ReactDOM',
    url: 'https://unpkg.com/react-dom@18/umd/react-dom.development.js'},
};
const headers = new Headers({
  'Content-Type': 'application/javascript',
});

const url_ext = url=>url.pathname.match(/\.[^./]*$/)?.[0];
async function _sw_fetch(event){
  let {request, request: {url}} = event;
  const u = URL.parse(url);
  const ext = url_ext(u);
  // console.log('before req', url);
  if (request.method!='GET')
    return fetch(request);
  let v;
  console.log('Req', url, ext, u.pathname);
  if (u.pathname.startsWith('/.lif/esm/')){
    let module = u.pathname.slice('/.lif/esm/'.length);
    if (!(v=map[module]))
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
    console.log(`module ${u.pathname} loaded`);
    return new Response(res, {headers});
  } else if (u.pathname=='/favicon.ico'){
    return await fetch('https://www.google.com/favicon.ico');
  } else if (ext=='.css'){
    let response = await fetch(url);
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
  } else if (ext=='.jsx'){
    let response = await fetch(url);
    let body = await response.text();
    let babel_opt = {
      presets: ['react'],
      plugins: [],
      sourceMaps: true,
    };
    let res = await Babel.transform(body, babel_opt);
    console.log('babel: '+u.pathname);
    return new Response(res.code, {headers});
  } else if (ext=='.js'){
    let response = await fetch(url);
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
