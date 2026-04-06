import { api, esc } from "../api.js";

interface Thought {
  id: string;
  timestamp: string;
  message: string;
  category: string;
  actions: { label: string; action: string }[];
  dismissed: boolean;
}

let thoughts: Thought[] = [];
let pollInterval: ReturnType<typeof setInterval> | null = null;

export function renderThoughts(container: HTMLElement): void {
  container.innerHTML = `
    <div class="dev-panel-header">
      <h2>Thoughts</h2>
    </div>
    <div id="thoughts-list" style="padding:0.25rem 0"></div>
  `;

  loadThoughts();

  // Poll for new thoughts every 30 seconds
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(loadThoughts, 30000);
}

async function loadThoughts(): Promise<void> {
  try {
    const data = await api<Thought[]>("/thoughts");
    if (Array.isArray(data)) {
      thoughts = data.filter(t => !t.dismissed);
      renderThoughtList();
    }
  } catch {
    // Agent server might not be running
  }
}

function renderThoughtList(): void {
  const list = document.getElementById("thoughts-list");
  if (!list) return;

  if (!thoughts.length) {
    list.innerHTML = `
      <div style="text-align:center;padding:3rem 1rem;color:var(--muted)">
        <div style="font-size:1.5rem;margin-bottom:0.5rem">All clear</div>
        <div class="text-sm">The supervisor has no observations right now.</div>
        <div class="text-sm" style="margin-top:0.5rem">Silence means your project is healthy.</div>
      </div>
    `;
    return;
  }

  list.innerHTML = thoughts.map(t => {
    const timeStr = t.timestamp ? new Date(parseInt(t.timestamp) * 1000).toLocaleString() : "";
    const categoryIcon = t.category === "uncommitted" ? "&#128190;" :
      t.category === "untested" ? "&#129514;" :
      t.category === "security" ? "&#128274;" : "&#128161;";

    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:0.75rem;margin-bottom:0.5rem">
        <div style="display:flex;gap:0.5rem;align-items:flex-start">
          <span style="font-size:1.1rem">${categoryIcon}</span>
          <div style="flex:1">
            <div style="font-size:0.8rem;line-height:1.4">${esc(t.message)}</div>
            <div class="text-sm text-muted" style="margin-top:0.25rem">${esc(timeStr)}</div>
            <div style="display:flex;gap:4px;margin-top:0.5rem">
              ${t.actions.map(a =>
                a.action === "dismiss"
                  ? `<button class="btn btn-sm" onclick="window.__dismissThought('${esc(t.id)}')">${esc(a.label)}</button>`
                  : `<button class="btn btn-sm btn-primary" onclick="window.__actOnThought('${esc(t.id)}','${esc(a.action)}')">${esc(a.label)}</button>`
              ).join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

async function dismissThought(id: string): Promise<void> {
  try {
    await api("/thoughts/dismiss", "POST", { id });
    thoughts = thoughts.filter(t => t.id !== id);
    renderThoughtList();
  } catch {}
}

function actOnThought(id: string, action: string): void {
  const thought = thoughts.find(t => t.id === id);
  if (!thought) return;

  // Switch to Code With Me tab and send the thought as a message
  (window as any).__switchTab("chat");
  setTimeout(() => {
    const prompt = `${thought.message} — please ${action.replace(/_/g, " ")}`;
    (window as any).__prefillChat(prompt);
  }, 150);

  // Dismiss the thought
  dismissThought(id);
}

// Update badge on the tab
export function getUnreadCount(): number {
  return thoughts.filter(t => !t.dismissed).length;
}

(window as any).__dismissThought = dismissThought;
(window as any).__actOnThought = actOnThought;
