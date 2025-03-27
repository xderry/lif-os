#!/usr/bin/env node
import server from '../lif-kernel/server.js';
let map = {
  '/lif-os-boot': './',
  '/lif-kernel': '../lif-kernel/',
  '/lif-os': '../',
};
let root = import.meta.dirname;
server({map, root});
