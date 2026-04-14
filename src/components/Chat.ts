import { api, esc } from "../api.js";

// --- Agent port: framework port + 2000 ---
function getAgentPort(): number {
  const pagePort = parseInt(window.location.port, 10) || 80;
  return pagePort + 2000;
}

// --- Settings (persisted to localStorage) ---
interface ModelConfig {
  provider: string;
  model: string;
  url: string;
  apiKey: string;
}

interface ChatSettings {
  thinking: ModelConfig;
  vision: ModelConfig;
  imageGen: ModelConfig;
}

const DEFAULTS: Record<string, { model: string; url: string }> = {
  tina4:     { model: "", url: "http://41.71.84.173:11437" },
  custom:    { model: "", url: "http://localhost:11434" },
  anthropic: { model: "claude-sonnet-4-20250514", url: "https://api.anthropic.com" },
  openai:    { model: "gpt-4o", url: "https://api.openai.com" },
};

// Tina4 Cloud uses different servers per model type — models fetched at connect time
const TINA4_CLOUD: Record<string, { model: string; url: string }> = {
  thinking: { model: "", url: "http://41.71.84.173:11437" },
  vision:   { model: "", url: "http://41.71.84.173:11434" },
  imageGen: { model: "", url: "http://41.71.84.173:11436" },
};

function defaultConfig(provider = "tina4", modelType = "thinking"): ModelConfig {
  if (provider === "tina4" && TINA4_CLOUD[modelType]) {
    const d = TINA4_CLOUD[modelType];
    return { provider, model: d.model, url: d.url, apiKey: "" };
  }
  const d = DEFAULTS[provider] || DEFAULTS.tina4;
  return { provider, model: d.model, url: d.url, apiKey: "" };
}

function migrateConfig(cfg: any, modelType = "thinking"): ModelConfig {
  const merged = { ...defaultConfig("tina4", modelType), ...(cfg || {}) };
  // Migrate old provider names
  if (merged.provider === "ollama") merged.provider = "custom";
  // Clear fake model names that don't exist on any server
  if (merged.model === "tina4-v1") merged.model = "";
  // Update Tina4 Cloud URLs if they're stale
  if (merged.provider === "tina4" && TINA4_CLOUD[modelType]) {
    merged.url = TINA4_CLOUD[modelType].url;
  }
  return merged;
}

function loadSettings(): ChatSettings {
  try {
    const s = JSON.parse(localStorage.getItem("tina4_chat_settings") || "{}");
    return {
      thinking: migrateConfig(s.thinking, "thinking"),
      vision: migrateConfig(s.vision, "vision"),
      imageGen: migrateConfig(s.imageGen, "imageGen"),
    };
  } catch { return { thinking: defaultConfig("tina4", "thinking"), vision: defaultConfig("tina4", "vision"), imageGen: defaultConfig("tina4", "imageGen") }; }
}

function saveSettings(s: ChatSettings): void {
  localStorage.setItem("tina4_chat_settings", JSON.stringify(s));
  settings = s;
  updateSummary();
}

let settings = loadSettings();
let chatStatus = "Idle";
const filesChanged: string[] = [];

// --- Chat history persistence ---
interface SavedMsg {
  role: string;
  content: string;
  agent?: string;
  timestamp?: string;
}

function saveChatHistory(): void {
  const container = document.getElementById("chat-messages");
  if (!container) return;
  const msgs: SavedMsg[] = [];
  container.querySelectorAll(".chat-msg").forEach(el => {
    const role = el.classList.contains("chat-user") ? "user" : "assistant";
    const content = el.querySelector(".chat-msg-content")?.innerHTML || "";
    // Skip welcome message
    if (content.includes("Hi! I'm Tina4.")) return;
    msgs.push({ role, content });
  });
  try { localStorage.setItem("tina4_chat_history", JSON.stringify(msgs)); } catch {}
}

function loadChatHistory(): void {
  try {
    const raw = localStorage.getItem("tina4_chat_history");
    if (!raw) return;
    const msgs: SavedMsg[] = JSON.parse(raw);
    if (!msgs.length) return;
    // Restore messages in reverse order (they are stored newest-first from prepend)
    // Skip empty or whitespace-only messages
    msgs.reverse().forEach(m => {
      const content = (m.content || "").trim();
      if (!content) return;
      addMessage(content, m.role === "user" ? "user" : "bot");
    });
  } catch {}
}

function clearChatHistory(): void {
  localStorage.removeItem("tina4_chat_history");
  const container = document.getElementById("chat-messages");
  if (container) {
    container.innerHTML = `<div class="chat-msg chat-bot">Hi! I'm Tina4. Ask me to build routes, templates, models — or ask questions about your project.</div>`;
  }
  msgCounter = 0;
}

