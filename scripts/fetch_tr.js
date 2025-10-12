#!/usr/bin/env node
// scroll.js - implements a scroll of bytes
import util from '../lif-kernel/util.js';
let {assert_eq, str} = util;
let {qw} = str;
const exports = {};
function Scroll(s){
  if (!(this instanceof Scroll))
    return new Scroll(...arguments);
  this.s = s;
  this.diff = [];
  this.len = this.s.length;
}
exports.Scroll = Scroll;

let Buffer = globalThis.Buffer = (await import('buffer@6.0.3')).default.Buffer;
import mn_mod from 'bip39@3.1.0';
const sha256_1 = await import("@noble/hashes@1.8.0/sha256");
let min_space = s=>qw(s).join(' ');
//let mn_mod = await import('web-bip39@0.0.3');
// import mn_mod from 'web-bip39@0.0.3';
let assert_throw;
let assert = (ok, msg)=>{
  if (ok)
    return;
  console.log('assert:', msg);
  if (assert_throw)
    throw Error('assert: '+msg);
  debugger; // eslint-disable-line no-debugger
};
import mn_eng_t from 'bip39@3.1.0/src/wordlists/english.json?raw=1'
  with {type: 'json'};
let mn_hex2eng_orig = mn=>mn_mod.entropyToMnemonic(mn, mn_t);
let mn_eng2hex_orig = mn=>mn_mod.mnemonicToEntropy(min_space(mn), mn_t);
let mn_t = mn_eng_t; //mn_mod.wordlists.EN;

let s_mk = fn=>s=>s.split('').map(fn).join('');
let arr_do_a_b = (a, b, fn, fn_in)=>{
  let _a = a, _b = b;
  if (fn_in){
    a = fn_in(a);
    b = fn_in(b);
  }
  assert(a.length==b.length, 'length mismatch');
  let c = a.map((v, i)=>fn(a[i], b[i]));
  return c;
};
let i2base = (i, base, width)=>i.toString(base).padStart(width, '0');
let i2bin = i=>i2base(i, 2, 8);
let i2hexb = i=>i2base(i, 16, 2);
let bin2i = bin=>parseInt(bin, 2);
let bytes2bin = bytes=>bytes.map(i2bin).join('');
let bytes2hex = bytes=>to_i_a(bytes).map(i2hexb).join('');
let to_uint8a = b=>{
  if (typeof b=='string')
    b = Buffer.from(b, 'utf-8');
  assert(Array.isArray(b) || b instanceof Buffer || b instanceof Uint8Array);
  return Uint8Array.from(b);
};
let to_i_a = b=>Array.from(to_uint8a(b));
let sha256 = b=>sha256_1.sha256(to_uint8a(b));
let ent_csum_calc = ent_buf=>{ // deriveChecksumBits
  let hash = sha256(ent_buf);
  let ent_bits = ent_buf.length * 8;
  let CS = ent_bits / 32;
  return bytes2bin(Array.from(hash)).slice(0, CS);
}
let ent_exp_csum = 0;
let mn_eng2hex = (nm, opt)=>{ // mnemonicToEntropy
  let wl = opt?.mn_t||mn_t;
  let exp_csum = opt?.ent_exp_csum!=null ? opt.ent_exp_csum : 0;
  assert(wl);
  let words = qw(nm);
  assert_eq(words.length%3, exp_csum, 'csum mismatch');
  // convert word indices to 11 bit binary strings
  let bits = words.map(word=>{
    let index = wl.indexOf(word);
    assert(index>=0, 'invalid mn')
    return i2base(index, 2, 11);
  }).join('');
  // split the binary string into ENT/CS
  let dividerIndex = Math.floor(bits.length/33)*32;
  let ent_bits = bits.slice(0, dividerIndex);
  let csum_bits = bits.slice(dividerIndex);
  // calculate the checksum and compare
  let ent_bytes = ent_bits.match(/(.{1,8})/g).map(bin2i);
  assert(ent_bytes.length>=16, 'ent min 16 bytes');
  assert(ent_bytes.length<=32, 'ent max 32 bytes');
  assert(ent_bytes.length%4==0, 'mod 4 bytes');
  let ent = Buffer.from(ent_bytes);
  let new_csum = ent_csum_calc(ent);
  assert_eq(new_csum, csum_bits, 'invalid ent csum');
  if (opt?.csum_bits)
    return csum_bits;
  return ent.toString('hex');
};
let mn_hex2eng = (ent, opt)=>{ // entropyToMnemonic
  let wl = opt?.mn_t||mn_t;
  assert(wl,length==2048);
  if (!Buffer.isBuffer(ent))
    ent = Buffer.from(ent, 'hex');
  // 128 <= ENT <= 256
  assert(ent.length>=16, 'min 16 bytes');
  assert(ent.length<=32, 'max 32 bytes');
  assert(ent.length%4==0, ' mod 4 bytes');
  let ent_bits = bytes2bin(Array.from(ent));
  let csum_bits = ent_csum_calc(ent);
  if (opt?.csum_bits)
    return csum_bits;
  let bits = ent_bits+csum_bits;
  let chunks = bits.match(/(.{1,11})/g);
  let words = chunks.map(binary=>wl[bin2i(binary)]);
  return words.join(' ');
};

