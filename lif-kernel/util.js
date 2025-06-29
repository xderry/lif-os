let util_version = '1.1.17';
let exports = {};
exports.version = util_version;
let D = 0; // Debug

let is_worker = typeof window=='undefined';

// Promise with return() and throw()
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
exports.ewait = ewait;
const esleep = ms=>{
  let p = ewait();
  setTimeout(()=>p.return(), ms);
  return p;
};
exports.esleep = esleep;

const eslow = (ms, arg)=>{
  let enable = 1;
  eslow.seq ||= 0;
  let seq = eslow.seq++;
  let done, timeout, at_end;
  if (typeof ms!='number'){
    arg = ms;
    ms = 1000;
  }
  if (!Array.isArray(arg))
    arg = [arg];
  let p = (async()=>{
    await esleep(ms);
    timeout = true;
    if (!done)
      enable && console.warn('slow('+seq+') '+ms, ...arg, p.err);
  })();
  eslow.set.add(p);
  p.now = Date.now();
  p.stack = Error('stack'),
  p.end = ()=>{
    if (at_end)
      return;
    at_end = Date.now();
    eslow.set.delete(p);
    if (timeout && !done)
      enable && console.warn('slow completed '+(Date.now()-p.now)+'>'+ms, ...arg);
    done = true;
  };
  p.print = ()=>console.log('slow('+seq+') '+(done?'completed ':'')+ms
    +' passed '+((at_end||Date.now())-p.now), ...arg);
  return p;
};

let once_obj = {};
let once_set = new Set();
const Donce = (once, fn)=>{
  if (typeof once=='object'){
    if (!once_set.has(once)){
      once_set.add(once);
      return void fn();
    }
  } else if (typeof once=='string'){
    if (!once_obj[once]){
      once_obj[once] = true;
      return void fn();
    }
  } else if (once===true || once===1)
    return void fn();
  else if (once==false || once===0);
  else
    console.error('invalid once', once);
};
exports.Donce = Donce;

eslow.set = new Set();
eslow.print = ()=>{
  console.log('eslow print');
  for (let p of eslow.set)
    p.print();
}
exports.eslow = eslow;
self.esb = eslow;

// shortcuts
const OF = o=>o ? Object.entries(o) : [];
exports.OF = OF;
const OA = Object.assign;
exports.OA = OA;
const T = (fn, throw_val)=>(function(){ // convert throw Error to undefined
  try {
    return fn(...arguments);
  } catch(err){ return throw_val; }
});
exports.T = T;
const TU = fn=>(function(){ // Throw error on undefined
  let v = fn(...arguments);
  if (v===undefined)
    throw Error('failed '+fn.name);
  return v;
});
exports.TU = TU;

// str.js
const str = {};
exports.str = str;
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
const arr_deep_find = exports.arr_deep_find = (a, find)=>{
  if (!Array.isArray(a))
    return find(a);
  let v;
  if (Array.isArray(a)){
    for (let i=0; i<a.length; i++){
      if (v = arr_deep_find(a[i], find))
        return v;
    }
  }
};
str.starts = (s, ..._start)=>arr_deep_find(_start, start=>{
  let v;
  if (typeof start=='string'){
    if (s.startsWith(start))
      return {start, rest: s.slice(start.length)};
    return;
  }
  if (start instanceof RegExp){
    if ((v=s.match(start)) && v.index==0)
      return {start: v[0], rest: s.slice(v[0].length)};
    return;
  }
  throw Error('invalid str.starts type');
});
str.ends = (s, ..._end)=>arr_deep_find(_end, end=>{
  if (s.endsWith(end))
    return {end, rest: s.slice(0, s.length-end.length)};
});
str.is = (s, ..._is)=>arr_deep_find(_is, is=>s==is)||false;
str.splice = (s, at, len, add)=>s.slice(0, at)+add+s.slice(at+len);
str.diff_pos = (s1, s2)=>{
  if (s1==s2)
    return;
  let i;
  for (i=0; i<s1.length && s1[i]==s2[i]; i++);
  return i;
};

// assert.js
let assert = (ok, exp, res)=>{
  if (ok)
    return;
  console.error('test FAIL: exp', exp, 'res', res);
  debugger; // eslint-disable-line no-debugger
  throw Error('test FAIL');
};
let assert_eq = (exp, res)=>{
  assert(exp===res, exp, res);
};
let assert_obj = (exp, res)=>{
  if (exp===res)
    return;
  if (typeof exp=='object'){
    assert(typeof res=='object', exp, res);
    for (let i in exp)
      assert_obj(exp[i], res[i]);
    return;
  }
  assert(0, exp, res);
};
let assert_run = run=>{
  try {
    return run();
  } catch(e){
    assert(0, 'run failed: '+e);
  }
};
let assert_run_ab = (a, b, test)=>{
  let _a = T(a, {got_throw: 1})();
  let _b = T(b, {got_throw: 1})();
  assert(!!_a.got_throw==!!_b.got_throw,
    _a.got_throw ? 'a throws, and b does not' : 'b throws, and a does not');
  let ok = assert_run(()=>test(_a, _b));
  assert(ok, 'a and b dont match');
  return {a: _a, b: _b};
};
exports.assert = assert;
exports.assert_eq = assert_eq;
exports.assert_obj = assert_obj;
exports.assert_run_ab = assert_run_ab;