// --- Render ---
export function renderChat(container: HTMLElement): void {
  container.innerHTML = `
    <div class="dev-panel-header">
      <h2>Code With Me</h2>
      <div class="flex gap-sm">
        <button class="btn btn-sm" onclick="window.__clearChat()" title="Clear chat history">Clear</button>
        <button class="btn btn-sm" id="chat-thoughts-btn" title="Supervisor thoughts">Thoughts <span id="thoughts-dot" style="display:none;color:var(--info)">&#9679;</span></button>
        <button class="btn btn-sm" id="chat-settings-btn" title="Settings">&#9881; Settings</button>
      </div>
    </div>
    <div style="display:flex;gap:0.5rem;flex:1;min-height:0;overflow:hidden">
      <div style="flex:1;display:flex;flex-direction:column;min-height:0">
        <div style="display:flex;gap:0.5rem;align-items:flex-start;padding:0.5rem 0;flex-shrink:0">
          <textarea id="chat-input" class="input" placeholder="Ask Tina4 to build something..." rows="2" style="flex:1;resize:vertical;min-height:36px;max-height:200px;font-family:inherit;font-size:inherit"></textarea>
          <div style="display:flex;flex-direction:column;gap:4px">
            <button class="btn btn-primary" id="chat-send-btn" style="white-space:nowrap">Send</button>
            <div style="display:flex;gap:4px">
              <input type="file" id="chat-file-input" multiple style="display:none" />
              <button class="btn btn-sm" id="chat-file-btn" style="font-size:0.65rem;padding:2px 6px">File</button>
              <button class="btn btn-sm" id="chat-mic-btn" style="font-size:0.65rem;padding:2px 6px">Mic</button>
            </div>
          </div>
        </div>
        <div id="chat-attachments" style="display:none;margin-bottom:0.375rem;font-size:0.75rem"></div>
        <div id="chat-status-bar" style="display:none;padding:6px 12px;background:var(--surface);border:1px solid var(--info);border-radius:0.375rem;margin-bottom:0.5rem;font-size:0.75rem;color:var(--info);align-items:center;gap:8px;flex-shrink:0">
          <span style="display:inline-block;width:12px;height:12px;border:2px solid var(--info);border-top-color:transparent;border-radius:50%;animation:t4spin 0.8s linear infinite"></span>
          <span id="chat-status-text">Thinking...</span>
        </div>
        <style>@keyframes t4spin{to{transform:rotate(360deg)}}</style>
        <div id="chat-messages" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:0.5rem;padding:0.25rem 0">
          <div class="chat-msg chat-bot">Hi! I'm Tina4. Ask me to build routes, templates, models — or ask questions about your project.</div>
        </div>
      </div>
      <div id="chat-summary" style="width:200px;flex-shrink:0;background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:0.75rem;font-size:0.75rem;overflow-y:auto"></div>
    </div>

    <!-- Thoughts Panel (slides in from right) -->
    <div id="chat-thoughts-panel" style="display:none;position:absolute;top:0;right:0;bottom:0;width:300px;background:var(--surface);border-left:1px solid var(--border);z-index:50;overflow-y:auto;padding:0.75rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
        <h3 style="font-size:0.85rem;margin:0">Thoughts</h3>
        <button class="btn btn-sm" id="chat-thoughts-close" style="width:24px;height:24px;padding:0;font-size:14px;line-height:1">&times;</button>
      </div>
      <div id="thoughts-list"></div>
    </div>

    <!-- Settings Modal -->
    <div id="chat-modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100;align-items:center;justify-content:center">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.25rem;width:750px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.3)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <h3 style="font-size:0.95rem;margin:0">AI Settings</h3>
          <button class="btn btn-sm" id="chat-modal-close" style="width:28px;height:28px;padding:0;font-size:16px;line-height:1">&times;</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;margin-bottom:0.75rem">
          ${["thinking", "vision", "imageGen"].map(key => {
            const label = key === "imageGen" ? "Image Generation" : key.charAt(0).toUpperCase() + key.slice(1);
            return `
          <fieldset style="border:1px solid var(--border);border-radius:0.375rem;padding:0.5rem 0.75rem;margin:0">
            <legend class="text-sm" style="font-weight:600;padding:0 4px">${label}</legend>
            <div style="margin-bottom:0.375rem"><label class="text-sm text-muted" style="display:block;margin-bottom:2px">Provider</label><select id="set-${key}-provider" class="input" style="width:100%"><option value="tina4">Tina4 Cloud</option><option value="custom">Custom / Local</option><option value="anthropic">Anthropic (Claude)</option><option value="openai">OpenAI</option></select></div>
            <div id="set-${key}-url-row" style="margin-bottom:0.375rem"><label class="text-sm text-muted" style="display:block;margin-bottom:2px">URL</label><input type="text" id="set-${key}-url" class="input" style="width:100%" /></div>
            <div id="set-${key}-key-row" style="margin-bottom:0.375rem"><label class="text-sm text-muted" style="display:block;margin-bottom:2px">API Key</label><input type="password" id="set-${key}-key" class="input" placeholder="sk-..." style="width:100%" /></div>
            <button class="btn btn-sm btn-primary" id="set-${key}-connect" style="width:100%;margin-bottom:0.375rem">Connect</button>
            <div id="set-${key}-result" class="text-sm" style="min-height:1.2em;margin-bottom:0.375rem"></div>
            <div style="margin-bottom:0.375rem"><label class="text-sm text-muted" style="display:block;margin-bottom:2px">Model</label><select id="set-${key}-model" class="input" style="width:100%" disabled><option value="">-- connect first --</option></select></div>
          </fieldset>`;
          }).join("")}
        </div>
        <button class="btn btn-primary" id="chat-modal-save" style="width:100%">Save Settings</button>
      </div>
    </div>
  `;

  // Wire events
  document.getElementById("chat-send-btn")?.addEventListener("click", sendChat);
  document.getElementById("chat-thoughts-btn")?.addEventListener("click", toggleThoughts);
  document.getElementById("chat-thoughts-close")?.addEventListener("click", toggleThoughts);
  document.getElementById("chat-settings-btn")?.addEventListener("click", openModal);
  document.getElementById("chat-modal-close")?.addEventListener("click", closeModal);
  document.getElementById("chat-modal-save")?.addEventListener("click", saveModal);
  document.getElementById("chat-modal-overlay")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById("chat-file-btn")?.addEventListener("click", () => {
    document.getElementById("chat-file-input")?.click();
  });
  document.getElementById("chat-file-input")?.addEventListener("change", handleFileSelect);
  document.getElementById("chat-mic-btn")?.addEventListener("click", toggleMic);

  const input = document.getElementById("chat-input") as HTMLTextAreaElement;
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });

  updateSummary();

  // Restore chat history from localStorage
  loadChatHistory();

  // Also try loading from agent server (more reliable, survives cross-tab)
  loadServerHistory();
}

// Server history loading removed — localStorage is sufficient and works offline

// --- Modal ---
function fillSection(key: string, cfg: ModelConfig): void {
  (document.getElementById(`set-${key}-provider`) as HTMLSelectElement).value = cfg.provider;
  const modelSel = document.getElementById(`set-${key}-model`) as HTMLSelectElement;
  if (cfg.model) {
    modelSel.innerHTML = `<option value="${cfg.model}">${cfg.model}</option>`;
    modelSel.value = cfg.model;
    modelSel.disabled = false;
  }
  (document.getElementById(`set-${key}-url`) as HTMLInputElement).value = cfg.url;
  (document.getElementById(`set-${key}-key`) as HTMLInputElement).value = cfg.apiKey;
  toggleFieldVisibility(key, cfg.provider);
}

