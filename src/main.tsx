import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// 禁用默认右键菜单
document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
