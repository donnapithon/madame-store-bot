import { createRoot } from "react-dom/client";

function App() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui, sans-serif", background: "#0a0a0a", color: "#fff" }}>
      <div style={{ textAlign: "center" }}>
        <h1>Madame Store CCS</h1>
        <p>Bot ativo no Telegram</p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
