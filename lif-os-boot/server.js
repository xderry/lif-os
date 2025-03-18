#!/usr/bin/env node
import server from '../lif-kernel/server.js';
let map = {
  '/lif-os-boot': './',
  '/lif-kernel': '../lif-kernel/',
  '/lif-os': '../',
};
server({map});