function readSection(key: string): ModelConfig {
  return {
    provider: (document.getElementById(`set-${key}-provider`) as HTMLSelectElement)?.value || "custom",
    model: (document.getElementById(`set-${key}-model`) as HTMLSelectElement)?.value || "",
    url: (document.getElementById(`set-${key}-url`) as HTMLInputElement)?.value || "",
    apiKey: (document.getElementById(`set-${key}-key`) as HTMLInputElement)?.value || "",
  };
}

function toggleFieldVisibility(key: string, provider: string): void {
  const keyRow = document.getElementById(`set-${key}-key-row`);
  const urlRow = document.getElementById(`set-${key}-url-row`);
  if (provider === "tina4") {
    // Tina4 Cloud — hide URL and API key, they're pre-configured
    if (keyRow) keyRow.style.display = "none";
    if (urlRow) urlRow.style.display = "none";
  } else {
    if (keyRow) keyRow.style.display = "block";
    if (urlRow) urlRow.style.display = "block";
  }
}

function wireProviderChange(key: string): void {
  const sel = document.getElementById(`set-${key}-provider`) as HTMLSelectElement;
  sel?.addEventListener("change", () => {
    // For Tina4 Cloud, use per-model-type URLs
    let d: { model: string; url: string };
    if (sel.value === "tina4" && TINA4_CLOUD[key]) {
      d = TINA4_CLOUD[key];
    } else {
      d = DEFAULTS[sel.value] || DEFAULTS.tina4;
    }
    const modelSel = document.getElementById(`set-${key}-model`) as HTMLSelectElement;
    modelSel.innerHTML = d.model ? `<option value="${d.model}">${d.model}</option>` : `<option value="">-- connect first --</option>`;
    modelSel.value = d.model;
    (document.getElementById(`set-${key}-url`) as HTMLInputElement).value = d.url;
    toggleFieldVisibility(key, sel.value);
  });
  // Initial visibility
  toggleFieldVisibility(key, sel?.value || "custom");
}

async function connectProvider(key: string): Promise<void> {
  const provider = (document.getElementById(`set-${key}-provider`) as HTMLSelectElement)?.value || "custom";
  let url = (document.getElementById(`set-${key}-url`) as HTMLInputElement)?.value || "";
  const apiKey = (document.getElementById(`set-${key}-key`) as HTMLInputElement)?.value || "";
  const modelSel = document.getElementById(`set-${key}-model`) as HTMLSelectElement;
  const resultEl = document.getElementById(`set-${key}-result`);

  // For Tina4 Cloud, use the pre-configured URL (hidden from user)
  if (provider === "tina4" && TINA4_CLOUD[key]) {
    url = TINA4_CLOUD[key].url;
  }

  if (resultEl) { resultEl.textContent = "Connecting..."; resultEl.style.color = "var(--muted)"; }

  try {
    let models: string[] = [];

    // Strip any path suffixes to get base URL
    const baseUrl = url.replace(/\/(v1|api)\/.*$/, "").replace(/\/+$/, "");

    if (provider === "tina4") {
      // Tina4 Cloud runs Ollama — fetch models via /api/tags then /v1/models
      try {
        const res = await fetch(`${baseUrl}/api/tags`);
        const data = await res.json();
        models = (data.models || []).map((m: any) => m.name || m.model);
      } catch {}
      if (!models.length) {
        try {
          const res = await fetch(`${baseUrl}/v1/models`);
          const data = await res.json();
          models = (data.data || []).map((m: any) => m.id);
        } catch {}
      }
    } else if (provider === "custom") {
      try {
        const res = await fetch(`${baseUrl}/api/tags`);
        const data = await res.json();
        models = (data.models || []).map((m: any) => m.name || m.model);
      } catch {}
      if (!models.length) {
        try {
          const res = await fetch(`${baseUrl}/v1/models`);
          const data = await res.json();
          models = (data.data || []).map((m: any) => m.id);
        } catch {}
      }
    } else if (provider === "anthropic") {
      // Anthropic doesn't have a model list API — use known models
      models = ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-4-20250514", "claude-3-5-sonnet-20241022"];
    } else if (provider === "openai") {
      // OpenAI: GET /v1/models
      const baseUrl = url.replace(/\/v1\/.*$/, "");
      const res = await fetch(`${baseUrl}/v1/models`, {
        headers: apiKey ? { "Authorization": `Bearer ${apiKey}` } : {},
      });
      const data = await res.json();
      models = (data.data || []).map((m: any) => m.id).filter((id: string) => id.startsWith("gpt"));
    }

    if (models.length === 0) {
      if (resultEl) { resultEl.innerHTML = `<span style="color:var(--warn)">No models found</span>`; }
      return;
    }

    const currentVal = modelSel.value;
    modelSel.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join("");
    if (models.includes(currentVal)) modelSel.value = currentVal;
    modelSel.disabled = false;
    if (resultEl) { resultEl.innerHTML = `<span style="color:var(--success)">&#10003; ${models.length} models available</span>`; }
  } catch (err) {
    if (resultEl) { resultEl.innerHTML = `<span style="color:var(--danger)">&#10007; Connection failed</span>`; }
  }
}

function openModal(): void {
  const overlay = document.getElementById("chat-modal-overlay");
  if (!overlay) return;
  overlay.style.display = "flex";
  fillSection("thinking", settings.thinking);
  fillSection("vision", settings.vision);
  fillSection("imageGen", settings.imageGen);
  wireProviderChange("thinking");
  wireProviderChange("vision");
  wireProviderChange("imageGen");
  document.getElementById("set-thinking-connect")?.addEventListener("click", () => connectProvider("thinking"));
  document.getElementById("set-vision-connect")?.addEventListener("click", () => connectProvider("vision"));
  document.getElementById("set-imageGen-connect")?.addEventListener("click", () => connectProvider("imageGen"));
}

