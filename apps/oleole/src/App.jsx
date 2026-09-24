import { Routes, Route } from "react-router-dom";
import { OleoleHome } from "@inseme/brique-oleole";
import { registerSW } from "virtual:pwa-register";

export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<OleoleHome registerServiceWorker={registerSW} />} />
    </Routes>
  );
}
