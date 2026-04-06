import { api, esc } from "../api.js";

export function renderMetrics(container: HTMLElement): void {
  container.innerHTML = `
    <div class="dev-panel-header">
      <h2>Code Metrics</h2>
    </div>
    <div id="metrics-quick" class="metric-grid"></div>
    <div id="metrics-scan-info" class="text-sm text-muted" style="margin:0.5rem 0"></div>
    <div id="metrics-chart" style="display:none;margin:1rem 0"></div>
    <div id="metrics-detail" style="margin-top:1rem"></div>
    <div id="metrics-complex" style="margin-top:1rem"></div>
  `;
  loadFullMetrics();
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

  if (infoEl) {
    const mode = d.scan_mode === "framework" ? '<span style="color:#cba6f7;font-weight:600">(Framework)</span> Add code to src/ to see your project' : '';
    infoEl.innerHTML = `${d.files_analyzed} files analyzed | ${d.total_functions} functions ${mode}`;
  }

  const grid = document.getElementById("metrics-quick");
  if (grid) {
    grid.innerHTML = [
      card("Files Analyzed", d.files_analyzed),
      card("Total Functions", d.total_functions),
      card("Avg Complexity", d.avg_complexity),
      card("Avg Maintainability", d.avg_maintainability),
    ].join("");
  }

  if (chartEl && d.file_metrics.length > 0) {
    renderCanvasBubbles(d.file_metrics, chartEl, d.dependency_graph || {}, d.scan_mode || "project");
  } else if (chartEl) {
    chartEl.innerHTML = '<p class="text-muted">No files to visualize</p>';
  }

  if (complexEl && d.most_complex_functions?.length) {
    complexEl.innerHTML = `
      <h3 style="font-size:0.85rem;margin-bottom:0.5rem">Most Complex Functions</h3>
      <table>
        <thead><tr><th>Function</th><th>File</th><th>Line</th><th>CC</th><th>LOC</th></tr></thead>
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

// ── Canvas 2D Bubble Chart (ported from original dev admin) ──

function renderCanvasBubbles(files: any[], container: HTMLElement, depGraph: Record<string, string[]>, scanMode: string): void {
  const W = container.offsetWidth || 900;
  const H = Math.max(450, Math.min(650, W * 0.45));
  const maxLoc = Math.max(...files.map((f: any) => f.loc)) || 1;
  const maxDeps = Math.max(...files.map((f: any) => f.dep_count || 0)) || 1;
  const minR = 14;
  const maxR = Math.min(70, W / 10);

  // Health color: complexity + tests + dependencies
  function healthColor(f: any): string {
    const cc = Math.min((f.avg_complexity || 0) / 10, 1);
    const untested = f.has_tests ? 0 : 1;
    const deps = Math.min((f.dep_count || 0) / 5, 1);
    const score = cc * 0.4 + untested * 0.4 + deps * 0.2;
    const s = Math.max(0, Math.min(1, score));
    const hue = Math.round(120 * (1 - s));
    const sat = Math.round(70 + s * 30);
    const lit = Math.round(42 + 18 * (1 - s));
    return `hsl(${hue},${sat}%,${lit}%)`;
  }

  // Size score: composite of LOC + complexity + deps
  function sizeScore(f: any): number {
    return (f.loc / maxLoc) * 0.4 + ((f.avg_complexity || 0) / 10) * 0.4 + ((f.dep_count || 0) / maxDeps) * 0.2;
  }

  // Sort smallest first for spiral placement (biggest ends up outside)
  const sorted = [...files].sort((a, b) => sizeScore(a) - sizeScore(b));

  // Spiral placement
  const cx = W / 2, cy = H / 2;
  const bubbles: any[] = [];
  let angle = 0, spiralR = 0;

  for (const f of sorted) {
    const r = minR + Math.sqrt(sizeScore(f)) * (maxR - minR);
    const color = healthColor(f);
    let placed = false;
    for (let attempt = 0; attempt < 800; attempt++) {
      const px = cx + spiralR * Math.cos(angle);
      const py = cy + spiralR * Math.sin(angle);
      let collides = false;
      for (const b of bubbles) {
        const dx = px - b.x, dy = py - b.y;
        if (Math.sqrt(dx * dx + dy * dy) < r + b.r + 2) { collides = true; break; }
      }
      if (!collides && px > r + 2 && px < W - r - 2 && py > r + 25 && py < H - r - 2) {
        bubbles.push({ x: px, y: py, vx: 0, vy: 0, r, color, f });
        placed = true; break;
      }
      angle += 0.2; spiralR += 0.04;
    }
    if (!placed) {
      bubbles.push({ x: cx + (Math.random() - 0.5) * W * 0.3, y: cy + (Math.random() - 0.5) * H * 0.3, vx: 0, vy: 0, r, color, f });
    }
  }

  // Build edges from dependency graph
  const edges: [number, number][] = [];
  function basename(p: string): string { const n = p.split("/").pop() || ""; const d = n.lastIndexOf("."); return (d > 0 ? n.substring(0, d) : n).toLowerCase(); }
  const nameIdx: Record<string, number> = {};
  bubbles.forEach((b, i) => { nameIdx[basename(b.f.path)] = i; });
  for (const [src, deps] of Object.entries(depGraph)) {
    let srcIdx: number | null = null;
    bubbles.forEach((b, i) => { if (b.f.path === src) srcIdx = i; });
    if (srcIdx === null) continue;
    for (const tgt of deps) {
      const tgtName = tgt.split(".").pop()!.toLowerCase();
      const tgtIdx = nameIdx[tgtName];
      if (tgtIdx !== undefined && srcIdx !== tgtIdx) edges.push([srcIdx, tgtIdx]);
    }
  }

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  canvas.style.cssText = "display:block;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:#0f172a";
  const modeLabel = scanMode === "framework" ? '<span style="color:#cba6f7;font-weight:600">(Framework)</span> Add code to src/ to see your project' : '';
  container.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem"><h3 style="margin:0;font-size:0.85rem">Code Landscape ${modeLabel}</h3><span style="font-size:0.65rem;color:var(--muted)">Drag bubbles | Dbl-click to drill down</span></div><div style="position:relative" id="metrics-canvas-wrap"></div>`;
  document.getElementById("metrics-canvas-wrap")!.appendChild(canvas);

  // Zoom buttons
  const btnWrap = document.createElement("div");
  btnWrap.style.cssText = "position:absolute;top:8px;left:8px;z-index:2;display:flex;gap:4px;flex-direction:column";
  btnWrap.innerHTML = `
    <button class="btn btn-sm" id="metrics-zoom-in" style="width:28px;height:28px;padding:0;font-size:14px;font-weight:700;line-height:1">+</button>
    <button class="btn btn-sm" id="metrics-zoom-out" style="width:28px;height:28px;padding:0;font-size:14px;font-weight:700;line-height:1">&minus;</button>
    <button class="btn btn-sm" id="metrics-zoom-fit" style="width:28px;height:28px;padding:0;font-size:10px;font-weight:700;line-height:1">Fit</button>
  `;
  document.getElementById("metrics-canvas-wrap")!.appendChild(btnWrap);

  document.getElementById("metrics-zoom-in")?.addEventListener("click", () => { zoom = Math.min(5, zoom * 1.3); });
  document.getElementById("metrics-zoom-out")?.addEventListener("click", () => { zoom = Math.max(0.3, zoom * 0.7); });
  document.getElementById("metrics-zoom-fit")?.addEventListener("click", () => { zoom = 1; panX = 0; panY = 0; });
  const ctx = canvas.getContext("2d")!;

  let hoveredIdx = -1, dragIdx = -1, dragOX = 0, dragOY = 0;
  let panX = 0, panY = 0, zoom = 1, panning = false, panSX = 0, panSY = 0, panOX = 0, panOY = 0;

  // Physics simulation
  function simulate(): void {
    const damping = 0.65, springK = 0.002, repulse = 40, grav = 0.008;
    // Gravity toward center — bigger bubbles pulled harder
    for (let i = 0; i < bubbles.length; i++) {
      if (i === dragIdx) continue;
      const b = bubbles[i];
      const dx = cx - b.x, dy = cy - b.y;
      const sizeFactor = 0.3 + (b.r / maxR) * 0.7;
      const pull = grav * sizeFactor * sizeFactor;
      b.vx += dx * pull; b.vy += dy * pull;
    }
    // Spring forces along edges
    for (const [ei, ej] of edges) {
      const a = bubbles[ei], b = bubbles[ej];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const rest = a.r + b.r + 20;
      const force = (dist - rest) * springK;
      const fx = dx / dist * force, fy = dy / dist * force;
      if (ei !== dragIdx) { a.vx += fx; a.vy += fy; }
      if (ej !== dragIdx) { b.vx -= fx; b.vy -= fy; }
    }
    // Soft repulsion
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i], b = bubbles[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = a.r + b.r + 20;
        if (dist < minDist) {
          const force = repulse * (minDist - dist) / minDist;
          const fx = dx / dist * force, fy = dy / dist * force;
          if (i !== dragIdx) { a.vx -= fx; a.vy -= fy; }
          if (j !== dragIdx) { b.vx += fx; b.vy += fy; }
        }
      }
    }
    // Apply velocity
    for (let i = 0; i < bubbles.length; i++) {
      if (i === dragIdx) continue;
      const b = bubbles[i];
      b.vx *= damping; b.vy *= damping;
      const maxV = 2;
      b.vx = Math.max(-maxV, Math.min(maxV, b.vx));
      b.vy = Math.max(-maxV, Math.min(maxV, b.vy));
      b.x += b.vx; b.y += b.vy;
      b.x = Math.max(b.r + 2, Math.min(W - b.r - 2, b.x));
      b.y = Math.max(b.r + 25, Math.min(H - b.r - 2, b.y));
    }
  }

  // Draw frame
  function draw(): void {
    simulate();
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.translate(panX, panY); ctx.scale(zoom, zoom);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1 / zoom;
    for (let gx = 0; gx < W / zoom; gx += 50) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H / zoom); ctx.stroke(); }
    for (let gy = 0; gy < H / zoom; gy += 50) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W / zoom, gy); ctx.stroke(); }

    // Dependency arrows
    for (const [ei, ej] of edges) {
      const a = bubbles[ei], b = bubbles[ej];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const hi = (hoveredIdx === ei || hoveredIdx === ej);
      ctx.beginPath();
      ctx.moveTo(a.x + dx / dist * a.r, a.y + dy / dist * a.r);
      const ex = b.x - dx / dist * b.r, ey = b.y - dy / dist * b.r;
      ctx.lineTo(ex, ey);
      ctx.strokeStyle = hi ? "rgba(139,180,250,0.9)" : "rgba(255,255,255,0.15)";
      ctx.lineWidth = hi ? 3 : 1; ctx.stroke();
      // Arrowhead
      const aLen = hi ? 12 : 6;
      const aAng = Math.atan2(dy, dx);
      ctx.beginPath(); ctx.moveTo(ex, ey);
      ctx.lineTo(ex - aLen * Math.cos(aAng - 0.4), ey - aLen * Math.sin(aAng - 0.4));
      ctx.lineTo(ex - aLen * Math.cos(aAng + 0.4), ey - aLen * Math.sin(aAng + 0.4));
      ctx.closePath(); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
    }

    // Bubbles
    for (let idx = 0; idx < bubbles.length; idx++) {
      const b = bubbles[idx];
      const isH = idx === hoveredIdx;
      const drawR = isH ? b.r + 4 : b.r;
      // Hover glow
      if (isH) { ctx.beginPath(); ctx.arc(b.x, b.y, drawR + 8, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fill(); }
      // Bubble
      ctx.beginPath(); ctx.arc(b.x, b.y, drawR, 0, Math.PI * 2);
      ctx.fillStyle = b.color; ctx.globalAlpha = isH ? 1.0 : 0.85; ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = isH ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)"; ctx.lineWidth = isH ? 2.5 : 1.5; ctx.stroke();
      // Label
      const name = b.f.path.split("/").pop()?.replace(/\.\w+$/, "") || "?";
      if (drawR > 16) {
        const fs = Math.max(8, Math.min(13, drawR * 0.38));
        ctx.fillStyle = "#fff"; ctx.font = `600 ${fs}px monospace`; ctx.textAlign = "center";
        ctx.fillText(name, b.x, b.y - 2);
        ctx.fillStyle = "rgba(255,255,255,0.65)"; ctx.font = `${fs - 1}px monospace`;
        ctx.fillText(`${b.f.loc} LOC`, b.x, b.y + fs);
      }
      // D badge at top, T badge at bottom
      const mfs = Math.max(9, drawR * 0.3), mrad = mfs * 0.7;
      if (drawR > 14 && b.f.dep_count > 0) {
        const dy2 = b.y - drawR + mrad + 3;
        ctx.beginPath(); ctx.arc(b.x, dy2, mrad, 0, Math.PI * 2); ctx.fillStyle = "#ea580c"; ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = `bold ${mfs}px sans-serif`; ctx.textAlign = "center"; ctx.fillText("D", b.x, dy2 + mfs * 0.35);
      }
      if (drawR > 14 && b.f.has_tests) {
        const ty = b.y + drawR - mrad - 3;
        ctx.beginPath(); ctx.arc(b.x, ty, mrad, 0, Math.PI * 2); ctx.fillStyle = "#16a34a"; ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = `bold ${mfs}px sans-serif`; ctx.textAlign = "center"; ctx.fillText("T", b.x, ty + mfs * 0.35);
      }
    }

    ctx.restore();
    requestAnimationFrame(draw);
  }

  // Mouse handling
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - panX) / zoom;
    const my = (e.clientY - rect.top - panY) / zoom;
    if (panning) { panX = panOX + (e.clientX - panSX); panY = panOY + (e.clientY - panSY); return; }
    if (dragIdx >= 0) { bubbles[dragIdx].x = mx + dragOX; bubbles[dragIdx].y = my + dragOY; bubbles[dragIdx].vx = 0; bubbles[dragIdx].vy = 0; return; }
    hoveredIdx = -1;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i], dx = mx - b.x, dy = my - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < b.r + 4) { hoveredIdx = i; break; }
    }
    canvas.style.cursor = hoveredIdx >= 0 ? "grab" : "default";
  });

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - panX) / zoom;
    const my = (e.clientY - rect.top - panY) / zoom;
    if (e.button === 2) { panning = true; panSX = e.clientX; panSY = e.clientY; panOX = panX; panOY = panY; canvas.style.cursor = "move"; return; }
    if (hoveredIdx >= 0) {
      dragIdx = hoveredIdx; dragOX = bubbles[dragIdx].x - mx; dragOY = bubbles[dragIdx].y - my;
      canvas.style.cursor = "grabbing";
    }
  });

  canvas.addEventListener("mouseup", () => {
    if (panning) { panning = false; canvas.style.cursor = "default"; }
    if (dragIdx >= 0) { canvas.style.cursor = "grab"; dragIdx = -1; }
  });

  canvas.addEventListener("mouseleave", () => { hoveredIdx = -1; dragIdx = -1; panning = false; });

  canvas.addEventListener("dblclick", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left - panX) / zoom;
    const my = (e.clientY - rect.top - panY) / zoom;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i], dx = mx - b.x, dy = my - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < b.r + 4) { drillDown(b.f.path); break; }
    }
  });


  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // Start animation
  requestAnimationFrame(draw);
}

