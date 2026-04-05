import { api, esc } from "../api.js";

export function renderDatabase(container: HTMLElement): void {
  container.innerHTML = `
    <div class="dev-panel-header">
      <h2>Database</h2>
      <div class="flex gap-sm">
        <select id="db-tables" class="input" style="width:200px" onchange="window.__loadTableInfo()">
          <option value="">Select table...</option>
        </select>
        <button class="btn btn-sm" onclick="window.__loadTables()">Refresh</button>
      </div>
    </div>
    <div style="margin-bottom:0.75rem">
      <textarea id="db-query" class="input" style="width:100%;height:80px" placeholder="SELECT * FROM ..." onkeydown="if(event.ctrlKey&&event.key==='Enter')window.__runQuery()"></textarea>
      <div class="flex gap-sm" style="margin-top:0.5rem">
        <button class="btn btn-primary btn-sm" onclick="window.__runQuery()">Run (Ctrl+Enter)</button>
      </div>
    </div>
    <div id="db-result"></div>
  `;
  loadTables();
}

async function loadTables(): Promise<void> {
  const d = await api<any>("/tables");
  const select = document.getElementById("db-tables") as HTMLSelectElement;
  if (!select) return;
  select.innerHTML = '<option value="">Select table...</option>' +
    (d.tables || []).map((t: string) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
}

async function loadTableInfo(): Promise<void> {
  const select = document.getElementById("db-tables") as HTMLSelectElement;
  if (!select?.value) return;
  const d = await api<any>("/table?name=" + encodeURIComponent(select.value));
  const result = document.getElementById("db-result");
  if (!result) return;
  result.innerHTML = `<table><thead><tr><th>Column</th><th>Type</th><th>Nullable</th></tr></thead><tbody>` +
    (d.columns || []).map((c: any) => `<tr><td class="text-mono">${esc(c.name)}</td><td class="text-sm">${esc(c.type)}</td><td>${c.nullable ? "yes" : "no"}</td></tr>`).join("") +
    `</tbody></table>`;
}

async function runQuery(): Promise<void> {
  const textarea = document.getElementById("db-query") as HTMLTextAreaElement;
  const sql = textarea?.value?.trim();
  if (!sql) return;
  const result = document.getElementById("db-result");
  if (result) result.innerHTML = '<p class="text-muted">Running...</p>';
  try {
    const d = await api<any>("/query", "POST", { query: sql, type: "sql" });
    if (d.error) {
      if (result) result.innerHTML = `<p style="color:var(--danger)">${esc(d.error)}</p>`;
      return;
    }
    if (d.rows && d.rows.length > 0) {
      const keys = Object.keys(d.rows[0]);
      if (result) result.innerHTML = `<p class="text-sm text-muted">${d.count ?? d.rows.length} rows</p>
        <table><thead><tr>${keys.map(k => `<th>${esc(k)}</th>`).join("")}</tr></thead>
        <tbody>${d.rows.map((r: any) => `<tr>${keys.map(k => `<td class="text-sm">${esc(String(r[k] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    } else {
      if (result) result.innerHTML = `<p class="text-muted">${d.affected !== undefined ? d.affected + " rows affected" : "Done"}</p>`;
    }
  } catch (e: any) {
    if (result) result.innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`;
  }
}

(window as any).__loadTables = loadTables;
(window as any).__loadTableInfo = loadTableInfo;
(window as any).__runQuery = runQuery;
