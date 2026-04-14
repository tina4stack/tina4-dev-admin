import { api, esc } from "../api.js";

let autoRefresh = false;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let activeView: "jobs" | "dead-letters" = "jobs";
let statusFilter = "";
let container: HTMLElement | null = null;

export function renderQueue(el: HTMLElement): void {
  container = el;
  el.innerHTML = `
    <div class="dev-panel-header">
      <h2>Queue Monitor</h2>
      <div style="display:flex;gap:0.5rem;align-items:center">
        <button class="btn btn-sm ${activeView === 'jobs' ? 'btn-primary' : ''}" onclick="window.__queueView('jobs')">Jobs</button>
        <button class="btn btn-sm ${activeView === 'dead-letters' ? 'btn-primary' : ''}" onclick="window.__queueView('dead-letters')">Dead Letters</button>
        <span style="color:var(--muted);margin:0 0.25rem">|</span>
        <label style="font-size:0.75rem;color:var(--muted);cursor:pointer;display:flex;align-items:center;gap:0.25rem">
          <input type="checkbox" ${autoRefresh ? "checked" : ""} onchange="window.__queueAutoRefresh(this.checked)"> Auto-refresh
        </label>
        <button class="btn btn-sm" onclick="window.__queueRefresh()">Refresh</button>
      </div>
    </div>
    <div id="queue-stats" style="display:flex;gap:1rem;margin-bottom:1rem"></div>
    <div id="queue-actions" style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap"></div>
    <div id="queue-list"></div>
  `;

  loadQueue();
}

async function loadQueue(): Promise<void> {
  if (activeView === "dead-letters") {
    loadDeadLetters();
    return;
  }

  try {
    const data = await api<any>(`/queue${statusFilter ? `?status=${statusFilter}` : ""}`);

    // Stats
    const statsEl = document.getElementById("queue-stats");
    if (statsEl && data.stats) {
      const s = data.stats;
      statsEl.innerHTML = `
        <span class="badge" style="background:var(--warn);color:#000;cursor:pointer" onclick="window.__queueFilter('pending')">Pending: ${s.pending || 0}</span>
        <span class="badge" style="background:var(--info);cursor:pointer" onclick="window.__queueFilter('reserved')">Reserved: ${s.reserved || 0}</span>
        <span class="badge" style="background:var(--success);cursor:pointer" onclick="window.__queueFilter('completed')">Completed: ${s.completed || 0}</span>
        <span class="badge" style="background:var(--danger);cursor:pointer" onclick="window.__queueFilter('failed')">Failed: ${s.failed || 0}</span>
        ${statusFilter ? `<span class="badge" style="background:var(--muted);cursor:pointer" onclick="window.__queueFilter('')">Clear Filter &times;</span>` : ""}
      `;
    }

    // Bulk actions
    const actionsEl = document.getElementById("queue-actions");
    if (actionsEl) {
      actionsEl.innerHTML = `
        <button class="btn btn-sm" style="background:var(--warn);color:#000" onclick="window.__queueRetryAll()">Retry All Failed</button>
        <button class="btn btn-sm" style="background:var(--success)" onclick="window.__queuePurge('completed')">Purge Completed</button>
        <button class="btn btn-sm" style="background:var(--danger)" onclick="window.__queuePurge('failed')">Purge Failed</button>
      `;
    }

    // Job list
    const listEl = document.getElementById("queue-list");
    if (listEl) {
      if (!data.jobs || data.jobs.length === 0) {
        listEl.innerHTML = `<div class="text-muted text-center" style="padding:2rem">No jobs found</div>`;
      } else {
        listEl.innerHTML = `
          <table class="table" style="font-size:0.8rem">
            <thead>
              <tr>
                <th style="width:60px">ID</th>
                <th>Topic</th>
                <th style="width:80px;text-align:center">Status</th>
                <th>Data</th>
                <th style="width:140px">Created</th>
                <th style="width:60px;text-align:center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.jobs.map((job: any) => `
                <tr>
                  <td style="font-family:var(--mono);font-size:0.7rem">${esc(String(job.id || ""))}</td>
                  <td>${esc(job.topic || "default")}</td>
                  <td style="text-align:center">${statusBadge(job.status)}</td>
                  <td><code style="font-size:0.7rem;word-break:break-all;max-width:300px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(JSON.stringify(job.data || {}))}">${esc(JSON.stringify(job.data || {}).slice(0, 80))}</code></td>
                  <td style="font-size:0.7rem;color:var(--muted)">${esc(job.created_at || "")}</td>
                  <td style="text-align:center">
                    ${job.status === "failed" ? `<button class="btn btn-sm" style="font-size:0.65rem;padding:2px 6px" onclick="window.__queueReplay('${esc(String(job.id))}')">Retry</button>` : ""}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      }
    }
  } catch (e: any) {
    const listEl = document.getElementById("queue-list");
    if (listEl) listEl.innerHTML = `<div style="color:var(--danger);padding:1rem">${esc(e.message || String(e))}</div>`;
  }
}

