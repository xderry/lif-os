import 'https://unpkg.com/@babel/standalone@7.26.4/babel.js';
import React from "https://esm.sh/react@19/?dev";
import ReactDOMClient from "https://esm.sh/react-dom@19/client?dev";
import {EditorView, basicSetup} from "https://esm.sh/codemirror"
//import CodeMirror from "https://esm.sh/codemirror"
let parser = Babel.packages.parser;
var editor = document.querySelector('.editor');
let cm = CodeMirror(editor, {lineNumbers: true, mode: 'javascript'});
cm.g = ()=>cm.getValue();
cm.s = v=>cm.setValue(v);
console.log('loaded2', parser);
cm.g('abc');

