#!/usr/bin/env node
import server from '../lif-kernel/server.js';
let map = {
  '.': './index.html',
  '/lif_kernel_sw.js': './',
  '/style.css': './',
  '/lif-basic': './',
  '/lif-kernel': '../lif-kernel/',
};
server({map});
