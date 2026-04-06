import { api, esc } from "../api.js";

export function renderSystem(container: HTMLElement): void {
  container.innerHTML = `
    <div class="dev-panel-header">
      <h2>System</h2>
    </div>
    <div id="system-grid" class="metric-grid"></div>
    <div id="system-env" style="margin-top:1rem"></div>
  `;
  loadSystem();
}

function formatUptime(seconds: number): string {
  if (!seconds || seconds < 0) return "?";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

function formatMemory(mb: number): string {
  if (!mb) return "?";
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
}

async function loadSystem(): Promise<void> {
  const d = await api<any>("/system");
  const grid = document.getElementById("system-grid");
  const envEl = document.getElementById("system-env");
  if (!grid) return;

  const runtime = d.python_version || d.php_version || d.ruby_version || d.node_version || d.runtime || "?";
  const runtimeShort = runtime.split("(")[0].trim();

  const cards = [
    { label: "Framework", value: d.framework || "Tina4" },
    { label: "Runtime", value: runtimeShort },
    { label: "Platform", value: d.platform || "?" },
    { label: "Architecture", value: d.architecture || "?" },
    { label: "PID", value: String(d.pid ?? "?") },
    { label: "Uptime", value: formatUptime(d.uptime_seconds) },
    { label: "Memory", value: formatMemory(d.memory_mb) },
    { label: "Database", value: d.database || "none" },
    { label: "DB Tables", value: String(d.db_tables ?? "?") },
    { label: "DB Connected", value: d.db_connected ? "Yes" : "No" },
    { label: "Debug", value: d.debug === "true" || d.debug === true ? "ON" : "OFF" },
    { label: "Log Level", value: d.log_level || "?" },
    { label: "Modules", value: String(d.loaded_modules ?? "?") },
    { label: "Working Dir", value: d.cwd || "?" },
  ];

  grid.innerHTML = cards.map(c => `
    <div class="metric-card">
      <div class="label">${esc(c.label)}</div>
      <div class="value" style="font-size:${c.label === "Working Dir" || c.label === "Database" ? "0.75rem" : "1.1rem"}">${esc(c.value)}</div>
    </div>
  `).join("");

  // Environment table
  if (envEl) {
    const envVars: [string, string][] = [];
    if (d.debug !== undefined) envVars.push(["TINA4_DEBUG", String(d.debug)]);
    if (d.log_level) envVars.push(["LOG_LEVEL", d.log_level]);
    if (d.database) envVars.push(["DATABASE_URL", d.database]);

    if (envVars.length) {
      envEl.innerHTML = `
        <h3 style="font-size:0.85rem;margin-bottom:0.5rem">Environment</h3>
        <table>
          <thead><tr><th>Variable</th><th>Value</th></tr></thead>
          <tbody>${envVars.map(([k, v]) =>
            `<tr><td class="text-mono text-sm" style="padding:4px 8px">${esc(k)}</td><td class="text-sm" style="padding:4px 8px">${esc(v)}</td></tr>`
          ).join("")}</tbody>
        </table>
      `;
    }
  }
}

(window as any).__loadSystem = loadSystem;
