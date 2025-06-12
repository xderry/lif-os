#!/usr/bin/env node
import server from '../lif-kernel/server_lib.js';
server({map: {'/lif-os': '../'}, root: import.meta.dirname});
