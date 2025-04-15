#!/usr/bin/env node
import server from '../lif-kernel/server.js';
let map = {
  '/lif-basic': './',
};
server({map, root: import.meta.dirname});
