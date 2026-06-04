import React from "react";
import { createRoot } from "react-dom/client";
import QuietReader from "./QuietReader";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QuietReader />
  </React.StrictMode>
);
