// to lint: $ eslint server.js public/sw.js public/index.js
import serve from 'serve-handler';
import http from 'http';
import process from 'process';

const is_prefix = (url, prefix)=>{
  if (url.startsWith(prefix))
    return {prefix: prefix, rest: url.substr(prefix.length)};
};

const server = http.createServer((request, response)=>{
  const opt = {directoryListing: false, cleanUrls: false};
  const url = request.url;
  let file;
  let v;
  if (v=is_prefix(url, '/.lif/'));
  else if (v=is_prefix(url, '/.lif/pkgroot/'))
    file = '/'+v.rest;
  else if (url=='/')
    file = '/public/index.html';
  else
    file = '/public'+url;
  if (file)
    opt.rewrites = [{source: '**', destination: file}];
  console.log(`req ${url} -> ${file}`);
  // You pass two more arguments for config and middleware
  // More details here: https://github.com/vercel/serve-handler#options
  return serve(request, response, opt);
});

let port = 3000;
let [...argv] = [...process.argv];
argv.shift();
argv.shift();
while (argv[0]!=undefined){
  if (argv[0]=='-p'){
    argv.shift();
    port = +argv.shift();
  }
  else
    break;
}
if (argv[0]!=undefined)
  throw 'invalid args '+JSON.stringify(argv);

server.listen(port, ()=>{
  console.log(`Running at http://localhost:${port}`);
});