// chan.js
class postmessage_chan {
  req = {};
  cmd_cb = {};
  ports;
  port;
  id = 0;
  async cmd(cmd, arg){
    let id = ''+(this.id++);
    let req = this.req[id] = {wait: ewait()};
    req.slow = eslow('post cmd '+cmd);
    this.port.postMessage({cmd, arg, id});
    return await req;
  }
  async cmd_server_cb(msg){
    let cmd_cb = this.cmd_cb[msg.cmd];
    if (!cmd_cb)
      throw Error('invalid cmd', msg.cmd);
    try {
      let slow = eslow('chan cmd '+msg.cmd);
      let res = await cmd_cb({cmd: msg.cmd, arg: msg.arg});
      slow.end();
      this.port.postMessage({cmd_res: msg.cmd, id_res: msg.id, res});
    } catch(err){
      console.error('cmd failed', msg);
      this.port.postMessage({cmd_res: msg.cmd, id_res: msg.id, err: ''+err});
      throw err;
    }
  }
  on_msg(event){
    let msg = event.data;
    if (typeof msg.cmd=='string' && typeof msg.id=='string')
      return this.cmd_server_cb(msg);
    if (typeof msg.cmd_res=='string' && typeof msg.id_res=='string'){
      let id = msg.id_res, req;
      if (!(req = this.req[id]))
        throw Error('invalid req msg.id', id);
      delete this.req[id];
      req.slow.end();
      if (msg.err)
        return req.wait.throw(msg.err);
      return req.wait.return(msg.res);
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
    this.port.addEventListener('message', event=>this.on_msg(event));
    this.port.start();
  }
  listen(event){
    if (event.data?.connect){
      this.port = event.ports[0];
      this.port.addEventListener('message', event=>this.on_msg(event));
      this.port.start();
      return true;
    }
  }
  close(){
    this.port.close();
  }
}
exports.postmessage_chan = postmessage_chan;

let utf8_enc = new TextEncoder('utf-8');
let str_to_buf = buf=>{
  if (buf instanceof ArrayBuffer)
    return buf;
  if (ArrayBuffer.isView(buf))
    return buf.buffer;
  if (typeof buf=='string')
    return utf8_enc.encode(buf).buffer;
  throw Error('str_to_buf: invalid buf type');
};
let utf8_dec = new TextDecoder('utf-8');
let buf_to_str = (buf, type)=>{
  if (!type)
    return buf;
  if (type=='string')
    return utf8_dec.decode(buf);
  throw Error('buf_to_str: invalid type');
}

// implementation automatic service-worker/direct SharedArrayBuffer
// https://github.com/alexmojaki/sync-message
class ipc_sync {
  seq = 0;
  constructor(ipc_buf){
    this.sab = ipc_buf || {
      data: new SharedArrayBuffer(8192),
      cmd: new SharedArrayBuffer(24),
    };
    this._data = this.sab.data;
    this.data = new Uint8Array(this.sab.data);
    let cmd = this.sab.cmd;
    this.write_lock = new Int32Array(cmd, 0, 1);
    this.read_lock = new Int32Array(cmd, 4, 1);
    this.sz = new Int32Array(cmd, 8, 1);
    this.len = new Int32Array(cmd, 12, 1);
    this.ofs = new Int32Array(cmd, 16, 1);
    this.last = new Int32Array(cmd, 20, 1);
  }
  write_notify(){
    Atomics.notify(this.write_lock, 0);
  }
  read_notify(){
    Atomics.notify(this.read_lock, 0);
  }
  write_wait(old_val){
    Atomics.wait(this.write_lock, 0, old_val);
  }
  read_wait(old_val){
    Atomics.wait(this.read_lock, 0, old_val);
  }
  async Ewrite_wait(old_val){
    await Atomics.wait(this.write_lock, 0, old_val).value;
  }
  async Eread_wait(old_val){
    await Atomics.waitAsync(this.read_lock, 0, old_val).value;
  }
  write(buf){
    buf = str_to_buf(buf);
    let sz = buf.byteLength, ofs = 0;
    this.sz[0] = sz;
    do {
      let len = Math.min(sz-ofs, this._data.byteLength);
      this.len[0] = len;
      this.ofs[0] = ofs;
      this.last[0] = ofs+len==sz;
      this.data.set(new Uint8Array(buf, ofs, len), 0);
      this.write_lock[0] = ++this.seq;
      this.write_notify();
      this.read_wait(this.seq-1);
      ofs += len;
    } while (ofs<sz);
  }
  async Ewrite(buf){
    buf = str_to_buf(buf);
    let sz = buf.byteLength, ofs = 0;
    this.sz[0] = sz;
    do {
      let len = Math.min(sz-ofs, this._data.byteLength);
      this.len[0] = len;
      this.ofs[0] = ofs;
      this.last[0] = ofs+len==sz;
      this.data.set(new Uint8Array(buf, ofs, len), 0);
      this.write_lock[0] = ++this.seq;
      this.write_notify();
      await this.Eread_wait(this.seq-1);
      ofs += len;
    } while (ofs<sz);
  }
  read(type){
    this.write_wait(this.seq);
    let sz = this.sz[0];
    let buf = new ArrayBuffer(sz);
    let _buf = new Uint8Array(buf);
    let ofs = 0;
    let last;
    while (ofs<sz){
      let len = this.len[0];
      _buf.set(new Uint8Array(this._data, 0, len), ofs);
      let last = this.last[0];
      this.read_lock[0] = ++this.seq;
      this.read_notify();
      ofs += len;
      if (last)
        break;
      this.write_wait(this.seq);
    }
    if (type)
      buf = buf_to_str(buf, type);
    return buf;
  }
  async Eread(type){
    await this.Ewrite_wait(this.seq);
    let sz = this.sz[0];
    let buf = new ArrayBuffer(sz);
    let _buf = new Uint8Array(buf);
    let ofs = 0;
    let last;
    while (ofs<sz){
      let len = this.len[0];
      _buf.set(new Uint8Array(this._data, 0, len), ofs);
      let last = this.last[0];
      this.read_lock[0] = ++this.seq;
      this.read_notify();
      ofs += len;
      if (last)
        break;
      await this.Ewrite_wait(this.seq);
    }
    if (type)
      buf = buf_to_str(buf, type);
    return buf;
  }
}
exports.ipc_sync = ipc_sync;

const path_ext = path=>path.match(/\.[^./]*$/)?.[0];
const _path_ext = path=>path.match(/\.([^./]*)$/)?.[1];
const path_file = path=>path.match(/(^.*\/)?([^/]*)$/)?.[2]||'';
const path_dir = path=>path.match(/(^.*\/)?([^/]*)$/)?.[1]||'';
const path_is_dir = path=>path.endsWith('/');
const path_join = (...path)=>{
  let p = path[0];
  for (let i=1; i<path.length; i++){
    let add = path[i];
    p += (p.endsWith('/') ? '' : '/')+(add[0]=='/' ? add.slice(1) : add);
  }
  return p;
};
const path_prefix = (path, start)=>{
  let v;
  if (!(v=str.starts(path, start)))
    return;
  if (!v.rest || v.rest[0]=='/' || start.endsWith('/'))
    return v;
};

function test_path(){
  let t;
  t = (v, s, arr)=>assert_eq(v, str.is(s, ...arr));
  t(false, 'ab', ['']);
  t(true, 'ab', ['ab']);
  t(true, 'ab', ['', 'ab']);
  t(true, 'D', ['d', ['abc', '', 'D']]);
  t(false, 'D', ['d', ['abc', '', 'd']]);
  t = (s, pre, v)=>{
    assert_obj(v ? {start: v[0], rest: v[1]} : undefined, str.starts(s, pre));
    assert_obj(v ? {start: v[0], rest: v[1]} : undefined, str.starts(s, ...pre));
  };
  t('ab:cd', [''], ['', 'ab:cd']);
  t('ab:cd', ['ab:'], ['ab:', 'cd']);
  t('ab:cd', ['ac:']);
  t('ab:cd', ['ab', 'ab.', 'ac:'], ['ab', ':cd']);
  t('ab:cd', ['ab:', 'ab', 'ac:'], ['ab:', 'cd']);
  t('ab:cd', ['ab:', 'ac:'], ['ab:', 'cd']);
  t('ab:cd', ['cd']);
  t('ab:cd', [/b:/]);
  t('ab:cd', [/ab:/], ['ab:', 'cd']);
  t('ab:cd', [/^ab:/], ['ab:', 'cd']);
  t = (s, pre, v)=>{
    assert_obj(v ? {end: v[0], rest: v[1]} : undefined, str.ends(s, pre));
    assert_obj(v ? {end: v[0], rest: v[1]} : undefined, str.ends(s, ...pre));
  };
  t('ab:cd', [''], ['', 'ab:cd']);
  t('ab:cd', [':cd'], [':cd', 'ab']);
  t('ab:cd', ['ac:']);
  t('ab:cd', [':dc']);
  t('ab:cd', ['cd', 'cd.', 'ac:'], ['cd', 'ab:']);
  t('ab:cd', ['ab:', ':c', ':cd'], [':cd', 'ab']);
  t('ab:cd', ['ab:', ':', 'd'], ['d', 'ab:c']);
  t('ab:cd', ['ab']);
  t = (v, path)=>assert_eq(v, path_ext(path));
  t(undefined, 'dir.js/file');
  t('.js', 'dir.js/file.js');
  t('.', 'dir.js/file.');
  t = (v, path)=>assert_eq(v, _path_ext(path));
  t(undefined, 'dir.js/file');
  t('js', 'dir.js/file.js');
  t('', 'dir.js/file.');
  t = (v, path)=>assert_eq(v, path_file(path));
  t('file.js', 'another/dir/dir.js/file.js');
  t('file.js', '/file.js');
  t('', '/');
  t('', 'dir/');
  t('', '');
  t = (v, path)=>assert_eq(v, path_dir(path));
  t('another/dir/dir.js/', 'another/dir/dir.js/file.js');
  t('/', '/file.js');
  t('/', '/');
  t('dir/', 'dir/');
  t('', '');
  t = (v, path)=>assert_eq(v, path_is_dir(path));
  t(false, '/file.js');
  t(true, '/');
  t(true, 'dir/');
  t(false, '');
  t = (v, ...path)=>assert_eq(v, path_join(...path));
  t('a/b/c', 'a/b', 'c');
  t('a/b/c', 'a/b', '/c');
  t('a/b/c', 'a/b/', '/c');
  t('a/b//c', 'a/b//', '/c');
  t = (v, path, prefix)=>assert_eq(v, path_prefix(path, prefix)?.rest);
  t(undefined, 'aa/bb/cc', 'a');
  t(undefined, 'aa/bb/cc', 'aa/b');
  t('/bb/cc', 'aa/bb/cc', 'aa');
  t('bb/cc', 'aa/bb/cc', 'aa/');
  t('/cc', 'aa/bb/cc', 'aa/bb');
  t('cc', 'aa/bb/cc', 'aa/bb/');
  t('', 'aa/bb/cc', 'aa/bb/cc');
}
test_path();

// URL.parse() only available on Chrome>=126
const URL_parse = (...args)=>{
  try { return new URL(...args); }
  catch(err){}
};
const T_url_parse = (url, base)=>{
  const u = URL_parse(url, base);
  if (!u)
    throw Error('cannot parse url: '+url);
  // some of these fields are setters, so copy object to normal object
  let _u = {path: u.pathname,
    hash: u.hash, host: u.host, hostname: u.hostname, href: u.href,
    origin: u.origin, password: u.password, pathname: u.pathname,
    port: u.port, protocol: u.protocol, search: u.search,
    searchParams: u.searchParams, username: u.username};
  // add info
  _u.path = u.pathname;
  _u.ext = path_ext(_u.path);
  _u.file = path_file(_u.path);
  _u.dir = path_dir(_u.path);
  return _u;
};
const url_parse = T(T_url_parse);

// https://www.iana.org/assignments/uri-schemes/prov/gitoid
// https://docs.npmjs.com/cli/v11/configuring-npm/package-json
// gh/pinheadmz/bcoin@05794f5cb35eb322965d33a045ab68dffc63b21a/lib/bcoin-browser.js
//   https://github.com/pinheadmz/bcoin/blob/05794f5cb35eb322965d33a045ab68dffc63b21a/lib/bcoin-browser.js
//   https://raw.githubusercontent.com/pinheadmz/bcoin/05794f5cb35eb322965d33a045ab68dffc63b21a/lib/bcoin-browser.js
//   https://cdn.jsdelivr.net/gh/pinheadmz/bcoin@05794f5cb35eb322965d33a045ab68dffc63b21a/lib/bcoin-browser.js
//   https://cdn.statically.io/gh/pinheadmz/bcoin@05794f5cb35eb322965d33a045ab68dffc63b21a/lib/bcoin-browser.js
// gh/pinheadmz/bcoin/HEAD/lib/bcoin-browser.js
//   https://github.com/pinheadmz/bcoin/blob/HEAD/lib/bcoin-browser.js
//   https://raw.githubusercontent.com/pinheadmz/bcoin/HEAD/lib/bcoin-browser.js
//   https://cdn.jsdelivr.net/gh/pinheadmz/bcoin@HEAD/lib/bcoin-browser.js
//   https://cdn.statically.io/gh/pinheadmz/bcoin@HEAD/lib/bcoin-browser.js
// Docs:
//   https://statically.io/ - gh GitHub, gl GitLab, 
//   https://www.jsdelivr.com/github - link converter
// IPFS
//   https://ipfs.io/ipfs/QmZULkCELmmk5XNfCgTnCyFgAVxBRBXyDHGGMVoLFLiXEN
//   https://cloudflare-ipfs.com/ipfs/QmZULkCELmmk5XNfCgTnCyFgAVxBRBXyDHGGMVoLFLiXEN
//   https://ipfs.io/ipfs/QmT5NvUtoM5nWFfrQdVrFtvGfKFmG7AHE8P34isapyhCxX/wiki/Mars.html
//   https://ipfs.io/ipfs/bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq/wiki/Vincent_van_Gogh.html
//   https://bafybeiemxf5abjwjbikoz4mc3a3dla6ual3jsgpdr4cjr3oz3evfyavhwq.ipfs.dweb.link/wiki/
// Docs:
//   https://docs.ipfs.tech/how-to/address-ipfs-on-web/#path-gateway
//   https://gist.github.com/olizilla/81cee26ffa3ae103e4766d2ae0d2f04b
//
// npm/MOD/PATH
// npm/MOD@VER/PATH
// npm/@SCOPE/MOD/PATH
// npm/@SCOPE/MOD@VER/PATH
//   SOURCE https://registry.npmjs.com/MOD
//   https://unpkg.com/MOD@VER/PATH
//   https://cdn.jsdelivr.net/npm/MOD@VER/PATH
// git/github/USER/REPO/PATH
// git/github/USER/REPO@VER/PATH
//   SOURCE https://github.com/USER/REPO/blob/VER/PATH
//   https://raw.githubusercontent.com/USER/REPO/VER/PATH
//   https://statically.io/gh/USER/REPO@VER/PATH
//   https://cdn.jsdelivr.net/gh/USER/REPO@HEAD/PATH
// git/gitlab/USER/REPO@VER/PATH
//   https://statically.io/gl/USER/REPO@VER/PATH
// http/SITE/PATH
// http/SITE@PORT/PATH
//   http://SITE:PORT/PATH
// https/SITE/PATH
// https/SITE@PORT/PATH
//   http://SITE:PORT/PATH
// ipfs/CID/PATH
//   https://ipfs.io/ipfs/CID
//   https://cloudflare-ipfs.com/ipfs/CID
// ipns/NAME/PATH
// bitcoin/BLOCK
// lifcoin/BLOCK
// bittorent/IH/PATH
//  magnet:?xt=urn:btih:IH 
//
// try to support this one day:
// import {groupBy} from 'npm:lodash@4.17.21';

const path_parts = parts=>parts.length ? '/'+parts.join('/') : '';
const T_lpm_parse = lpm=>{
  let l = {};
  let p = lpm.split('/');
  let i = 0;
  function next(err){
    let v = p[i++];
    if (typeof v!='string')
      throw Error('lpm_parse missing'+err+': '+lpm);
    if (v=='')
      throw Error('lpm_parse empty element: '+lpm);
    return v;
  }
  function next_submod(){
    let j = p.indexOf('', i);
    if (j==i)
      throw Error('invalid empty submod: '+lpm);
    if (j<0)
      return '';
    let submod = '/'+p.slice(i, j).join('/')+'/';
    i = j+1;
    return submod;
  }
  function ver_split(name){
    let n = name.split('@');
    if (n.length==1)
      return {name: name, ver: '', _ver: null};
    if (n.length==2)
      return {name: n[0], ver: '@'+n[1], _ver: n[1]};
    throw Error('lpm_parse invalid ver inname: '+name);
  }
  let v, lmod, repo;
  l.reg = next('registry (npm, git, bitcoin, lifcoin, ipfs)');
  switch (l.reg){
  case 'npm':
    l.name = next('module name');
    if (l.name[0]=='@'){
      l.scoped = true;
      let scoped = next('scoped module name');
      v = ver_split(scoped);
      l.name = l.name+'/'+v.name;
    } else {
      v = ver_split(l.name);
      l.name = v.name;
    }
    l.ver = v.ver;
    l._ver = v._ver;
    l.lmod = l.reg+'/'+l.name+l.ver;
    break;
  case 'git':
    l.site = next('site');
    l.user = next('user');
    repo = next('repo');
    v = ver_split(repo);
    l.repo = v.name;
    l.name = l.user+'/'+l.repo;
    l.ver = v.ver;
    l._ver = v._ver;
    if (!l._ver)
      l.ver_type = l._ver;
    else if (/^[0-9a-f]+$/.test(l._ver)){
      l.ver_type = l._ver.length==40 ? 'sha1' : l._ver.length==64 ? 'sha256' :
        l._ver.length>=4 && !(l._ver.length % 2) && l._ver.length<=20 ? 'shortcut' :
        'name';
    } else
      l.ver_type = 'name';
    l.lmod = l.reg+'/'+l.site+'/'+l.name+l.ver;
    break;
  case 'http':
  case 'https':
    l.name = next('site name');
    v = ver_split(l.name);
    l.name = v.name;
    l.ver = v.ver;
    l._ver = v._ver;
    l.port = v._ver;
    l.lmod = l.reg+'/'+l.blockid;
    break;
  case 'bittorent':
    l.infohash = next('InfoHash');
    break;
  case 'lifcoin':
    l.blockid = next('BlockID');
    l.lmod = l.reg+'/'+l.blockid;
    break;
  case 'bitcoin':
    l.blockid = next('BlockID');
    l.lmod = l.reg+'/'+l.blockid;
    break;
  case 'ethereum':
    throw Error('unsupported etherum '+lpm);
    break;
  case 'ipfs':
    l.cid = next('cid');
    l.lmod = l.reg+'/'+l.cid;
    break;
  case 'ipns':
    l.name = next('name');
    l.lmod = l.reg+'/'+l.name;
    break;
  case 'local':
    l.lmod = l.reg;
    break;
  default:
    throw Error('invalid registry: '+lpm);
  }
  l.submod = next_submod();
  l.lmod += l.submod;
  let _p = p.slice(i);
  l.path = path_parts(_p);
  return l;
};
exports.T_lpm_parse = T_lpm_parse;
const lpm_parse = T(T_lpm_parse);
exports.lpm_parse = lpm_parse;
const T_lpm_str = l=>{
  switch (l.reg){
  case 'npm':
    return l.reg+'/'+l.name+l.ver+l.submod+l.path;
  case 'git':
    return l.reg+'/'+l.site+'/'+l.name+l.ver+l.submod+l.path;
  case 'http':
  case 'https':
    return l.reg+'/'+l.name+(l.port ? '@'+l.port : '')+l.submod+l.path;
  case 'bittorent':
    return l.reg+'/'+l.infohash+l.submod+l.path;
  case 'lifcoin':
    return l.reg+'/'+l.blockid+l.submod+l.path;
  case 'bitcoin':
    return l.reg+'/'+l.blockid+l.submod+l.path;
    break;
  case 'ethereum':
    throw Error('unsupported etherum');
  case 'ipfs':
    return l.reg+'/'+l.cid+l.submod+l.path;
  case 'ipns':
    return l.reg+'/'+l.name+l.submod+l.path;
  case 'local':
    return l.reg+l.submod+l.path;
  default:
    throw Error('invalid registry: '+l.reg);
  }
};
exports.T_lpm_str = T_lpm_str;
const lpm_str = T(T_lpm_str);
exports.lpm_str = lpm_str;
const npm_str = exports.npm_str = u=>lpm_to_npm(lpm_str(u));

const T_lpm_lmod = lpm=>{
  let u = lpm;
  if (typeof lpm=='string')
    u = T_lpm_parse(lpm);
  return u.lmod;
};
exports.T_lpm_lmod = T_lpm_lmod;
const lpm_lmod = T(T_lpm_lmod);
exports.lpm_lmod = lpm_lmod;

// parse-package-name: package.json:dependencies
const T_npm_dep_to_lpm = (mod_self, dep)=>{
  let v;
  if (v=str.starts(dep, './'))
    return mod_self+'/'+v.rest;
  if (v=str.starts(dep, ['https:', 'http:', 'git:'])){
    let u = new URL(dep), site = u.host;
    if (u.host=='github.com'){
      site = 'github';
    } else if (site=='gitlab.com'){
      site = 'gitlab';
    } else
      throw Error('invalid http registry '+site);
    let p = u.pathname.slice(1).split('/');
    let user = p.shift();
    let repo = p.shift();
    if (!user || !repo)
      throw Error('invalid gith user/repo');
    if (v=str.ends(repo, '.git'))
      repo = v.rest;
    let _path = p.map(p=>'/'+p).join('');
    let ver = u.hash ? '@'+u.hash.slice(1) : '';
    return 'git/'+site+'/'+user+'/'+repo+ver+_path;
  }
  if (v=str.starts(dep, 'npm:'))
    return 'npm/'+v.rest;
  if (v=str.starts(dep, 'file:')){
    let file = v.rest;
    if (!(v=str.starts(file, './')))
      throw Error('only ./ files supported: '+dep);
    return mod_self+'/'+v.rest;
  }
  // add later bittorent: lifcoin: bitcoin: ethereum: ipfs: ipns:
  throw Error('invalid npm_dep prefix: '+dep);
};
const npm_dep_to_lpm = T(T_npm_dep_to_lpm);

const T_npm_dep_parse = exports.T_npm_dep_parse = ({mod_self, imp, dep})=>{
  let lmod = T_lpm_lmod(imp);
  let path = T_lpm_parse(imp).path;
  let d = dep, v;
  if (d[0]=='/')
    return T_lpm_str({reg: 'local', submod: d=='/' ? '' : d+'/', path});
  if (v=str.starts(d, './'))
    return mod_self+(v.rest?'/'+v.rest:'')+path;
  if (v=str.starts(d, ['https:', 'http:', 'git:'])){
    let u = new URL(d), site = u.host;
    if (u.host=='github.com'){
      site = 'github';
    } else if (site=='gitlab.com'){
      site = 'gitlab';
    } else
      throw Error('invalid http registry '+site);
    let p = u.pathname.slice(1).split('/');
    let user = p.shift();
    let repo = p.shift();
    if (!user || !repo)
      throw Error('invalid gith user/repo');
    if (v=str.ends(repo, '.git'))
      repo = v.rest;
    let _path = p.map(p=>'/'+p).join('');
    let ver = u.hash ? '@'+u.hash.slice(1) : '';
    return 'git/'+site+'/'+user+'/'+repo+ver+_path;
  }
  if (v=str.starts(d, 'npm:'))
    return 'npm/'+v.rest+path;
  if (v=str.starts(d, '.npm/', '.git/', '.local/'))
    return v.start.slice(1)+v.rest+path;
  if (v=str.starts(dep, 'file:')){
    let file = v.rest;
    if (!(v=str.starts(file, './')))
      throw Error('only ./ files supported: '+dep);
    return mod_self+'/'+v.rest;
  }
  let range = semver_range_parse(d);
  if (!range){
    D && console.log('invalid semver_range: '+range);
    return '-';
  }
  let {op, ver} = range[0];
  if (range.length>1)
    D && console.log('ignoring multi-op imp: '+d);
  if (op=='>=')
    return '-';
  if (op=='^' || op=='=' || op=='' || op=='~')
    return lmod+'@'+ver+path;
  D && console.log('invalid op: '+op);
  return '-';
};
const npm_dep_parse = exports.npm_dep_parse = T(T_npm_dep_parse, '');

// npm_parse() and lpm_parse(), and npm_parse_basic()
const T_npm_parse = npm=>T_lpm_parse(T_npm_to_lpm(npm));
exports.T_npm_parse = T_npm_parse;
const npm_parse = T(T_npm_parse);
exports.npm_parse = npm_parse;

let T_npm_to_lpm = exports.T_npm_to_lpm = npm=>{
  let v;
  if (npm[0]!='.')
    return 'npm/'+npm;
  if (v=path_prefix(npm, '.npm'))
    return 'npm'+v.rest;
  if (v=path_prefix(npm, '.git'))
    return 'git'+v.rest;
  if (v=path_prefix(npm, '.local'))
    return 'local'+v.rest;
  throw Error('invalid npm: '+npm);
};
let npm_to_lpm = exports.npm_to_lpm = T(T_npm_to_lpm);

let T_lpm_to_npm = exports.T_lpm_to_npm = lpm=>{
  let u = typeof lpm=='string' ? T_lpm_parse(lpm) : lpm;
  if (u.reg=='npm')
    return u.lmod.slice(4)+u.path;
  return '.'+u.lmod+u.path;
};
let lpm_to_npm = exports.lpm_to_npm = T(T_lpm_to_npm);

let lpm_to_sw_uri = lpm=>{
  let v;
  if (v=str.starts(lpm, 'local/'))
    return '/'+v.rest;
  return '/.lif/'+lpm;
};
exports.lpm_to_sw_uri = lpm_to_sw_uri;

const url_uri_type = url_uri=>{
  if (!url_uri)
    throw Error('invalid url_uri type');
  if (URL_parse(url_uri))
    return 'url';
  if (url_uri[0]=='/')
    return 'uri';
  let dir = url_uri.split('/')[0];
  if (dir=='.' || dir=='..')
    return 'rel';
  return 'mod';
};
exports.url_uri_type = url_uri_type;

const __uri_parse = (uri, base)=>{
  if (base && base[0]!='/')
    throw Error('invalid base '+base);
  let u = T_url_parse(uri, 'x://x'+(base||''));
  u.host = u.hostname = u.origin = u.href = u.protocol = '';
  return u;
};

const lpm_ver_missing = exports.lpm_ver_missing = u=>{
  u = _lpm_parse(u);
  return str.is(u.reg, 'npm', 'git') && !u.ver;
};
const _lpm_parse = exports._lpm_parse =
  lpm=>typeof lpm=='string' ? lpm_parse(lpm) : lpm;
const lpm_same_base = exports.lpm_same_base = (lmod_a, lmod_b)=>{
  let a = _lpm_parse(lmod_a), b = _lpm_parse(lmod_b);
  return a.reg==b.reg && a.name==b.name;
};
const lpm_ver_from_base = exports.lpm_ver_from_base = (lpm, base)=>{
  if (!base)
    return;
  lpm = _lpm_parse(lpm);
  base = _lpm_parse(base);
  if (!(lpm_same_base(lpm, base) && lpm_ver_missing(lpm) && base.ver))
    return;
  return lpm_str({...lpm, ver: base.ver});
};
const npm_ver_from_base = exports.npm_ver_from_base = (npm, base)=>{
  if (!base)
    return;
  let v = lpm_ver_from_base(npm_to_lpm(npm), npm_to_lpm(base));
  if (!v)
    return;
  return lpm_to_npm(v);
};

const T_npm_url_base = (url_uri, base_uri)=>{
  let t = url_uri_type(url_uri);
  let tbase = base_uri ? url_uri_type(base_uri) : null;
  let u, is = {};
  if (t=='rel' && !tbase)
    throw Error('npm_url_base('+url_uri+') rel without base');
  if (t=='rel')
    is.rel = 1;
  if (t=='url' || t=='rel' && tbase=='url'){
    let u = url_parse(url_uri, t=='rel' ? base_uri : undefined);
    u.is = is;
    is.url = 1;
    return u;
  }
  if (t=='uri' || t=='rel' && tbase=='uri'){
    u = __uri_parse(url_uri, t=='rel' ? base_uri : undefined);
    u.is = is;
    is.uri = 1;
    return u;
  }
  is.mod = 1;
  let base = base_uri ? T_npm_parse(base_uri) : undefined;
  if (t=='mod'){
    let lpm = T_npm_parse(url_uri);
    let uri = url_uri;
    if (lpm_ver_from_base(lpm, base)){
      is.rel_ver = 1;
      lpm.ver = base.ver;
      uri = npm_str(lpm);
    }
    u = __uri_parse('/'+uri);
    u.is = is;
    u.path = u.pathname = u.path.slice(1);
    u.dir = u.dir.slice(1);
    u.lmod = T_npm_parse(u.path);
    return u;
  }
  if (t=='rel' && tbase=='mod'){
    base.path = __uri_parse(url_uri, base.path).path;
    u = __uri_parse('/'+npm_str(base));
    u.is = is;
    u.path = u.pathname = u.path.slice(1);
    u.dir = u.dir.slice(1);
    u.lmod = T_npm_parse(u.path);
    return u;
  }
  throw Error('npm_url_base('+url_uri+','+base_uri+') failed');
};
const npm_url_base = T(T_npm_url_base);

let semver_re_part = /v?([0-9.]+)([\-+][0-9.\-+A-Za-z]*)?/;
let semver_re_start = new RegExp('^'+semver_re_part.source);
let semver_re = new RegExp('^'+semver_re_part.source+'$');
let semver_parse = semver=>{
  let m = semver.match(semver_re);
  if (!m)
    return
  return {ver: m[1], rel: m[2]||''};
};
exports.semver_parse = semver_parse;

let semver_op_re_start = /^(\^|=|~|>=|<=|\|\|)/;
let T_semver_range_parse = semver_range=>{
  let s = semver_range, m, range = [];
  function is(re){
    m = s.match(re);
    if (!m)
      return;
    s = s.slice(m[0].length);
    return true;
  }
  is(/^ +/);
  while (s){
    let op, ver;
    if (is(semver_op_re_start))
      op = m[0];
    is(/^ +/);
    if (op=='||'){
      range.push({op: '||', ver: ''});
      continue;
    }
    if (!is(semver_re_start))
      throw Error('invalid semver_range '+semver_range);
    ver = m[0].replace(/^v/, '');
    range.push({op: op||'', ver});
    is(/^ +/);
  }
  if (!range.length)
    throw Error('empty semver range');
  return range;
};
exports.T_semver_range_parse = T_semver_range_parse;
let semver_range_parse = T(T_semver_range_parse);
exports.semver_range_parse = semver_range_parse;

function test_lpm(){
  let t = (v, arg)=>assert_obj(v, T_npm_url_base(...arg));
  t({path: '/a/b', origin: 'http://dns', is: {url: 1}},
    ['http://dns/a/b', 'http://oth/c/d']);
  t({path: '/c/a/b', origin: 'http://oth', is: {url: 1, rel: 1}},
    ['./a/b', 'http://oth/c/d']);
  t({path: '/c/d', is: {uri: 1}}, ['/c/d', '/dir/a/b']);
  t({path: '/c//d', is: {uri: 1}}, ['/c//d', '/dir/a/b']);
  t({path: '/dir/a/c/d', is: {uri: 1, rel: 1}}, ['./c/d', '/dir/a/b']);
  t({path: '/dir/c/d', is: {uri: 1, rel: 1}}, ['../c/d', '/dir/a/b']);
  t({path: '/c/d', is: {uri: 1, rel: 1}}, ['../../../../c/d', '/dir/a/b']);
  t({path: 'mod/c/d', is: {mod: 1}}, ['mod/c/d', 'mod/a/b']);
  t({path: 'mod/a/c/d', is: {mod: 1, rel: 1}}, ['./c/d', 'mod/a/b']);
  t({path: 'mod/c/d', is: {mod: 1, rel: 1}}, ['../c/d', 'mod/a/b']);
  t({path: 'mod/c/d', is: {mod: 1, rel: 1}}, ['../../../c/d', 'mod/a/b']);
  t({path: '@mod/v/c/d', is: {mod: 1, rel: 1}},
    ['../../../c/d', '@mod/v/a/b']);
  t({path: 'mod@1.2.3/c/c/d', is: {mod: 1, rel: 1}},
    ['./c/d', 'mod@1.2.3/c/a']);
  t({path: 'mod@1.2.3/c/d', is: {mod: 1, rel_ver: 1}},
    ['mod/c/d', 'mod@1.2.3/c/a']);
  t({path: 'mod@4.5.6/c/d', is: {mod: 1}}, ['mod@4.5.6/c/d', 'mod@1.2.3/c/a']);
  t({path: 'mod/c/d', is: {mod: 1}}, ['mod/c/d', 'other@1.2.3/c/a']);
  t({path: '.git/github/user/repo@v1.2.3/c/d', is: {mod: 1, rel_ver: 1}},
    ['.git/github/user/repo/c/d', '.git/github/user/repo@v1.2.3/c/a']);
  t({path: '.git/github/user/repo/c/d', is: {mod: 1}},
    ['.git/github/user/repo/c/d', '.git/github/other/repo@v1.2.3/c/a']);
  t({path: 'mod/sub//a/c/d', is: {mod: 1, rel: 1}}, ['./c/d', 'mod/sub//a/b']);
  t({path: '@mod/sub/a/c/d', is: {mod: 1, rel: 1}}, ['./c/d', '@mod/sub/a/b']);
  t({path: '.git/github/user/repo@1.2.3/a/c/d', is: {mod: 1, rel: 1}},
    ['./c/d', '.git/github/user/repo@1.2.3/a/b']);
  t = (npm, v)=>assert_obj(v, T_npm_parse(npm));
  t('@noble/hashes@1.2.0/esm/utils.js',
    {name: '@noble/hashes', scoped: true,
    ver: '@1.2.0', _ver: '1.2.0',
    lmod: 'npm/@noble/hashes@1.2.0', path: '/esm/utils.js'});
  t('@noble/hashes@1.2.0/esm/utils.js',
    {name: '@noble/hashes', scoped: true,
    ver: '@1.2.0', _ver: '1.2.0',
    lmod: 'npm/@noble/hashes@1.2.0', path: '/esm/utils.js'});
  t = (lpm, v)=>{
    let t;
    assert_obj(v, t=T_lpm_parse(lpm));
    assert_eq(lpm, T_lpm_str(t));
  };
  t('local/package.json', {reg: 'local', submod: '',
    lmod: 'local', path: '/package.json'});
  t('local/mod/sub//package.json', {reg: 'local', submod: '/mod/sub/',
    lmod: 'local/mod/sub/', path: '/package.json'});
  t('local/mod/sub//dir/file', {reg: 'local', submod: '/mod/sub/',
    lmod: 'local/mod/sub/', path: '/dir/file'});
  t('local/mod/dir/', {reg: 'local', submod: '/mod/dir/',
    lmod: 'local/mod/dir/', path: ''});
  t('local/mod/sub//', {reg: 'local', submod: '/mod/sub/',
    lmod: 'local/mod/sub/', path: '/'});
  t('npm/mod/dir/file', {reg: 'npm', submod: '',
    lmod: 'npm/mod', path: '/dir/file'});
  t('npm/mod/dir/file', {reg: 'npm', submod: '',
    lmod: 'npm/mod', path: '/dir/file'});
  t('npm/mod/dir/', {reg: 'npm', submod: '/dir/',
    lmod: 'npm/mod/dir/', path: ''});
  t('npm/mod/sub//', {reg: 'npm', submod: '/sub/',
    lmod: 'npm/mod/sub/', path: '/'});
  t = (v, lpm)=>assert_eq(v, !!lpm_parse(lpm));
  t(true, 'npm/mod/dir/file.js');
  t(true, 'npm/mod/dir//file.js');
  t = (dep, v)=>assert_eq(v,
    npm_dep_parse({mod_self: 'npm/self@4.5.6', imp: 'npm/xxx', dep}));
  t('npm:react', 'npm/react');
  t('npm:react/index.js', 'npm/react/index.js');
  t('npm:@mod/sub@1.2.3/index.js', 'npm/@mod/sub@1.2.3/index.js');
  t('git://github.com/mochajs/mocha', 'git/github/mochajs/mocha');
  t('git://github.com/mochajs/mocha.git#4727d357ea',
    'git/github/mochajs/mocha@4727d357ea');
  t('git://github.com/mochajs/mocha.git/index.js#4727d357ea',
    'git/github/mochajs/mocha@4727d357ea/index.js');
  t('git://github.com/mochajs/mocha/dir/file.js',
    'git/github/mochajs/mocha/dir/file.js');
  t('git://github.com/npm/cli.git#v1.0.27', 'git/github/npm/cli@v1.0.27');
  t('https://github.com/npm/cli.git#v1.0.27', 'git/github/npm/cli@v1.0.27');
  t('https://github.com/npm/cli#v1.0.27', 'git/github/npm/cli@v1.0.27');
  t('https://gitlab.com/npm/cli#v1.0.27', 'git/gitlab/npm/cli@v1.0.27');
  t('file:./dir/index.js', 'npm/self@4.5.6/dir/index.js');
  t('./dir/index.js', 'npm/self@4.5.6/dir/index.js');
  t = (imp, dep, v)=>
    assert_eq(v, npm_dep_parse({mod_self: 'npm/mod', imp, dep}));
  t('npm/react', '^18.3.1', 'npm/react@18.3.1');
  t('npm/react/file', '^18.3.1', 'npm/react@18.3.1/file');
  t('npm/xxx', '/', 'local');
  t('npm/xxx/file', '/', 'local/file');
  t('npm/xxx/file', '/DIR', 'local/DIR//file');
  t('npm/react', '=18.3.1', 'npm/react@18.3.1');
  t('npm/react', '18.3.1', 'npm/react@18.3.1');
  t('npm/react', '>=18.3.1', '-');
  t('npm/pages/_app.tsx', './pages', 'npm/mod/pages/_app.tsx');
  t('npm/loc/file.js', '/loc', 'local/loc//file.js');
  t('npm/react', '^18.3.1', 'npm/react@18.3.1');
  t('npm/react/index.js', '^18.3.1', 'npm/react@18.3.1/index.js');
  t('npm/rmod', 'npm:react@18.3.1', 'npm/react@18.3.1');
  t('npm/os/dir/index.js', '.git/github/repo/mod',
    'git/github/repo/mod/dir/index.js');
  //t('npm/os/dir/index.js', 'git:user/github/repo/mod',
  //  'git/github/repo/mod/dir/index.js');
  t = (npm, v)=>assert_eq(v, npm_to_lpm(npm));
  // XXX need to add to npm_parse() support for .local ,git...
  // and make current version a more low level: npm_basic_parse()
  t('mod', 'npm/mod');
  t('mod/dir/file', 'npm/mod/dir/file');
  t('@mod/sub', 'npm/@mod/sub');
  t('@mod/sub/', 'npm/@mod/sub/');
  t('@mod/sub/file', 'npm/@mod/sub/file');
  t('.npm/mod', 'npm/mod');
  t('.npm/mod/dir/file', 'npm/mod/dir/file');
  t('.git/github/a_user/a_repo', 'git/github/a_user/a_repo');
  t('.git/github/a_user/a_repo/dir/file', 'git/github/a_user/a_repo/dir/file');
  t('.local', 'local');
  t('.local/file.js', 'local/file.js');
  t('.none/github/a_user/a_repo/dir/file');
  t = (lpm, v)=>assert_eq(v, lpm_to_sw_uri(lpm));
  t('local/dir/file.js', '/dir/file.js');
  t('npm/mod/file.js', '/.lif/npm/mod/file.js');
  t = (lpm, v)=>assert_eq(v, lpm_to_npm(lpm));
  t('npm/mod', 'mod');
  t('npm/mod/file.js', 'mod/file.js');
  t('npm/mod/sub//file.js', 'mod/sub//file.js');
  t(lpm_parse('npm/mod/sub//file.js'), 'mod/sub//file.js');
  t('git/github/user/repo', '.git/github/user/repo');
  t('git/gitlab/user/repo/file.js', '.git/gitlab/user/repo/file.js');
  t('local', '.local');
  t('local/file.js', '.local/file.js');
  t('local/dir/file.js', '.local/dir/file.js');
  t('local/sub//dir/file.js', '.local/sub//dir/file.js');
  t = (lpm, lmod, path)=>{
    let u = T_lpm_parse(lpm);
    assert_eq(path, u.path);
    assert_eq(lmod, u.lmod);
    assert_eq(lmod, T_lpm_lmod(lpm));
    assert_eq(lpm, T_lpm_str(u));
  };
  t('local', 'local', '');
  t('local/main.tsx', 'local', '/main.tsx');
  t('local/mod//dir/main.tsx', 'local/mod/', '/dir/main.tsx');
  t('local/mod//', 'local/mod/', '/');
  t('local/mod/', 'local/mod/', '');
  t('npm/mod', 'npm/mod', '');
  t('npm/mod/dir/main.tsx', 'npm/mod', '/dir/main.tsx');
  t('git/github/user/repo', 'git/github/user/repo', '');
  t('git/github/user/repo/dir/file.js',
    'git/github/user/repo', '/dir/file.js');
  t('git/github/user/repo/mod//dir/file.js',
    'git/github/user/repo/mod/', '/dir/file.js');
  t = (npm, base, v)=>assert_eq(v, npm_ver_from_base(npm, base));
  t('mod/dir', 'mod@1.2.3/file', 'mod@1.2.3/dir');
  t('mod/dir', 'mod/file');
  t('mod/dir', 'mod/dir');
  t('mod/dir', 'other@1.2.3/file');
  t('.local/dir/file', '.local/dir@1.2.3/file');
  t('.git/github/user/repo/dir', '.git/github/user/repo@1.2.3/file',
    '.git/github/user/repo@1.2.3/dir');
  t = (lpm, base, v)=>assert_eq(v, lpm_ver_from_base(lpm, base));
  t('npm/mod/dir', 'npm/mod@1.2.3/file', 'npm/mod@1.2.3/dir');
  t('npm/mod/dir', 'npm/mod/file');
  t('npm/mod/dir', 'npm/mod/dir');
  t('npm/mod/dir', 'npm/other@1.2.3/file');
  t('local/dir/file', 'local/dir@1.2.3/file');
  t('git/github/user/repo/dir', 'git/github/user/repo@1.2.3/file',
    'git/github/user/repo@1.2.3/dir');
  t = (semver, v)=>assert_obj(v, semver_parse(semver));
  t('1.2.3', {ver: '1.2.3', rel: ''});
  t('1.2.3-abc', {ver: '1.2.3', rel: '-abc'});
  t('1.2.3-abc2-341.3', {ver: '1.2.3', rel: '-abc2-341.3'});
  t('x1.2.3-abc2-341.3');
  t('1.2.3x-abc2-341.3');
  t('1.2.3-a_');
  t = (range, v)=>assert_obj(v, semver_range_parse(range));
  t('1.2.3', [{ver: '1.2.3'}]);
  t('v1.2.3-ab', [{ver: '1.2.3-ab'}]);
  t('1.2.3 >=v1.3.4', [{op: '', ver: '1.2.3'}, {op: '>=', ver: '1.3.4'}]);
  t(' = 1.2.3 >= 1.3.4 ', [{op: '=', ver: '1.2.3'}, {op: '>=', ver: '1.3.4'}]);
  t('=1.2.3 +1.3.4');
  t('=1.2.3 x.2.3');
  t('^1.2.3 || ^4.5.6', [{op: '^', ver: '1.2.3'}, {op: '||', ver: ''},
    {op: '^', ver: '4.5.6'}]);
  t('  ');
}
test_lpm();

const uri_enc = path=>encodeURIComponent(path)
  .replaceAll('%20', ' ').replaceAll('%2F', '/').replaceAll('%2B', '.');
const uri_dec = uri=>decodeURIComponent(uri);

const esc_regex = s=>s.replace(/[[\]{}()*+?.\\^$|\/]/g, '\\$&');

const match_glob_to_regex_str = glob=>{
  return '^(?:'
  +glob.replace(/(\?|\*\*|\*)|([^?*]+)/g,
    m=>m=='?' ? '[^/]' : m=='**' ? '(.*)' : m=='*' ? '([^/]*)' : esc_regex(m))
  +')$';
};
const match_glob_to_regex = glob=>new RegExp(match_glob_to_regex_str(glob));
const match_glob = (glob, value)=>
  match_glob_to_regex(glob).test(value);
const qs_enc = (q, qmark)=>{
  let _q = ''+(new URLSearchParams(q));
  return _q ? (qmark ? '?' : '')+_q : '';
};
let qs_append = (url, q)=>{
  let _q = typeof q=='string' ? q : ''+(new URLSearchParams(q));
  if (!_q)
    return url;
  return url+(url.includes('?') ? '&' : '?')+_q;
};

exports.path_ext = path_ext;
exports._path_ext = _path_ext;
exports.path_file = path_file;
exports.path_dir = path_dir;
exports.path_is_dir = path_is_dir;
exports.path_join = path_join;
exports.path_prefix = path_prefix;
exports.url_parse = url_parse;
exports.T_url_parse = T_url_parse;
exports.npm_url_base = npm_url_base;
exports.T_npm_url_base = T_npm_url_base;
exports.uri_enc = uri_enc;
exports.uri_dec = uri_dec;
exports.qs_enc = qs_enc;
exports.qs_append = qs_append;
exports.match_glob_to_regex = match_glob_to_regex;
exports.match_glob = match_glob;

// useful debugging script: stop on first time
//{ if (file.includes('getProto') && match.includes('getPro') && !self._x_) {self._x_=1; debugger;} }
const _debugger = function(stop){
  if ((!arguments.length || stop) && !self._x_){
    self._x_=1;
    debugger; // eslint-disable-line no-debugger
  }
};
exports._debugger = _debugger;
// useful for locating who is changes window.location
const detect_unload = ()=>addEventListener('beforeunload',()=>{debugger}); // eslint-disable-line no-debugger
exports.detect_unload = detect_unload;

function Scroll(s){
  if (!(this instanceof Scroll))
    return new Scroll(...arguments);
  this.s = s;
  this.diff = [];
  this.len = this.s.length;
}
Scroll.prototype.get_diff_pos = function(start, end){
  if (start>end)
    throw Error('diff start>end');
  if (end>this.len)
    throw Error('diff out of s range');
  let i, d;
  // use binary-search in the future
  for (i=0; d=this.diff[i]; i++){
    if (start>=d.end)
      continue;
    if (end<=d.start)
      return i;
    throw Error('diff overlaping');
  }
  return i;
};
Scroll.prototype.splice = function(start, end, s){
  // find the frag pos of src in dst, and update
  let i = this.get_diff_pos(start, end);
  this.diff.splice(i, 0, {start, end, s});
};
Scroll.prototype.out = function(){
  let s = '', at = 0, d;
  for (let i=0; d=this.diff[i]; i++){
    s += this.s.slice(at, d.start)+d.s;
    at = d.end;
  }
  s += this.s.slice(at, this.len);
  return s;
};
exports.Scroll = Scroll;

function test_Scroll(){
  let t = v=>assert_eq(v, s.out());
  let s = Scroll('0123456789abcdef');
  s.splice(3, 5, 'ABCD');
  t('012ABCD56789abcdef');
  s.splice(6, 7, 'QW');
  t('012ABCD5QW789abcdef');
  s.splice(7, 8, '  ');
  t('012ABCD5QW  89abcdef');
  s.splice(6, 6, '-');
  s.splice(7, 7, '-');
  s.splice(8, 8, '-');
  t('012ABCD5-QW-  -89abcdef');
}
test_Scroll();

async function ecache(table, id, fn){
  let t, ret;
  if (t = table[id])
    return await t.wait;
  t = table[id] = {id, wait: ewait()};
  try {
    ret = await fn(t);
    t.wait_complete = true;
  } catch(err){
    throw t.wait.throw(err);
  }
  return t.wait.return(ret);
}
ecache.get_sync = (table, id)=>table[id]?.wait_complete && table[id];
exports.ecache = ecache;

exports.html_elm = (name, attr)=>{
  let elm = document.createElement(name);
  for (let [k, v] of OF(attr))
    elm[k] = v;
  return elm;
};
exports.html_favicon_set = href=>{
  let link = document.createElement('link');
  link.rel = 'icon';
  link.href = href;
  document.head.appendChild(link);
};
exports.html_stylesheet_add = href=>{
  // also possible with import
  //let style = (await import(href, {with: {type: 'css'}})).default;
  //document.adoptedStyleSheets = [style];
  let link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
};

export default exports;