function closeModal(): void {
  const overlay = document.getElementById("chat-modal-overlay");
  if (overlay) overlay.style.display = "none";
}

function saveModal(): void {
  saveSettings({
    thinking: readSection("thinking"),
    vision: readSection("vision"),
    imageGen: readSection("imageGen"),
  });
  closeModal();
}

// --- Summary panel ---
function updateSummary(): void {
  const el = document.getElementById("chat-summary");
  if (!el) return;

  // Status log feed
  const statusHtml = statusLog.length ? statusLog.map(s =>
    `<div style="margin-bottom:4px;font-size:0.65rem;line-height:1.3">
      <span style="color:var(--muted)">${esc(s.time)}</span>
      <span style="color:var(--info);font-size:0.6rem">${esc(s.agent)}</span>
      <div>${esc(s.text)}</div>
    </div>`
  ).join("") : '<div class="text-muted" style="font-size:0.65rem">No activity yet</div>';

  const statusColor = chatStatus === "Idle" ? "var(--muted)" : chatStatus === "Thinking..." ? "var(--info)" : "var(--success)";
  const dot = (cfg: ModelConfig) => cfg.model ? `<span style="color:var(--success)">&#9679;</span>` : `<span style="color:var(--muted)">&#9675;</span>`;

  el.innerHTML = `
    <div style="margin-bottom:0.5rem;font-size:0.7rem">
      <span style="color:${statusColor}">&#9679;</span> ${esc(chatStatus)}
    </div>
    <div style="font-size:0.65rem;line-height:1.8">
      ${dot(settings.thinking)} T: ${esc(settings.thinking.model || "—")}<br>
      ${dot(settings.vision)} V: ${esc(settings.vision.model || "—")}<br>
      ${dot(settings.imageGen)} I: ${esc(settings.imageGen.model || "—")}
    </div>
    ${filesChanged.length ? `
      <div style="margin-bottom:0.75rem">
        <div class="text-muted" style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Files Changed</div>
        ${filesChanged.map(f => `<div class="text-mono" style="font-size:0.65rem;color:var(--success);margin-bottom:2px">${esc(f)}</div>`).join("")}
      </div>
    ` : ""}
    <div>
      <div class="text-muted" style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Activity</div>
      ${statusHtml}
    </div>
  `;
}

// --- Chat ---
let msgCounter = 0;

function addMessage(html: string, role: "user" | "bot"): void {
  const container = document.getElementById("chat-messages");
  if (!container) return;
  const id = `msg-${++msgCounter}`;
  const div = document.createElement("div");
  div.className = `chat-msg chat-${role}`;
  div.id = id;
  div.innerHTML = `
    <div class="chat-msg-content">${html}</div>
    <div class="chat-msg-actions" style="display:flex;gap:4px;margin-top:4px;opacity:0.4">
      <button class="btn btn-sm" style="font-size:0.6rem;padding:1px 6px" onclick="window.__copyMsg('${id}')" title="Copy">Copy</button>
      <button class="btn btn-sm" style="font-size:0.6rem;padding:1px 6px" onclick="window.__replyMsg('${id}')" title="Reply">Reply</button>
      <button class="btn btn-sm btn-primary" style="font-size:0.6rem;padding:1px 6px;display:none" onclick="window.__submitAnswers('${id}')" title="Submit answers" data-submit-btn>Submit Answers</button>
    </div>
  `;
  // Show actions on hover
  div.addEventListener("mouseenter", () => { const a = div.querySelector(".chat-msg-actions") as HTMLElement; if (a) a.style.opacity = "1"; });
  div.addEventListener("mouseleave", () => { const a = div.querySelector(".chat-msg-actions") as HTMLElement; if (a) a.style.opacity = "0.4"; });
  // Show submit button if message has question inputs
  if (div.querySelector(".chat-answer-input")) {
    const submitBtn = div.querySelector("[data-submit-btn]") as HTMLElement;
    if (submitBtn) submitBtn.style.display = "inline-block";
  }

  // Add quick-reply buttons when bot asks a question (ends with ?)
  if (role === "bot") {
    const text = div.querySelector(".chat-msg-content")?.textContent || "";
    const endsWithQuestion = text.trim().endsWith("?");
    const hasInputs = div.querySelector(".chat-answer-input");
    if (endsWithQuestion && !hasInputs) {
      const quickBtns = document.createElement("div");
      quickBtns.style.cssText = "display:flex;gap:4px;margin-top:6px;flex-wrap:wrap";
      quickBtns.className = "chat-quick-replies";
      quickBtns.innerHTML = `
        <button class="btn btn-sm" style="font-size:0.65rem;padding:2px 8px" onclick="window.__quickReply('Yes')">Yes</button>
        <button class="btn btn-sm" style="font-size:0.65rem;padding:2px 8px" onclick="window.__quickReply('No')">No</button>
        <button class="btn btn-sm" style="font-size:0.65rem;padding:2px 8px" onclick="window.__quickReply('You decide')">You decide</button>
        <button class="btn btn-sm" style="font-size:0.65rem;padding:2px 8px" onclick="window.__quickReply('Skip')">Skip</button>
        <button class="btn btn-sm" style="font-size:0.65rem;padding:2px 8px" onclick="window.__quickReply('Just build it')">Just build it</button>
      `;
      div.querySelector(".chat-msg-content")?.appendChild(quickBtns);
    }
  }

  // Prepend — latest message always at the top
  container.prepend(div);

  // Auto-save chat history to localStorage
  saveChatHistory();
}

function submitAnswers(msgId: string): void {
  const msg = document.getElementById(msgId);
  if (!msg) return;
  const inputs = msg.querySelectorAll(".chat-answer-input") as NodeListOf<HTMLInputElement>;
  const answers: string[] = [];
  inputs.forEach(input => {
    const q = input.dataset.q || "?";
    const val = input.value.trim();
    if (val) {
      answers.push(`${q}. ${val}`);
      input.disabled = true;
      input.style.opacity = "0.6";
    }
  });
  if (!answers.length) return;

  // Send as next message
  const input = document.getElementById("chat-input") as HTMLTextAreaElement;
  if (input) {
    input.value = answers.join("\n");
    sendChat();
  }

  // Hide submit button
  const btn = msg.querySelector("[data-submit-btn]") as HTMLElement;
  if (btn) btn.style.display = "none";
}

