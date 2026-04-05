import { api, esc } from "../api.js";

export function renderRoutes(container: HTMLElement): void {
  container.innerHTML = `
    <div class="dev-panel-header">
      <h2>Routes <span id="routes-count" class="text-muted text-sm"></span></h2>
      <button class="btn btn-sm" onclick="window.__loadRoutes()">Refresh</button>
    </div>
    <table>
      <thead><tr><th>Method</th><th>Path</th><th>Auth</th><th>Handler</th></tr></thead>
      <tbody id="routes-body"></tbody>
    </table>
  `;
  loadRoutes();
}

async function loadRoutes(): Promise<void> {
  const d = await api<any>("/routes");
  const count = document.getElementById("routes-count");
  if (count) count.textContent = `(${d.count})`;
  const tbody = document.getElementById("routes-body");
  if (!tbody) return;
  tbody.innerHTML = (d.routes || []).map((r: any) => `
    <tr>
      <td><span class="method method-${r.method.toLowerCase()}">${esc(r.method)}</span></td>
      <td class="text-mono"><a href="${esc(r.path)}" target="_blank" style="color:inherit;text-decoration:underline dotted">${esc(r.path)}</a></td>
      <td>${r.auth_required ? '<span class="badge badge-warn">auth</span>' : '<span class="badge badge-success">open</span>'}</td>
      <td class="text-sm text-muted">${esc(r.handler || "")} <small>(${esc(r.module || "")})</small></td>
    </tr>
  `).join("");
}

(window as any).__loadRoutes = loadRoutes;
