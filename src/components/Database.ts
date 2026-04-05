import { api, esc } from "../api.js";

let lastResults: any[] = [];
let lastColumns: string[] = [];
let queryHistory: string[] = JSON.parse(localStorage.getItem("tina4_query_history") || "[]");

export function renderDatabase(container: HTMLElement): void {
  container.innerHTML = `
    <div class="dev-panel-header">
      <h2>Database</h2>
      <button class="btn btn-sm" onclick="window.__loadTables()">Refresh</button>
    </div>
    <div style="display:flex;gap:1rem;height:calc(100vh - 140px)">
      <div style="width:200px;flex-shrink:0;overflow-y:auto;border-right:1px solid var(--border);padding-right:0.75rem">
        <div style="font-weight:600;font-size:0.75rem;color:var(--muted);text-transform:uppercase;margin-bottom:0.5rem">Tables</div>
        <div id="db-table-list"></div>
        <div style="margin-top:1.5rem;border-top:1px solid var(--border);padding-top:0.75rem">
          <div style="font-weight:600;font-size:0.75rem;color:var(--muted);text-transform:uppercase;margin-bottom:0.5rem">Seed Data</div>
          <select id="db-seed-table" class="input" style="width:100%;margin-bottom:0.5rem">
            <option value="">Pick table...</option>
          </select>
          <div class="flex gap-sm">
            <input type="number" id="db-seed-count" class="input" value="10" style="width:60px">
            <button class="btn btn-sm btn-primary" onclick="window.__seedTable()">Seed</button>
          </div>
        </div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;min-width:0">
        <div class="flex gap-sm items-center" style="margin-bottom:0.5rem;flex-wrap:wrap">
          <select id="db-type" class="input" style="width:80px">
            <option value="sql">SQL</option>
            <option value="graphql">GraphQL</option>
          </select>
          <span class="text-sm text-muted">Limit</span>
          <select id="db-limit" class="input" style="width:60px">
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="500">500</option>
          </select>
          <span class="text-sm text-muted">Offset</span>
          <input type="number" id="db-offset" class="input" value="0" style="width:60px" min="0">
          <button class="btn btn-primary" onclick="window.__runQuery()">Run</button>
          <button class="btn" onclick="window.__copyCSV()">Copy CSV</button>
          <button class="btn" onclick="window.__copyJSON()">Copy JSON</button>
          <button class="btn" onclick="window.__showPaste()">Paste</button>
          <span class="text-sm text-muted">Ctrl+Enter</span>
        </div>
        <div class="flex gap-sm items-center" style="margin-bottom:0.25rem">
          <select id="db-history" class="input text-mono" style="flex:1" onchange="window.__loadHistory(this.value)">
            <option value="">Query history...</option>
          </select>
          <button class="btn btn-sm" onclick="window.__clearHistory()" title="Clear history" style="height:30px">Clear</button>
        </div>
        <textarea id="db-query" class="input text-mono" style="width:100%;height:80px;resize:vertical" placeholder="SELECT * FROM users" onkeydown="if(event.ctrlKey&&event.key==='Enter')window.__runQuery()"></textarea>
        <div id="db-result" style="flex:1;overflow:auto;margin-top:0.75rem"></div>
      </div>
    </div>
    <div id="db-paste-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:none;align-items:center;justify-content:center">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:1.5rem;width:600px;max-height:80vh;overflow:auto">
        <h3 style="margin-bottom:0.75rem;font-size:0.9rem">Paste Data</h3>
        <p class="text-sm text-muted" style="margin-bottom:0.5rem">Paste CSV or JSON array. First row = column headers for CSV.</p>
        <div class="flex gap-sm items-center" style="margin-bottom:0.5rem">
          <select id="paste-table" class="input" style="flex:1"><option value="">Select existing table...</option></select>
          <span class="text-sm text-muted">or</span>
          <input type="text" id="paste-new-table" class="input" placeholder="New table name..." style="flex:1">
        </div>
        <textarea id="paste-data" class="input text-mono" style="width:100%;height:200px" placeholder='CSV data or JSON'></textarea>
        <div class="flex gap-sm" style="margin-top:0.75rem;justify-content:flex-end">
          <button class="btn" onclick="window.__hidePaste()">Cancel</button>
          <button class="btn btn-primary" onclick="window.__doPaste()">Import</button>
        </div>
      </div>
    </div>
  `;
  loadTables();
  renderHistory();
}