function quickAnswer(btn: HTMLElement, answer: string): void {
  const row = btn.parentElement;
  if (!row) return;
  const input = row.querySelector(".chat-answer-input") as HTMLInputElement;
  if (input) {
    input.value = answer;
    input.disabled = true;
    input.style.opacity = "0.5";
  }
  // Remove all quick buttons
  row.querySelectorAll("button").forEach(b => b.remove());
  // Show what was picked
  const badge = document.createElement("span");
  badge.style.cssText = "font-size:0.65rem;padding:2px 8px;border-radius:3px;background:var(--info);color:white";
  badge.textContent = answer;
  row.appendChild(badge);
}

(window as any).__quickAnswer = quickAnswer;
(window as any).__submitAnswers = submitAnswers;

function copyMsg(id: string): void {
  const el = document.querySelector(`#${id} .chat-msg-content`);
  if (el) {
    navigator.clipboard.writeText(el.textContent || "").then(() => {
      const btn = document.querySelector(`#${id} .chat-msg-actions button`) as HTMLElement;
      if (btn) { const orig = btn.textContent; btn.textContent = "Copied!"; setTimeout(() => { btn.textContent = orig; }, 1000); }
    });
  }
}

function replyMsg(id: string): void {
  const el = document.querySelector(`#${id} .chat-msg-content`);
  if (!el) return;
  const text = (el.textContent || "").substring(0, 100);
  const input = document.getElementById("chat-input") as HTMLTextAreaElement;
  if (input) {
    input.value = `> ${text}${text.length >= 100 ? "..." : ""}\n\n`;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

function commentOnItem(btn: HTMLElement): void {
  const parent = btn.closest(".chat-checklist-item") as HTMLElement;
  if (!parent) return;

  // Don't add duplicate comment box
  if (parent.nextElementSibling?.classList.contains("chat-comment-box")) return;

  const box = document.createElement("div");
  box.className = "chat-comment-box";
  box.style.cssText = "padding-left:1.8rem;margin:0.15rem 0;display:flex;gap:4px";
  box.innerHTML = `
    <input type="text" class="input" placeholder="Your comment..." style="flex:1;font-size:0.7rem;padding:2px 6px;height:24px">
    <button class="btn btn-sm" style="font-size:0.6rem;padding:1px 6px;height:24px" onclick="window.__submitComment(this)">Add</button>
  `;
  parent.after(box);
  (box.querySelector("input") as HTMLInputElement)?.focus();
}

function submitComment(btn: HTMLElement): void {
  const box = btn.closest(".chat-comment-box") as HTMLElement;
  if (!box) return;
  const input = box.querySelector("input") as HTMLInputElement;
  const comment = input?.value?.trim();
  if (!comment) return;

  // Add the comment as a note below the item
  const note = document.createElement("div");
  note.style.cssText = "padding-left:1.8rem;margin:0.1rem 0;font-size:0.7rem;color:var(--info);font-style:italic";
  note.textContent = `↳ ${comment}`;
  box.replaceWith(note);
}

function getChecklist(): { accepted: string[]; rejected: string[]; comments: string[] } {
  const accepted: string[] = [];
  const rejected: string[] = [];
  const comments: string[] = [];

  document.querySelectorAll(".chat-checklist-item").forEach(item => {
    const checkbox = item.querySelector("input[type=checkbox]") as HTMLInputElement;
    const label = item.querySelector("label")?.textContent || "";
    if (checkbox?.checked) {
      accepted.push(label);
    } else {
      rejected.push(label);
    }
    // Check for comment below
    const next = item.nextElementSibling;
    if (next && !next.classList.contains("chat-checklist-item") && !next.classList.contains("chat-comment-box")) {
      const commentText = next.textContent?.replace("↳ ", "") || "";
      if (commentText) comments.push(`${label}: ${commentText}`);
    }
  });

  return { accepted, rejected, comments };
}

// --- Thoughts panel ---
let thoughtsVisible = false;

function toggleThoughts(): void {
  const panel = document.getElementById("chat-thoughts-panel");
  if (!panel) return;
  thoughtsVisible = !thoughtsVisible;
  panel.style.display = thoughtsVisible ? "block" : "none";
  if (thoughtsVisible) loadThoughts();
}

async function loadThoughts(): Promise<void> {
  const list = document.getElementById("thoughts-list");
  if (!list) return;
  try {
    const res = await fetch("/__dev/api/thoughts");
    const data = await res.json();
    const active = (data || []).filter((t: any) => !t.dismissed);
    const dot = document.getElementById("thoughts-dot");
    if (dot) dot.style.display = active.length ? "inline" : "none";

    if (!active.length) {
      list.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:2rem 0">All clear. No observations.</div>';
      return;
    }
    list.innerHTML = active.map((t: any) => `
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;padding:0.5rem;margin-bottom:0.5rem;font-size:0.75rem">
        <div style="line-height:1.4">${esc(t.message)}</div>
        <div style="display:flex;gap:4px;margin-top:0.375rem">
          ${(t.actions || []).map((a: any) =>
            a.action === "dismiss"
              ? `<button class="btn btn-sm" style="font-size:0.6rem" onclick="window.__dismissThought('${esc(t.id)}')">Dismiss</button>`
              : `<button class="btn btn-sm btn-primary" style="font-size:0.6rem" onclick="window.__actOnThought('${esc(t.id)}','${esc(a.action)}')">${esc(a.label)}</button>`
          ).join("")}
        </div>
      </div>
    `).join("");
  } catch {
    list.innerHTML = '<div class="text-muted text-sm" style="text-align:center;padding:1rem">Agent not connected</div>';
  }
}

async function dismissThought(id: string): Promise<void> {
  await fetch("/__dev/api/thoughts/dismiss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
  loadThoughts();
}

function actOnThought(id: string, _action: string): void {
  dismissThought(id);
  toggleThoughts();
}

// Poll for new thoughts every 60 seconds
setInterval(async () => {
  try {
    const res = await fetch("/__dev/api/thoughts");
    const data = await res.json();
    const active = (data || []).filter((t: any) => !t.dismissed);
    const dot = document.getElementById("thoughts-dot");
    if (dot) dot.style.display = active.length ? "inline" : "none";
  } catch {}
}, 60000);

(window as any).__dismissThought = dismissThought;
(window as any).__actOnThought = actOnThought;

(window as any).__commentOnItem = commentOnItem;
(window as any).__submitComment = submitComment;
(window as any).__getChecklist = getChecklist;

function quickReply(answer: string): void {
  // Remove all quick-reply buttons from all messages
  document.querySelectorAll(".chat-quick-replies").forEach(el => el.remove());
  // Send as message
  const input = document.getElementById("chat-input") as HTMLTextAreaElement;
  if (input) {
    input.value = answer;
    sendChat();
  }
}

(window as any).__quickReply = quickReply;
(window as any).__copyMsg = copyMsg;
(window as any).__replyMsg = replyMsg;
(window as any).__clearChat = clearChatHistory;

// Status log entries for the right panel
const statusLog: { time: string; text: string; agent: string }[] = [];

function showStatusBar(text: string): void {
  const bar = document.getElementById("chat-status-bar");
  const txt = document.getElementById("chat-status-text");
  if (bar) { bar.style.display = "flex"; }
  if (txt) { txt.textContent = text; }
}

function hideStatusBar(): void {
  const bar = document.getElementById("chat-status-bar");
  if (bar) bar.style.display = "none";
}

function addStatus(text: string, agent: string): void {
  const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  statusLog.unshift({ time: now, text, agent });
  if (statusLog.length > 50) statusLog.length = 50;
  updateSummary();
}

async function sendChat(): Promise<void> {
  const input = document.getElementById("chat-input") as HTMLTextAreaElement;
  const msg = input?.value?.trim();
  if (!msg) return;
  input.value = "";

  addMessage(esc(msg), "user");

  // Show attachments in the message
  if (attachedFiles.length) {
    const fileNames = attachedFiles.map(f => f.name).join(", ");
    addMessage(`<span class="text-sm text-muted">Attached: ${esc(fileNames)}</span>`, "user");
  }

  chatStatus = "Thinking...";
  showStatusBar("Analyzing request...");
  addStatus("Analyzing request...", "supervisor");

  // Build request body for the Rust agent
  const body: any = {
    message: msg,
    settings: {
      thinking: settings.thinking,
      vision: settings.vision,
      imageGen: settings.imageGen,
    },
  };
  if (attachedFiles.length) {
    body.files = attachedFiles.map(f => ({ name: f.name, data: f.data }));
  }

  try {
    // Route through the framework proxy (/__dev/api/chat → agent:9145/chat)
    const response = await fetch("/__dev/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) {
      const errMsg = response.status === 0 ? "Agent not running. Start: tina4 agent" : `Error: ${response.status}`;
      addMessage(`<span style="color:var(--danger)">${errMsg}</span>`, "bot");
      chatStatus = "Error";
      updateSummary();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const dataStr = line.slice(6);
          try {
            const data = JSON.parse(dataStr);
            handleSSEEvent(currentEvent, data);
          } catch {
            // Non-JSON data, ignore
          }
        }
      }
    }

    // Clear attachments after send
    attachedFiles.length = 0;
    renderAttachments();

  } catch (err) {
    addMessage(`<span style="color:var(--danger)">Connection failed</span>`, "bot");
    chatStatus = "Error";
    updateSummary();
  }
}

function handleSSEEvent(event: string, data: any): void {
  switch (event) {
    case "status":
      chatStatus = data.text || "Working...";
      showStatusBar(`${data.agent || "supervisor"}: ${data.text || "Working..."}`);
      addStatus(data.text || "", data.agent || "supervisor");
      break;

    case "message": {
      const content = data.content || "";
      const agent = data.agent || "supervisor";
      let html = formatChat(content);

      // Show agent badge
      if (agent !== "supervisor") {
        html = `<span class="badge" style="font-size:0.6rem;margin-right:4px">${esc(agent)}</span>` + html;
      }

      // Show files changed
      if (data.files_changed && data.files_changed.length > 0) {
        html += `<div style="margin-top:0.5rem;padding:0.5rem;background:var(--bg);border-radius:0.375rem;border:1px solid var(--border)">`;
        html += `<div class="text-sm" style="color:var(--success);font-weight:600;margin-bottom:0.25rem">Files changed:</div>`;
        data.files_changed.forEach((f: string) => {
          html += `<div class="text-sm text-mono">${esc(f)}</div>`;
          if (!filesChanged.includes(f)) filesChanged.push(f);
        });
        html += `</div>`;
      }

      addMessage(html, "bot");
      break;
    }

    case "plan": {
      // Plan content + approval buttons in ONE message
      let planHtml = "";

      // Render plan content if present
      if (data.content) {
        planHtml += formatChat(data.content);
      }

      // Add approval buttons below the plan
      if (data.approve) {
        planHtml += `
          <div style="padding:0.5rem;background:var(--surface);border:1px solid var(--info);border-radius:0.375rem;margin-top:0.75rem">
            <div class="text-sm text-muted" style="margin-bottom:0.5rem">Uncheck items you don't want. Click + to add comments.</div>
            <div class="flex gap-sm" style="flex-wrap:wrap">
              <button class="btn btn-sm btn-primary" onclick="window.__approvePlan('${esc(data.file || "")}')">Approve & Build</button>
              <button class="btn btn-sm" onclick="window.__submitFeedback()">Give Feedback</button>
              <button class="btn btn-sm" onclick="window.__keepPlan('${esc(data.file || "")}')">Later</button>
              <button class="btn btn-sm" onclick="this.closest('.chat-msg').remove()">Dismiss</button>
            </div>
          </div>
        `;
      }

      // Show agent badge
      if (data.agent && data.agent !== "supervisor") {
        planHtml = `<span class="badge" style="font-size:0.6rem;margin-right:4px">${esc(data.agent)}</span>` + planHtml;
      }

      addMessage(planHtml, "bot");
      break;
    }

    case "error":
      hideStatusBar();
      addMessage(`<span style="color:var(--danger)">${esc(data.message || "Unknown error")}</span>`, "bot");
      chatStatus = "Error";
      updateSummary();
      break;

    case "plan_failed": {
      // Show Resume button when execution fails mid-plan
      const done = data.completed || 0;
      const tot = data.total || 0;
      const failedStep = data.failed_step || 0;
      const resumeHtml = `
        <div style="padding:0.5rem;background:var(--surface);border:1px solid var(--warn);border-radius:0.375rem;margin-top:0.25rem">
          <div class="text-sm" style="margin-bottom:0.5rem">${done} of ${tot} steps completed. Failed at step ${failedStep}.</div>
          <div class="flex gap-sm">
            <button class="btn btn-sm btn-primary" onclick="window.__resumePlan('${esc(data.file || "")}')">Resume</button>
            <button class="btn btn-sm" onclick="this.closest('.chat-msg').remove()">Dismiss</button>
          </div>
        </div>
      `;
      addMessage(resumeHtml, "bot");
      break;
    }

    case "done":
      chatStatus = "Done";
      hideStatusBar();
      addStatus("Done", "supervisor");
      setTimeout(() => { chatStatus = "Idle"; updateSummary(); }, 3000);
      break;
  }
}

async function approvePlan(planFile: string): Promise<void> {
  addMessage(`<span style="color:var(--success)">Plan approved — let's build it!</span>`, "user");
  chatStatus = "Executing plan...";
  addStatus("Plan approved — building...", "supervisor");
  showStatusBar("Building...");

  // Go directly to /execute — bypass the supervisor LLM
  const body = {
    plan_file: planFile,
    settings: {
      thinking: settings.thinking,
      vision: settings.vision,
      imageGen: settings.imageGen,
    },
  };

  try {
    const response = await fetch("/__dev/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok || !response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) currentEvent = line.slice(7).trim();
        else if (line.startsWith("data: ")) {
          try { handleSSEEvent(currentEvent, JSON.parse(line.slice(6))); } catch {}
        }
      }
    }
  } catch {
    addMessage(`<span style="color:var(--danger)">Plan execution failed</span>`, "bot");
  }
}

