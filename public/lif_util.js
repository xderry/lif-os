let exports = {};

// Promise with return() and throw()
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
exports.ewait = ewait;
const esleep = ms=>{
  let p = ewait();
  setTimeout(()=>p.return(), ms);
  return p;
};
exports.esleep = esleep;

const eslow = (ms, arg)=>{
  let done, timeout;
  let p = (async()=>{
    await esleep(ms);
    timeout = true;
    if (!done)
      console.error('slow timeout('+ms+')', ...arg);
  })();
  eslow.set.add(p);
  p.end = ()=>{
    eslow.set.delete(p);
    if (timeout && !done)
      console.error('slow timeout('+ms+') done', ...arg);
    done = true;
  };
  p.print = ()=>console.log('slow('+ms+') print', ...arg);
  return p;
};
eslow.set = new Set();
eslow.print = ()=>{
  console.log('eslow print');
  for (let p of eslow.set)
    p.print();
}
exports.eslow = eslow;
self.esb = eslow;

// shortcuts
const OF = Object.entries;
exports.OF = OF;

// str.js
const str = {};
str.split_ws = s=>s.split(/\s+/).filter(s=>s);
str.es6_str = args=>{
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
str.qw = function(s){
  return str.split_ws(!Array.isArray(s) ? s : str.es6_str(arguments)); };
str.prefix = (s, prefix)=>{
  if (s.startsWith(prefix))
    return {prefix: prefix, rest: s.substr(prefix.length)};
};
exports.str = str;

// chan.js
class postmessage_chan {
  req = {};
  cmd_cb = {};
  ports;
  port;
  id = 0;
  async cmd(cmd, arg){
    let id = ''+(this.id++);
    let req = this.req[id] = ewait();
    this.port.postMessage({cmd, arg, id});
    return await req;
  }
  async cmd_server_cb(msg){
    let cmd_cb = this.cmd_cb[msg.cmd];
    if (!cmd_cb)
      throw Error('invalid cmd', msg.cmd);
    try {
      let res = await cmd_cb({chan: this, cmd: msg.cmd, arg: msg.arg});
      this.port.postMessage({cmd_res: msg.cmd, id_res: msg.id, res});
    } catch(err){
      console.error('cmd failed', msg);
      this.port.postMessage({cmd_res: msg.cmd, id_res: msg.id, err: ''+err});
      throw err;
    }
  }
  on_msg(event){
    let msg = event.data, id = msg.id_res;
    //console.log('got msg', msg);
    if (msg.cmd)
      return this.cmd_server_cb(msg);
    if (id){
      if (!this.req[id])
        throw Error('invalid req msg.id', id);
      let req = this.req[id];
      delete this.req[id];
      if (msg.err)
        return req.throw(msg.err);
      return req.return(msg.res);
    }
    throw Error('invalid msg', msg);
  }
  add_server_cmd(cmd, cb){
    this.cmd_cb[cmd] = cb;
  }
  // controller = navigator.serviceWorker.controller
  connect(controller){
    this.ports = new MessageChannel();
    controller.postMessage({connect: true}, [this.ports.port2]);
    this.port = this.ports.port1;
    this.port.onmessage = event=>this.on_msg(event);
  }
  listen(event){
    if (event.data?.connect){
      console.log('new listen');
      this.port = event.ports[0];
      this.port.onmessage = event=>this.on_msg(event);
      return true;
    }
  }
}
exports.postmessage_chan = postmessage_chan;

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
const uri_parse = (uri, base)=>{
  base ||= '';
  if (base && base[0]!='/')
    throw Error('invalid uri '+base);
  let u = {...url_parse(uri, 'http://x'+base)};
  u.host = u.hostname = u.origin = u.href = u.protocol = '';
  return u;
};
exports.path_ext = path_ext;
exports.path_file = path_file;
exports.path_dir = path_dir;
exports.path_is_dir = path_is_dir;
exports.url_parse = url_parse;
exports.uri_parse = uri_parse;

// parse-package-name
const npm_uri_parse = path=>{
  const RE_SCOPED = /^(@[^\/]+\/[^@\/]+)(?:@([^\/]+))?(\/.*)?$/
  const RE_NON_SCOPED = /^([^@\/]+)(?:(@[^\/]+))?(\/.*)?$/
  const m = RE_SCOPED.exec(path) || RE_NON_SCOPED.exec(path)
  return !m ? null : {name: m[1]|| '', version: m[2]|| '', path: m[3]||''};
};
exports.npm_uri_parse = npm_uri_parse;

export default exports;

