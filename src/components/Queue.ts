import { api, esc } from "../api.js";

let autoRefresh = false;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let activeView: "jobs" | "dead-letters" = "jobs";
let statusFilter = "";
let currentTopic = "default";
let topics: string[] = ["default"];
let container: HTMLElement | null = null;

export function renderQueue(el: HTMLElement): void {
  container = el;
  // Load topics first, then render
  api<any>("/queue/topics").then(d => {
    if (d.topics && d.topics.length > 0) {
      topics = d.topics;
      if (!topics.includes(currentTopic)) currentTopic = topics[0];
    }
    renderUI();
  }).catch(() => renderUI());
}

function renderUI(): void {
  if (!container) return;
  const topicOptions = topics.map(t =>
    `<option value="${esc(t)}" ${t === currentTopic ? "selected" : ""}>${esc(t)}</option>`
  ).join("");

  container.innerHTML = `
    <div class="dev-panel-header">
      <h2>Queue Monitor</h2>
      <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
        <select id="queue-topic-select" onchange="window.__queueTopic(this.value)" style="background:var(--surface);color:var(--text);border:1px solid var(--border);border-radius:0.25rem;padding:0.25rem 0.5rem;font-size:0.8rem">
          ${topicOptions}
        </select>
        <button class="btn btn-sm ${activeView === 'jobs' ? 'btn-primary' : ''}" onclick="window.__queueView('jobs')">Jobs</button>
        <button class="btn btn-sm ${activeView === 'dead-letters' ? 'btn-primary' : ''}" onclick="window.__queueView('dead-letters')">Dead Letters</button>
        <span style="color:var(--muted)">|</span>
        <label style="font-size:0.75rem;color:var(--muted);cursor:pointer;display:flex;align-items:center;gap:0.25rem">
          <input type="checkbox" ${autoRefresh ? "checked" : ""} onchange="window.__queueAutoRefresh(this.checked)"> Auto
        </label>
        <button class="btn btn-sm" onclick="window.__queueRefresh()">Refresh</button>
      </div>
    </div>
    <div id="queue-stats" style="display:flex;gap:0.75rem;margin-bottom:1rem;flex-wrap:wrap"></div>
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
    const params = `?topic=${encodeURIComponent(currentTopic)}${statusFilter ? `&status=${statusFilter}` : ""}`;
    const data = await api<any>(`/queue${params}`);

    // Stats
    const statsEl = document.getElementById("queue-stats");
    if (statsEl && data.stats) {
      const s = data.stats;
      const total = (s.pending || 0) + (s.reserved || 0) + (s.completed || 0) + (s.failed || 0);
      statsEl.innerHTML = `
        <span class="badge" style="background:var(--surface);border:1px solid var(--border);color:var(--text);cursor:pointer" onclick="window.__queueFilter('')">All: ${total}</span>
        <span class="badge" style="background:var(--warn);color:#000;cursor:pointer" onclick="window.__queueFilter('pending')">Pending: ${s.pending || 0}</span>
        <span class="badge" style="background:var(--info);cursor:pointer" onclick="window.__queueFilter('reserved')">Reserved: ${s.reserved || 0}</span>
        <span class="badge" style="background:var(--success);cursor:pointer" onclick="window.__queueFilter('completed')">Completed: ${s.completed || 0}</span>
        <span class="badge" style="background:var(--danger);cursor:pointer" onclick="window.__queueFilter('failed')">Failed: ${s.failed || 0}</span>
        ${statusFilter ? `<span class="badge" style="background:var(--muted);cursor:pointer" onclick="window.__queueFilter('')">&times; Clear</span>` : ""}
      `;
    }

    // Actions
    const actionsEl = document.getElementById("queue-actions");
    if (actionsEl) {
      actionsEl.innerHTML = `
        <button class="btn btn-sm" style="background:var(--warn);color:#000" onclick="window.__queueRetryAll()">Retry Failed</button>
        <button class="btn btn-sm" style="background:var(--success)" onclick="window.__queuePurge('completed')">Purge Completed</button>
        <button class="btn btn-sm" style="background:var(--danger)" onclick="window.__queuePurge('failed')">Purge Failed</button>
      `;
    }

    // Job list
    const listEl = document.getElementById("queue-list");
    if (!listEl) return;

    if (!data.jobs || data.jobs.length === 0) {
      listEl.innerHTML = `<div class="text-muted text-center" style="padding:2rem">No jobs in <strong>${esc(currentTopic)}</strong>${statusFilter ? ` with status <strong>${esc(statusFilter)}</strong>` : ""}</div>`;
      return;
    }

    listEl.innerHTML = `
      <table class="table" style="font-size:0.8rem">
        <thead>
          <tr>
            <th style="width:80px">ID</th>
            <th style="width:80px;text-align:center">Status</th>
            <th>Payload</th>
            <th style="width:200px">Error</th>
            <th style="width:60px;text-align:center">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${data.jobs.map((job: any, idx: number) => {
            (window as any).__queueJobs = (window as any).__queueJobs || [];
            (window as any).__queueJobs[idx] = job;
            return `
            <tr>
              <td style="font-family:var(--mono);font-size:0.65rem">${esc(String(job.id || "").slice(0, 8))}</td>
              <td style="text-align:center">${statusBadge(job.status)}</td>
              <td><code style="font-size:0.7rem;word-break:break-all;max-width:300px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer" onclick="window.__queueExpandPayload(this,${idx})">${esc(JSON.stringify(job.data || {}).slice(0, 80))}</code></td>
              <td style="color:var(--danger);font-size:0.7rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(job.error || "")}">${esc(job.error || "-")}</td>
              <td style="text-align:center">
                ${job.status === "failed" || job.status === "dead_letter" ? `<button class="btn btn-sm" style="font-size:0.65rem;padding:2px 6px" onclick="window.__queueReplay('${esc(String(job.id))}')">Retry</button>` : ""}
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    `;
  } catch (e: any) {
    const listEl = document.getElementById("queue-list");
    if (listEl) listEl.innerHTML = `<div style="color:var(--danger);padding:1rem">${esc(e.message || String(e))}</div>`;
  }
}

async function loadDeadLetters(): Promise<void> {
  try {
    const data = await api<any>(`/queue/dead-letters?topic=${encodeURIComponent(currentTopic)}`);

    const statsEl = document.getElementById("queue-stats");
    if (statsEl) {
      statsEl.innerHTML = `<span class="badge" style="background:var(--danger)">Dead Letters: ${data.count || 0}</span>`;
    }

    const actionsEl = document.getElementById("queue-actions");
    if (actionsEl) {
      actionsEl.innerHTML = data.count > 0
        ? `<button class="btn btn-sm" style="background:var(--warn);color:#000" onclick="window.__queueRetryAll()">Retry All</button>`
        : "";
    }

    const listEl = document.getElementById("queue-list");
    if (!listEl) return;

    if (!data.jobs || data.jobs.length === 0) {
      listEl.innerHTML = `<div class="text-muted text-center" style="padding:2rem">No dead letter jobs in <strong>${esc(currentTopic)}</strong></div>`;
      return;
    }

    listEl.innerHTML = `
      <table class="table" style="font-size:0.8rem">
        <thead>
          <tr>
            <th style="width:80px">ID</th>
            <th>Payload</th>
            <th style="width:200px">Error</th>
            <th style="width:50px;text-align:center">Tries</th>
            <th style="width:60px;text-align:center">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${data.jobs.map((job: any, idx: number) => {
            (window as any).__queueJobs = (window as any).__queueJobs || [];
            (window as any).__queueJobs[1000 + idx] = job;
            return `
            <tr>
              <td style="font-family:var(--mono);font-size:0.65rem">${esc(String(job.id || "").slice(0, 8))}</td>
              <td><code style="font-size:0.7rem;word-break:break-all;max-width:250px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer" onclick="window.__queueExpandPayload(this,${1000 + idx})">${esc(JSON.stringify(job.data || {}).slice(0, 60))}</code></td>
              <td style="color:var(--danger);font-size:0.7rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(job.error || "")}">${esc(job.error || "")}</td>
              <td style="text-align:center">${job.retries || job.attempts || 0}</td>
              <td style="text-align:center">
                <button class="btn btn-sm" style="font-size:0.65rem;padding:2px 6px" onclick="window.__queueReplay('${esc(String(job.id))}')">Replay</button>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    `;
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
    dead_letter: "#8b0000",
  };
  return `<span class="badge" style="background:${colors[status] || "var(--muted)"};font-size:0.65rem">${esc(status)}</span>`;
}

// Payload expand — toggles formatted JSON + copy button below the clicked row
(window as any).__queueExpandPayload = (el: HTMLElement, idx: number) => {
  const row = el.closest("tr");
  if (!row) return;
  const existing = row.nextElementSibling;
  if (existing && existing.classList.contains("queue-payload-row")) {
    existing.remove();
    return;
  }
  const job = (window as any).__queueJobs?.[idx];
  const json = JSON.stringify(job?.data || {}, null, 2);
  const payloadRow = document.createElement("tr");
  payloadRow.className = "queue-payload-row";
  payloadRow.innerHTML = `<td colspan="5" style="padding:0.75rem 1rem;background:rgba(0,0,0,0.3)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
      <span style="font-size:0.7rem;color:var(--muted)">Job ${esc(job?.id || "")} — ${esc(job?.status || "")}</span>
      <button class="btn btn-sm" style="font-size:0.65rem;padding:2px 8px" onclick="navigator.clipboard.writeText(this.closest('td').querySelector('pre').textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1000)})">Copy</button>
    </div>
    <pre style="margin:0;font-size:0.75rem;white-space:pre-wrap;color:var(--text);max-height:300px;overflow:auto;background:rgba(0,0,0,0.2);padding:0.5rem;border-radius:0.25rem">${esc(json)}</pre>
    ${job?.error ? `<div style="margin-top:0.5rem;font-size:0.7rem;color:var(--danger)">Error: ${esc(job.error)}</div>` : ""}
  </td>`;
  row.after(payloadRow);
};

// Global handlers
(window as any).__queueTopic = (topic: string) => {
  currentTopic = topic;
  loadQueue();
};

(window as any).__queueView = (view: "jobs" | "dead-letters") => {
  activeView = view;
  statusFilter = "";
  if (container) renderUI();
};

(window as any).__queueFilter = (status: string) => {
  statusFilter = status;
  loadQueue();
};

(window as any).__queueRefresh = () => loadQueue();

(window as any).__queueAutoRefresh = (enabled: boolean) => {
  autoRefresh = enabled;
  if (refreshTimer) clearInterval(refreshTimer);
  if (autoRefresh) refreshTimer = setInterval(loadQueue, 3000);
};

(window as any).__queueRetryAll = async () => {
  await api("/queue/retry", "POST", { topic: currentTopic });
  loadQueue();
};

(window as any).__queuePurge = async (status: string) => {
  if (!confirm(`Purge all ${status} jobs in ${currentTopic}?`)) return;
  await api("/queue/purge", "POST", { status, topic: currentTopic });
  loadQueue();
};

(window as any).__queueReplay = async (id: string) => {
  await api("/queue/replay", "POST", { id, topic: currentTopic });
  loadQueue();
};
