import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { useDeviceStore } from "./store/deviceStore";

// Durable storage is async (disk); hydrate before first persist write
void useDeviceStore.persist.rehydrate();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