let heb_t = 'אבגדהוזחטיכלמנסעפצקרשת '.split('');
let eng_t = 'abcdefghijklmnopqrstuvyxyz '.split('');
let heg_u_t = 'A B G D E V Z ChT Y K L M N S AiP TsQ R ShTh'.split('');
let heg_l_t = 'A b G D E V Z ChT Y k L M N S AiF TsQ R ShTh'.split('');
let heb2_t =   'א ב ג ד ה ו ז ח ט י כ ל מ נ ס ע פ צ ק ר ש ת  '.split('');
let heg2_u_t = 'A B G D E V Z H T Y K L M N s I P X Q R S t '.split('');
let heg2_l_t = 'A b G D E V Z H T Y k L M N s I F X Q R s t '.split('');
let engp_t = 'qwertyuiopasdfghjkl;zxcvbnm,. '.split('');
let hebp_t = "/'קראטוןםפשדגכעיחלךףזסבהנמצתץ ".split('');
let oft_t = 'qgde3rty8uiojh9014w57f2s6ab'.split('');
let hex_t = '0123456789abcdef'.split('');
let t2i = (t, c)=>{
  let i = t.indexOf(c);
  assert(i>=0, `not in map(${c})`);
  return i;
};
let i2t = (t, i)=>{
  assert(i>=0 && i<t.length, 'not in range');
  return t[i];
};
let str2ch_a = s_a=>Array.isArray(s_a) ? s_a : s_a.split('');
let t2i_mk = t=>s=>t2i(t, s);
let i2t_mk = t=>i=>i2t(t, i);
let t2t_s = (t1, t2, s)=>s.split('').map(c=>i2t(t2, t2i(t1, c))).join('');
let cc2i = c=>c.charCodeAt();
let i2cc = c=>String.fromCharCode();
let hex2i = hex=>t2i(hex_t, hex);
let hex2i_a = hex=>str2ch_a(hex).map(hex2i);
let i2hex = i=>i2t(hex_t, i);
let i2hex_a = i=>i.map(i2hex);
let i2hex_s = i=>i2hex_a(i).join('');
let eng2i = eng=>t2i(eng_t, eng);
let eng2i_a = eng=>str2ch_a(eng).map(eng2i);
let i2eng = i=>i2t(eng_t, i);
let i2eng_a = i=>i.map(i2eng);
let i2eng_s = i=>i2eng_a(i).join('');
let hex2heb = hex=>t2t_s(hex_t, heb_t, hex);
let heb2hex = heb=>t2t_s(heb_t, hex_t, heb);
let iadd_hex = (a, b)=>(a + b)% 16;
let ineg_hex = a=>(16-a)%16;
let add_hex = (a, b)=>i2hex_s(arr_do_a_b(a, b, iadd_hex, hex2i_a));
let neg_hex = a=>i2hex_s(arr_do_a_b(a, a, ineg_hex, hex2i_a));
let oft2eng= s=>s.split('').map(c=>i2t(eng_t, t2i(oft_t, c))).join('');
let eng2oft = s=>s.split('').map(c=>i2t(oft_t, t2i(eng_t, c))).join('');
let engp2heb= s=>s.split('').map(c=>i2t(hebp_t, t2i(engp_t, c))).join('');
let D = 0;
let group = s=>s.match(/..../g).join(' ');
let rand = ()=>bytes2hex(sha256(''+Math.random()+Date.now())).slice(32);
let samp = (s, n)=>{
  if (n==undefined)
    n = 3;
  let sample = in_full || s.length<2*n ? s : s.slice(0, n)+'...'+s.slice(-n);
  return ''+s.length+' :'+sample+':';
};
let tr1_z = ({mno, r})=>{
  let eng = oft2eng(mno);
  let ent = mn_eng2hex(eng);
  r ||= rand();
  let _k1 = r;
  let _k2 = add_hex(ent, _k1);
  let k1 = hex2heb(_k1);
  let k2 = hex2heb(_k2);
  D && console.log('eng', eng, 'ent', ent);
  ev_log(`k1 ${group(k1)}\nk2 ${group(k2)}\nr ${group(r)}`);
  return {k1, k2};
}
let tr1_uz = ({k1, k2})=>{
  let _k1 = heb2hex(k1);
  let _k2 = heb2hex(k2);
  let ent = add_hex(_k2, neg_hex(_k1));
  let mn = mn_hex2eng(ent);
  let mno = eng2oft(mn);
  D && console.log('k1', k1, 'k2', k2, 'mno', mno);
  ev_log('mn '+samp(mn, 5));
  D && console.log('ent', ent);
  return {mn};
}
let rfix = [
  '29849364738742abcbdefbabcbde8247',
  '317844bff21fa72f9340238320785d93',
];
function test(){
  //debugger; // eslint-disable-line no-debugger
  let t = (mn, hex, csum)=>{
    assert_eq(mn_eng2hex_orig(mn), hex);
    assert_eq(mn_eng2hex(mn), hex);
    assert_eq(mn_hex2eng_orig(hex), mn);
    assert_eq(mn_hex2eng(hex), mn);
    assert_eq(mn_eng2hex(mn, {csum_bits: 1}), csum);
    assert_eq(mn_hex2eng(hex, {csum_bits: 1}), csum);
  };
  assert_eq(bytes2hex([0x38, 2, 0xfe]), '3802fe');
  assert_eq(bytes2hex(sha256('hello\n')),
    '5891b5b522d5df086d0ff0b110fbd9d21bb4fc7163af34d08286a2e846f6be03');
  let mn1, ent1;
  let r1 = '29849364738742abcbdefbabcbde8247';
  t(mn1='hand item rail bind three toast lock pool usage impact only aunt',
    ent1='68cedac38b2e11c620dd40ef8e3a6c07', '1010');
  t('mammal mutual endless strong sadness globe parade february nice autumn park item',
    '86b24526eb9bdec6a802a29561f6813b', '0110');
  t = (a, b, v)=>assert_eq(add_hex(a, b), v);
  t('39a2b', '032f1', '3cc1c');
  t('0318ed', '27a0fe', '2ab8db');
  t = (a, v)=>{assert_eq(neg_hex(a), v); assert_eq(neg_hex(v), a); };
  t('39a2b', 'd76e5');
  t = (a, v)=>assert_eq(hex2heb(a), v);
  t('39a2b', 'דיכגל');
  let mno = eng2oft(mn1);
  let k = tr1_z({mno, r: r1});
  console.log(k);
  let o = tr1_uz(k);
  assert_eq(o.mn, mn1);
  k = tr1_z({mno, r: 0});
  console.log(k);
  o = tr1_uz(k);
  assert_eq(o.mn, mn1);
}
let in_uz;
let in_e;
let in_hx;
let in_full; // show full (not sample)
let acc = '';
let ev = {};
let res;
let _ev_log = '', _ev_err;
let ev_err = msg=>{
  _ev_err += 'XXX '+msg+'\n';
  console.log(msg);
  ev.log?.(_ev_log+'\n\n'+_ev_err);
};
let ev_log = msg=>{
  _ev_log += ''+msg+'\n';
  console.log(msg);
  ev.log?.(_ev_log+'\n\n'+_ev_err);
};
let _in_e = v=>in_e ? eng2oft(v) : v;
let evkey = v=>{
  assert_throw = true;
  _ev_err = _ev_log = '';
  let _acc = acc;
  if (v=='{space}')
    v = ' ';
  if (v.length==1){
    if (v=='=')
      acc = _in_e(ev.getv());
    else if (v=='+')
      acc += _in_e(ev.getv());
    else if (v=='E')
      in_e = !in_e;
    else if (v=='U')
      in_uz = !in_uz;
    else if (v=='X')
      in_hx = !in_hx;
    else if (v=='F')
      in_full = !in_full;
    else if (v.match(/^[A-Z]$/));
    else
      acc += _in_e(v);
  } else if (v=='Delete' || v=='{bksp}')
    acc = acc.slice(0, -1);
  try {
    if (in_uz)
      check_uz();
    else
      check_z();
  } catch(err){
    ev_err(err);
  }
  ev_log('acc> '+samp(acc, 3));
  ev_log((in_e?'E':'o')+' '+(in_uz?'Uz':'z ')
    +' '+(in_hx?'Hx':'hb')+' '+(in_full?'Full':'samp'));
};
export let check_z = ()=>{
  let e, v = acc;
  try {
    e = oft2eng(v);
  } catch(err){
    return ev_err('not in map: '+err);
  }
  let w = qw(e);
  ev_log(`acc_z> ${w.length}:${w[w.length-1]?.length||0} ${samp(e, 3)}`);
  let len = w.length-(e.slice(-1)==' ' ? 0 : 1);
  for (let i=0; i<len; i++)
    t2i(mn_t, w[i]);
  if (!w.length)
    return;
  if (len<w.length && !mn_t.includes(w[len])){
    assert(mn_t.some(v=>v.startsWith(w[len])), 'no map start');
    return;
  }
  if (w.length!=12)
    return;
  let k = tr1_z({mno: v, r: 0 && rfix[1]});
  let o = tr1_uz(k);
};
export let check_uz = ()=>{
  let e, v = acc;
  e = v.replace(/(\S) (\S)/g, '$1$2'); // merge single space
  try {
    let _e = v.replace(/ /g, '');
    (in_hx ? hex2heb : heb2hex)(_e);
  } catch(err){
    return ev_err('not in map:'+err);
  }
  let w = qw(e);
  console.log(w);
  ev_log(`acc_uz> ${w.length}:${w[w.length-1]?.length||0} ${samp(e, 3)}`);
  if (w.length!=2)
    return;
  if (w[0].length!=32)
    return ev_err('w1 short/long');
  if (w[1].length!=32)
    return ev_err('w2 short/long');
  try {
    let o = tr1_uz({k1: w[0], k2: w[1]});
  } catch(err){
    ev_err(err);
  }
};
exports.test = test;
try {
  test();
  console.log('pass');
} catch(err){
  console.error('failed tests', err);
}
export function init_ev(_ev){
  ev = _ev;
  ev.onkey = evkey;
  evkey('');
}
export default exports;

