import React from 'react';
window.React = React;
console.log('index_boot.js started');
let app = (await import('./index.tsx')).default;
export default app;

