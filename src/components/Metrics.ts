import { api, esc } from "../api.js";

export function renderMetrics(container: HTMLElement): void {
  container.innerHTML = `
    <div class="dev-panel-header">
      <h2>Code Metrics</h2>
      <div class="flex gap-sm">
        <button class="btn" onclick="window.__loadQuickMetrics()">Quick Scan</button>
        <button class="btn btn-primary" onclick="window.__loadFullMetrics()">Full Analysis</button>
      </div>
    </div>
    <div id="metrics-quick" class="metric-grid"></div>
    <div id="metrics-scan-info" class="text-sm text-muted" style="margin:0.5rem 0"></div>
    <div id="metrics-chart" style="display:none;margin:1rem 0"></div>
    <div id="metrics-complex" style="margin-top:1rem"></div>
    <div id="metrics-detail" style="margin-top:1rem"></div>
  `;
  loadQuickMetrics();
}

async function loadQuickMetrics(): Promise<void> {
  const d = await api<any>("/metrics");
  const grid = document.getElementById("metrics-quick");
  if (!grid || d.error) return;
  grid.innerHTML = [
    card("Files", d.file_count),
    card("Lines of Code", d.total_loc),
    card("Blank Lines", d.total_blank),
    card("Comments", d.total_comment),
    card("Classes", d.classes),
    card("Functions", d.functions),
    card("Routes", d.route_count),
    card("ORM Models", d.orm_count),
    card("Templates", d.template_count),
    card("Migrations", d.migration_count),
    card("Avg File Size", (d.avg_file_size ?? 0) + " LOC"),
  ].join("");
}

async function loadFullMetrics(): Promise<void> {
  const chartEl = document.getElementById("metrics-chart");
  const complexEl = document.getElementById("metrics-complex");
  const infoEl = document.getElementById("metrics-scan-info");
  if (chartEl) { chartEl.style.display = "block"; chartEl.innerHTML = '<p class="text-muted">Analyzing...</p>'; }

  const d = await api<any>("/metrics/full");
  if (d.error || !d.file_metrics) {
    if (chartEl) chartEl.innerHTML = `<p style="color:var(--danger)">${esc(d.error || "No data")}</p>`;
    return;
  }

  // Scan info
  if (infoEl) {
    infoEl.textContent = `${d.files_analyzed} files analyzed | ${d.total_functions} functions | Mode: ${d.scan_mode || "project"}`;
  }

  // Summary cards
  const grid = document.getElementById("metrics-quick");
  if (grid) {
    grid.innerHTML = [
      card("Files Analyzed", d.files_analyzed),
      card("Total Functions", d.total_functions),
      card("Avg Complexity", d.avg_complexity),
      card("Avg Maintainability", d.avg_maintainability),
      card("Scan Mode", d.scan_mode || "project"),
    ].join("");
  }

  // Bubble chart
  if (chartEl && d.file_metrics.length > 0) {
    renderBubbleChart(d.file_metrics, chartEl);
  } else if (chartEl) {
    chartEl.innerHTML = '<p class="text-muted">No files to visualize</p>';
  }

  // Most complex functions table
  if (complexEl && d.most_complex_functions?.length) {
    complexEl.innerHTML = `
      <h3 style="font-size:0.85rem;margin-bottom:0.5rem">Most Complex Functions</h3>
      <table>
        <thead><tr><th>Function</th><th>File</th><th>Line</th><th>Complexity</th><th>LOC</th></tr></thead>
        <tbody>${d.most_complex_functions.slice(0, 15).map((f: any) => `
          <tr>
            <td class="text-mono">${esc(f.name)}</td>
            <td class="text-sm text-muted" style="cursor:pointer;text-decoration:underline dotted" onclick="window.__drillDown('${esc(f.file)}')">${esc(f.file)}</td>
            <td>${f.line}</td>
            <td><span class="${f.complexity > 10 ? 'badge badge-danger' : f.complexity > 5 ? 'badge badge-warn' : 'badge badge-success'}">${f.complexity}</span></td>
            <td>${f.loc}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    `;
  }
}

function renderBubbleChart(files: any[], container: HTMLElement): void {
  const w = container.clientWidth || 900;
  const h = Math.max(300, Math.min(500, files.length * 15));
  const maxLoc = Math.max(...files.map((f: any) => f.loc || 1));
  const minRadius = 10;
  const maxRadius = 40;

  // Sort by maintainability (worst first) for visual priority
  const sorted = [...files].sort((a, b) => (a.maintainability ?? 50) - (b.maintainability ?? 50));

  // Pack circles in a grid
  const cols = Math.ceil(Math.sqrt(sorted.length * (w / h)));
  const rows = Math.ceil(sorted.length / cols);
  const cellW = w / cols;
  const cellH = h / rows;

  let svg = `<svg width="${w}" height="${h}" style="background:var(--surface);border:1px solid var(--border);border-radius:0.5rem">`;

  sorted.forEach((f: any, i: number) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * cellW + cellW / 2;
    const cy = row * cellH + cellH / 2;
    const r = Math.max(minRadius, Math.min(maxRadius, Math.sqrt(f.loc / maxLoc) * maxRadius));

    // Color by maintainability: red (0) → yellow (50) → green (100)
    const mi = f.maintainability ?? 50;
    const hue = Math.min(120, Math.max(0, mi * 1.2));
    const color = `hsl(${hue}, 80%, 45%)`;
    const fileName = f.path?.split("/").pop() || "?";

    svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" fill-opacity="0.6" stroke="${color}" stroke-width="1.5" style="cursor:pointer" onclick="window.__drillDown('${esc(f.path)}')" />`;
    svg += `<title>${esc(f.path)}\nLOC: ${f.loc} | CC: ${f.avg_complexity} | MI: ${f.maintainability}</title>`;
    if (r > 15) {
      svg += `<text x="${cx}" y="${cy + 3}" text-anchor="middle" fill="white" font-size="8" font-weight="600" style="pointer-events:none">${esc(fileName.length > 10 ? fileName.substring(0, 8) + ".." : fileName)}</text>`;
    }
    svg += `<text x="${cx}" y="${cy + r + 11}" text-anchor="middle" fill="var(--muted)" font-size="7" style="pointer-events:none">${esc(fileName)}</text>`;
  });

  // Legend
  svg += `<rect x="${w - 160}" y="8" width="150" height="50" rx="4" fill="var(--bg)" fill-opacity="0.8" stroke="var(--border)" />`;
  svg += `<circle cx="${w - 145}" cy="22" r="5" fill="hsl(0, 80%, 45%)" /><text x="${w - 135}" y="25" fill="var(--text)" font-size="8">Low maintainability</text>`;
  svg += `<circle cx="${w - 145}" cy="36" r="5" fill="hsl(60, 80%, 45%)" /><text x="${w - 135}" y="39" fill="var(--text)" font-size="8">Medium</text>`;
  svg += `<circle cx="${w - 145}" cy="50" r="5" fill="hsl(120, 80%, 45%)" /><text x="${w - 135}" y="53" fill="var(--text)" font-size="8">High maintainability</text>`;

  svg += "</svg>";
  container.innerHTML = svg;
}

