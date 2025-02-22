#!/usr/bin/env node
import server from '../lif-kernel/server.js';
//import server from './node_modules/lif-kernel/server.js';
import process from 'process';
let cwd = process.cwd();
let map = {
  '/lif-kernel': cwd+'/node_modules/lif-kernel',
  '/lif-basic': cwd,
  '/': cwd,
};
server({map});
