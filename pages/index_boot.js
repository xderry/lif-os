import React from 'react';
window.React = React;
let app = (await import('./index.tsx')).default;
export default app;