async function loadTables(): Promise<void> {
  const d = await api<any>("/tables");
  const tables = d.tables || [];
  
  // Sidebar list
  const list = document.getElementById("db-table-list");
  if (list) {
    list.innerHTML = tables.length
      ? tables.map((t: string) => `<div style="padding:0.3rem 0.5rem;cursor:pointer;border-radius:0.25rem;font-size:0.8rem;font-family:monospace" class="db-table-item" onclick="window.__selectTable('${esc(t)}')" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background=''">${esc(t)}</div>`).join("")
      : '<div class="text-sm text-muted">No tables</div>';
  }
  
  // Seed dropdown
  const seed = document.getElementById("db-seed-table") as HTMLSelectElement;
  if (seed) {
    seed.innerHTML = '<option value="">Pick table...</option>' +
      tables.map((t: string) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
  }
  
  // Paste dropdown
  const paste = document.getElementById("paste-table") as HTMLSelectElement;
  if (paste) {
    paste.innerHTML = '<option value="">Select table...</option>' +
      tables.map((t: string) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
  }
}

function selectTable(name: string): void {
  const limit = (document.getElementById("db-limit") as HTMLSelectElement)?.value || "20";
  const textarea = document.getElementById("db-query") as HTMLTextAreaElement;
  if (textarea) textarea.value = `SELECT * FROM ${name}`;
  
  // Highlight selected
  document.querySelectorAll(".db-table-item").forEach(el => {
    (el as HTMLElement).style.background = el.textContent === name ? "var(--border)" : "";
  });
  
  runQuery();
}

function updateLimit(): void {
  const textarea = document.getElementById("db-query") as HTMLTextAreaElement;
  const limit = (document.getElementById("db-limit") as HTMLSelectElement)?.value || "20";
  if (textarea?.value) {
    textarea.value = textarea.value.replace(/LIMIT\s+\d+/i, `LIMIT ${limit}`);
  }
}

function addToHistory(sql: string): void {
  const trimmed = sql.trim();
  if (!trimmed) return;
  // Remove if already exists, add to front
  queryHistory = queryHistory.filter(q => q !== trimmed);
  queryHistory.unshift(trimmed);
  // Keep max 50
  if (queryHistory.length > 50) queryHistory = queryHistory.slice(0, 50);
  localStorage.setItem("tina4_query_history", JSON.stringify(queryHistory));
  renderHistory();
}

function renderHistory(): void {
  const select = document.getElementById("db-history") as HTMLSelectElement;
  if (!select) return;
  select.innerHTML = '<option value="">Query history...</option>' +
    queryHistory.map((q, i) => `<option value="${i}">${esc(q.length > 80 ? q.substring(0, 80) + "..." : q)}</option>`).join("");
}

function loadHistory(index: string): void {
  const i = parseInt(index);
  if (isNaN(i) || !queryHistory[i]) return;
  const textarea = document.getElementById("db-query") as HTMLTextAreaElement;
  if (textarea) textarea.value = queryHistory[i];
  // Reset dropdown
  (document.getElementById("db-history") as HTMLSelectElement).selectedIndex = 0;
}

function clearHistory(): void {
  queryHistory = [];
  localStorage.removeItem("tina4_query_history");
  renderHistory();
}

async function runQuery(): Promise<void> {
  const textarea = document.getElementById("db-query") as HTMLTextAreaElement;
  const sql = textarea?.value?.trim();
  if (!sql) return;
  addToHistory(sql);
  const result = document.getElementById("db-result");
  const queryType = (document.getElementById("db-type") as HTMLSelectElement)?.value || "sql";
  if (result) result.innerHTML = '<p class="text-muted">Running...</p>';
  try {
    const limit = parseInt((document.getElementById("db-limit") as HTMLSelectElement)?.value || "20");
    const d = await api<any>("/query", "POST", { query: sql, type: queryType, limit });
    if (d.error) {
      if (result) result.innerHTML = `<p style="color:var(--danger)">${esc(d.error)}</p>`;
      return;
    }
    if (d.rows && d.rows.length > 0) {
      lastColumns = Object.keys(d.rows[0]);
      lastResults = d.rows;
      if (result) result.innerHTML = `<p class="text-sm text-muted" style="margin-bottom:0.5rem">${d.count ?? d.rows.length} rows</p>
        <div style="overflow-x:auto"><table><thead><tr>${lastColumns.map(k => `<th>${esc(k)}</th>`).join("")}</tr></thead>
        <tbody>${d.rows.map((r: any) => `<tr>${lastColumns.map(k => `<td class="text-sm">${esc(String(r[k] ?? ""))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    } else if (d.affected !== undefined) {
      if (result) result.innerHTML = `<p class="text-muted">${d.affected} rows affected. ${d.success ? "Success." : ""}</p>`;
      lastResults = [];
      lastColumns = [];
    } else {
      if (result) result.innerHTML = '<p class="text-muted">No results</p>';
      lastResults = [];
      lastColumns = [];
    }
  } catch (e: any) {
    if (result) result.innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`;
  }
}

function copyCSV(): void {
  if (!lastResults.length) return;
  const header = lastColumns.join(",");
  const rows = lastResults.map(r => lastColumns.map(k => {
    const v = String(r[k] ?? "");
    return v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(","));
  navigator.clipboard.writeText([header, ...rows].join("\n"));
}

function copyJSON(): void {
  if (!lastResults.length) return;
  navigator.clipboard.writeText(JSON.stringify(lastResults, null, 2));
}

function showPaste(): void {
  const modal = document.getElementById("db-paste-modal");
  if (modal) modal.style.display = "flex";
}

function hidePaste(): void {
  const modal = document.getElementById("db-paste-modal");
  if (modal) modal.style.display = "none";
}

async function doPaste(): Promise<void> {
  const existingTable = (document.getElementById("paste-table") as HTMLSelectElement)?.value;
  const newTable = (document.getElementById("paste-new-table") as HTMLInputElement)?.value?.trim();
  const table = newTable || existingTable;
  const data = (document.getElementById("paste-data") as HTMLTextAreaElement)?.value?.trim();
  if (!table || !data) { alert("Select a table or enter a new table name, and paste data."); return; }

  try {
    // Parse data — try JSON first, then CSV
    let rows: any[];
    try {
      rows = JSON.parse(data);
      if (!Array.isArray(rows)) rows = [rows];
    } catch {
      const lines = data.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { alert("CSV needs at least a header row and one data row."); return; }
      const headers = lines[0].split(",").map(h => h.trim().replace(/[^a-zA-Z0-9_]/g, ""));
      rows = lines.slice(1).map(line => {
        const vals = line.split(",").map(v => v.trim());
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = vals[i] ?? ""; });
        return obj;
      });
    }

    if (!rows.length) { alert("No data rows found."); return; }

    // Create table if new name provided
    if (newTable) {
      const cols = Object.keys(rows[0]).filter(c => c.toLowerCase() !== "id");
      const colDefs = ["id INTEGER PRIMARY KEY AUTOINCREMENT", ...cols.map(c => `"${c}" TEXT`)];
      const createResult = await api<any>("/query", "POST", { query: `CREATE TABLE IF NOT EXISTS "${newTable}" (${colDefs.join(", ")})`, type: "sql" });
      if (createResult.error) { alert("Create table failed: " + createResult.error); return; }
    }

    // Insert rows one by one
    let inserted = 0;
    for (const row of rows) {
      const cols = newTable ? Object.keys(row).filter(c => c.toLowerCase() !== "id") : Object.keys(row);
      const quotedCols = cols.map(c => `"${c}"`).join(",");
      const vals = cols.map(c => `'${String(row[c]).replace(/'/g, "''")}'`).join(",");
      const result = await api<any>("/query", "POST", { query: `INSERT INTO "${table}" (${quotedCols}) VALUES (${vals})`, type: "sql" });
      if (result.error) { alert(`Row ${inserted + 1} failed: ${result.error}`); break; }
      inserted++;
    }

    // Clear form and close
    (document.getElementById("paste-data") as HTMLTextAreaElement).value = "";
    (document.getElementById("paste-new-table") as HTMLInputElement).value = "";
    (document.getElementById("paste-table") as HTMLSelectElement).selectedIndex = 0;
    hidePaste();
    loadTables();
    if (inserted > 0) {
      selectTable(table);
    }
  } catch (e: any) {
    alert("Import error: " + e.message);
  }
}

async function seedTable(): Promise<void> {
  const table = (document.getElementById("db-seed-table") as HTMLSelectElement)?.value;
  const count = parseInt((document.getElementById("db-seed-count") as HTMLInputElement)?.value || "10");
  if (!table) return;
  
  try {
    const d = await api<any>("/seed", "POST", { table, count });
    if (d.error) {
      alert(d.error);
    } else {
      selectTable(table);
    }
  } catch (e: any) {
    alert("Seed error: " + e.message);
  }
}

(window as any).__loadTables = loadTables;
(window as any).__selectTable = selectTable;
(window as any).__updateLimit = updateLimit;
(window as any).__runQuery = runQuery;
(window as any).__copyCSV = copyCSV;
(window as any).__copyJSON = copyJSON;
(window as any).__showPaste = showPaste;
(window as any).__hidePaste = hidePaste;
(window as any).__doPaste = doPaste;
(window as any).__seedTable = seedTable;
(window as any).__loadHistory = loadHistory;
(window as any).__clearHistory = clearHistory;
