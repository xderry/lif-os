import React from 'react';
window.React = React;
import {Buffer} from 'buffer';
window.Buffer = Buffer;
console.log('os boot started');
import {createRoot} from "react-dom";
let App = (await import('pages/_app.tsx')).default;
//import App from "pages/_app.tsx";
let _root = document.body.appendChild(document.createElement('div'));
let root = createRoot(_root);
console.log('app render');
root.render(<App />);
console.log('os_boot complete');
export default App;