async function loadDeadLetters(): Promise<void> {
  try {
    const data = await api<any>("/queue/dead-letters");

    const statsEl = document.getElementById("queue-stats");
    if (statsEl) {
      statsEl.innerHTML = `<span class="badge" style="background:var(--danger)">Dead Letters: ${data.count || 0}</span>`;
    }

    const actionsEl = document.getElementById("queue-actions");
    if (actionsEl) {
      actionsEl.innerHTML = `
        <button class="btn btn-sm" style="background:var(--warn);color:#000" onclick="window.__queueRetryAll()">Retry All Dead Letters</button>
      `;
    }

    const listEl = document.getElementById("queue-list");
    if (listEl) {
      if (!data.jobs || data.jobs.length === 0) {
        listEl.innerHTML = `<div class="text-muted text-center" style="padding:2rem">No dead letter jobs</div>`;
      } else {
        listEl.innerHTML = `
          <table class="table" style="font-size:0.8rem">
            <thead>
              <tr>
                <th style="width:60px">ID</th>
                <th>Topic</th>
                <th>Data</th>
                <th>Error</th>
                <th style="width:50px">Retries</th>
                <th style="width:60px;text-align:center">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.jobs.map((job: any) => `
                <tr>
                  <td style="font-family:var(--mono);font-size:0.7rem">${esc(String(job.id || ""))}</td>
                  <td>${esc(job.topic || "default")}</td>
                  <td><code style="font-size:0.7rem;word-break:break-all;max-width:250px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(JSON.stringify(job.data || {}))}">${esc(JSON.stringify(job.data || {}).slice(0, 60))}</code></td>
                  <td style="color:var(--danger);font-size:0.7rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(job.error || "")}">${esc(job.error || "")}</td>
                  <td style="text-align:center">${job.retries || 0}</td>
                  <td style="text-align:center">
                    <button class="btn btn-sm" style="font-size:0.65rem;padding:2px 6px" onclick="window.__queueReplay('${esc(String(job.id))}')">Replay</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      }
    }
  } catch (e: any) {
    const listEl = document.getElementById("queue-list");
    if (listEl) listEl.innerHTML = `<div style="color:var(--danger);padding:1rem">${esc(e.message || String(e))}</div>`;
  }
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = {
    pending: "var(--warn)",
    reserved: "var(--info)",
    completed: "var(--success)",
    failed: "var(--danger)",
  };
  const bg = colors[status] || "var(--muted)";
  return `<span class="badge" style="background:${bg};font-size:0.65rem">${esc(status)}</span>`;
}

// Global handlers
(window as any).__queueView = (view: "jobs" | "dead-letters") => {
  activeView = view;
  statusFilter = "";
  if (container) renderQueue(container);
};

(window as any).__queueFilter = (status: string) => {
  statusFilter = status;
  loadQueue();
};

(window as any).__queueRefresh = () => loadQueue();

(window as any).__queueAutoRefresh = (enabled: boolean) => {
  autoRefresh = enabled;
  if (refreshTimer) clearInterval(refreshTimer);
  if (autoRefresh) {
    refreshTimer = setInterval(loadQueue, 3000);
  }
};

(window as any).__queueRetryAll = async () => {
  await api("/queue/retry", "POST", { topic: "default" });
  loadQueue();
};

(window as any).__queuePurge = async (status: string) => {
  if (!confirm(`Purge all ${status} jobs?`)) return;
  await api("/queue/purge", "POST", { status, topic: "default" });
  loadQueue();
};

(window as any).__queueReplay = async (id: string) => {
  await api("/queue/replay", "POST", { id, topic: "default" });
  loadQueue();
};
