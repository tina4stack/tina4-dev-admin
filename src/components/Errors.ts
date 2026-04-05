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
  body.innerHTML = errors.map((e: any, i: number) => `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:0.75rem;margin-bottom:0.75rem">
      <div class="flex items-center" style="justify-content:space-between">
        <div>
          <span class="badge badge-danger">UNRESOLVED</span>
          <strong style="margin-left:0.5rem;font-size:0.85rem">${esc(e.error || e.message || "Unknown error")}</strong>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-sm" onclick="window.__resolveError('${esc(e.id || String(i))}')">Resolve</button>
          <button class="btn btn-sm btn-primary" onclick="window.__askAboutError(${i})">Ask Tina4</button>
        </div>
      </div>
      ${e.traceback ? `<div class="error-trace">${esc(e.traceback)}</div>` : ""}
      <div class="text-sm text-muted" style="margin-top:0.5rem">${esc(e.timestamp || "")}</div>
    </div>
  `).join("");
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
  // Switch to chat tab and pre-fill
  const chatTab = document.querySelector('[data-tab="chat"]') as HTMLElement;
  if (chatTab) chatTab.click();
  setTimeout(() => {
    const input = document.getElementById("chat-input") as HTMLInputElement;
    if (input) {
      input.value = `I have this error: ${e.error || e.message}\n\n${e.traceback || ""}`;
      input.focus();
    }
  }, 100);
}

(window as any).__loadErrors = loadErrors;
(window as any).__clearErrors = clearErrors;
(window as any).__resolveError = resolveError;
(window as any).__askAboutError = askAboutError;