function keepPlan(planFile: string): void {
  addMessage(`<span style="color:var(--muted)">Plan saved for later: ${esc(planFile)}</span>`, "bot");
}

function submitFeedback(): void {
  const { accepted, rejected, comments } = getChecklist();
  let feedback = "Here's my feedback on the proposal:\n\n";
  if (accepted.length) feedback += "**Keep these:**\n" + accepted.map(a => `- ${a}`).join("\n") + "\n\n";
  if (rejected.length) feedback += "**Remove these:**\n" + rejected.map(r => `- ${r}`).join("\n") + "\n\n";
  if (comments.length) feedback += "**Comments:**\n" + comments.map(c => `- ${c}`).join("\n") + "\n\n";
  if (!rejected.length && !comments.length) feedback += "Everything looks good. ";
  feedback += "Please revise the plan based on this feedback.";

  // Send as a user message
  const input = document.getElementById("chat-input") as HTMLTextAreaElement;
  if (input) {
    input.value = feedback;
    sendChat();
  }
}

async function resumePlan(planFile: string): Promise<void> {
  addMessage(`<span style="color:var(--info)">Resuming plan...</span>`, "user");
  chatStatus = "Resuming...";
  showStatusBar("Resuming...");

  const body = {
    plan_file: planFile,
    resume: true,
    settings: {
      thinking: settings.thinking,
      vision: settings.vision,
      imageGen: settings.imageGen,
    },
  };

  try {
    const response = await fetch("/__dev/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok || !response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) currentEvent = line.slice(7).trim();
        else if (line.startsWith("data: ")) {
          try { handleSSEEvent(currentEvent, JSON.parse(line.slice(6))); } catch {}
        }
      }
    }
  } catch {
    addMessage(`<span style="color:var(--danger)">Resume failed</span>`, "bot");
  }
}

