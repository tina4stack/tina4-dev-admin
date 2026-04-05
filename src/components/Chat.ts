import { api, esc } from "../api.js";

let aiProvider = "anthropic";
let aiKey = "";

export function renderChat(container: HTMLElement): void {
  container.innerHTML = `
    <div class="dev-panel-header">
      <h2>Code With Me</h2>
      <div class="flex gap-sm items-center">
        <select id="ai-provider" class="input" style="width:120px" onchange="window.__setProvider(this.value)">
          <option value="anthropic">Claude</option>
          <option value="openai">OpenAI</option>
          <option value="ollama">Ollama</option>
        </select>
        <input type="password" id="ai-key" class="input" placeholder="API key..." style="width:200px">
        <button class="btn btn-sm btn-primary" onclick="window.__setAiKey()">Set</button>
        <span class="text-sm text-muted" id="ai-status">${aiKey ? "Key set" : "No key"}</span>
      </div>
    </div>
    <div class="chat-container">
      <div class="chat-messages" id="chat-messages">
        <div class="chat-msg chat-bot">Hi! I'm Tina4. Ask me to build routes, templates, models — or ask questions about your project. I can read and write files directly.</div>
      </div>
      <div class="chat-input-row">
        <input type="text" id="chat-input" class="input" placeholder="Ask Tina4 to build something..." onkeydown="if(event.key==='Enter')window.__sendChat()" style="flex:1">
        <button class="btn btn-primary" onclick="window.__sendChat()">Send</button>
        <button class="btn btn-sm" onclick="window.__undoChat()" title="Undo last file change">Undo</button>
      </div>
    </div>
  `;
}

async function sendChat(): Promise<void> {
  const input = document.getElementById("chat-input") as HTMLInputElement;
  const msg = input?.value?.trim();
  if (!msg) return;
  input.value = "";

  const container = document.getElementById("chat-messages");
  if (!container) return;

  container.innerHTML += `<div class="chat-msg chat-user">${esc(msg)}</div>`;
  container.innerHTML += `<div class="chat-msg chat-bot" id="chat-loading" style="color:var(--muted)">Thinking...</div>`;
  container.scrollTop = container.scrollHeight;

  const body: any = { message: msg, provider: aiProvider };
  if (aiKey) body.api_key = aiKey;

  try {
    const d = await api<any>("/chat", "POST", body);
    const loading = document.getElementById("chat-loading");
    if (loading) loading.remove();

    let reply = formatChat(d.reply || "No response");

    // Show file changes if any
    if (d.files_changed && d.files_changed.length > 0) {
      reply += `<div style="margin-top:0.5rem;padding:0.5rem;background:var(--bg);border-radius:0.375rem;border:1px solid var(--border)">`;
      reply += `<div class="text-sm" style="color:var(--success);font-weight:600;margin-bottom:0.25rem">Files changed:</div>`;
      d.files_changed.forEach((f: string) => {
        reply += `<div class="text-sm text-mono">${esc(f)}</div>`;
      });
      reply += `</div>`;
    }

    container.innerHTML += `<div class="chat-msg chat-bot">${reply}</div>`;
    container.innerHTML += `<div class="text-sm text-muted" style="text-align:right;margin-bottom:0.25rem">${esc(d.source || "")}</div>`;
    container.scrollTop = container.scrollHeight;
  } catch {
    const loading = document.getElementById("chat-loading");
    if (loading) { loading.textContent = "Error connecting"; loading.id = ""; }
  }
}

async function undoChat(): Promise<void> {
  try {
    const d = await api<any>("/chat/undo", "POST");
    const container = document.getElementById("chat-messages");
    if (container) {
      container.innerHTML += `<div class="chat-msg chat-bot" style="color:var(--warn)">${esc(d.message || "Undo complete")}</div>`;
      container.scrollTop = container.scrollHeight;
    }
  } catch {
    alert("Nothing to undo");
  }
}

function setAiKey(): void {
  const input = document.getElementById("ai-key") as HTMLInputElement;
  aiKey = input?.value || "";
  const status = document.getElementById("ai-status");
  if (status) status.textContent = aiKey ? "Key set" : "No key";
}

function setProvider(val: string): void {
  aiProvider = val;
}

function formatChat(text: string): string {
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:var(--bg);padding:0.5rem;border-radius:0.375rem;overflow-x:auto;margin:0.5rem 0;font-size:0.8rem"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg);padding:0.1rem 0.25rem;border-radius:0.2rem;font-size:0.8em">$1</code>')
    .replace(/\n/g, "<br>");
}

(window as any).__sendChat = sendChat;
(window as any).__undoChat = undoChat;
(window as any).__setAiKey = setAiKey;
(window as any).__setProvider = setProvider;
