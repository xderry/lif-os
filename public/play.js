import 'https://unpkg.com/@babel/standalone@7.26.4/babel.js';
import React from "https://esm.sh/react@19/?dev";
import ReactDOMClient from "https://esm.sh/react-dom@19/client?dev";
import {EditorView, basicSetup} from "https://esm.sh/codemirror"
let Babel = window.Babel;
let CodeMirror = window.CodeMirror;
//import CodeMirror from "https://esm.sh/codemirror"
let parser = Babel.packages.parser;
let traverse = Babel.packages.traverse.default;
console.log('tr', traverse);
var editor = document.querySelector('.editor');
let cm = CodeMirror(editor, {lineNumbers: true, mode: 'javascript'});
cm.g = ()=>cm.getValue();
cm.s = v=>cm.setValue(v);
console.log('loaded2', parser);
cm.g('abc');

let url = 'https://unpkg.com/react@18/umd/react.development.js';
let res = await fetch(url);
let src = await res.text();
let p = parser.parse(src);
let b = p.program.body;
traverse(p, {
  AssignmentExpression: function(path){
    let n = path.node, l = n.left, r = n.right;
    if (!(n.operator=='=' &&
      l.type=='MemberExpression' &&
      l.object.name=='exports' && l.object.type=='Identifier' &&
      l.property?.type=='Identifier'))
    {
      return;
    }
    console.log(l.property.name);
  },
});

