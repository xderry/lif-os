#!/usr/bin/env node
import server from '../lif-kernel/server.js';
let map = {
  '.': './index.html',
  '/lif_kernel_sw.js': './',
  '/lif-kernel': '../lif-kernel/',
  '/lif-basic': './',
};
server({map});server({map});
