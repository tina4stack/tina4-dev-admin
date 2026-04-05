import { api, esc } from "../api.js";

export function renderSystem(container: HTMLElement): void {
  container.innerHTML = `
    <div class="dev-panel-header">
      <h2>System</h2>
      <button class="btn btn-sm" onclick="window.__loadSystem()">Refresh</button>
    </div>
    <div id="system-grid" class="metric-grid"></div>
  `;
  loadSystem();
}

async function loadSystem(): Promise<void> {
  const d = await api<any>("/system");
  const grid = document.getElementById("system-grid");
  if (!grid) return;
  const cards = [
    { label: "Framework", value: d.framework || "Tina4" },
    { label: "Version", value: d.version || "?" },
    { label: "Runtime", value: d.runtime || d.python_version || d.php_version || d.ruby_version || d.node_version || "?" },
    { label: "Database", value: d.database || d.db_type || "none" },
    { label: "Uptime", value: d.uptime || "?" },
    { label: "Memory", value: d.memory || "?" },
    { label: "Platform", value: d.platform || "?" },
    { label: "Routes", value: String(d.route_count ?? d.routes ?? "?") },
    { label: "Debug", value: d.debug ? "ON" : "OFF" },
  ];
  grid.innerHTML = cards.map(c => `
    <div class="metric-card">
      <div class="label">${esc(c.label)}</div>
      <div class="value" style="font-size:1.1rem">${esc(c.value)}</div>
    </div>
  `).join("");
}

(window as any).__loadSystem = loadSystem;
