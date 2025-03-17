#!/usr/bin/env node
import server from '../lif-kernel/server.js';
let map = {
  '.': './index.html',
  '/lif_kernel_sw.js': './',
  '/lif-os-boot': './',
  '/lif-kernel': '../lif-kernel/',
  '/lif-os': '../',
};
server({map});
