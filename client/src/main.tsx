import { createRoot } from "react-dom/client";
import "./config"; // Validate frontend environment variables
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
