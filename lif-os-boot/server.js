#!/usr/bin/env node
import server from '../lif-kernel/server.js';
let map = {
  '.': './index.html',
  '/lif_kernel_sw.js': './',
  '/lif-kernel': './node_modules/lif-kernel/',
  '/lif-os-boot': './',
  '/lif-os': './../',
};
server({map});
