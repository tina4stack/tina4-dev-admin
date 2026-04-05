import { api, esc } from "../api.js";

export function renderMetrics(container: HTMLElement): void {
  container.innerHTML = `
    <div class="dev-panel-header">
      <h2>Code Metrics</h2>
      <div class="flex gap-sm">
        <button class="btn btn-sm" onclick="window.__loadMetrics()">Quick Scan</button>
        <button class="btn btn-sm btn-primary" onclick="window.__loadFullMetrics()">Full Analysis</button>
      </div>
    </div>
    <div id="metrics-quick" class="metric-grid"></div>
    <div id="metrics-chart" class="bubble-chart" style="display:none"></div>
    <div id="metrics-detail" style="margin-top:1rem"></div>
  `;
  loadQuickMetrics();
}

async function loadQuickMetrics(): Promise<void> {
  const d = await api<any>("/metrics");
  const grid = document.getElementById("metrics-quick");
  if (!grid || d.error) return;
  const cards = [
    { label: "Files", value: String(d.file_count ?? 0) },
    { label: "Lines of Code", value: String(d.total_loc ?? 0) },
    { label: "Classes", value: String(d.classes ?? 0) },
    { label: "Functions", value: String(d.functions ?? 0) },
    { label: "Routes", value: String(d.route_count ?? 0) },
    { label: "Templates", value: String(d.template_count ?? 0) },
    { label: "Migrations", value: String(d.migration_count ?? 0) },
    { label: "Avg File Size", value: String(d.avg_file_size ?? 0) + " LOC" },
  ];
  grid.innerHTML = cards.map(c => `
    <div class="metric-card">
      <div class="label">${esc(c.label)}</div>
      <div class="value">${esc(c.value)}</div>
    </div>
  `).join("");
}

async function loadFullMetrics(): Promise<void> {
  const chart = document.getElementById("metrics-chart");
  const detail = document.getElementById("metrics-detail");
  if (chart) { chart.style.display = "block"; chart.innerHTML = '<p class="text-muted" style="padding:1rem">Analyzing...</p>'; }
  const d = await api<any>("/metrics/full");
  if (d.error || !d.file_metrics) {
    if (chart) chart.innerHTML = `<p style="color:var(--danger);padding:1rem">${esc(d.error || "No data")}</p>`;
    return;
  }
  renderBubbleChart(d.file_metrics, chart!);
  if (detail) {
    detail.innerHTML = `
      <div class="metric-grid">
        <div class="metric-card"><div class="label">Files Analyzed</div><div class="value">${d.files_analyzed}</div></div>
        <div class="metric-card"><div class="label">Total Functions</div><div class="value">${d.total_functions}</div></div>
        <div class="metric-card"><div class="label">Avg Complexity</div><div class="value">${d.avg_complexity}</div></div>
        <div class="metric-card"><div class="label">Avg Maintainability</div><div class="value">${d.avg_maintainability}</div></div>
        <div class="metric-card"><div class="label">Scan Mode</div><div class="value">${esc(d.scan_mode || "project")}</div></div>
      </div>
      ${d.most_complex_functions?.length ? `
        <h3 style="margin:1rem 0 0.5rem;font-size:0.85rem">Most Complex Functions</h3>
        <table><thead><tr><th>Function</th><th>File</th><th>Complexity</th><th>LOC</th></tr></thead>
        <tbody>${d.most_complex_functions.slice(0, 10).map((f: any) => `
          <tr><td class="text-mono">${esc(f.name)}</td><td class="text-sm text-muted">${esc(f.file)}</td>
          <td>${f.complexity}</td><td>${f.loc}</td></tr>`).join("")}</tbody></table>
      ` : ""}
    `;
  }
}

function renderBubbleChart(files: any[], container: HTMLElement): void {
  const w = container.clientWidth || 800;
  const h = 400;
  const maxLoc = Math.max(...files.map((f: any) => f.loc || 1));

  let svg = `<svg width="${w}" height="${h}" style="background:var(--surface)">`;
  const cols = Math.ceil(Math.sqrt(files.length));
  const cellW = w / cols;
  const cellH = h / Math.ceil(files.length / cols);

  files.forEach((f: any, i: number) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * cellW + cellW / 2;
    const cy = row * cellH + cellH / 2;
    const r = Math.max(8, Math.sqrt(f.loc / maxLoc) * Math.min(cellW, cellH) * 0.4);

    // Color by maintainability: green (100) → yellow (50) → red (0)
    const mi = f.maintainability ?? 50;
    const hue = Math.min(120, Math.max(0, mi * 1.2));
    const color = `hsl(${hue}, 70%, 50%)`;

    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" fill-opacity="0.7" stroke="${color}" stroke-width="1"
      style="cursor:pointer" onclick="window.__drillDown('${esc(f.path)}')" />`;
    svg += `<text x="${cx}" y="${cy + r + 12}" text-anchor="middle" fill="var(--muted)" font-size="9">${esc(f.path?.split("/").pop() || "")}</text>`;
  });

  svg += "</svg>";
  container.innerHTML = svg;
}

async function drillDown(path: string): Promise<void> {
  const detail = document.getElementById("metrics-detail");
  if (!detail) return;
  detail.innerHTML = '<p class="text-muted">Loading file analysis...</p>';
  const d = await api<any>("/metrics/file?path=" + encodeURIComponent(path));
  if (d.error) {
    detail.innerHTML = `<p style="color:var(--danger)">${esc(d.error)}</p>`;
    return;
  }
  detail.innerHTML = `
    <h3 style="font-size:0.85rem;margin-bottom:0.5rem">${esc(d.path)}</h3>
    <div class="metric-grid">
      <div class="metric-card"><div class="label">LOC</div><div class="value">${d.loc}</div></div>
      <div class="metric-card"><div class="label">Total Lines</div><div class="value">${d.total_lines}</div></div>
      <div class="metric-card"><div class="label">Classes</div><div class="value">${d.classes}</div></div>
      <div class="metric-card"><div class="label">Functions</div><div class="value">${(d.functions || []).length}</div></div>
    </div>
    ${(d.functions || []).length ? `
      <table><thead><tr><th>Function</th><th>Line</th><th>Complexity</th><th>LOC</th><th>Args</th></tr></thead>
      <tbody>${d.functions.map((f: any) => `
        <tr><td class="text-mono">${esc(f.name)}</td><td>${f.line}</td><td>${f.complexity}</td><td>${f.loc}</td><td class="text-sm text-muted">${(f.args || []).join(", ")}</td></tr>
      `).join("")}</tbody></table>
    ` : ""}
    ${(d.warnings || []).length ? `
      <h3 style="margin:1rem 0 0.5rem;font-size:0.85rem;color:var(--warn)">Warnings</h3>
      ${d.warnings.map((w: any) => `<p class="text-sm" style="color:var(--warn)">Line ${w.line}: ${esc(w.message)}</p>`).join("")}
    ` : ""}
  `;
}

(window as any).__loadMetrics = loadQuickMetrics;
(window as any).__loadFullMetrics = loadFullMetrics;
(window as any).__drillDown = drillDown;
