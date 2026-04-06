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
    renderBubbleChart(d.file_metrics, chartEl, d.dependency_graph || {});
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

function renderBubbleChart(files: any[], container: HTMLElement, depGraph: Record<string, string[]>): void {
  const w = container.clientWidth || 900;
  const h = 450;
  const maxLoc = Math.max(...files.map((f: any) => f.loc || 1));
  const minRadius = 18;
  const maxRadius = 50;

  const placeCenterX = 1000;
  const placeCenterY = 1000;

  // Sort most complex first for packing (most complex → center)
  const sorted = [...files].sort((a, b) => {
    const ca = (a.avg_complexity ?? 0) * 2 + (a.loc || 0);
    const cb = (b.avg_complexity ?? 0) * 2 + (b.loc || 0);
    return cb - ca;
  });

  const bubbles = sorted.map((f: any) => ({
    ...f,
    r: Math.max(minRadius, Math.min(maxRadius, Math.sqrt((f.loc || 1) / maxLoc) * maxRadius)),
    x: placeCenterX,
    y: placeCenterY,
  }));

  // Circle packing — spiral outward from center
  for (let i = 0; i < bubbles.length; i++) {
    if (i === 0) continue;
    let angle = 0, dist = 0, placed = false;
    while (!placed) {
      const tx = placeCenterX + Math.cos(angle) * dist;
      const ty = placeCenterY + Math.sin(angle) * dist;
      let overlaps = false;
      for (let j = 0; j < i; j++) {
        const dx = tx - bubbles[j].x, dy = ty - bubbles[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < bubbles[i].r + bubbles[j].r + 4) { overlaps = true; break; }
      }
      if (!overlaps) { bubbles[i].x = tx; bubbles[i].y = ty; placed = true; }
      angle += 0.3; dist += 0.5;
    }
  }

  // Spread bubbles out initially so the attraction is visible
  for (const b of bubbles) {
    b.x += (b.x - placeCenterX) * 1.5;
    b.y += (b.y - placeCenterY) * 1.5;
  }

  // Cluster bounds
  let cMinX = Infinity, cMaxX = -Infinity, cMinY = Infinity, cMaxY = -Infinity;
  for (const b of bubbles) {
    cMinX = Math.min(cMinX, b.x - b.r - 15);
    cMaxX = Math.max(cMaxX, b.x + b.r + 15);
    cMinY = Math.min(cMinY, b.y - b.r - 15);
    cMaxY = Math.max(cMaxY, b.y + b.r + 25);
  }

  const pad = 30;
  const vbX = cMinX - pad, vbY = cMinY - pad;
  const vbW = (cMaxX - cMinX) + pad * 2, vbH = (cMaxY - cMinY) + pad * 2;
  const gridStep = Math.max(20, Math.round(Math.max(vbW, vbH) / 20));

  // Build wrapper with hover panel
  container.innerHTML = `
    <div style="position:relative;display:flex;gap:0">
      <div style="flex:1;position:relative">
        <div style="position:absolute;top:8px;left:8px;z-index:2;display:flex;gap:4px;flex-direction:column">
          <button class="btn btn-sm" id="metrics-zoom-in" style="width:28px;height:28px;padding:0;font-size:14px;font-weight:700;line-height:1">+</button>
          <button class="btn btn-sm" id="metrics-zoom-out" style="width:28px;height:28px;padding:0;font-size:14px;font-weight:700;line-height:1">&minus;</button>
          <button class="btn btn-sm" id="metrics-zoom-fit" style="width:28px;height:28px;padding:0;font-size:10px;font-weight:700;line-height:1">Fit</button>
        </div>
        <svg id="metrics-svg" width="100%" height="${h}" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" style="background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;cursor:grab"></svg>
      </div>
      <div id="metrics-hover-panel" style="width:200px;flex-shrink:0;background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:0.75rem;font-size:0.75rem;margin-left:0.5rem;overflow-y:auto;height:${h}px">
        <div class="text-muted" style="text-align:center;padding-top:2rem">Hover a bubble<br>to see stats</div>
      </div>
    </div>
  `;

  const svgEl = document.getElementById("metrics-svg") as unknown as SVGSVGElement;
  if (!svgEl) return;

  // Build path lookup for dependency lines
  const pathToPos: Record<string, { x: number; y: number; r: number }> = {};
  for (const b of bubbles) { if (b.path) pathToPos[b.path] = { x: b.x, y: b.y, r: b.r }; }

  let content = "";

  // --- Grid ---
  const gx0 = Math.floor((vbX - vbW) / gridStep) * gridStep;
  const gx1 = Math.ceil((vbX + vbW * 3) / gridStep) * gridStep;
  const gy0 = Math.floor((vbY - vbH) / gridStep) * gridStep;
  const gy1 = Math.ceil((vbY + vbH * 3) / gridStep) * gridStep;
  content += '<g class="metrics-grid">';
  for (let x = gx0; x <= gx1; x += gridStep) content += `<line x1="${x}" y1="${gy0}" x2="${x}" y2="${gy1}" stroke="var(--border)" stroke-width="0.5" stroke-opacity="0.4" />`;
  for (let y = gy0; y <= gy1; y += gridStep) content += `<line x1="${gx0}" y1="${y}" x2="${gx1}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-opacity="0.4" />`;
  content += "</g>";

  // --- Arrow marker definition ---
  content += `<defs>
    <marker id="dep-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--info)" fill-opacity="0.5" />
    </marker>
  </defs>`;

  // --- Dependency arrows (files sharing common imports) ---
  // Build: for each import, which files use it?
  const importToFiles: Record<string, string[]> = {};
  for (const [srcPath, deps] of Object.entries(depGraph)) {
    if (!pathToPos[srcPath]) continue;
    for (const dep of deps) {
      if (!importToFiles[dep]) importToFiles[dep] = [];
      if (!importToFiles[dep].includes(srcPath)) importToFiles[dep].push(srcPath);
    }
  }

  // Draw arrows between files that share an import (deduplicated pairs)
  const drawnPairs = new Set<string>();
  content += '<g class="dep-lines">';
  for (const files of Object.values(importToFiles)) {
    if (files.length < 2) continue;
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const pairKey = [files[i], files[j]].sort().join("|");
        if (drawnPairs.has(pairKey)) continue;
        drawnPairs.add(pairKey);
        const a = pathToPos[files[i]], b = pathToPos[files[j]];
        if (!a || !b) continue;
        // Shorten line so arrow stops at bubble edge
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / dist, uy = dy / dist;
        const x1 = a.x + ux * (a.r + 2), y1 = a.y + uy * (a.r + 2);
        const x2 = b.x - ux * (b.r + 2), y2 = b.y - uy * (b.r + 2);
        content += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--info)" stroke-width="1.5" stroke-opacity="0.4" marker-end="url(#dep-arrow)" />`;
      }
    }
  }
  content += "</g>";

  // --- Bubbles ---
  for (const f of bubbles) {
    const mi = f.maintainability ?? 50;
    // Composite health: MI + test bonus + dep penalty
    const testBonus = f.has_tests ? 15 : -15;
    const depPenalty = Math.min((f.dep_count ?? 0) * 3, 20);
    const health = Math.min(120, Math.max(0, (mi * 1.2) + testBonus - depPenalty));
    const hue = health;
    const color = `hsl(${hue}, 80%, 45%)`;
    const fileName = f.path?.split("/").pop() || "?";
    const hasTests = f.has_tests === true;
    const depCount = f.dep_count ?? 0;

    content += `<circle cx="${f.x}" cy="${f.y}" r="${f.r}" fill="${color}" fill-opacity="0.6" stroke="${color}" stroke-width="1.5" style="cursor:pointer" data-drill="${esc(f.path)}" />`;
    content += `<title>${esc(f.path)}\nLOC: ${f.loc} | CC: ${f.avg_complexity} | MI: ${mi}${hasTests ? " | Tested" : ""}${depCount > 0 ? " | Deps: " + depCount : ""}</title>`;

    if (f.r > 15) {
      const label = fileName.length > 12 ? fileName.substring(0, 10) + ".." : fileName;
      content += `<text x="${f.x}" y="${f.y + 2}" text-anchor="middle" fill="white" font-size="8" font-weight="600" style="pointer-events:none" data-for="${esc(f.path)}" data-role="label">${esc(label)}</text>`;
    }

    // (T) tested badge — inside bubble, bottom-center
    if (hasTests) {
      const tx = f.x, ty = f.y + f.r - 10;
      content += `<circle cx="${tx}" cy="${ty}" r="7" fill="var(--success)" stroke="var(--surface)" stroke-width="1" data-for="${esc(f.path)}" data-role="t-circle" />`;
      content += `<text x="${tx}" y="${ty + 3}" text-anchor="middle" fill="white" font-size="7" font-weight="700" style="pointer-events:none" data-for="${esc(f.path)}" data-role="t-text">T</text>`;
    }

    // (D) dependency badge — inside bubble, top-center
    if (depCount > 0) {
      const dx = f.x, dy = f.y - f.r + 10;
      content += `<circle cx="${dx}" cy="${dy}" r="7" fill="var(--info)" stroke="var(--surface)" stroke-width="1" data-for="${esc(f.path)}" data-role="d-circle" />`;
      content += `<text x="${dx}" y="${dy + 3}" text-anchor="middle" fill="white" font-size="7" font-weight="700" style="pointer-events:none" data-for="${esc(f.path)}" data-role="d-text">D</text>`;
    }
  }

  svgEl.innerHTML = content;

  // --- State ---
  let didDrag = false;
  let isPanning = false;
  let draggingBubble: any = null;
  let panStart = { x: 0, y: 0, vbX: 0, vbY: 0 };
  let vb = { x: vbX, y: vbY, w: vbW, h: vbH };
  const fitVb = { x: vbX, y: vbY, w: vbW, h: vbH };
  const DRAG_THRESHOLD = 4;
  const hoverPanel = document.getElementById("metrics-hover-panel")!;

  function applyVb(): void { svgEl.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); }

  function zoom(factor: number): void {
    const cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2;
    vb.w *= factor; vb.h *= factor;
    vb.x = cx - vb.w / 2; vb.y = cy - vb.h / 2;
    applyVb();
  }

  // Convert screen coords to SVG viewBox coords (accounts for preserveAspectRatio)
  function screenToSvg(sx: number, sy: number): { x: number; y: number } {
    const pt = svgEl.createSVGPoint();
    pt.x = sx;
    pt.y = sy;
    const ctm = svgEl.getScreenCTM();
    if (ctm) {
      const svgPt = pt.matrixTransform(ctm.inverse());
      return { x: svgPt.x, y: svgPt.y };
    }
    // Fallback
    const rect = svgEl.getBoundingClientRect();
    return {
      x: vb.x + (sx - rect.left) / rect.width * vb.w,
      y: vb.y + (sy - rect.top) / rect.height * vb.h,
    };
  }

  // Redraw all bubble positions + dep arrows (called after drag)
  function redrawBubbles(): void {
    // Rebuild dep arrows
    svgEl.querySelectorAll(".dep-lines line").forEach(l => l.remove());
    const depGroup = svgEl.querySelector(".dep-lines");
    if (depGroup) {
      const redrawnPairs = new Set<string>();
      for (const files of Object.values(importToFiles)) {
        if (files.length < 2) continue;
        for (let i = 0; i < files.length; i++) {
          for (let j = i + 1; j < files.length; j++) {
            const pk = [files[i], files[j]].sort().join("|");
            if (redrawnPairs.has(pk)) continue;
            redrawnPairs.add(pk);
            const a = bubbles.find(bb => bb.path === files[i]);
            const b = bubbles.find(bb => bb.path === files[j]);
            if (!a || !b) continue;
            const dx = b.x - a.x, dy = b.y - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / dist, uy = dy / dist;
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", String(a.x + ux * (a.r + 2)));
            line.setAttribute("y1", String(a.y + uy * (a.r + 2)));
            line.setAttribute("x2", String(b.x - ux * (b.r + 2)));
            line.setAttribute("y2", String(b.y - uy * (b.r + 2)));
            line.setAttribute("stroke", "var(--info)"); line.setAttribute("stroke-width", "1.5");
            line.setAttribute("stroke-opacity", "0.4"); line.setAttribute("marker-end", "url(#dep-arrow)");
            depGroup.appendChild(line);
          }
        }
      }
    }

    // Update circle + text positions
    svgEl.querySelectorAll("[data-drill]").forEach((circle) => {
      const path = circle.getAttribute("data-drill");
      const b = bubbles.find(bb => bb.path === path);
      if (!b) return;
      circle.setAttribute("cx", String(b.x));
      circle.setAttribute("cy", String(b.y));
    });

    // Update associated text/badge positions via data-for
    svgEl.querySelectorAll("[data-for]").forEach((el) => {
      const path = el.getAttribute("data-for");
      const role = el.getAttribute("data-role");
      const b = bubbles.find(bb => bb.path === path);
      if (!b) return;
      if (role === "label") { el.setAttribute("x", String(b.x)); el.setAttribute("y", String(b.y + 2)); }
      else if (role === "t-circle") { el.setAttribute("cx", String(b.x)); el.setAttribute("cy", String(b.y + b.r - 10)); }
      else if (role === "t-text") { el.setAttribute("x", String(b.x)); el.setAttribute("y", String(b.y + b.r - 7)); }
      else if (role === "d-circle") { el.setAttribute("cx", String(b.x)); el.setAttribute("cy", String(b.y - b.r + 10)); }
      else if (role === "d-text") { el.setAttribute("x", String(b.x)); el.setAttribute("y", String(b.y - b.r + 13)); }
    });
  }

  // Show stats on hover panel
  function showHoverStats(b: any): void {
    const mi = b.maintainability ?? 0;
    const hue = Math.min(120, Math.max(0, mi * 1.2));
    const miColor = `hsl(${hue}, 80%, 45%)`;
    hoverPanel.innerHTML = `
      <div style="font-weight:700;font-size:0.85rem;margin-bottom:0.5rem;word-break:break-all">${esc(b.path || "?")}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:0.5rem">
        <div><span class="text-muted">LOC</span><br><strong>${b.loc ?? 0}</strong></div>
        <div><span class="text-muted">Lines</span><br><strong>${b.total_lines ?? b.loc ?? 0}</strong></div>
        <div><span class="text-muted">Complexity</span><br><strong>${b.avg_complexity ?? 0}</strong></div>
        <div><span class="text-muted">MI</span><br><strong style="color:${miColor}">${mi}</strong></div>
        <div><span class="text-muted">Functions</span><br><strong>${b.function_count ?? 0}</strong></div>
        <div><span class="text-muted">Deps</span><br><strong>${b.dep_count ?? 0}</strong></div>
      </div>
      <div style="margin-bottom:0.25rem">${b.has_tests ? '<span class="badge badge-success">Tested</span>' : '<span class="badge badge-muted">No tests</span>'}</div>
      ${(b.dep_count ?? 0) > 0 ? '<div><span class="badge badge-info">' + b.dep_count + ' dependencies</span></div>' : ""}
      <div style="margin-top:0.75rem;font-size:0.7rem;color:var(--muted)">Click to drill down</div>
    `;
  }

  // --- Hover listeners on each bubble ---
  svgEl.querySelectorAll("[data-drill]").forEach((circle) => {
    circle.addEventListener("mouseenter", () => {
      const path = circle.getAttribute("data-drill");
      const b = bubbles.find(bb => bb.path === path);
      if (b) showHoverStats(b);
    });
  });

  // --- Mouse handling: pan canvas OR drag bubble ---
  // Key: only start dragging after mouse moves past threshold.
  // A short click (no movement) always fires drill-down.
  let mouseDownTarget: Element | null = null;
  let mouseDownPos = { x: 0, y: 0 };
  let bubbleDragOffset = { x: 0, y: 0 };

  svgEl.addEventListener("mousedown", (e: MouseEvent) => {
    if (e.button !== 0) return;
    didDrag = false;
    draggingBubble = null;
    mouseDownTarget = e.target as Element;
    mouseDownPos = { x: e.clientX, y: e.clientY };

    // Always start as a potential pan; bubble drag only kicks in after threshold
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY, vbX: vb.x, vbY: vb.y };
  });

  window.addEventListener("mousemove", (e: MouseEvent) => {
    if (!isPanning && !draggingBubble) return;

    const dx = e.clientX - mouseDownPos.x;
    const dy = e.clientY - mouseDownPos.y;
    const moved = Math.abs(dx) >= DRAG_THRESHOLD || Math.abs(dy) >= DRAG_THRESHOLD;
    if (!moved) return;

    // First real movement — decide: bubble drag or canvas pan
    if (!didDrag) {
      didDrag = true;
      const drillPath = mouseDownTarget?.getAttribute?.("data-drill");
      if (drillPath) {
        const b = bubbles.find(bb => bb.path === drillPath);
        if (b) {
          draggingBubble = b;
          isPanning = false;
          svgEl.style.cursor = "move";
          // Capture offset so bubble doesn't snap to cursor
          const startSvg = screenToSvg(mouseDownPos.x, mouseDownPos.y);
          bubbleDragOffset = { x: b.x - startSvg.x, y: b.y - startSvg.y };
        }
      }
      if (!draggingBubble) {
        svgEl.style.cursor = "grabbing";
      }
    }

    if (draggingBubble) {
      const pos = screenToSvg(e.clientX, e.clientY);
      draggingBubble.x = pos.x + bubbleDragOffset.x;
      draggingBubble.y = pos.y + bubbleDragOffset.y;
      redrawBubbles();
    } else if (isPanning) {
      // Convert pixel delta to SVG units using the CTM scale
      const ctm = svgEl.getScreenCTM();
      if (ctm) {
        vb.x = panStart.vbX - dx / ctm.a;
        vb.y = panStart.vbY - dy / ctm.d;
      } else {
        const rect = svgEl.getBoundingClientRect();
        vb.x = panStart.vbX - (dx / rect.width * vb.w);
        vb.y = panStart.vbY - (dy / rect.height * vb.h);
      }
      applyVb();
    }
  });

  window.addEventListener("mouseup", (e: MouseEvent) => {
    const wasDrag = didDrag;
    const target = mouseDownTarget;

    // If no drag happened and we clicked a bubble → drill down
    if (!wasDrag && target) {
      const path = target.getAttribute?.("data-drill");
      if (path) drillDown(path);
    }

    draggingBubble = null;
    isPanning = false;
    didDrag = false;
    mouseDownTarget = null;
    svgEl.style.cursor = "grab";
  });

  // --- Zoom buttons ---
  document.getElementById("metrics-zoom-in")?.addEventListener("click", () => zoom(0.7));
  document.getElementById("metrics-zoom-out")?.addEventListener("click", () => zoom(1.4));
  document.getElementById("metrics-zoom-fit")?.addEventListener("click", () => { vb = { ...fitVb }; applyVb(); });

  // --- Floating legend ---
  const legend = document.createElement("div");
  legend.style.cssText = "position:absolute;bottom:8px;left:8px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:6px 10px;font-size:11px;line-height:1.6;opacity:0.9;z-index:2";
  legend.innerHTML = `
    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:hsl(0,80%,45%);vertical-align:middle"></span> Low MI &nbsp;
    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:hsl(60,80%,45%);vertical-align:middle"></span> Med &nbsp;
    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:hsl(120,80%,45%);vertical-align:middle"></span> High MI &nbsp;
    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--success);vertical-align:middle"></span> T &nbsp;
    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--info);vertical-align:middle"></span> D &nbsp;
    <span style="color:var(--info)">---</span> Dep
  `;
  container.querySelector("div > div:first-child")?.parentElement?.appendChild(legend);

  // --- Live gravity animation ---
  const GAP = 25;
  let animId = 0;

  function simStep(): void {
    if (draggingBubble) { animId = requestAnimationFrame(simStep); return; }

    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const dx = bubbles[j].x - bubbles[i].x;
        const dy = bubbles[j].y - bubbles[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const minD = bubbles[i].r + bubbles[j].r + GAP;
        const ux = dx / dist, uy = dy / dist;

        if (dist < minD) {
          // Repel
          const push = (minD - dist) * 0.15;
          bubbles[i].x -= ux * push;
          bubbles[i].y -= uy * push;
          bubbles[j].x += ux * push;
          bubbles[j].y += uy * push;
        } else {
          // Attract
          const pull = (dist - minD) * 0.008;
          bubbles[i].x += ux * pull;
          bubbles[i].y += uy * pull;
          bubbles[j].x -= ux * pull;
          bubbles[j].y -= uy * pull;
        }
      }
    }

    redrawBubbles();
    animId = requestAnimationFrame(simStep);
  }

  animId = requestAnimationFrame(simStep);

  // Stop animation when tab switches away
  const observer = new MutationObserver(() => {
    if (!document.getElementById("metrics-svg")) cancelAnimationFrame(animId);
  });
  observer.observe(container, { childList: true });
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
