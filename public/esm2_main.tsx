// from code.esm.sh
import React from "react";
import {createRoot} from "react-dom";
import App from "./esmsh_app.tsx";

//let i = await import("https://unpkg.com/react@18/umd/react.development.js");
//console.log('import amd', i);
//let r = await import("https://esm.sh/react@18.2.0");
//console.log('import esm', r);
const root = createRoot(document.getElementById("root"));
root.render(<App />);

