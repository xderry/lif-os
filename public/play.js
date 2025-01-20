import 'https://unpkg.com/@babel/standalone@7.26.4/babel.js';
let Babel = window.Babel;
import React from "https://esm.sh/react@19/?dev";
import ReactDOMClient from "https://esm.sh/react-dom@19/client?dev";
import {EditorView, basicSetup} from "https://esm.sh/codemirror"
let CodeMirror = window.CodeMirror;
//import CodeMirror from "https://esm.sh/codemirror"
let parser = Babel.packages.parser;
let traverse = Babel.packages.traverse.default;
var editor = document.querySelector('.editor');
let cm = CodeMirror(editor, {lineNumbers: true, mode: 'javascript'});
cm.g = ()=>cm.getValue();
cm.s = v=>cm.setValue(v);
cm.g('42');

// let url = 'https://unpkg.com/react@18/umd/react.development.js';
let url = 'https://unpkg.com/react-dom@19.0.0/cjs/react-dom.development.js';
let res = await fetch(url);
let src = await res.text();
let p = parser.parse(src, {sourceType: 'module'});
console.log(p);
let b = p.program.body;
let exports = [];
let requires = [];
let get_scope_type = path=>{
  for (; path; path=path.parentPath){
    let b = path.scope.block;
    if (b.async)
      return 'async';
    if (b.type=='FunctionExpression' ||
      b.type=='ArrowFunctionExpression' ||
      b.type=='FunctionDeclaration')
    {
      return b.async ? 'async' : 'sync';
    }
    if (b.type=='Program')
      return 'program';
  }
};
traverse(p, {
  AssignmentExpression: function(path){
    let n = path.node, l = n.left, r = n.right, v;
    if (n.operator=='=' &&
      l.type=='MemberExpression' &&
      l.object.name=='exports' && l.object.type=='Identifier' &&
      l.property.type=='Identifier')
    {
      exports.push(v=l.property.name);
      let type = get_scope_type(path);
      //console.log(l.property.name);
      console.log('found export('+v+'): '+b.slice(n.start, n.end), type, path);
    }
  },
  CallExpression: function(path){
    let n = path.node, v;
    if (n.callee.type=='Identifier' && n.callee.name=='require' &&
      n.arguments.length==1 && n.arguments[0].type=='StringLiteral')
    {
      requires.push(v = n.arguments[0].value);
      let type = get_scope_type(path);
      console.log('found require('+v+'): '+b.slice(n.start, n.end), type, path);
    }
  },
});