(window as any).__resumePlan = resumePlan;
(window as any).__submitFeedback = submitFeedback;
(window as any).__approvePlan = approvePlan;
(window as any).__keepPlan = keepPlan;

async function undoChat(): Promise<void> {
  try {
    const d = await api<any>("/chat/undo", "POST");
    addMessage(`<span style="color:var(--warn)">${esc(d.message || "Undo complete")}</span>`, "bot");
  } catch {
    addMessage('<span style="color:var(--warn)">Nothing to undo</span>', "bot");
  }
}

// --- File attachments ---
const attachedFiles: { name: string; data: string }[] = [];

function handleFileSelect(): void {
  const input = document.getElementById("chat-file-input") as HTMLInputElement;
  if (!input?.files) return;
  const container = document.getElementById("chat-attachments")!;

  Array.from(input.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = () => {
      attachedFiles.push({ name: file.name, data: reader.result as string });
      renderAttachments();
    };
    reader.readAsDataURL(file);
  });
  input.value = "";
}

function renderAttachments(): void {
  const container = document.getElementById("chat-attachments");
  if (!container) return;
  if (!attachedFiles.length) { container.style.display = "none"; return; }
  container.style.display = "flex";
  container.style.cssText += "gap:0.375rem;flex-wrap:wrap;margin-bottom:0.375rem;font-size:0.75rem";
  container.innerHTML = attachedFiles.map((f, i) =>
    `<span style="background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:2px 8px;display:inline-flex;align-items:center;gap:4px">
      ${esc(f.name)} <span style="cursor:pointer;color:var(--danger)" onclick="window.__removeFile(${i})">&times;</span>
    </span>`
  ).join("");
}

function removeFile(idx: number): void {
  attachedFiles.splice(idx, 1);
  renderAttachments();
}

// --- Mic input (Web Speech API) ---
let micRecording = false;
let recognition: any = null;

