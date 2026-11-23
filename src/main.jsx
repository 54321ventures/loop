import { createRoot } from "react-dom/client";
import { storage } from "./sync.js";
import AuthGate from "./AuthGate.jsx";
window.storage = storage;   // loop.jsx persists through this local-first, cloud-synced store
createRoot(document.getElementById("root")).render(<AuthGate />);
