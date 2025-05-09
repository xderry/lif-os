#!/usr/bin/env node
import server from 'lif-kernel/server.js';
let map = {
  '/lif-basic': './',
  '/lif-kernel': '../lif-kernel/', // for local kernel development
};
server({map, root: import.meta.dirname});