function toggleMic(): void {
  const btn = document.getElementById("chat-mic-btn");
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    addMessage('<span style="color:var(--warn)">Speech recognition not supported in this browser</span>', "bot");
    return;
  }

  if (micRecording && recognition) {
    recognition.stop();
    micRecording = false;
    if (btn) { btn.textContent = "Mic"; btn.style.background = ""; }
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (e: any) => {
    const transcript = e.results[0][0].transcript;
    const input = document.getElementById("chat-input") as HTMLTextAreaElement;
    if (input) input.value = (input.value ? input.value + " " : "") + transcript;
  };

  recognition.onend = () => {
    micRecording = false;
    if (btn) { btn.textContent = "Mic"; btn.style.background = ""; }
  };

  recognition.onerror = () => {
    micRecording = false;
    if (btn) { btn.textContent = "Mic"; btn.style.background = ""; }
  };

  recognition.start();
  micRecording = true;
  if (btn) { btn.textContent = "Stop"; btn.style.background = "var(--danger)"; }
}

(window as any).__removeFile = removeFile;

function formatChat(text: string): string {
  // First unescape literal \n from JSON
  let t = text.replace(/\\n/g, "\n");

  // Extract code blocks first to protect them
  const codeBlocks: string[] = [];
  t = t.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre style="background:var(--bg);padding:0.75rem;border-radius:0.375rem;overflow-x:auto;margin:0.5rem 0;font-size:0.75rem;border:1px solid var(--border)"><code>${esc(code)}</code></pre>`);
    return `\x00CODE${idx}\x00`;
  });

  // Process line by line
  const lines = t.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Placeholder — pass through
    if (trimmed.startsWith("\x00CODE")) { result.push(trimmed); continue; }

    // Headers
    if (trimmed.startsWith("### ")) { result.push(`<div style="font-weight:700;font-size:0.8rem;margin:0.75rem 0 0.25rem;color:var(--info)">${esc(trimmed.slice(4))}</div>`); continue; }
    if (trimmed.startsWith("## ")) { result.push(`<div style="font-weight:700;font-size:0.9rem;margin:0.75rem 0 0.25rem">${esc(trimmed.slice(3))}</div>`); continue; }
    if (trimmed.startsWith("# ")) { result.push(`<div style="font-weight:700;font-size:1rem;margin:0.75rem 0 0.25rem">${esc(trimmed.slice(2))}</div>`); continue; }

    // Horizontal rule
    if (trimmed === "---" || trimmed === "***") { result.push('<hr style="border:none;border-top:1px solid var(--border);margin:0.5rem 0">'); continue; }

    // Numbered list — detect questions (ends with ?) and add inline input
    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      const isQuestion = numMatch[2].trim().endsWith("?");
      if (isQuestion) {
        const qId = `q-${msgCounter}-${numMatch[1]}`;
        result.push(`<div style="margin:0.3rem 0;padding-left:0.5rem">
          <div style="margin-bottom:4px"><span style="color:var(--info);font-weight:600;margin-right:0.4rem">${numMatch[1]}.</span>${inlineFormat(numMatch[2])}</div>
          <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
            <input type="text" class="input chat-answer-input" id="${qId}" data-q="${numMatch[1]}" placeholder="Your answer..." style="font-size:0.75rem;padding:4px 8px;flex:1;max-width:350px">
            <button class="btn btn-sm" style="font-size:0.6rem;padding:2px 6px" onclick="window.__quickAnswer(this,'Yes')">Yes</button>
            <button class="btn btn-sm" style="font-size:0.6rem;padding:2px 6px" onclick="window.__quickAnswer(this,'No')">No</button>
            <button class="btn btn-sm" style="font-size:0.6rem;padding:2px 6px" onclick="window.__quickAnswer(this,'Later')">Later</button>
            <button class="btn btn-sm" style="font-size:0.6rem;padding:2px 6px" onclick="window.__quickAnswer(this,'Skip')">Skip</button>
          </div>
        </div>`);
      } else {
        result.push(`<div style="margin:0.15rem 0;padding-left:1.5rem"><span style="color:var(--info);font-weight:600;margin-right:0.4rem">${numMatch[1]}.</span>${inlineFormat(numMatch[2])}</div>`);
      }
      continue;
    }

    // Bullet list — render as interactive checkboxes with comment ability
    if (trimmed.startsWith("- ")) {
      const itemId = `chk-${msgCounter}-${result.length}`;
      const content = trimmed.slice(2);
      result.push(`<div style="margin:0.15rem 0;padding-left:0.5rem;display:flex;align-items:flex-start;gap:6px" class="chat-checklist-item">
        <input type="checkbox" id="${itemId}" checked style="margin-top:3px;cursor:pointer;accent-color:var(--success)">
        <label for="${itemId}" style="flex:1;cursor:pointer">${inlineFormat(content)}</label>
        <button class="btn btn-sm" style="font-size:0.55rem;padding:1px 4px;opacity:0.5;flex-shrink:0" onclick="window.__commentOnItem(this)" title="Add comment">+</button>
      </div>`);
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) { result.push(`<div style="border-left:3px solid var(--info);padding-left:0.75rem;margin:0.3rem 0;color:var(--muted);font-style:italic">${inlineFormat(trimmed.slice(2))}</div>`); continue; }

    // Empty line
    if (trimmed === "") { result.push('<div style="height:0.4rem"></div>'); continue; }

    // Normal text
    result.push(`<div style="margin:0.1rem 0">${inlineFormat(trimmed)}</div>`);
  }

  // Restore code blocks
  let html = result.join("");
  codeBlocks.forEach((block, i) => {
    html = html.replace(`\x00CODE${i}\x00`, block);
  });

  return html;
}

function inlineFormat(text: string): string {
  // Escape HTML first to prevent XSS, then apply markdown formatting
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg);padding:0.1rem 0.3rem;border-radius:0.2rem;font-size:0.8em;border:1px solid var(--border)">$1</code>');
}

function prefillChat(text: string): void {
  const input = document.getElementById("chat-input") as HTMLTextAreaElement;
  if (input) {
    input.value = text;
    input.focus();
    input.scrollTop = input.scrollHeight;
  }
}

(window as any).__sendChat = sendChat;
(window as any).__undoChat = undoChat;
(window as any).__prefillChat = prefillChat;
