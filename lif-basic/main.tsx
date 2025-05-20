// from code.esm.sh
import React from 'react';
import {createRoot, render} from 'react-dom';
import App from './app.tsx';
// set favicon
let link = document.createElement('link');
link.rel = 'icon';
link.href = '/.lif/npm/lif-kernel/favicon.ico';
document.head.appendChild(link);
// add stylesheet
link = document.createElement('link');
link.rel = 'stylesheet';
link.href = '/.lif/npm/lif-basic/style.css';
document.head.appendChild(link);
// start app
const root = createRoot(document.getElementById("root"));
root.render(<App />);
// playground
let play = 0;
if (play){
  let {create} = await import('./play.js');
  let m = await import('./fetch_tr.js');
  let p = create();
  m.init_ev(p.ev);
}
