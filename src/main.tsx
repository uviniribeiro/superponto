import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { setupPwa } from "./lib/pwa";
import "./index.css";

setupPwa(); // terminal e app do funcionário: manifesto, ícones Apple e service worker

createRoot(document.getElementById("root")!).render(<App />);
