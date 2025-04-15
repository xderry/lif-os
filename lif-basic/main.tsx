// from code.esm.sh
import React from "react";
import {createRoot} from "react-dom";
import App from "./app.tsx";

// set favicon
let link = document.createElement('link');
link.rel = 'icon';
link.href = '/.lif/npm/lif-kernel/favicon.ico';
document.head.appendChild(link);
// start app
const root = createRoot(document.getElementById("root"));
root.render(<App />);

