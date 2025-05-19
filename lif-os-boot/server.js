#!/usr/bin/env node
import server from '../lif-kernel/server.js';
server({map: {'/lif-os': '../'}, root: import.meta.dirname});
