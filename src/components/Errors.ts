import { api, esc } from "../api.js";

export function renderErrors(container: HTMLElement): void {
  container.innerHTML = `
    <div class="dev-panel-header">
      <h2>Errors <span id="errors-count" class="text-muted text-sm"></span></h2>
      <div class="flex gap-sm">
        <button class="btn btn-sm" onclick="window.__loadErrors()">Refresh</button>
        <button class="btn btn-sm btn-danger" onclick="window.__clearErrors()">Clear All</button>
      </div>
    </div>
    <div id="errors-body"></div>
  `;
  loadErrors();
}

async function loadErrors(): Promise<void> {
  const d = await api<any>("/broken");
  const count = document.getElementById("errors-count");
  const body = document.getElementById("errors-body");
  if (!body) return;
  const errors = d.errors || [];
  if (count) count.textContent = `(${errors.length})`;
  if (!errors.length) {
    body.innerHTML = '<div class="empty-state">No errors</div>';
    return;
  }
  body.innerHTML = errors.map((e: any, i: number) => {
    const title = e.error_type ? `${e.error_type}: ${e.message}` : (e.error || e.message || "Unknown error");
    const ctx = e.context || {};
    const time = e.last_seen || e.first_seen || e.timestamp || "";
    const timeStr = time ? new Date(time).toLocaleString() : "";
    return `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:0.75rem;margin-bottom:0.75rem">
      <div class="flex items-center" style="justify-content:space-between;flex-wrap:wrap;gap:0.5rem">
        <div style="flex:1;min-width:0">
          <span class="badge ${e.resolved ? 'badge-success' : 'badge-danger'}">${e.resolved ? "RESOLVED" : "UNRESOLVED"}</span>
          ${e.count > 1 ? `<span class="badge badge-warn" style="margin-left:4px">x${e.count}</span>` : ""}
          <strong style="margin-left:0.5rem;font-size:0.85rem">${esc(title)}</strong>
        </div>
        <div class="flex gap-sm" style="flex-shrink:0">
          ${!e.resolved ? `<button class="btn btn-sm" onclick="window.__resolveError('${esc(e.id || String(i))}')">Resolve</button>` : ""}
          <button class="btn btn-sm btn-primary" onclick="window.__askAboutError(${i})">Ask Tina4</button>
        </div>
      </div>
      ${ctx.method ? `<div class="text-sm text-mono" style="margin-top:0.5rem;color:var(--info)">${esc(ctx.method)} ${esc(ctx.path || "")}</div>` : ""}
      ${e.traceback ? `<pre style="margin-top:0.5rem;padding:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:4px;font-size:0.7rem;overflow-x:auto;white-space:pre-wrap;max-height:200px;overflow-y:auto">${esc(e.traceback)}</pre>` : ""}
      <div class="text-sm text-muted" style="margin-top:0.5rem">${esc(timeStr)}</div>
    </div>
  `}).join("");
  (window as any).__errorData = errors;
}

async function resolveError(id: string): Promise<void> {
  await api("/broken/resolve", "POST", { id });
  loadErrors();
}

async function clearErrors(): Promise<void> {
  await api("/broken/clear", "POST");
  loadErrors();
}

function askAboutError(index: number): void {
  const errors = (window as any).__errorData || [];
  const e = errors[index];
  if (!e) return;
  const title = e.error_type ? `${e.error_type}: ${e.message}` : (e.error || e.message || "Unknown error");
  const ctx = e.context || {};
  const route = ctx.method && ctx.path ? `\nRoute: ${ctx.method} ${ctx.path}` : "";
  const prompt = `I have this error: ${title}${route}\n\n${e.traceback || ""}`;

  // Switch to Code With Me tab, then pre-fill
  (window as any).__switchTab("chat");
  setTimeout(() => {
    (window as any).__prefillChat(prompt);
  }, 150);
}

(window as any).__loadErrors = loadErrors;
(window as any).__clearErrors = clearErrors;
(window as any).__resolveError = resolveError;
(window as any).__askAboutError = askAboutError;
