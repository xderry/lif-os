#!/usr/bin/env node
import server from 'lif-kernel/server_lib.js';
server({map: {'/lif-basic': '.', '/index.html': './index.html'},
  root: import.meta.dirname});
