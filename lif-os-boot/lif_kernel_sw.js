/*global importScripts*/
//importScripts('https://unpkg.com/lif-kernel@1.1.2/kernel.js');
let u = new URLSearchParams(location.search);
let base = u.get('lif_kernel_base') || '/lif-kernel/';
importScripts(base+'kernel.js');