async function drillDown(filePath: string): Promise<void> {
  const detail = document.getElementById("metrics-detail");
  if (!detail) return;
  detail.innerHTML = '<p class="text-muted">Loading file analysis...</p>';

  const d = await api<any>("/metrics/file?path=" + encodeURIComponent(filePath));
  if (d.error) {
    detail.innerHTML = `<p style="color:var(--danger)">${esc(d.error)}</p>`;
    return;
  }

  const functions = d.functions || [];
  const warnings = d.warnings || [];

  detail.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:1rem">
      <div class="flex items-center" style="justify-content:space-between;margin-bottom:0.75rem">
        <h3 style="font-size:0.9rem">${esc(d.path)}</h3>
        <button class="btn btn-sm" onclick="document.getElementById('metrics-detail').innerHTML=''">Close</button>
      </div>
      <div class="metric-grid" style="margin-bottom:0.75rem">
        ${card("LOC", d.loc)}
        ${card("Total Lines", d.total_lines)}
        ${card("Classes", d.classes)}
        ${card("Functions", functions.length)}
      </div>
      ${functions.length ? `
        <table>
          <thead><tr><th>Function</th><th>Line</th><th>Complexity</th><th>LOC</th><th>Args</th></tr></thead>
          <tbody>${functions.map((f: any) => `
            <tr>
              <td class="text-mono">${esc(f.name)}</td>
              <td>${f.line}</td>
              <td><span class="${f.complexity > 10 ? 'badge badge-danger' : f.complexity > 5 ? 'badge badge-warn' : 'badge badge-success'}">${f.complexity}</span></td>
              <td>${f.loc}</td>
              <td class="text-sm text-muted">${(f.args || []).join(", ")}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      ` : '<p class="text-muted">No functions</p>'}
      ${warnings.length ? `
        <div style="margin-top:0.75rem">
          <h4 style="font-size:0.8rem;color:var(--warn);margin-bottom:0.25rem">Warnings</h4>
          ${warnings.map((w: any) => `<p class="text-sm" style="color:var(--warn)">Line ${w.line}: ${esc(w.message)}</p>`).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function card(label: string, value: any): string {
  return `<div class="metric-card"><div class="label">${esc(label)}</div><div class="value">${esc(String(value ?? 0))}</div></div>`;
}

(window as any).__loadQuickMetrics = loadQuickMetrics;
(window as any).__loadFullMetrics = loadFullMetrics;
(window as any).__drillDown = drillDown;
