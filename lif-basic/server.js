#!/usr/bin/env node
import server from '../lif-kernel/server.js';
let map = {
  '/lif-basic': './',
  '/lif-kernel': '../lif-kernel/',
};
server({map});