// ── Drill-down ──

async function drillDown(filePath: string): Promise<void> {
  const detail = document.getElementById("metrics-detail");
  if (!detail) return;
  detail.innerHTML = '<p class="text-muted">Loading file analysis...</p>';

  const d = await api<any>("/metrics/file?path=" + encodeURIComponent(filePath));
  if (d.error) { detail.innerHTML = `<p style="color:var(--danger)">${esc(d.error)}</p>`; return; }

  const functions = d.functions || [];
  const maxCC = Math.max(1, ...functions.map((f: any) => f.complexity));

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
        ${card("Imports", d.imports ? d.imports.length : 0)}
      </div>
      ${functions.length ? `
        <h4 style="font-size:0.8rem;color:var(--info);margin-bottom:0.5rem">Cyclomatic Complexity by Function</h4>
        ${functions.sort((a: any, b: any) => b.complexity - a.complexity).map((f: any) => {
          const pct = (f.complexity / maxCC) * 100;
          const color = f.complexity > 10 ? "#ef4444" : f.complexity > 5 ? "#f59e0b" : "#22c55e";
          return `<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:3px;font-size:0.75rem">
            <div style="width:200px;flex-shrink:0;text-align:right;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(f.name)}">${esc(f.name)}</div>
            <div style="flex:1;height:14px;background:var(--bg);border-radius:2px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${color}"></div></div>
            <div style="width:180px;flex-shrink:0;font-family:monospace;text-align:right"><span style="color:${color}">CC:${f.complexity}</span> <span style="color:var(--muted)">${f.loc} LOC L${f.line}</span></div>
          </div>`;
        }).join("")}
      ` : '<p class="text-muted">No functions</p>'}
    </div>
  `;
}

function card(label: string, value: any): string {
  return `<div class="metric-card"><div class="label">${esc(label)}</div><div class="value">${esc(String(value ?? 0))}</div></div>`;
}

(window as any).__drillDown = drillDown;
