#!/usr/bin/env node
import server from '../lif-kernel/server.js';
let map = {
  '/lif-os-boot': './',
  '/lif-os': '../',
  // '/lif-kernel': '../lif-kernel/', // local development
};
server({map, root: import.meta.dirname});
