import { api, esc } from "../api.js";
import {
  chat as aiChat,
  ChatMessage,
  generateImage as aiGenerateImage,
  probeEndpoint,
  MODELS,
  type ModelKey,
} from "../ai.js";
import {
  listMcpTools,
  callMcpTool,
  formatToolsForPrompt,
  parseToolCalls,
  type McpTool,
} from "../mcp.js";
import { TINA4_CONTEXT } from "../tina4-context.js";
import { ghostCompletion } from "../ai-completion.js";
import {
  streamExecute,
  streamSupervisorChat,
  listThoughts,
  dismissThought,
  createSession,
  getSessionDiff,
  commitSession,
  cancelSession,
  listSessions,
  type AgentEvent,
  type Thought,
  type SessionMeta,
  type SessionDiff,
} from "../rust-agents.js";

// ── CodeMirror imports ──
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, indentWithTab, insertNewlineAndIndent, history, historyKeymap } from "@codemirror/commands";
import { indentOnInput, indentUnit, bracketMatching, foldGutter, foldKeymap } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { php } from "@codemirror/lang-php";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { sql } from "@codemirror/lang-sql";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { search, searchKeymap } from "@codemirror/search";
import { StreamLanguage } from "@codemirror/language";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { properties } from "@codemirror/legacy-modes/mode/properties";

// ── State ──
interface OpenFile {
  path: string;
  content: string;
  language: string;
  dirty: boolean;
  view?: EditorView;
}

let openFiles: OpenFile[] = [];
let activeFile: string | null = null;
let activeDir: string | null = null;  // Most recently clicked folder — highlighted in the tree for visual feedback
let expandedDirs: Set<string> = new Set([".", "src", "src/routes", "src/orm", "src/templates"]);
let container: HTMLElement | null = null;
let fileTreeCache: Map<string, any[]> = new Map();

// ── Language extensions ──
function langExtension(lang: string) {
  switch (lang) {
    case "python": return python();
    case "php": return php();
    case "javascript":
    case "typescript": return javascript({ typescript: lang === "typescript", jsx: true });
    case "html": return html();
    case "css": return css();
    case "json": return json();
    case "yaml": return yaml();
    case "sql": return sql();
    case "markdown": return markdown();
    case "dockerfile": return StreamLanguage.define(dockerFile);
    case "shell": return StreamLanguage.define(shell);
    case "toml": return StreamLanguage.define(toml);
    case "env": return StreamLanguage.define(properties);
    default: return [];
  }
}

// ── Main render ──
export function renderEditor(el: HTMLElement): void {
  container = el;

  el.innerHTML = `
    <div class="editor-layout">
      <div class="editor-sidebar" id="editor-sidebar">
        <div class="editor-sidebar-header">
          <div style="display:flex;align-items:center;gap:6px">
            <div class="editor-menu-wrapper" style="position:relative">
              <button class="btn btn-sm" id="editor-menu-btn" onclick="window.__editorToggleMenu()" title="Menu" style="font-size:0.75rem;padding:2px 6px;line-height:1">☰</button>
              <div id="editor-menu-dropdown" class="editor-menu-dropdown" style="display:none">
                <div class="editor-menu-item" onclick="window.__switchTab('routes')">🔀 Routes</div>
                <div class="editor-menu-item" onclick="window.__switchTab('database')">🗄️ Database</div>
                <div class="editor-menu-item" onclick="window.__switchTab('graphql')">◇ GraphQL</div>
                <div class="editor-menu-item" onclick="window.__switchTab('queue')">📋 Queue</div>
                <div class="editor-menu-item" onclick="window.__switchTab('errors')">⚠️ Errors</div>
                <div class="editor-menu-item" onclick="window.__switchTab('metrics')">📊 Metrics</div>
                <div class="editor-menu-item" onclick="window.__switchTab('system')">⚙️ System</div>
              </div>
            </div>
            <span class="text-sm" style="font-weight:600">Files</span>
          </div>
          <div style="display:flex;gap:4px;align-items:center">
            <span id="editor-branch" class="text-sm text-muted"></span>
            <button class="btn btn-sm" onclick="window.__editorPopOut()" title="Pop out to new window" style="font-size:0.65rem;padding:2px 6px">&#x29C9;</button>
          </div>
        </div>
        <div id="editor-file-tree" class="editor-file-tree"></div>
        <div class="editor-scaffold-bar">
          <div class="scaffold-label">Scaffold</div>
          <div class="scaffold-buttons">
            <button class="scaffold-btn" onclick="window.__scaffold('route')" title="Generate route file">+ Route</button>
            <button class="scaffold-btn" onclick="window.__scaffold('model')" title="Generate ORM model">+ Model</button>
            <button class="scaffold-btn" onclick="window.__scaffold('migration')" title="Generate migration">+ Migration</button>
            <button class="scaffold-btn" onclick="window.__scaffold('middleware')" title="Generate middleware">+ Middleware</button>
          </div>
          <div class="scaffold-sep"></div>
          <div class="scaffold-buttons">
            <button class="scaffold-btn scaffold-run" onclick="window.__scaffoldRun('migrate')" title="Run pending migrations">▶ Migrate</button>
            <button class="scaffold-btn scaffold-run" onclick="window.__scaffoldRun('test')" title="Run tests">▶ Test</button>
            <button class="scaffold-btn scaffold-run" onclick="window.__scaffoldRun('seed')" title="Seed database">▶ Seed</button>
          </div>
          <div id="scaffold-output" class="scaffold-output" style="display:none"></div>
        </div>
      </div>
      <div class="editor-splitter" id="editor-splitter-left" title="Drag to resize"></div>
      <div class="editor-main">
        <div class="editor-tabs" id="editor-tabs"></div>
        <div class="editor-content" id="editor-content">
          <div class="editor-welcome">
            <h3>Code With Me</h3>
            <p class="text-muted">Select a file from the sidebar to start editing.</p>
            <p class="text-muted text-sm">Ctrl+S saves. Ctrl+Click navigates to definition.</p>
          </div>
        </div>
        <div class="editor-statusbar" id="editor-statusbar">
          <span class="text-sm text-muted">Ready</span>
        </div>
      </div>
      <div class="editor-splitter" id="editor-splitter-right" title="Drag to resize"></div>
      <div class="editor-right-panel" id="editor-right-panel">
        <!-- Session workspace (supervisor-owned) -->
        <div id="editor-ai-panel" class="right-panel-view">

          <!-- Status strip: session title + meta, collapse toggle -->
          <div class="session-strip">
            <div class="session-strip-row session-title-row">
              <span class="session-title-wrap">
                <span class="session-title" id="session-title">No active session</span>
                <span class="session-meta" id="session-meta"></span>
              </span>
              <button class="btn btn-sm session-collapse-btn" id="editor-ai-toggle" onclick="window.__editorToggleAI()" title="Collapse panel">&#x25B6;</button>
            </div>
            <div class="session-strip-row session-plan-row">
              <span id="editor-plan-indicator" class="session-plan-indicator"></span>
            </div>
            <!-- Live reachability for the 5 backing services. Clicking a
                 dot would tell you which port / model it maps to — later
                 slice turns these into interactive tooltips. For now the
                 title attribute is enough. -->
            <div class="session-strip-row session-health-row">
              <span class="session-health-label">services</span>
              <span class="model-dot" data-model="chat"   title="/ai — Qwen2.5-Coder-14B @ 45K YaRN (:11437)"></span>
              <span class="model-dot" data-model="vision" title="/vision — Qwen2.5-VL-7B (:11434)"></span>
              <span class="model-dot" data-model="embed"  title="/embed — nomic-embed-text (:11435)"></span>
              <span class="model-dot" data-model="image"  title="/image — SDXL Turbo (:11436)"></span>
              <span class="model-dot" data-model="rag"    title="/rag — tina4-rag (:11438)"></span>
              <span class="session-mode-toggle" id="session-mode-toggle" role="tablist" aria-label="Chat mode">
                <button type="button" class="mode-btn active" data-mode="supervisor" onclick="window.__editorSetMode('supervisor')" title="Supervisor delegates to agents and stages edits for review">supervisor</button>
                <button type="button" class="mode-btn"        data-mode="qa"         onclick="window.__editorSetMode('qa')"         title="Read-only Q&amp;A — no writes to disk">Q&amp;A</button>
              </span>
              <button type="button" class="completion-toggle" id="completion-toggle" onclick="window.__editorToggleCompletion()" title="Inline completion (Tab to accept, Esc to dismiss)">&#9889;</button>
            </div>
          </div>

          <!-- Tabs -->
          <div class="session-tabs" role="tablist" aria-label="Session views">
            <button type="button" class="session-tab active" data-tab="activity" onclick="window.__editorTabSwitch('activity')">Activity</button>
            <button type="button" class="session-tab"        data-tab="plan"     onclick="window.__editorTabSwitch('plan')">Plan<span class="tab-badge" id="tab-badge-plan"></span></button>
            <button type="button" class="session-tab"        data-tab="thoughts" onclick="window.__editorTabSwitch('thoughts')">Thoughts<span class="tab-badge" id="tab-badge-thoughts"></span></button>
            <button type="button" class="session-tab"        data-tab="diff"     onclick="window.__editorTabSwitch('diff')">Diff</button>
            <button type="button" class="session-tab"        data-tab="checks"   onclick="window.__editorTabSwitch('checks')">Checks</button>
          </div>

          <!-- Tab bodies. One visible at a time; the rest get the hidden
               attribute so scroll position is preserved between switches. -->
          <div class="session-tab-body">

            <!-- Activity: agent turns, tool results, chat bubbles. The
                 #editor-ai-messages id is preserved so addAIMessage() et
                 al. keep appending here without code changes. The
                 session-summary strip at the top surfaces cumulative
                 session state (files / commits / warnings) when a
                 supervisor session is live. -->
            <div class="session-tab-panel" data-panel="activity" id="panel-activity">
              <div class="session-summary-strip" id="session-summary-strip" hidden>
                <span class="summary-chip" id="summary-chip-session"></span>
                <span class="summary-spacer"></span>
                <button type="button" class="summary-toggle" onclick="window.__editorTabSwitch('diff')">view diff</button>
              </div>
              <div id="editor-ai-messages" class="editor-ai-messages">
                <div class="ai-msg ai-bot">How can I help with this file?</div>
                <div id="activity-session-bootstrap" style="margin-top:0.5rem">
                  <div style="font-size:0.7rem;opacity:0.6;padding:0.3rem 0;line-height:1.4">
                    Supervisor sessions stage work in a throwaway git worktree. Apply commits to your tree only when you accept the proposal.
                  </div>
                  <div style="display:flex;gap:0.3rem;flex-wrap:wrap">
                    <button class="btn btn-sm btn-primary" onclick="window.__editorSessionStartFromActivity()" style="font-size:0.7rem">▶ Start session</button>
                    <button class="btn btn-sm" onclick="window.__editorTabSwitch('plan')" style="font-size:0.7rem">Plan</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Plan: current plan indicator + steps (populated later).
                 Empty state nudges toward creating a plan since working
                 from a plan is non-negotiable for supervisor mode. -->
            <div class="session-tab-panel" data-panel="plan" id="panel-plan" hidden>
              <div class="panel-empty" id="plan-empty-state">
                <div class="panel-empty-title">No active plan</div>
                <div class="panel-empty-body">Working from a plan is required in supervisor mode. A plan gives the agents a concrete goal to ground against and makes each commit point at a real step.</div>
                <div class="panel-empty-actions">
                  <button class="btn btn-sm btn-primary" onclick="window.__editorOpenPlanSwitcher()">Create plan</button>
                  <button class="btn btn-sm" onclick="window.__editorOpenPlanSwitcher()">Browse plans</button>
                </div>
              </div>
              <div class="panel-content" id="plan-content-area" hidden></div>
            </div>

            <!-- Thoughts: supervisor's "by the way…" observations.
                 Preserving the #editor-thoughts-banner id lets
                 loadThoughtsBanner() keep working unchanged. The
                 header row offers bulk actions when the engine
                 floods with false positives — one click to clear
                 every currently-visible thought. -->
            <div class="session-tab-panel" data-panel="thoughts" id="panel-thoughts" hidden>
              <div class="thoughts-toolbar" id="thoughts-toolbar" hidden>
                <span class="thoughts-toolbar-count" id="thoughts-toolbar-count">0 observations</span>
                <span class="thoughts-toolbar-spacer"></span>
                <button class="btn btn-sm thoughts-toolbar-clear" onclick="window.__editorThoughtsClearAll()" title="Dismiss every visible observation. Remembered across reloads so they don't resurface.">Clear all</button>
              </div>
              <div id="editor-thoughts-banner" class="editor-thoughts-banner" style="display:none"></div>
              <div class="panel-empty" id="thoughts-empty-state">
                <div class="panel-empty-title">No thoughts yet</div>
                <div class="panel-empty-body">The supervisor surfaces observations and risks here as work progresses. If an observation isn't true, dismiss it — the panel won't show it again.</div>
              </div>
            </div>

            <!-- Diff: populated once the supervisor session has commits
                 on its working branch. Empty-state shows when there's
                 no session or the session is empty; otherwise the
                 live diff + RAG warnings render here. -->
            <div class="session-tab-panel" data-panel="diff" id="panel-diff" hidden>
              <div class="panel-empty" id="diff-empty-state">
                <div class="panel-empty-title">No proposal to review</div>
                <div class="panel-empty-body">When the supervisor hands work back, staged diffs show here for per-file accept/reject.</div>
              </div>
              <div class="panel-content" id="diff-content-area" hidden>
                <div class="diff-summary" id="diff-summary"></div>
                <div class="diff-files" id="diff-files"></div>
                <div class="diff-warnings" id="diff-warnings"></div>
                <div class="diff-commits" id="diff-commits"></div>
              </div>
            </div>

            <!-- Checks: syntax / tests / review results per step. -->
            <div class="session-tab-panel" data-panel="checks" id="panel-checks" hidden>
              <div class="panel-empty">
                <div class="panel-empty-title">No checks run</div>
                <div class="panel-empty-body">Syntax, tests, and review verdicts populate per plan step as agents commit work.</div>
              </div>
            </div>

          </div>

          <!-- Agent activity strip: single line summary of the current
               turn (who's active, what they're doing). Hidden when idle. -->
          <div class="session-activity-strip" id="session-activity-strip" hidden>
            <span class="activity-dot"></span>
            <span class="activity-text" id="session-activity-text">idle</span>
          </div>

          <!-- Input + action bar. Revise / Apply / Cancel are disabled
               until a session has a proposal staged (later slice wires
               them against /supervise endpoints). -->
          <div class="editor-ai-input-area">
            <textarea id="editor-ai-input" class="input session-input" placeholder="Describe the change (supervisor will propose a plan if none is active)..." rows="2"></textarea>
            <div class="session-action-row">
              <button class="btn btn-sm btn-primary session-btn-send" onclick="window.__editorAISend()" id="btn-session-send">Send</button>
              <button class="btn btn-sm" onclick="window.__editorAIExplain()" title="Explain selected code">Explain</button>
              <button class="btn btn-sm" onclick="window.__editorAIImage()" title="Generate image from prompt">&#127912;</button>
              <span class="action-spacer"></span>
              <button class="btn btn-sm" id="btn-session-revise" onclick="window.__editorSessionRevise()" disabled title="Ask the supervisor to revise the current proposal">Revise</button>
              <button class="btn btn-sm btn-primary" id="btn-session-apply" onclick="window.__editorSessionApply()" disabled title="Apply the supervisor's proposal to the working tree">Apply</button>
              <button class="btn btn-sm" id="btn-session-cancel" onclick="window.__editorSessionCancel()" disabled title="Cancel the active session">✕</button>
            </div>
          </div>
        </div>
        <!-- Dependency search (shown for package files) -->
        <div id="editor-deps-panel" class="right-panel-view" style="display:none">
          <div class="editor-ai-header">
            <span id="deps-panel-title" style="font-weight:600;font-size:0.8rem">Dependencies</span>
            <button class="btn btn-sm" onclick="window.__editorToggleAI()" style="font-size:0.6rem;padding:2px 6px" title="Toggle panel">&#x25B6;</button>
          </div>
          <div style="padding:0.5rem;border-bottom:1px solid var(--border)">
            <div style="display:flex;gap:4px">
              <input type="text" id="deps-search-input" class="input" placeholder="Search packages..." style="flex:1;font-size:0.8rem;padding:4px 8px">
              <button class="btn btn-sm btn-primary" onclick="window.__depsSearch()" style="font-size:0.7rem">🔍</button>
            </div>
          </div>
          <div id="deps-search-results" class="deps-results" style="flex:1;overflow-y:auto;padding:0.25rem"></div>
          <div style="border-top:1px solid var(--border);padding:0.375rem 0.5rem">
            <div class="scaffold-label">Installed</div>
          </div>
          <div id="deps-installed" class="deps-installed" style="overflow-y:auto;max-height:40%;padding:0.25rem"></div>
        </div>
      </div>
    </div>
  `;

  // Add editor-specific styles
  addEditorStyles();

  // Wire up the draggable column splitters (sidebar + right panel).
  setupSplitters();

  // Load the file tree, then restore the workspace the user left behind —
  // expanded folders, open tabs, and which tab was active — from
  // localStorage. Browser-level durability so F5 doesn't wipe context.
  loadFileTree(".").then(() => restoreEditorState());
  // Populate the plan indicator on initial load — users shouldn't
  // have to send a chat turn just to see which plan is active.
  callMcpTool("plan_current", {}).then((r) => {
    renderPlanIndicator((r.ok && (r as any).result) || null);
  });
  // Proactive thoughts (from the Rust supervisor) — surface them as
  // dismissable chips above the chat input so the user sees "by the
  // way, your project is missing .env.example" on load instead of
  // only when they ask.
  loadThoughtsBanner();
  // Watch for file-system changes (from chat tool calls, Rust
  // supervisor, external editors, `tina4 generate`, etc.) so the
  // tree and open tabs stay in sync without a full page reload.
  startLiveReloadWatcher();

  // ── Session panel init ──
  // Restore the user's last chat mode (supervisor / Q&A) and last-
  // viewed tab so reloading doesn't reset context. Start pinging the
  // five model endpoints for the health dots. Revive any previously-
  // open session (worktree still exists on the server) so reload
  // doesn't orphan in-flight work.
  applySessionModeToDOM(getSessionMode());
  const savedTab = (localStorage.getItem(LS_ACTIVE_TAB) as SessionTab | null) || "activity";
  switchTab(savedTab);
  startHealthPoll();
  refreshCompletionIndicator();
  reviveSessionFromStorage().catch(() => { /* offline is fine */ });
}

// ── Editor state persistence ───────────────────────────────────
//
// Persist just enough to recreate the workspace: expanded folders,
// open tabs, active tab, and the last-clicked folder. File *contents*
// live on disk and are always re-read — we never try to persist
// editor buffers, only what the user was looking at.

const LS_STATE = "tina4.editor.state";

interface PersistedState {
  openPaths?: string[];
  activeFile?: string | null;
  activeDir?: string | null;
  expandedDirs?: string[];
}

function persistEditorState(): void {
  try {
    const state: PersistedState = {
      openPaths: openFiles.map((f) => f.path),
      activeFile,
      activeDir,
      expandedDirs: Array.from(expandedDirs),
    };
    localStorage.setItem(LS_STATE, JSON.stringify(state));
  } catch {
    // localStorage can fail in private-browsing mode; silent is fine
  }
}

async function restoreEditorState(): Promise<void> {
  let state: PersistedState;
  try {
    state = JSON.parse(localStorage.getItem(LS_STATE) || "{}");
  } catch {
    return;
  }

  // Re-expand directories first so the tree looks the same as last time.
  // Each loadFileTree() call also renders, but we suppress intermediate
  // renders by only calling renderFileTree() after the final load.
  for (const dir of state.expandedDirs || []) {
    expandedDirs.add(dir);
    if (!fileTreeCache.has(dir)) {
      await loadFileTree(dir);
    }
  }

  if (state.activeDir) activeDir = state.activeDir;

  // Reopen files that still exist. Use openFile() so each goes through
  // the normal load / CodeMirror bootstrap path. Skip any that 404.
  for (const path of state.openPaths || []) {
    try {
      await openFile(path);
    } catch {
      // File was deleted since last session — silently skip
    }
  }

  // Finally set the active tab (defaults to the last-opened file otherwise)
  if (state.activeFile && openFiles.some((f) => f.path === state.activeFile)) {
    switchToFile(state.activeFile);
  }

  renderFileTree();
}

// ── File tree ──
async function loadFileTree(dirPath: string): Promise<void> {
  try {
    const data = await api<any>(`/files?path=${encodeURIComponent(dirPath)}`);

    // Update branch display
    if (data.branch) {
      const branchEl = document.getElementById("editor-branch");
      if (branchEl) branchEl.textContent = `⎇ ${data.branch}`;
    }

    fileTreeCache.set(dirPath, data.entries || []);
    renderFileTree();
  } catch (e: any) {
    console.error("Failed to load file tree:", e);
  }
}

function renderFileTree(): void {
  const treeEl = document.getElementById("editor-file-tree");
  if (!treeEl) return;
  treeEl.innerHTML = renderDir(".", 0);
}

/** Drop every cached directory listing and reload everything the
 *  user currently has open in the tree. Call after a file-system
 *  change that we didn't originate (Rust supervisor writes, CLI
 *  scaffolding, external edits, etc.). */
async function refreshAllOpenDirs(): Promise<void> {
  // Snapshot the dirs that were loaded — otherwise we'd wipe the
  // cache and then have nothing to re-fetch. Always include "." so
  // the root shows up even if it somehow fell out of the set.
  const dirs = Array.from(new Set(["." , ...Array.from(fileTreeCache.keys()), ...Array.from(expandedDirs)]));
  fileTreeCache.clear();
  // Parallelise — tree reloads are just tiny JSON fetches.
  await Promise.all(dirs.map((d) => loadFileTree(d).catch(() => { /* tolerate missing */ })));
  renderFileTree();
}

/** Reload an open file's buffer from disk if its contents drifted.
 *  Skips files with unsaved edits (the `dirty` flag) to avoid
 *  clobbering the user's typing. */
async function syncOpenBuffer(filePath: string): Promise<void> {
  const f = openFiles.find((of) => of.path === filePath);
  if (!f) return;
  if (f.dirty) return; // user has unsaved local edits — don't stomp
  try {
    const fresh = await api<any>(`/file?path=${encodeURIComponent(filePath)}`);
    const content: string = fresh?.content ?? "";
    if (content === f.content) return; // no-op
    if (f.view) {
      f.view.dispatch({
        changes: { from: 0, to: f.view.state.doc.length, insert: content },
      });
    }
    f.content = content;
    f.dirty = false;
    renderTabs();
  } catch {
    /* file may have been deleted — leave the tab so the user notices */
  }
}

// ── Live reload watcher ────────────────────────────────────────────
//
// The Rust `tina4` CLI watches the project for file-system events and
// POSTs /__dev/api/reload to the running framework on each change.
// The framework then broadcasts a `{type: "reload"}` message over a
// WebSocket at /__dev_reload and bumps a counter at GET
// /__dev/api/mtime (for polling fallback).
//
// We subscribe to BOTH: WS primary, polling every 3 s as backup
// (matches the framework's dev-toolbar contract). On any reload
// signal we refresh the tree and hot-sync open tabs without a full
// page reload.

let _lastMtime = 0;
let _reloadSocket: WebSocket | null = null;

function startLiveReloadWatcher(): void {
  // WebSocket path — dev server serves WS on the same origin at /__dev_reload
  const wsProto = location.protocol === "https:" ? "wss" : "ws";
  // Vite rewrites `/__dev/*` HTTP requests to the framework on :7200
  // but WebSocket upgrade isn't in our proxy table. Hit the framework
  // directly — localhost-only in dev anyway.
  const wsUrl = `${wsProto}://${location.hostname}:7200/__dev_reload`;
  try {
    _reloadSocket = new WebSocket(wsUrl);
    _reloadSocket.addEventListener("message", (ev) => {
      try {
        const data = typeof ev.data === "string" ? JSON.parse(ev.data) : null;
        if (data && (data.type === "reload" || data.type === "change")) {
          handleReloadSignal();
        }
      } catch {
        handleReloadSignal(); // any payload = "something changed"
      }
    });
    _reloadSocket.addEventListener("close", () => {
      _reloadSocket = null;
      // Retry after 5 s — dev server restart / network blip.
      setTimeout(() => startLiveReloadWatcher(), 5000);
    });
  } catch {
    _reloadSocket = null;
  }
  // Polling fallback — guaranteed to work even if WS fails to upgrade.
  // Framework's mtime counter bumps on every reload POST, so a bump
  // between our poll calls = something changed.
  setInterval(async () => {
    try {
      const r = await fetch("/__dev/api/mtime");
      if (!r.ok) return;
      const data = await r.json();
      const mt = typeof data.mtime === "number" ? data.mtime : 0;
      if (mt > _lastMtime) {
        if (_lastMtime > 0) handleReloadSignal();
        _lastMtime = mt;
      }
    } catch { /* non-fatal */ }
  }, 3000);
}

/** Debounced tree+buffer refresh — bursts of file events (a plan
 *  run writes 5 files in 200 ms) shouldn't produce 5 round-trips. */
let _reloadPending: number | null = null;
function handleReloadSignal(): void {
  if (_reloadPending !== null) return;
  _reloadPending = window.setTimeout(async () => {
    _reloadPending = null;
    await refreshAllOpenDirs();
    // Resync every open file in parallel.
    await Promise.all(openFiles.map((f) => syncOpenBuffer(f.path)));
  }, 300);
}

function renderDir(dirPath: string, depth: number): string {
  const entries = fileTreeCache.get(dirPath);
  if (!entries) return "";

  const expanded = expandedDirs.has(dirPath);
  let html = "";

  // Sort: directories first, then files, alphabetical
  const sorted = [...entries].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    const statusClass = `git-${entry.git_status || "clean"}`;
    const indent = depth * 16;
    const escapedPath = esc(entry.path);

    if (entry.is_dir) {
      const isExpanded = expandedDirs.has(entry.path);
      const hasKids = entry.has_children !== false;
      const arrow = hasKids ? (isExpanded ? "▾" : "▸") : " ";
      const dirDot = gitDot(entry.git_status);
      const isActiveDir = activeDir === entry.path;
      html += `<div class="tree-item tree-dir ${statusClass} ${isActiveDir ? "active" : ""}" style="padding-left:${indent}px"
        onclick="window.__editorToggleDir('${escapedPath}')"
        oncontextmenu="event.preventDefault();window.__editorCtxMenu(event,'${escapedPath}',true)">
        <span class="tree-arrow">${arrow}</span>
        <span class="tree-icon">📁</span>
        <span class="tree-name">${esc(entry.name)}</span>
        ${dirDot}
      </div>`;

      if (isExpanded) {
        html += renderDir(entry.path, depth + 1);
      }
    } else {
      const icon = fileIcon(entry.name);
      const isActive = activeFile === entry.path;
      const fileDot = gitDot(entry.git_status);
      html += `<div class="tree-item tree-file ${statusClass} ${isActive ? "active" : ""}" style="padding-left:${indent + 16}px"
        onclick="window.__editorOpenFile('${escapedPath}')"
        oncontextmenu="event.preventDefault();window.__editorCtxMenu(event,'${escapedPath}',false)">
        <span class="tree-icon">${icon}</span>
        <span class="tree-name">${esc(entry.name)}</span>
        ${fileDot}
      </div>`;
    }
  }

  return html;
}

function fileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const icons: Record<string, string> = {
    py: "🐍", php: "🐘", rb: "💎", ts: "📘", js: "📒",
    json: "📋", html: "🌐", twig: "🌐", css: "🎨", scss: "🎨",
    md: "📝", sql: "🗄️", env: "⚙️", yml: "⚙️", yaml: "⚙️",
    toml: "⚙️", txt: "📄", csv: "📊", log: "📄",
    rs: "🦀", go: "🔵",
    svg: "🖼️", png: "🖼️", jpg: "🖼️", jpeg: "🖼️",
    gif: "🖼️", webp: "🖼️", ico: "🖼️", bmp: "🖼️",
  };
  return icons[ext] || "📄";
}

function gitDot(status: string): string {
  const labels: Record<string, string> = {
    untracked: "U",
    modified: "M",
    added: "A",
    deleted: "D",
  };
  const label = labels[status];
  if (!label) return "";
  return `<span class="tree-git-dot" title="${status}">${label}</span>`;
}

// ── Toggle directory ──
async function toggleDir(dirPath: string): Promise<void> {
  // Mark this folder as the active one so the tree highlights it (matches
  // the existing highlight behaviour on file clicks).
  activeDir = dirPath;
  if (expandedDirs.has(dirPath)) {
    expandedDirs.delete(dirPath);
  } else {
    expandedDirs.add(dirPath);
    if (!fileTreeCache.has(dirPath)) {
      await loadFileTree(dirPath);
      return; // renderFileTree is called inside loadFileTree
    }
  }
  renderFileTree();
  persistEditorState();
}

// ── Open file ──
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "svg"];

async function openFile(filePath: string): Promise<void> {
  // Check if already open
  const existing = openFiles.find(f => f.path === filePath);
  if (existing) {
    switchToFile(filePath);
    return;
  }

  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const isImage = IMAGE_EXTENSIONS.includes(ext);

  try {
    // For raster images, don't fetch content — just create a stub entry
    if (isImage && ext !== "svg") {
      const file: OpenFile = {
        path: filePath,
        content: "",
        language: "image",
        dirty: false,
      };
      openFiles.push(file);
      switchToFile(filePath);
      return;
    }

    const data = await api<any>(`/file?path=${encodeURIComponent(filePath)}`);

    const file: OpenFile = {
      path: data.path,
      content: data.content,
      language: data.language === "html" && ext === "svg" ? "svg" : data.language,
      dirty: false,
    };
    openFiles.push(file);
    switchToFile(filePath);
  } catch (e: any) {
    console.error("Failed to open file:", e);
  }
}

// ── Switch to file ──
// Package manager file detection
const PKG_FILES: Record<string, { registry: string; manager: string; label: string }> = {
  "pyproject.toml": { registry: "pypi", manager: "uv/pip", label: "PyPI" },
  "requirements.txt": { registry: "pypi", manager: "pip", label: "PyPI" },
  "composer.json": { registry: "packagist", manager: "composer", label: "Packagist" },
  "Gemfile": { registry: "rubygems", manager: "bundler", label: "RubyGems" },
  "package.json": { registry: "npm", manager: "npm", label: "npm" },
  "Cargo.toml": { registry: "crates", manager: "cargo", label: "crates.io" },
};

function switchToFile(filePath: string): void {
  activeFile = filePath;
  activeDir = null;  // Clear folder highlight so only one item in the tree is emphasised
  renderTabs();
  renderContent();
  renderFileTree(); // Update active highlight
  updateStatusBar();
  persistEditorState();
  updateRightPanel();
}

function updateRightPanel(): void {
  const aiPanel = document.getElementById("editor-ai-panel");
  const depsPanel = document.getElementById("editor-deps-panel");
  if (!aiPanel || !depsPanel) return;

  const fileName = activeFile?.split("/").pop() || "";
  const pkgInfo = PKG_FILES[fileName];

  if (pkgInfo) {
    aiPanel.style.display = "none";
    depsPanel.style.display = "flex";
    const title = document.getElementById("deps-panel-title");
    if (title) title.textContent = `📦 ${pkgInfo.label}`;
    // Parse installed deps from the file
    renderInstalledDeps(pkgInfo);
  } else {
    aiPanel.style.display = "flex";
    depsPanel.style.display = "none";
  }
}

function renderInstalledDeps(pkgInfo: { registry: string; manager: string; label: string }): void {
  const el = document.getElementById("deps-installed");
  if (!el) return;

  const file = openFiles.find(f => f.path === activeFile);
  if (!file) { el.innerHTML = ""; return; }

  const deps: { name: string; version: string }[] = [];

  if (pkgInfo.registry === "pypi" && file.path.endsWith(".toml")) {
    // Parse pyproject.toml dependencies
    const match = file.content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/);
    if (match) {
      const items = match[1].match(/"([^"]+)"/g);
      items?.forEach(item => {
        const clean = item.replace(/"/g, "");
        const parts = clean.split(/[><=~!]+/);
        deps.push({ name: parts[0].trim(), version: clean.slice(parts[0].length).trim() || "*" });
      });
    }
  } else if (pkgInfo.registry === "pypi" && file.path.endsWith(".txt")) {
    file.content.split("\n").forEach(line => {
      const l = line.trim();
      if (!l || l.startsWith("#")) return;
      const parts = l.split(/[><=~!]+/);
      deps.push({ name: parts[0].trim(), version: l.slice(parts[0].length).trim() || "*" });
    });
  } else if (pkgInfo.registry === "npm") {
    try {
      const pkg = JSON.parse(file.content);
      for (const [name, ver] of Object.entries(pkg.dependencies || {})) deps.push({ name, version: ver as string });
      for (const [name, ver] of Object.entries(pkg.devDependencies || {})) deps.push({ name, version: `${ver} (dev)` });
    } catch {}
  } else if (pkgInfo.registry === "packagist") {
    try {
      const pkg = JSON.parse(file.content);
      for (const [name, ver] of Object.entries(pkg.require || {})) deps.push({ name, version: ver as string });
      for (const [name, ver] of Object.entries(pkg["require-dev"] || {})) deps.push({ name, version: `${ver} (dev)` });
    } catch {}
  } else if (pkgInfo.registry === "rubygems") {
    file.content.split("\n").forEach(line => {
      const m = line.match(/gem\s+["']([^"']+)["'](?:\s*,\s*["']([^"']+)["'])?/);
      if (m) deps.push({ name: m[1], version: m[2] || "*" });
    });
  } else if (pkgInfo.registry === "crates") {
    const depsSection = file.content.match(/\[dependencies\]([\s\S]*?)(?:\[|$)/);
    if (depsSection) {
      depsSection[1].split("\n").forEach(line => {
        const m = line.match(/^(\w[\w-]*)\s*=\s*"([^"]+)"/);
        if (m) deps.push({ name: m[1], version: m[2] });
      });
    }
  }

  el.innerHTML = deps.length
    ? deps.map(d => `<div class="deps-installed-item">
        <span>${esc(d.name)}</span>
        <span class="deps-ver">${esc(d.version)}</span>
      </div>`).join("")
    : '<div class="text-sm text-muted" style="padding:8px;text-align:center">No dependencies found</div>';
}

// ── Render tabs ──
function renderTabs(): void {
  const tabsEl = document.getElementById("editor-tabs");
  if (!tabsEl) return;

  tabsEl.innerHTML = openFiles.map(f => {
    const name = f.path.split("/").pop() || f.path;
    const isActive = f.path === activeFile;
    const dirtyDot = f.dirty ? `<span style="color:var(--warn);margin-left:2px">●</span>` : "";
    return `<div class="editor-tab ${isActive ? "active" : ""}"
        onclick="window.__editorSwitchFile('${esc(f.path)}')"
        oncontextmenu="event.preventDefault();window.__editorTabCtxMenu(event,'${esc(f.path)}')">
      <span>${esc(name)}${dirtyDot}</span>
      <span class="editor-tab-close" onclick="event.stopPropagation();window.__editorCloseFile('${esc(f.path)}')">&times;</span>
    </div>`;
  }).join("");
}

// ── Render content (CodeMirror or markdown preview) ──
function renderContent(): void {
  const contentEl = document.getElementById("editor-content");
  if (!contentEl) return;

  const file = openFiles.find(f => f.path === activeFile);
  if (!file) {
    contentEl.innerHTML = `<div class="editor-welcome">
      <h3>Code With Me</h3>
      <p class="text-muted">Select a file from the sidebar to start editing.</p>
    </div>`;
    return;
  }

  contentEl.innerHTML = "";

  const ext = file.path.split(".").pop()?.toLowerCase() || "";
  const isRasterImage = ["png", "jpg", "jpeg", "gif", "webp", "ico", "bmp"].includes(ext);
  const isSvg = ext === "svg";

  if (isRasterImage) {
    // Full image preview — no code editor
    contentEl.innerHTML = `<div class="editor-image-preview">
      <div class="image-preview-toolbar">
        <span class="text-sm text-muted">${esc(file.path)}</span>
        <span class="text-sm text-muted">${file.content.length > 0 ? Math.round(file.content.length / 1024) + " KB" : ""}</span>
      </div>
      <div class="image-preview-container">
        <img id="editor-img-preview" src="/__dev/api/file/raw?path=${encodeURIComponent(file.path)}" alt="${esc(file.path)}" />
      </div>
    </div>`;
  } else if (isSvg) {
    // SVG: code editor + live preview in top-right corner
    contentEl.innerHTML = `<div style="flex:1;display:flex;flex-direction:column;min-height:0;overflow:hidden;position:relative">
      <div id="editor-cm-pane" style="flex:1;overflow:auto"></div>
      <div id="editor-svg-preview" class="editor-svg-float">
        <div class="svg-preview-header">
          <span class="text-sm" style="font-weight:600">Preview</span>
          <button class="btn btn-sm" onclick="document.getElementById('editor-svg-preview').classList.toggle('collapsed')" style="font-size:0.6rem;padding:1px 4px">_</button>
        </div>
        <div class="svg-preview-content" id="svg-preview-content"></div>
      </div>
    </div>`;
    mountCodeMirror(file, document.getElementById("editor-cm-pane")!);
    renderSvgPreview(file.content);
  } else if (file.language === "markdown") {
    // Split view: editor left, preview right
    contentEl.innerHTML = `<div style="display:flex;flex:1;min-height:0;overflow:hidden">
      <div id="editor-cm-pane" style="flex:1;overflow:auto;min-width:0"></div>
      <div style="width:1px;background:var(--border)"></div>
      <div id="editor-md-preview" class="editor-md-preview" style="flex:1;overflow:auto;padding:1rem"></div>
    </div>`;
    mountCodeMirror(file, document.getElementById("editor-cm-pane")!);
    renderMarkdownPreview(file.content);
  } else {
    contentEl.innerHTML = `<div id="editor-cm-pane" style="flex:1;overflow:auto"></div>`;
    mountCodeMirror(file, document.getElementById("editor-cm-pane")!);
  }
}

function renderSvgPreview(content: string): void {
  const el = document.getElementById("svg-preview-content");
  if (!el) return;
  // Sanitize: strip scripts from SVG for safety
  const cleaned = content.replace(/<script[\s\S]*?<\/script>/gi, "");
  el.innerHTML = cleaned;
}

// ── Mount CodeMirror ──
function mountCodeMirror(file: OpenFile, parent: HTMLElement): void {
  // Destroy previous view if any
  if (file.view) {
    file.view.destroy();
    file.view = undefined;
  }

  const saveKeymap = keymap.of([{
    key: "Mod-s",
    run: () => { saveCurrentFile(); return true; },
  }]);

  const updateListener = EditorView.updateListener.of(update => {
    if (update.docChanged) {
      const newContent = update.state.doc.toString();
      file.content = newContent;
      if (!file.dirty) {
        file.dirty = true;
        renderTabs();
      }
      // Live preview updates
      if (file.language === "markdown") {
        renderMarkdownPreview(newContent);
      }
      if (file.path.endsWith(".svg")) {
        renderSvgPreview(newContent);
      }
    }
  });

  const lang = langExtension(file.language);
  // Python wants 4-space indent; everything else gets 2. Using spaces
  // (not tabs) matches what the language-server / linter defaults expect.
  const indent = file.language === "python" ? "    " : "  ";

  const state = EditorState.create({
    doc: file.content,
    extensions: [
      lineNumbers(),
      foldGutter(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      oneDark,
      history(),
      indentUnit.of(indent),
      indentOnInput(),
      bracketMatching(),
      closeBrackets(),
      autocompletion(),
      // Inline ghost-text completion via qwen2.5-coder FIM. The opts
      // callbacks fire on every trigger, so active-plan switches and
      // the status-strip toggle are picked up without rebuilding
      // the editor state. Tab / Esc handling is installed at highest
      // precedence inside the extension so it wins over indentWithTab
      // only when a ghost is present.
      ghostCompletion({
        language: () => file.language,
        path: () => file.path,
        planIntent: () => activeCompletionPlanIntent,
        enabled: () => completionEnabled,
      }),
      saveKeymap,
      // Enter → insertNewlineAndIndent consults the language's indent
      // service, so `def foo():` followed by Enter lands inside the
      // block at the expected column. We put it first so it wins over
      // the plainer Enter binding in defaultKeymap.
      keymap.of([
        { key: "Enter", run: insertNewlineAndIndent },
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...completionKeymap,
        indentWithTab,
        ...searchKeymap,
      ]),
      search(),
      updateListener,
      ...(Array.isArray(lang) ? lang : [lang]),
      EditorView.theme({
        "&": { height: "100%", fontSize: "13px" },
        ".cm-scroller": { overflow: "auto", fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" },
        ".cm-content": { minHeight: "100%" },
      }),
    ],
  });

  file.view = new EditorView({ state, parent });
}

// ── Markdown preview ──
function renderMarkdownPreview(content: string): void {
  const previewEl = document.getElementById("editor-md-preview");
  if (!previewEl) return;

  // Process raw markdown — extract code blocks first, then parse line by line
  const codeBlocks: string[] = [];
  const raw = content.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<pre style="background:#11111b;padding:0.75rem;border-radius:0.375rem;overflow-x:auto;border:1px solid var(--border);margin:0.5rem 0"><code style="font-size:0.8rem;line-height:1.5">${esc(code)}</code></pre>`
    );
    return `\x00CB${idx}\x00`;
  });

  const lines = raw.split("\n");
  const result: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let hasHeaderSep = false;

  function flushTable(): void {
    if (tableRows.length === 0) return;
    let thead = "";
    let tbody = "";
    const startIdx = hasHeaderSep && tableRows.length > 0 ? 0 : -1;

    if (startIdx === 0 && tableRows.length > 1) {
      thead = `<thead><tr>${tableRows[0].map(c => `<th style="padding:6px 10px;border:1px solid var(--border);background:rgba(255,255,255,0.05);font-weight:600;text-align:left">${esc(c)}</th>`).join("")}</tr></thead>`;
      // Skip separator row (index 1), body starts at 2
      const bodyStart = tableRows.length > 2 ? 2 : tableRows.length;
      tbody = tableRows.slice(bodyStart).map(row =>
        `<tr>${row.map(c => `<td style="padding:6px 10px;border:1px solid var(--border)">${inlineMd(c)}</td>`).join("")}</tr>`
      ).join("");
    } else {
      tbody = tableRows.map(row =>
        `<tr>${row.map(c => `<td style="padding:6px 10px;border:1px solid var(--border)">${inlineMd(c)}</td>`).join("")}</tr>`
      ).join("");
    }

    result.push(`<table style="border-collapse:collapse;width:100%;margin:0.5rem 0;font-size:0.85rem">${thead}<tbody>${tbody}</tbody></table>`);
    tableRows = [];
    hasHeaderSep = false;
    inTable = false;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Code block placeholder
    if (trimmed.startsWith("\x00CB")) {
      if (inTable) flushTable();
      result.push(trimmed);
      continue;
    }

    // Table row
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed.slice(1, -1).split("|").map(c => c.trim());
      // Check if separator row (|---|---|)
      if (cells.every(c => /^[-:]+$/.test(c))) {
        hasHeaderSep = true;
        tableRows.push(cells); // keep for counting but skip in render
        inTable = true;
        continue;
      }
      tableRows.push(cells);
      inTable = true;
      continue;
    }

    // End of table
    if (inTable) flushTable();

    // Headers
    if (trimmed.startsWith("#### ")) { result.push(`<h4 style="margin:1.2rem 0 0.4rem;font-size:0.95rem;color:var(--info)">${inlineMd(trimmed.slice(5))}</h4>`); continue; }
    if (trimmed.startsWith("### ")) { result.push(`<h3 style="margin:1.2rem 0 0.4rem;font-size:1.05rem;color:var(--info)">${inlineMd(trimmed.slice(4))}</h3>`); continue; }
    if (trimmed.startsWith("## ")) { result.push(`<h2 style="margin:1.4rem 0 0.5rem;font-size:1.2rem;border-bottom:1px solid var(--border);padding-bottom:0.3rem">${inlineMd(trimmed.slice(3))}</h2>`); continue; }
    if (trimmed.startsWith("# ")) { result.push(`<h1 style="margin:1.5rem 0 0.5rem;font-size:1.5rem;border-bottom:1px solid var(--border);padding-bottom:0.3rem">${inlineMd(trimmed.slice(2))}</h1>`); continue; }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { result.push('<hr style="border:none;border-top:1px solid var(--border);margin:1rem 0">'); continue; }

    // Blockquote
    if (trimmed.startsWith("> ")) { result.push(`<blockquote style="border-left:3px solid var(--info);padding-left:0.75rem;margin:0.3rem 0;color:var(--muted);font-style:italic">${inlineMd(trimmed.slice(2))}</blockquote>`); continue; }

    // Unordered list
    if (/^[-*+] /.test(trimmed)) { result.push(`<div style="padding-left:1.5rem;margin:0.2rem 0">• ${inlineMd(trimmed.slice(2))}</div>`); continue; }

    // Ordered list
    const olMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (olMatch) { result.push(`<div style="padding-left:1.5rem;margin:0.2rem 0">${olMatch[1]}. ${inlineMd(olMatch[2])}</div>`); continue; }

    // Empty line → paragraph break
    if (trimmed === "") { result.push('<div style="height:0.5rem"></div>'); continue; }

    // Normal text
    result.push(`<div style="margin:0.15rem 0">${inlineMd(trimmed)}</div>`);
  }

  if (inTable) flushTable();

  // Restore code blocks
  let html = result.join("\n");
  codeBlocks.forEach((block, i) => {
    html = html.replace(`\x00CB${i}\x00`, block);
  });

  previewEl.innerHTML = `<div class="md-preview-content" style="line-height:1.6;color:var(--text);font-size:0.9rem">${html}</div>`;
}

/** Inline markdown: bold, italic, code, links, images — with HTML escaping */
function inlineMd(text: string): string {
  let t = esc(text);
  // Images
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:0.25rem">');
  // Links
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:var(--info);text-decoration:underline">$1</a>');
  // Bold
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code
  t = t.replace(/`([^`]+)`/g, '<code style="background:#11111b;padding:0.1rem 0.35rem;border-radius:0.2rem;font-size:0.85em;border:1px solid var(--border)">$1</code>');
  return t;
}

// ── Save ──
async function saveCurrentFile(): Promise<void> {
  const file = openFiles.find(f => f.path === activeFile);
  if (!file || !file.dirty) return;

  updateStatusBar("Saving...");

  try {
    await api("/file/save", "POST", { path: file.path, content: file.content });
    file.dirty = false;
    renderTabs();
    updateStatusBar(`Saved ${file.path.split("/").pop()}`);
    setTimeout(() => updateStatusBar(), 2000);
  } catch (e: any) {
    updateStatusBar(`Save failed: ${e.message}`, true);
  }
}

// ── Close file ──
function closeFile(filePath: string): void {
  const file = openFiles.find(f => f.path === filePath);
  if (file?.dirty) {
    if (!confirm(`${filePath} has unsaved changes. Close anyway?`)) return;
  }

  if (file?.view) file.view.destroy();
  openFiles = openFiles.filter(f => f.path !== filePath);

  if (activeFile === filePath) {
    activeFile = openFiles.length > 0 ? openFiles[openFiles.length - 1].path : null;
  }

  renderTabs();
  renderContent();
  renderFileTree();
  persistEditorState();
}

// ── Status bar ──
function updateStatusBar(msg?: string, isError?: boolean): void {
  const bar = document.getElementById("editor-statusbar");
  if (!bar) return;

  const file = openFiles.find(f => f.path === activeFile);
  const langLabel = file ? file.language : "";
  const lineInfo = file?.view ? `Ln ${file.view.state.doc.lineAt(file.view.state.selection.main.head).number}` : "";

  const statusMsg = msg || "Ready";
  const color = isError ? "var(--danger)" : "var(--muted)";

  bar.innerHTML = `
    <span class="text-sm" style="color:${color}">${esc(statusMsg)}</span>
    <div style="display:flex;gap:1rem;align-items:center">
      <span class="text-sm text-muted">${esc(lineInfo)}</span>
      <span class="text-sm text-muted">${esc(langLabel)}</span>
      <span class="text-sm text-muted">UTF-8</span>
    </div>
  `;
}

// ── Pop out ──
function popOut(): void {
  const w = window.open("", "tina4-editor", "width=1400,height=900,menubar=no,toolbar=no,status=no");
  if (!w) return;

  w.document.write(`<!DOCTYPE html>
<html><head>
<title>Tina4 — Code With Me</title>
<style>${getEditorCSS()}</style>
</head><body>
<div id="app" style="height:100vh"></div>
<script type="module">
  // Re-import and render into the new window
  import("${window.location.origin}/@fs/${import.meta.url.replace(/^.*?\/src\//, "src/")}").then(m => {
    // Won't work cross-origin — fallback: redirect
  }).catch(() => {
    document.getElementById("app").innerHTML = '<div style="padding:2rem;color:#cdd6f4"><h2>Code With Me</h2><p>Pop-out editor loading...</p></div>';
    window.location = window.opener.location.origin + "/__dev#editor";
  });
</script>
</body></html>`);
}

// ── Styles ──
function getEditorCSS(): string {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #1e1e2e; color: #cdd6f4; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }

    .editor-layout { display: flex; position: absolute; inset: 0; overflow: hidden; }

    .editor-sidebar { width: 240px; flex-shrink: 0; background: var(--bg, #181825); border-right: 1px solid var(--border, #313244); display: flex; flex-direction: column; overflow: hidden; }
    .editor-sidebar-header { padding: 0.5rem 0.75rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border, #313244); flex-shrink: 0; }
    .editor-file-tree { flex: 1; overflow-y: auto; padding: 0.25rem 0; font-size: 0.8rem; }

    .tree-item { padding: 3px 8px; cursor: pointer; display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; user-select: none; }
    .tree-item:hover { background: rgba(255,255,255,0.05); }
    .tree-item.active { background: var(--info, #89b4fa); color: #1e1e2e; }
    .tree-arrow { width: 12px; text-align: center; font-size: 0.7rem; flex-shrink: 0; }
    .tree-icon { font-size: 0.75rem; flex-shrink: 0; }
    .tree-name { overflow: hidden; text-overflow: ellipsis; }

    /* Git status colours */
    .git-untracked .tree-name { color: #a6e3a1; }
    .git-untracked .tree-git-dot { color: #a6e3a1; }
    .git-modified .tree-name { color: #89b4fa; }
    .git-modified .tree-git-dot { color: #89b4fa; }
    .git-added .tree-name { color: #a6e3a1; font-weight: 600; }
    .git-added .tree-git-dot { color: #a6e3a1; }
    .git-deleted .tree-name { color: #f38ba8; text-decoration: line-through; }
    .git-deleted .tree-git-dot { color: #f38ba8; }
    .git-clean .tree-git-dot { display: none; }
    .tree-git-dot { font-size: 0.6rem; flex-shrink: 0; margin-left: auto; }
    .tree-item.active .tree-name { color: #1e1e2e; }
    .tree-item.active .tree-git-dot { color: #1e1e2e; }

    /* Folders get a subtler highlight than the currently-open file:
       a translucent tint of the same accent, and the text keeps its
       original colour. Files still get the solid bright background
       because the open file is the primary focus. These rules come
       after .tree-item.active so they win by source order for tree-dir. */
    .tree-dir.active { background: rgba(137, 180, 250, 0.18); color: inherit; }
    .tree-dir.active .tree-name { color: inherit; }
    .tree-dir.active .tree-git-dot { color: inherit; }

    .editor-main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }

    .editor-tabs { display: flex; background: var(--bg, #181825); border-bottom: 1px solid var(--border, #313244); overflow-x: auto; flex-shrink: 0; min-height: 32px; }
    .editor-tab { padding: 6px 12px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 6px; border-right: 1px solid var(--border, #313244); white-space: nowrap; user-select: none; flex-shrink: 0; }
    .editor-tab:hover { background: rgba(255,255,255,0.05); }
    .editor-tab.active { background: var(--surface, #1e1e2e); border-bottom: 2px solid var(--info, #89b4fa); }
    .editor-tab-close { font-size: 14px; opacity: 0.4; line-height: 1; }
    .editor-tab-close:hover { opacity: 1; color: var(--danger, #f38ba8); }

    .editor-content { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
    .editor-welcome { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; opacity: 0.5; }

    .editor-statusbar { display: flex; justify-content: space-between; padding: 4px 12px; background: var(--bg, #181825); border-top: 1px solid var(--border, #313244); font-size: 0.7rem; flex-shrink: 0; }

    .editor-md-preview { background: var(--surface, #1e1e2e); }
    .md-preview-content img { max-width: 100%; }
    .md-preview-content table { border-collapse: collapse; }

    /* Image preview */
    .editor-image-preview { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
    .image-preview-toolbar { display: flex; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid var(--border, #313244); flex-shrink: 0; }
    .image-preview-container { flex: 1; display: flex; align-items: center; justify-content: center; overflow: auto; padding: 1rem; background: repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%, transparent 0% 50%) 50% / 20px 20px; }
    .image-preview-container img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px; box-shadow: 0 2px 12px rgba(0,0,0,0.3); }

    /* SVG floating preview */
    .editor-svg-float { position: absolute; top: 8px; right: 8px; width: 240px; background: var(--surface, #313244); border: 1px solid var(--border, #45475a); border-radius: 0.5rem; box-shadow: 0 4px 16px rgba(0,0,0,0.4); z-index: 10; overflow: hidden; }
    .editor-svg-float.collapsed .svg-preview-content { display: none; }
    .svg-preview-header { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; border-bottom: 1px solid var(--border, #313244); }
    .svg-preview-content { padding: 8px; background: repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%, transparent 0% 50%) 50% / 16px 16px; max-height: 200px; overflow: auto; display: flex; align-items: center; justify-content: center; }
    .svg-preview-content svg { max-width: 100%; max-height: 180px; }

    /* Scaffold toolbar */
    .editor-scaffold-bar { border-top: 1px solid var(--border, #313244); padding: 0.5rem; flex-shrink: 0; }
    .scaffold-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted, #6c7086); margin-bottom: 4px; }
    .scaffold-buttons { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 4px; }
    .scaffold-btn { font-size: 0.65rem; padding: 3px 6px; background: var(--surface, #313244); border: 1px solid var(--border, #45475a); border-radius: 3px; color: var(--text, #cdd6f4); cursor: pointer; white-space: nowrap; }
    .scaffold-btn:hover { background: rgba(255,255,255,0.08); }
    .scaffold-btn.scaffold-run { color: var(--success, #a6e3a1); border-color: var(--success, #a6e3a1); }
    .scaffold-btn.scaffold-run:hover { background: rgba(166,227,161,0.1); }
    .scaffold-sep { height: 1px; background: var(--border, #313244); margin: 4px 0; }
    .scaffold-output { font-size: 0.7rem; max-height: 120px; overflow-y: auto; background: #11111b; border-radius: 3px; padding: 6px; margin-top: 4px; font-family: monospace; white-space: pre-wrap; }

    /* Context menu */
    .editor-ctx-menu { background: var(--surface, #313244); border: 1px solid var(--border, #45475a); border-radius: 0.375rem; padding: 4px 0; min-width: 180px; box-shadow: 0 4px 16px rgba(0,0,0,0.5); }
    .ctx-item { padding: 6px 12px; cursor: pointer; font-size: 0.8rem; display: flex; justify-content: space-between; align-items: center; }
    .ctx-item:hover { background: rgba(255,255,255,0.08); }
    .ctx-item.ctx-danger:hover { background: rgba(243,139,168,0.15); color: #f38ba8; }
    .ctx-shortcut { font-size: 0.65rem; color: var(--muted, #6c7086); margin-left: 1rem; }
    .ctx-sep { height: 1px; background: var(--border, #313244); margin: 4px 0; }

    /* Menu dropdown */
    .editor-menu-dropdown { position: absolute; top: 100%; left: 0; background: var(--surface, #313244); border: 1px solid var(--border, #313244); border-radius: 0.375rem; padding: 4px 0; min-width: 160px; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.4); }
    .editor-menu-item { padding: 6px 12px; cursor: pointer; font-size: 0.8rem; white-space: nowrap; }
    .editor-menu-item:hover { background: rgba(255,255,255,0.08); }

    /* Right panel (AI / Dependencies) */
    .editor-right-panel { width: 280px; flex-shrink: 0; background: var(--bg, #181825); border-left: 1px solid var(--border, #313244); display: flex; flex-direction: column; overflow: hidden; }
    .editor-right-panel.collapsed { width: 0; min-width: 0; border-left: none; }

    /* Column splitters — thin draggable dividers between the sidebar,
       the editor, and the right panel. 4px wide so they stay out of
       the way; hover and active states widen the visible rule for
       feedback without reflowing the layout. */
    .editor-splitter { flex: 0 0 4px; cursor: col-resize; background: transparent; position: relative; z-index: 5; user-select: none; }
    .editor-splitter:hover { background: var(--info, #89b4fa); opacity: 0.5; }
    .editor-splitter.dragging { background: var(--info, #89b4fa); opacity: 0.9; }
    .editor-right-panel.collapsed + * /* noop — scope-safe CSS */ { }

    /* Tab context menu (right-click on a tab for close-left/right/all). */
    .tab-ctx-menu { position: fixed; z-index: 10000; min-width: 180px; background: var(--bg, #181825); border: 1px solid var(--border, #313244); border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); padding: 4px; font-size: 0.8rem; }
    .tab-ctx-item { padding: 6px 10px; cursor: pointer; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .tab-ctx-item:hover { background: rgba(255,255,255,0.08); }
    .tab-ctx-item.disabled { opacity: 0.35; cursor: not-allowed; }
    .tab-ctx-item.disabled:hover { background: transparent; }
    .tab-ctx-sep { height: 1px; background: var(--border, #313244); margin: 4px 0; }
    .tab-ctx-shortcut { color: var(--muted, #64748b); font-size: 0.7rem; }
    .right-panel-view { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }

    /* Dependency panel */
    .deps-results { font-size: 0.8rem; }
    .deps-item { padding: 6px 8px; border-bottom: 1px solid var(--border, #313244); cursor: default; }
    .deps-item:hover { background: rgba(255,255,255,0.03); }
    .deps-item-name { font-weight: 600; color: var(--info, #89b4fa); font-size: 0.8rem; }
    .deps-item-desc { font-size: 0.7rem; color: var(--muted, #6c7086); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .deps-item-meta { font-size: 0.65rem; color: var(--muted, #6c7086); margin-top: 3px; display: flex; justify-content: space-between; align-items: center; }
    .deps-installed-item { padding: 4px 8px; font-size: 0.75rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.03); }
    .deps-installed-item:hover { background: rgba(255,255,255,0.03); }
    .deps-ver { color: var(--muted, #6c7086); font-size: 0.65rem; }
    .editor-ai-header { padding: 0.5rem 0.75rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border, #313244); flex-shrink: 0; }
    .editor-ai-messages { flex: 1; overflow-y: auto; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem; }

    /* ── Session panel restructure ─────────────────────────────
       The right-panel is now organised around a session (one
       supervisor-owned unit of work) rather than a chat log.
       Zones, top to bottom:
         1. status strip  — title, plan, health, mode
         2. tab bar       — Activity / Plan / Thoughts / Diff / Checks
         3. tab body      — one panel visible, rest hidden
         4. activity strip — collapsed current-turn indicator
         5. action bar    — input + Send/Revise/Apply/Cancel
       The Activity tab hosts the existing #editor-ai-messages
       container so legacy chat rendering keeps working untouched
       while the rest of the panel rebuilds around it. */

    .session-strip { flex-shrink: 0; border-bottom: 1px solid var(--border, #313244); padding: 0.4rem 0.5rem 0.3rem; display: flex; flex-direction: column; gap: 0.25rem; }
    .session-strip-row { display: flex; align-items: center; gap: 0.4rem; min-width: 0; }
    .session-title-row { justify-content: space-between; }
    .session-title-wrap { display: flex; flex-direction: column; min-width: 0; flex: 1; line-height: 1.15; }
    .session-title { font-size: 0.78rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .session-meta { font-size: 0.65rem; opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .session-meta:empty { display: none; }
    .session-collapse-btn { font-size: 0.6rem; padding: 2px 6px; flex-shrink: 0; }
    .session-plan-row { font-size: 0.68rem; opacity: 0.85; min-height: 0; }
    .session-plan-row:empty, .session-plan-indicator:empty { display: none; }
    .session-plan-indicator { min-width: 0; overflow: hidden; display: inline-flex; align-items: center; gap: 0.4rem; flex: 1; }

    /* Health row — tiny dots per service. Grey = unknown, green = up,
       red = down. Flex-end so the mode toggle tucks to the right. */
    .session-health-row { gap: 0.3rem; }
    .session-health-label { font-size: 0.6rem; opacity: 0.45; text-transform: uppercase; letter-spacing: 0.04em; margin-right: 0.15rem; }
    .model-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--muted, #64748b); display: inline-block; flex-shrink: 0; transition: background 0.2s; position: relative; }
    .model-dot.up   { background: var(--success, #a6e3a1); }
    .model-dot.down { background: var(--danger,  #f38ba8); }
    .model-dot:hover { outline: 1px solid rgba(255,255,255,0.2); outline-offset: 2px; }

    /* Mode toggle — segmented pair. Only one active at a time; the
       inactive is subdued so the eye lands on the current mode. */
    .session-mode-toggle { margin-left: auto; display: inline-flex; border: 1px solid var(--border, #313244); border-radius: 4px; overflow: hidden; flex-shrink: 0; }
    .session-mode-toggle .mode-btn { background: transparent; border: none; color: var(--muted, #9399b2); font-size: 0.62rem; padding: 2px 7px; cursor: pointer; letter-spacing: 0.01em; }
    .session-mode-toggle .mode-btn:hover { background: rgba(255,255,255,0.04); color: var(--text, #cdd6f4); }
    .session-mode-toggle .mode-btn.active { background: var(--info, #89b4fa); color: #1e1e2e; font-weight: 600; }

    /* Completion toggle — small ⚡ button next to the mode toggle.
       Three visual states: on-plan (primary color), off-plan (dimmed
       with an off-plan dot), disabled (strike-through). Click to
       flip enabled/disabled; hover tooltip carries the full status. */
    .completion-toggle { background: transparent; border: 1px solid var(--border, #313244); color: var(--warning, #f9e2af); font-size: 0.62rem; padding: 2px 6px; border-radius: 4px; cursor: pointer; line-height: 1; flex-shrink: 0; }
    .completion-toggle:hover { background: rgba(249,226,175,0.08); }
    .completion-toggle.on-plan { color: var(--info, #89b4fa); border-color: rgba(137,180,250,0.35); background: rgba(137,180,250,0.08); }
    .completion-toggle.off-plan { color: var(--muted, #9399b2); border-color: var(--border, #313244); }
    .completion-toggle.disabled { color: var(--muted, #9399b2); opacity: 0.5; text-decoration: line-through; }

    /* Tab bar — flat, underline on active. Kept terse; each tab is
       a single word so they all fit at 280px panel width. */
    .session-tabs { display: flex; flex-shrink: 0; border-bottom: 1px solid var(--border, #313244); background: transparent; }
    .session-tab { flex: 1; background: transparent; border: none; color: var(--muted, #9399b2); padding: 6px 4px; font-size: 0.7rem; cursor: pointer; border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s; position: relative; white-space: nowrap; }
    .session-tab:hover { color: var(--text, #cdd6f4); }
    .session-tab.active { color: var(--text, #cdd6f4); border-bottom-color: var(--info, #89b4fa); }
    .tab-badge { display: inline-block; min-width: 14px; padding: 0 4px; margin-left: 4px; background: var(--surface, #313244); color: var(--text, #cdd6f4); border-radius: 7px; font-size: 0.6rem; line-height: 14px; vertical-align: baseline; }
    .tab-badge:empty { display: none; }
    .session-tab.has-alert .tab-badge { background: var(--warning, #f9e2af); color: #1e1e2e; }

    /* Tab bodies — flex column, one visible at a time. Each panel
       owns its own scroll so switching tabs doesn't reset position. */
    .session-tab-body { flex: 1; min-height: 0; position: relative; display: flex; flex-direction: column; }
    .session-tab-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow-y: auto; }
    .session-tab-panel[hidden] { display: none; }

    /* Panel empty-state pattern — consistent shape across Plan /
       Thoughts / Diff / Checks. Vertically centered, terse body,
       optional action buttons. */
    .panel-empty { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 1rem 0.75rem; text-align: center; gap: 0.4rem; color: var(--muted, #9399b2); }
    .panel-empty-title { font-size: 0.78rem; font-weight: 600; color: var(--text, #cdd6f4); }
    .panel-empty-body { font-size: 0.7rem; line-height: 1.4; max-width: 240px; }
    .panel-empty-actions { display: flex; gap: 0.35rem; margin-top: 0.4rem; }
    .panel-empty-actions .btn { font-size: 0.68rem; padding: 3px 10px; }
    .panel-content { flex: 1; overflow-y: auto; padding: 0.5rem; }

    /* Activity strip above the input — shows who's currently working
       on this turn. Hidden when idle to avoid visual noise. */
    .session-activity-strip { flex-shrink: 0; display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.6rem; font-size: 0.66rem; border-top: 1px solid var(--border, #313244); background: rgba(137,180,250,0.06); color: var(--muted, #9399b2); }
    .session-activity-strip .activity-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--info, #89b4fa); animation: session-pulse 1.1s ease-in-out infinite; flex-shrink: 0; }
    .session-activity-strip .activity-text { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    @keyframes session-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

    /* Action row under the input — Send on the left (primary),
       secondary action on the right (Revise/Apply/Cancel appear
       only once a session has a proposal staged). */
    .session-action-row { display: flex; gap: 4px; margin-top: 4px; align-items: center; }
    .session-action-row .btn { font-size: 0.68rem; padding: 3px 9px; }
    .session-action-row .session-btn-send { flex: 0 0 auto; min-width: 58px; }
    .session-action-row .action-spacer { flex: 1; }
    .session-action-row .btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .session-input { width: 100%; box-sizing: border-box; display: block; resize: vertical; font-size: 0.8rem; min-height: 36px; }

    /* Tweaks to the existing chat styles now that they live inside a
       tab panel — the Activity panel has its own padding so the list
       container can sit flush. */
    .session-tab-panel[data-panel="activity"] .editor-ai-messages { padding: 0.5rem; }

    /* Decision chips — inline quick-action buttons the supervisor
       can emit alongside a question ("commit now or keep going?").
       One click beats typing the answer. Chips share a row, wrap
       to a new line when they overflow. */
    .activity-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; margin: 0.3rem 0 0.2rem; align-items: center; }
    .activity-chips-prompt { font-size: 0.72rem; line-height: 1.4; color: var(--text, #cdd6f4); flex-basis: 100%; margin-bottom: 0.2rem; }
    .activity-chip { background: rgba(137,180,250,0.1); border: 1px solid rgba(137,180,250,0.35); color: var(--text, #cdd6f4); padding: 3px 10px; border-radius: 12px; font-size: 0.68rem; cursor: pointer; transition: background 0.15s, border-color 0.15s, opacity 0.15s; line-height: 1.3; }
    .activity-chip:hover { background: rgba(137,180,250,0.22); border-color: var(--info, #89b4fa); }
    .activity-chip.primary { background: var(--info, #89b4fa); color: #1e1e2e; border-color: transparent; font-weight: 600; }
    .activity-chip.primary:hover { background: #b4befe; }
    .activity-chip.subdued { opacity: 0.65; }
    .activity-chip.subdued:hover { opacity: 1; }
    .activity-chip.spent { opacity: 0.35; pointer-events: none; text-decoration: line-through; }

    /* Outcome line — the "✓ src/x.py — added Y" summary that
       replaces code-block dumps in the Activity stream. Clicking
       jumps to the Diff tab for that commit (later slice). */
    .activity-outcome { display: flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.5rem; font-size: 0.72rem; border-left: 2px solid var(--success, #a6e3a1); background: rgba(166,227,161,0.06); border-radius: 0 3px 3px 0; cursor: pointer; }
    .activity-outcome:hover { background: rgba(166,227,161,0.12); }
    .activity-outcome .outcome-icon { color: var(--success, #a6e3a1); flex-shrink: 0; }
    .activity-outcome .outcome-path { font-family: "SF Mono", Menlo, monospace; font-size: 0.68rem; color: var(--info, #89b4fa); }
    .activity-outcome .outcome-note { color: var(--muted, #9399b2); font-size: 0.68rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }
    .activity-outcome.failed { border-left-color: var(--danger, #f38ba8); background: rgba(243,139,168,0.08); }
    .activity-outcome.failed .outcome-icon { color: var(--danger, #f38ba8); }

    /* Session summary strip at the top of Activity — "3 files · 5 commits"
       collapsed view of cumulative session state. */
    .session-summary-strip { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.5rem; font-size: 0.66rem; border-bottom: 1px solid var(--border, #313244); background: rgba(255,255,255,0.02); color: var(--muted, #9399b2); flex-shrink: 0; }
    .session-summary-strip:empty, .session-summary-strip[hidden] { display: none; }
    .session-summary-strip .summary-chip { display: inline-flex; align-items: center; gap: 0.2rem; }
    .session-summary-strip .summary-chip strong { color: var(--text, #cdd6f4); font-weight: 600; }
    .session-summary-strip .summary-spacer { flex: 1; }
    .session-summary-strip .summary-toggle { background: transparent; border: none; color: var(--info, #89b4fa); cursor: pointer; font-size: 0.65rem; padding: 0; }
    .session-summary-strip .summary-toggle:hover { text-decoration: underline; }

    /* Thoughts tab toolbar — small header with count + "Clear all".
       Shown only when there's something to clear. The clear button
       carries warning color so it reads as a power-action, not a
       casual secondary action. */
    .thoughts-toolbar { display: flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.5rem; font-size: 0.66rem; border-bottom: 1px solid var(--border, #313244); color: var(--muted, #9399b2); flex-shrink: 0; }
    .thoughts-toolbar[hidden] { display: none; }
    .thoughts-toolbar-count { color: var(--text, #cdd6f4); font-weight: 500; }
    .thoughts-toolbar-spacer { flex: 1; }
    .thoughts-toolbar-clear { font-size: 0.65rem; padding: 2px 8px; color: var(--warning, #f9e2af); border-color: rgba(249,226,175,0.35); }
    .thoughts-toolbar-clear:hover { background: rgba(249,226,175,0.1); }

    /* ── Diff tab content ─────────────────────────────────────── */
    .diff-summary { font-size: 0.7rem; padding: 0.3rem 0.5rem; border-bottom: 1px solid var(--border, #313244); color: var(--muted, #9399b2); }
    .diff-summary strong { color: var(--text, #cdd6f4); font-weight: 600; }
    .diff-summary .diff-sha { font-family: "SF Mono", Menlo, monospace; opacity: 0.55; }

    /* File list — one row per changed file, clickable to jump into
       the editor, status dot + additions/deletions on the right. */
    .diff-files { padding: 0.3rem 0; }
    .diff-file-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.5rem; cursor: pointer; border-left: 2px solid transparent; font-size: 0.72rem; }
    .diff-file-row:hover { background: rgba(255,255,255,0.03); border-left-color: var(--info, #89b4fa); }
    .diff-file-status { width: 16px; text-align: center; font-family: "SF Mono", Menlo, monospace; font-size: 0.65rem; font-weight: 700; flex-shrink: 0; }
    .diff-file-status.s-A { color: var(--success, #a6e3a1); }
    .diff-file-status.s-M { color: var(--info, #89b4fa); }
    .diff-file-status.s-D { color: var(--danger, #f38ba8); }
    .diff-file-status.s-R { color: var(--warning, #f9e2af); }
    .diff-file-path { flex: 1; font-family: "SF Mono", Menlo, monospace; font-size: 0.68rem; color: var(--text, #cdd6f4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
    .diff-file-stats { flex-shrink: 0; font-family: "SF Mono", Menlo, monospace; font-size: 0.65rem; display: flex; gap: 0.3rem; }
    .diff-file-stats .add { color: var(--success, #a6e3a1); }
    .diff-file-stats .del { color: var(--danger, #f38ba8); }
    .diff-file-warn { color: var(--warning, #f9e2af); font-size: 0.7rem; flex-shrink: 0; }

    /* Warnings block — RAG-backed convention/risk/info flags, grouped
       by path, with reference link when available. Rendered below the
       file list so the user scans "what changed" first and "what might
       be wrong" second. */
    .diff-warnings { margin-top: 0.3rem; padding: 0.3rem 0.5rem; }
    .diff-warnings:empty { display: none; }
    .diff-warnings-header { font-size: 0.66rem; font-weight: 600; color: var(--warning, #f9e2af); margin-bottom: 0.3rem; display: flex; align-items: center; gap: 0.3rem; }
    .diff-warning-item { border-left: 2px solid var(--warning, #f9e2af); padding: 0.35rem 0.5rem; margin-bottom: 0.3rem; background: rgba(249,226,175,0.04); border-radius: 0 3px 3px 0; font-size: 0.72rem; line-height: 1.4; }
    .diff-warning-item.risk { border-left-color: var(--danger, #f38ba8); background: rgba(243,139,168,0.05); }
    .diff-warning-item.info { border-left-color: var(--info, #89b4fa); background: rgba(137,180,250,0.04); }
    .diff-warning-path { font-family: "SF Mono", Menlo, monospace; font-size: 0.65rem; color: var(--muted, #9399b2); margin-bottom: 0.2rem; }
    .diff-warning-kind { text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.6rem; font-weight: 700; margin-right: 0.3rem; color: var(--warning, #f9e2af); }
    .diff-warning-item.risk .diff-warning-kind { color: var(--danger, #f38ba8); }
    .diff-warning-item.info .diff-warning-kind { color: var(--info, #89b4fa); }
    .diff-warning-msg { color: var(--text, #cdd6f4); }
    .diff-warning-ref { font-size: 0.65rem; color: var(--muted, #9399b2); margin-top: 0.25rem; font-style: italic; }
    .diff-warning-ref a { color: var(--info, #89b4fa); text-decoration: none; }
    .diff-warning-ref a:hover { text-decoration: underline; }

    /* Commit log at the bottom — terse. Each row: short sha + subject
       + trailer summary. Clicking could open the git commit view in a
       later slice; for now it's informational. */
    .diff-commits { padding: 0.3rem 0.5rem; border-top: 1px solid var(--border, #313244); margin-top: 0.3rem; }
    .diff-commits:empty { border-top: none; margin-top: 0; }
    .diff-commits-header { font-size: 0.66rem; font-weight: 600; color: var(--muted, #9399b2); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.3rem; }
    .diff-commit-row { display: flex; gap: 0.4rem; padding: 0.2rem 0; font-size: 0.68rem; align-items: baseline; }
    .diff-commit-sha { font-family: "SF Mono", Menlo, monospace; font-size: 0.62rem; color: var(--muted, #9399b2); flex-shrink: 0; width: 50px; }
    .diff-commit-subject { flex: 1; color: var(--text, #cdd6f4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .diff-commit-agent { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--info, #89b4fa); flex-shrink: 0; }

    /* AI code-block toolbar — every fenced block in an AI reply gets one */
    .ai-codeblock { margin: 0.5rem 0; border: 1px solid var(--border, #313244); border-radius: 6px; overflow: hidden; background: #11111b; }
    .ai-codeblock-bar { display: flex; justify-content: space-between; align-items: center; padding: 4px 8px; background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--border, #313244); font-size: 0.7rem; }
    .ai-codeblock-lang { color: var(--muted, #9399b2); font-family: "SF Mono", Menlo, monospace; transition: color 0.2s; }
    .ai-codeblock-actions { display: flex; gap: 4px; }
    .ai-codeblock-btn { background: transparent; border: 1px solid var(--border, #313244); color: var(--text, #cdd6f4); padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer; transition: background 0.15s; }
    .ai-codeblock-btn:hover:not(:disabled) { background: rgba(255,255,255,0.08); }
    .ai-codeblock-btn.ai-codeblock-apply { background: var(--info, #89b4fa); color: #1e1e2e; border-color: transparent; font-weight: 600; }
    .ai-codeblock-btn.ai-codeblock-apply:hover:not(:disabled) { background: #b4befe; }
    .ai-codeblock-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .ai-codeblock pre { margin: 0; padding: 8px 10px; overflow-x: auto; font-size: 0.75rem; line-height: 1.45; background: transparent; }
    .ai-codeblock code { background: transparent; padding: 0; }

    /* Collapsed auto-apply acknowledgement — inline, understated. Just
       the path + tiny "view" link. No panel border. */
    .ai-codeblock-collapsed { border: none; background: transparent; margin: 0.15rem 0; display: block; font-size: 0.72rem; }
    .ai-codeblock-collapsed .ai-codeblock-bar { border: none; background: transparent; padding: 0; gap: 0.4rem; justify-content: flex-start; }
    .ai-codeblock-collapsed .ai-codeblock-lang { display: inline-flex; align-items: center; gap: 0.25rem; color: var(--muted,#9399b2); }
    .ai-codeblock-collapsed .ai-codeblock-lang code { color: var(--text,#cdd6f4); opacity: 0.85; }
    .ai-codeblock-collapsed .ai-codeblock-btn { border: none; padding: 0; font-size: 0.7rem; color: var(--info,#89b4fa); text-decoration: underline; background: transparent; }
    .ai-codeblock-collapsed .ai-codeblock-btn:hover { background: transparent; opacity: 0.8; }
    .ai-codeblock-collapsed pre { border-top: 1px solid var(--border,#313244); margin-top: 0.35rem; background: #11111b; border-radius: 4px; }
    .editor-ai-input-area { padding: 0.5rem; border-top: 1px solid var(--border, #313244); flex-shrink: 0; }
    /* Thoughts banner — the Rust supervisor's proactive observations.
       One chip per thought; click body to ask the AI about it, × to dismiss. */
    .editor-thoughts-banner { border-top: 1px solid var(--border,#313244); padding: 0.4rem 0.5rem; max-height: 140px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.3rem; flex-shrink: 0; }
    .editor-thought-chip { font-size: 0.7rem; background: rgba(249,226,175,0.08); border-left: 2px solid var(--warning,#f9e2af); padding: 0.35rem 0.5rem; border-radius: 3px; display: flex; gap: 0.4rem; align-items: flex-start; }
    .editor-thought-chip-body { flex: 1; cursor: pointer; line-height: 1.35; }
    .editor-thought-chip-body:hover { text-decoration: underline; text-decoration-style: dotted; }
    .editor-thought-chip-close { background: transparent; border: none; color: var(--muted,#9399b2); cursor: pointer; font-size: 0.85rem; padding: 0 0.25rem; line-height: 1; }
    .editor-thought-chip-close:hover { color: var(--text,#cdd6f4); }

    .ai-msg { padding: 0.5rem 0.75rem; border-radius: 0.375rem; font-size: 0.8rem; line-height: 1.5; word-wrap: break-word; }
    .ai-msg.ai-user { background: var(--info, #89b4fa); color: #1e1e2e; align-self: flex-end; max-width: 90%; }
    .ai-msg.ai-bot { background: var(--surface, #313244); color: var(--text, #cdd6f4); max-width: 95%; }
    .ai-msg pre { background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 0.25rem; margin: 0.375rem 0; overflow-x: auto; font-size: 0.75rem; }
    .ai-msg code { font-size: 0.75rem; }

    .ai-diff { margin: 0.375rem 0; padding: 0.5rem; background: rgba(0,0,0,0.3); border-radius: 0.25rem; font-family: monospace; font-size: 0.7rem; }
    .ai-diff-add { color: #a6e3a1; }
    .ai-diff-del { color: #f38ba8; text-decoration: line-through; }

    .ai-actions { display: flex; gap: 4px; margin-top: 0.375rem; }
    .ai-actions .btn { font-size: 0.65rem; padding: 2px 8px; }
  `;
}

function addEditorStyles(): void {
  if (document.getElementById("tina4-editor-styles")) return;
  const style = document.createElement("style");
  style.id = "tina4-editor-styles";
  style.textContent = getEditorCSS();
  document.head.appendChild(style);
}

// ── AI Assistant ──
let aiPanelCollapsed = false;

function toggleAI(): void {
  aiPanelCollapsed = !aiPanelCollapsed;
  const panel = document.getElementById("editor-right-panel");
  if (panel) panel.classList.toggle("collapsed", aiPanelCollapsed);
}

function addAIMessage(html: string, role: "user" | "bot"): void {
  const container = document.getElementById("editor-ai-messages");
  if (!container) return;
  const div = document.createElement("div");
  div.className = `ai-msg ai-${role}`;
  div.innerHTML = html;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function getSelectedText(): string {
  const file = openFiles.find(f => f.path === activeFile);
  if (!file?.view) return "";
  const sel = file.view.state.selection.main;
  return file.view.state.sliceDoc(sel.from, sel.to);
}

// ── Inline completion state ─────────────────────────────────────
//
// Two small module-level values that the ghost-completion extension
// reaches through its opts callbacks. Keeping them here (not inside
// the extension) lets the rest of the editor toggle completion and
// swap the active plan intent without rebuilding editor state.

let completionEnabled: boolean = (() => {
  // Persisted toggle so reloading preserves "I turned ghost text off."
  // Default to enabled — users who don't want it can flick it off.
  const v = localStorage.getItem("tina4.editor.completion.enabled");
  return v !== "false";
})();

/** Last-known active plan step intent, refreshed whenever the plan
 *  indicator updates. Null means off-plan — completions still fire
 *  but without the intent boost in the FIM prompt. */
let activeCompletionPlanIntent: string | null = null;

// Conversation history for the chat panel. We keep it per page-load
// rather than per file — matches what users expect from a chat UI.
const chatHistory: ChatMessage[] = [];

/** In-flight request so a new Send cancels a still-streaming response. */
let chatAbort: AbortController | null = null;

/** Fetch the current plan and format it for the system prompt.
 *  Returns null when no plan is active — the AI should behave
 *  normally in that case. On every turn we also refresh the header
 *  indicator so "active plan" status stays visible. */
async function getCurrentPlan(): Promise<string | null> {
  const r = await callMcpTool("plan_current", {});
  const result = (r.ok && (r as any).result) || null;
  renderPlanIndicator(result);
  if (!result || !result.current) return null;
  const title = result.title || result.current;
  const goal = result.goal ? `Goal: ${result.goal}` : "";
  const progress = `${result.progress?.done ?? 0}/${result.progress?.total ?? 0}`;
  const steps = (result.steps || []).map((s: any) =>
    `  ${s.done ? "[x]" : "[ ]"} ${s.index}. ${s.text}`,
  ).join("\n");
  const next = result.next_step
    ? `\nNEXT STEP: #${result.next_step.index} — ${result.next_step.text}`
    : "\nAll steps complete. Consider plan_archive or ask the user what's next.";
  // Execution ledger summary — files this plan has already touched.
  // Injected so the AI doesn't re-create work (e.g. emitting a second
  // migration for the same table or re-writing an already-saved model).
  const exec = result.execution || {};
  const execLines: string[] = [];
  if ((exec.migrations || []).length) execLines.push(`  migrations: ${exec.migrations.join(", ")}`);
  if ((exec.created || []).length)    execLines.push(`  created:    ${exec.created.join(", ")}`);
  if ((exec.patched || []).length)    execLines.push(`  patched:    ${exec.patched.join(", ")}`);
  const execBlock = execLines.length
    ? ["", "ALREADY TOUCHED BY THIS PLAN (do not recreate — edit with file_patch instead):", ...execLines]
    : [];

  return [
    "CURRENT PLAN — you are executing this. Cross off steps as you finish them.",
    `File: plan/${result.current}  ·  Title: ${title}  ·  Progress: ${progress}`,
    goal,
    "",
    "Steps:",
    steps || "  (no steps defined)",
    next,
    ...execBlock,
    "",
    "When a step is done, CALL plan_complete_step(index) in the SAME turn — don't batch ticks for the end. If the user's request falls outside this plan, either add a step (plan_add_step) or ask whether to switch plans. Check the 'already touched' list before creating new files — edit existing ones.",
  ].filter(Boolean).join("\n");
}

/** Small status strip in the AI header showing the active plan +
 *  a ▶ Run button that hands execution to the Rust supervisor agent.
 *  Clicking the text opens the plan switcher; clicking ▶ runs it. */
function renderPlanIndicator(plan: any): void {
  const host = document.getElementById("editor-plan-indicator");
  // Cache the current step intent for the completion extension. First
  // pending step (or the plan title if steps aren't surfaced) is
  // what we feed into the FIM prompt.
  if (plan && plan.current) {
    const firstPending = Array.isArray(plan.steps)
      ? plan.steps.find((s: any) => s && !s.done)
      : null;
    activeCompletionPlanIntent = (firstPending?.text || plan.title || plan.current) || null;
  } else {
    activeCompletionPlanIntent = null;
  }
  refreshCompletionIndicator();
  if (!host) return;
  if (!plan || !plan.current) {
    host.innerHTML = `<span style="opacity:0.55;font-size:0.7rem;cursor:pointer" onclick="window.__editorPlanSwitcher()" title="No active plan — click to create one">📋 no plan</span>`;
    return;
  }
  const done = plan.progress?.done ?? 0;
  const total = plan.progress?.total ?? 0;
  const remaining = total - done;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  // ▶ disabled when there's nothing left to do. Running against a
  // finished plan just streams "all done" — noise, not an error.
  const runDisabled = remaining <= 0;
  host.innerHTML = `
    <span style="font-size:0.7rem;display:inline-flex;align-items:center;gap:0.3rem">
      <span style="cursor:pointer;display:inline-flex;align-items:center;gap:0.25rem" onclick="window.__editorPlanSwitcher()" title="Click to switch plans">
        <span>📋</span>
        <span style="font-weight:600;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(plan.title || plan.current)}</span>
        <span style="opacity:0.6">${done}/${total}${pct ? ` · ${pct}%` : ""}</span>
      </span>
      <button class="btn btn-sm" onclick="window.__editorPlanRun('${esc(plan.current)}')" ${runDisabled ? "disabled" : ""} title="Hand this plan to the Rust supervisor and let it execute remaining steps" style="font-size:0.65rem;padding:1px 6px;line-height:1;${runDisabled ? "opacity:0.35;cursor:not-allowed" : ""}">▶</button>
    </span>`;
}

/** Abort controller for any in-flight /execute stream so clicking ▶
 *  again or switching plans cancels the previous run cleanly. */
let planRunAbort: AbortController | null = null;

async function runCurrentPlan(planFile: string): Promise<void> {
  planRunAbort?.abort();
  planRunAbort = new AbortController();

  const messages = document.getElementById("editor-ai-messages");
  if (!messages) return;

  // Header bubble — identifies the run as supervisor-driven, not chat.
  const header = document.createElement("div");
  header.className = "ai-msg ai-bot";
  header.style.cssText = "padding:0.4rem 0.6rem;font-size:0.72rem;border-left:2px solid var(--info,#89b4fa);background:rgba(137,180,250,0.08)";
  header.innerHTML = `▶ <strong>Executing plan</strong> <code>plan/${esc(planFile)}</code> via Rust supervisor… <button class="btn btn-sm" onclick="window.__editorPlanStop()" style="font-size:0.6rem;padding:1px 6px;margin-left:0.5rem">Stop</button>`;
  messages.appendChild(header);

  // Status line that updates as events arrive (replaced, not appended)
  const status = document.createElement("div");
  status.className = "ai-msg ai-bot";
  status.style.cssText = "padding:0.35rem 0.6rem;font-size:0.7rem;opacity:0.8;font-family:var(--font-mono,monospace)";
  status.textContent = "starting…";
  messages.appendChild(status);

  const files: string[] = [];
  try {
    await streamExecute(`plan/${planFile}`, (ev: AgentEvent) => {
      if (ev.event === "status") {
        status.textContent = `[${ev.agent || "…"}] ${ev.text || ""}`;
      } else if (ev.event === "message") {
        const msg = document.createElement("div");
        msg.className = "ai-msg ai-bot";
        msg.style.cssText = "padding:0.45rem 0.6rem;font-size:0.75rem";
        // Keep the prose content simple — the supervisor's messages
        // are already formatted ("**Step 2 of 5:** …"). Minimal
        // markdown: bold + newlines.
        const text = (ev.content || "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>");
        msg.innerHTML = text;
        messages.appendChild(msg);
        if (ev.files_changed?.length) files.push(...ev.files_changed);
      } else if (ev.event === "error") {
        status.textContent = `✗ ${ev.text || "agent error"}`;
        status.style.color = "var(--danger,#f38ba8)";
      }
      messages.scrollTop = messages.scrollHeight;
    }, { signal: planRunAbort.signal });
    status.textContent = files.length
      ? `✓ done — ${files.length} file${files.length === 1 ? "" : "s"} touched`
      : "✓ done";
    status.style.color = "var(--success,#a6e3a1)";
    // Refresh tree + plan indicator — the supervisor probably wrote files
    // and ticked boxes. Mtime-based index pass keeps everything current.
    await loadFileTree(".");
    const p = await callMcpTool("plan_current", {});
    renderPlanIndicator((p.ok && (p as any).result) || null);
  } catch (e: any) {
    if (e?.name === "AbortError") {
      status.textContent = "⏹ stopped by user";
    } else {
      status.textContent = `✗ ${e?.message || e}`;
      status.style.color = "var(--danger,#f38ba8)";
    }
  } finally {
    planRunAbort = null;
  }
}

function stopPlanRun(): void {
  planRunAbort?.abort();
}

// ── Thoughts banner — the Rust supervisor's proactive observations ──
//
// GET /thoughts returns a list of "hey, I noticed X" items. We show
// them as small chips above the chat input. Click the body to pipe
// the thought into the chat as a user message; click × to dismiss
// it server-side (falls back to client-side hide if the endpoint
// doesn't implement delete).

// The Rust thought engine generates fresh IDs every cycle even for
// the same observation ("missing .env.example" comes back every run).
// Dismissing by ID alone means the chip re-appears next poll with a
// different ID. We dedupe AND remember by a content hash persisted
// to localStorage so page reloads don't resurrect dismissed chips.

const LS_DISMISSED_THOUGHTS = "tina4.editor.dismissedThoughts";

function loadDismissedHashes(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_DISMISSED_THOUGHTS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveDismissedHashes(hashes: Set<string>): void {
  // Cap at 200 to bound localStorage usage — older thoughts age out.
  const capped = Array.from(hashes).slice(-200);
  try { localStorage.setItem(LS_DISMISSED_THOUGHTS, JSON.stringify(capped)); } catch { /* quota */ }
}

/** Stable-ish content key for a thought — used to dedupe paraphrased
 *  versions of the same observation.
 *
 *  The old implementation normalised the first 120 characters of the
 *  message. That worked for exact-prefix restatements but failed on
 *  paraphrases the thought engine actually emits, e.g.
 *     "Hey team, I noticed we have a `.env` file but no `.env.example`…"
 *     "Hey there! I noticed the project has a .env file but no .env.example…"
 *  Both are the *same* claim; both produce different prefix hashes.
 *
 *  This version extracts the content-bearing tokens (alphanumeric + the
 *  period-connected filenames like `.env.example`), drops a small
 *  stopword list (chatty AI openers + generic filler), sorts the unique
 *  set, and keys on the top N tokens. The two sample thoughts above
 *  now collapse to the same key. */
const THOUGHT_STOPWORDS = new Set([
  "hey", "hi", "hello", "there", "team", "folks", "everyone",
  "i", "we", "you", "they", "our", "us", "my", "your", "their",
  "noticed", "notice", "saw", "see", "spotted", "found", "thought",
  "that", "this", "these", "those", "it", "its",
  "the", "a", "an", "and", "or", "but", "for", "of", "to", "in", "on", "at", "with", "as", "by", "from",
  "have", "has", "had", "having", "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "does", "done",
  "can", "could", "should", "would", "will", "may", "might", "must",
  "so", "just", "even", "still", "also", "too", "not", "no", "yes",
  "project", "projects", "file", "files",
  "new", "old", "make", "makes", "made", "making",
  "know", "knows", "knew", "known",
  "tricky", "bit", "exactly", "some", "any", "all", "each", "every",
  "what", "which", "why", "how", "when", "where", "who",
  "if", "then", "else", "than", "because",
  "set", "up", "down", "over", "under", "out", "into", "onto",
  "developer", "developers", "dev", "devs", "user", "users",
  "environment", "env",  // too generic — the actual value is ".env.example", not the word "env"
]);

function hashThought(message: string): string {
  // Keep period-connected filenames intact (`.env.example`, `app.py`, etc.)
  // and slash-connected paths intact (`src/routes/contact.py`). Everything
  // else splits on whitespace and non-identifier punctuation.
  const tokens = (message || "")
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[._\-/]+|[._\-/]+$/g, "")) // strip edge punctuation
    .filter((w) => w.length > 1);

  // Period-containing tokens (".env.example", "app.py", "src/routes/auth.py")
  // are the actual subjects of a thought; the surrounding prose is phrasing
  // that drifts wildly across restatements. If any identifier-shaped tokens
  // are present, key *only* on them — two thoughts about ".env.example"
  // hash the same regardless of whether one says "vars are needed" and the
  // other says "developers won't get up and running."
  const identifiers = tokens.filter((t) => t.includes(".") || t.includes("/"));
  if (identifiers.length) {
    return Array.from(new Set(identifiers)).sort().slice(0, 6).join("|");
  }

  // Fallback: no filenames mentioned. Hash on the content words after a
  // stopword filter. Less reliable than the identifier path but better
  // than prefix matching, and covers generic observations like "tests
  // are slow" or "missing type hints in the model layer."
  const content = tokens.filter((t) => t.length > 2 && !THOUGHT_STOPWORDS.has(t));
  const unique = Array.from(new Set(content)).sort();
  return unique.slice(0, 4).join("|");
}

async function loadThoughtsBanner(): Promise<void> {
  const banner = document.getElementById("editor-thoughts-banner");
  const emptyState = document.getElementById("thoughts-empty-state");
  const toolbar = document.getElementById("thoughts-toolbar");
  const toolbarCount = document.getElementById("thoughts-toolbar-count");
  if (!banner) return;
  let thoughts: Thought[] = [];
  try {
    thoughts = await listThoughts();
  } catch {
    thoughts = [];
  }
  const dismissed = loadDismissedHashes();
  // Dedupe by content hash — show each unique observation once even
  // if the engine emits it under three different IDs, and collapse
  // paraphrased restatements of the same claim (see hashThought).
  const seen = new Set<string>();
  const unique: Thought[] = [];
  for (const t of thoughts) {
    const h = hashThought(t.message);
    if (dismissed.has(h) || seen.has(h)) continue;
    seen.add(h);
    unique.push(t);
  }
  // Badge the Thoughts tab with the undismissed count so the user
  // knows there's something to look at without opening the tab.
  setTabBadge("thoughts", unique.length || null, unique.length > 0);
  if (!unique.length) {
    banner.style.display = "none";
    banner.innerHTML = "";
    if (emptyState) emptyState.style.display = "";
    if (toolbar) toolbar.setAttribute("hidden", "");
    return;
  }
  if (emptyState) emptyState.style.display = "none";
  if (toolbar) {
    toolbar.removeAttribute("hidden");
    if (toolbarCount) toolbarCount.textContent = `${unique.length} observation${unique.length === 1 ? "" : "s"}`;
  }
  banner.style.display = "flex";
  // Unlike the banner-era cap of ONE chip, the Thoughts tab can show
  // the whole list — the user explicitly navigated here to see them,
  // so we're no longer competing with the main chat for attention.
  banner.innerHTML = unique.slice(0, 20).map((t) => {
    const msg = (t.message || "").slice(0, 180);
    return `
      <div class="editor-thought-chip" data-id="${esc(t.id)}" data-hash="${esc(hashThought(t.message))}">
        <span style="opacity:0.7">💡</span>
        <div class="editor-thought-chip-body" onclick="window.__editorThoughtAct('${esc(t.id)}')">${esc(msg)}${t.message.length > 180 ? "…" : ""}</div>
        <button class="editor-thought-chip-close" title="Dismiss (remembered across reloads)" onclick="window.__editorThoughtDismiss('${esc(t.id)}')">×</button>
      </div>
    `;
  }).join("");
}

/** Turn a thought into the next chat prompt — gives the user a one-
 *  click "yes, do something about this" path. */
async function actOnThought(id: string): Promise<void> {
  const chip = document.querySelector<HTMLElement>(`.editor-thought-chip[data-id="${CSS.escape(id)}"] .editor-thought-chip-body`);
  const message = chip?.textContent?.trim() || "";
  const input = document.getElementById("editor-ai-input") as HTMLTextAreaElement | null;
  if (input && message) {
    input.value = message;
    await aiSend();
  }
  await dismissThoughtChip(id);
}

/** Nuke every currently-visible thought. Used when the engine floods
 *  the panel with restated or false-positive observations — one click
 *  beats dismissing them one at a time. Each current hash is added to
 *  the persistent dismissed set so restarts don't resurrect them; the
 *  server is asked to drop each id as a best-effort. */
async function clearAllThoughts(): Promise<void> {
  const chips = Array.from(document.querySelectorAll<HTMLElement>(".editor-thought-chip"));
  if (!chips.length) return;
  const dismissed = loadDismissedHashes();
  const ids: string[] = [];
  for (const chip of chips) {
    const h = chip.dataset.hash;
    const id = chip.dataset.id;
    if (h) dismissed.add(h);
    if (id) ids.push(id);
  }
  saveDismissedHashes(dismissed);
  // Fire-and-forget server-side dismiss for each id. We don't await
  // the lot — the panel already hid them locally and the hash is in
  // the dismiss set, so even if the server requests fail the user's
  // experience is correct.
  for (const id of ids) {
    dismissThought(id).catch(() => { /* best-effort */ });
  }
  await loadThoughtsBanner();
}

async function dismissThoughtChip(id: string): Promise<void> {
  // Remember by content hash so regenerated thoughts with the same
  // essence but a fresh ID stay dismissed across polls / reloads.
  const chip = document.querySelector<HTMLElement>(`.editor-thought-chip[data-id="${CSS.escape(id)}"]`);
  const hash = chip?.dataset.hash;
  if (hash) {
    const dismissed = loadDismissedHashes();
    dismissed.add(hash);
    saveDismissedHashes(dismissed);
  }
  try { await dismissThought(id); } catch { /* best-effort server-side dismiss */ }
  await loadThoughtsBanner();
}

/** Modal picker to switch/create plans. Small, no-dependencies. */
async function openPlanSwitcher(): Promise<void> {
  document.getElementById("editor-plan-modal")?.remove();
  const r = await callMcpTool("plan_list", {});
  const plans: any[] = (r.ok && (r as any).result) || [];
  const wrap = document.createElement("div");
  wrap.id = "editor-plan-modal";
  wrap.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999";
  wrap.innerHTML = `
    <div style="background:var(--bg-elev,#1e1e2e);border:1px solid var(--border,#313244);border-radius:8px;padding:1.25rem;width:min(480px,92vw);max-height:80vh;overflow:auto;color:var(--text,#cdd6f4)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
        <h3 style="margin:0;font-size:1rem">📋 Plans</h3>
        <button class="btn btn-sm" onclick="document.getElementById('editor-plan-modal').remove()" style="font-size:0.75rem">✕</button>
      </div>
      <p style="font-size:0.7rem;opacity:0.6;margin:0 0 0.75rem">Stored as markdown in <code>plan/</code>. The AI sees the active plan every turn.</p>
      <div style="display:flex;flex-direction:column;gap:0.25rem;margin-bottom:1rem">
        ${plans.length === 0 ? '<div style="font-size:0.8rem;opacity:0.6;padding:0.5rem">No plans yet. Create one below.</div>' : ""}
        ${plans.map((p) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:0.4rem 0.6rem;border:1px solid var(--border,#313244);border-radius:4px;${p.is_current ? "background:rgba(137,180,250,0.12);border-color:var(--info,#89b4fa)" : ""}">
            <div style="flex:1;min-width:0">
              <div style="font-size:0.8rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.is_current ? "▸ " : ""}${esc(p.title || p.name)}</div>
              <div style="font-size:0.65rem;opacity:0.6">${p.steps_done}/${p.steps_total} steps · ${esc(p.name)}</div>
            </div>
            <div style="display:flex;gap:0.25rem">
              ${p.is_current ? "" : `<button class="btn btn-sm" onclick="window.__editorPlanSwitch('${esc(p.name)}')" style="font-size:0.65rem">Activate</button>`}
              <button class="btn btn-sm" onclick="window.__editorPlanOpen('${esc(p.name)}')" style="font-size:0.65rem" title="Open in editor">Open</button>
            </div>
          </div>
        `).join("")}
      </div>
      <hr style="border:none;border-top:1px solid var(--border,#313244);margin:0.75rem 0">
      <div style="display:flex;flex-direction:column;gap:0.4rem">
        <input id="plan-new-title" class="input" placeholder="New plan title (e.g. 'Implement contact form')" style="font-size:0.8rem">
        <textarea id="plan-new-goal" class="input" placeholder="Goal (optional, one line)" rows="2" style="font-size:0.8rem;resize:vertical"></textarea>
        <div style="display:flex;gap:0.25rem;justify-content:flex-end">
          <button class="btn btn-sm btn-primary" onclick="window.__editorPlanCreate()" style="font-size:0.75rem">Create & activate</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
}

async function switchPlan(name: string): Promise<void> {
  await callMcpTool("plan_switch_to", { name });
  document.getElementById("editor-plan-modal")?.remove();
  const plan = await callMcpTool("plan_current", {});
  renderPlanIndicator((plan.ok && (plan as any).result) || null);
  updateStatusBar(`Active plan: ${name}`);
}

async function openPlanFile(name: string): Promise<void> {
  document.getElementById("editor-plan-modal")?.remove();
  await openFile(`plan/${name}`);
}

async function createPlanFromModal(): Promise<void> {
  const titleEl = document.getElementById("plan-new-title") as HTMLInputElement | null;
  const goalEl = document.getElementById("plan-new-goal") as HTMLTextAreaElement | null;
  const title = titleEl?.value?.trim() || "";
  const goal = goalEl?.value?.trim() || "";
  if (!title) {
    // Surface the validation error instead of silently doing nothing.
    if (titleEl) {
      titleEl.style.borderColor = "var(--danger,#f38ba8)";
      titleEl.placeholder = "Title is required";
      titleEl.focus();
    }
    return;
  }
  const r = await callMcpTool("plan_create", { title, goal, steps: [], make_current: true });
  // MCP returns {ok:true, result:{ok:true,...}} on success or
  // {ok:false,error:"..."} on transport error. The inner .ok=false
  // happens when the plan name collides.
  const result: any = (r as any).result;
  if (!r.ok || !result?.ok) {
    const msg = result?.error || (r as any).error || "Plan creation failed";
    alert(msg); // cheap but visible — beats a silent no-op
    return;
  }
  document.getElementById("editor-plan-modal")?.remove();
  const plan = await callMcpTool("plan_current", {});
  renderPlanIndicator((plan.ok && (plan as any).result) || null);
  await loadFileTree(".");
  updateStatusBar(`Plan created: ${title}`);
}

/** MCP tool registry. Cached briefly (10s) so rapid-fire chat turns
 *  don't hammer the backend, but short enough that newly-registered
 *  user-app \`@mcp_tool\` handlers show up in the next turn without a
 *  page reload. */
let _mcpTools: McpTool[] | null = null;
let _mcpToolsAt = 0;
const MCP_TOOLS_TTL_MS = 10_000;
async function getMcpTools(): Promise<McpTool[]> {
  if (_mcpTools && Date.now() - _mcpToolsAt < MCP_TOOLS_TTL_MS) return _mcpTools;
  _mcpTools = await listMcpTools();
  _mcpToolsAt = Date.now();
  return _mcpTools;
}

/** Cap on tool-call rounds per user turn so a broken model can't loop
 *  forever. 4 was too tight for Claude on multi-file work (it easily
 *  wants 6–10 rounds for "implement the plan"); 20 gives head-room
 *  without letting a stuck model run all day. */
const MAX_TOOL_ROUNDS = 20;

async function aiSend(): Promise<void> {
  const input = document.getElementById("editor-ai-input") as HTMLTextAreaElement;
  const msg = input?.value?.trim();
  if (!msg) return;
  input.value = "";

  // Cancel any in-flight streaming response from a previous Send
  chatAbort?.abort();
  chatAbort = new AbortController();

  addAIMessage(esc(msg), "user");

  // Every turn rebuilds the system message from the CURRENT active file
  // + selection. Otherwise the model keeps answering from whatever file
  // was open when the conversation started, and the user wonders why
  // swapping tabs doesn't change its answers.
  //
  // We keep user/assistant turns intact, drop the old system message,
  // and prepend a fresh one reflecting editor state right now.
  const file = openFiles.find((f) => f.path === activeFile);
  const selection = getSelectedText();
  while (chatHistory.length && chatHistory[0].role === "system") chatHistory.shift();

  // MCP tools are available — fetch registry so we can announce them to the
  // model. Fire-and-forget cache means subsequent turns don't re-hit the server.
  const tools = await getMcpTools();
  // Pull the current plan so the model keeps working toward the same
  // goal across chat turns instead of starting fresh every time.
  const plan = await getCurrentPlan();

  const rules = [
    "You are a coding assistant embedded in the Tina4 editor.",
    "Rules:",
    "- Be direct and concise. No pleasantries, no 'how can I help' filler.",
    "- NEVER repeat the file's contents back to the user — they can see it.",
    "- NEVER describe what a file 'contains' — jump straight to the answer.",
    "- NEVER end with 'is there anything else…' or similar prompts.",
    "- When suggesting code changes, output ONLY the new/changed code in a fenced block, with a comment on line 1 showing the target path, e.g. `// src/routes/home.ts`.",
    "- For multi-step changes, number them. One fenced block per step.",
    "- If the user asks for an explanation, give it in ≤3 short paragraphs.",
    "- Answers must be about the CURRENT active file shown below. If the user asks about a different file, say so.",
    "- Prefer calling tools (database_query, file_read, route_list, etc.) to *verify* facts before answering. Do NOT guess table names, file contents, or routes when a tool call can confirm them.",
    "- INVESTIGATE, DON'T INTERROGATE. You have file_read, index_search, index_file, docs_search, route_list, orm_describe, file_list, database_tables, and 25+ more tools. Before asking the user 'what's in app.py?' or 'where is X?' — just call the tool. Asking for information you can fetch yourself in one tool call wastes the user's time and makes you look lazy.",
    "  • User says 'add an sqlite database'? Call index_file('app.py') or file_read('app.py'), see what's there, then file_patch/file_write the Database(...) line in. Don't ask for confirmation.",
    "  • User refers to a filename without a path ('app.py', 'home.py', 'users.twig')? Try the obvious locations first (./app.py, src/routes/home.py, src/templates/users.twig) via index_search or file_read. Only ask if you genuinely can't find it.",
    "  • User says 'add it under data' or similar ambiguous phrasing? Interpret reasonably based on context — 'under data' for an sqlite DB means the .db file lives in ./data/, not that you edit something in a data/ directory. Make the sensible call and proceed; if wrong, the user will correct you in the next turn.",
    "- DEFAULT TO THE ACTIVE FILE. The currently-open file in the editor is shown to you every turn (look for 'Active file:' in this prompt). When the user gives an edit instruction without naming a file — 'remove the placeholders', 'add a docstring', 'rename this function', 'make it public', 'add noauth' — they mean the active file. Operate on it. Do NOT ask 'which file?' when there's one right in front of you. Only ask when no file is active OR when the instruction mentions a different filename explicitly.",
    "  • Example: active file is src/routes/ping.py, user says 'remove noauth' → file_patch ping.py to strip every @noauth() decorator. Don't ask; there's only one possible target.",
    "  • Example: active file is .env, user says 'add a comment at the top' → file_patch .env. Don't ask.",
    "- EDITING FILES — critical rules:",
    "  • NEVER claim to have changed a file unless you actually emitted a ```tool_call``` for `file_write` or `file_patch` in the SAME turn and got back a `tool_result`. Saying 'Added X' or 'Updated Y' without a real tool call is a lie. If you didn't call a tool, you didn't change anything — say what you'd change and ask the user to confirm instead.",
    "  • For small/targeted changes to an EXISTING file: use `file_patch` with a minimal unique `old_string` and the replacement `new_string`. Never reach for file_write when file_patch can do the job.",
    "  • Only use `file_write` when (a) creating a brand-new file, or (b) rewriting a file wholesale. In both cases the `content` argument MUST be the COMPLETE file contents — every line, top to bottom. Emitting a fragment deletes the rest of the file.",
    "  • Before file_write on an existing file, call `file_read` first and include every line in your replacement. Never guess what was there.",
    "  • If the change is a single snippet (one function, one block, one fragment), that is a file_patch, not a file_write.",
    "- Response shape for an edit request:",
    "  1. Emit the tool_call block(s) (file_patch or file_write).",
    "  2. Wait for the tool_result.",
    "  3. THEN respond with ONE short sentence acknowledging what you did. Example: user asks 'add css to file' → after a successful file_patch → you reply 'Added CSS to src/templates/index.html.' That's it. Do NOT repeat the changed code — the editor already shows it.",
    "  If the tool_result shows an error, explain what went wrong and retry. Never pretend the edit succeeded.",
    "- ANNOUNCING IS NOT DOING. If you write 'Implementing step 2: POST /api/contact route.' and don't emit a tool_call block, you've done NOTHING. The user will see a warning chip. Either emit the tool_call in the same turn, or don't announce — every sentence describing work must be backed by a matching tool_call you already emitted above it. 'I will add X' is forbidden phrasing; your ONLY options are (a) emit a tool_call and follow with 'Added X.' or (b) ask a clarifying question. Never promise future work.",
    "- BATCH tool calls when a request implies multiple edits (e.g. 'remove all placeholders', 'rename variable everywhere', 'add X to every field'). Emit every ```tool_call``` block in a SINGLE response — they run in parallel. Doing one patch per turn is slow and fills the chat with noise. Only fall back to sequential calls when a later edit genuinely depends on an earlier result.",
    '- Worked example. User: "add placeholders to the form" on a 3-input HTML file. CORRECT response (all three patches in ONE turn):',
    "  ```tool_call",
    '  {"name":"file_patch","arguments":{"path":"src/templates/index.html","old_string":"id=\\"name\\" name=\\"name\\" required","new_string":"id=\\"name\\" name=\\"name\\" required placeholder=\\"Full name\\""}}',
    "  ```",
    "  ```tool_call",
    '  {"name":"file_patch","arguments":{"path":"src/templates/index.html","old_string":"id=\\"last_name\\" name=\\"last_name\\" required","new_string":"id=\\"last_name\\" name=\\"last_name\\" required placeholder=\\"Last name\\""}}',
    "  ```",
    "  ```tool_call",
    '  {"name":"file_patch","arguments":{"path":"src/templates/index.html","old_string":"id=\\"email\\" name=\\"email\\" required","new_string":"id=\\"email\\" name=\\"email\\" required placeholder=\\"you@example.com\\""}}',
    "  ```",
    "  WRONG: emitting just one tool_call and saying 'Added a placeholder to the name field'. That's one out of three — the user asked for all of them.",
  ];
  let sys = rules.join("\n");
  // Tina4 framework cheat-sheet — makes the model write idiomatic
  // @get/@post routes, use response() not response.json(), pull from
  // built-ins instead of reinventing queues/auth/HTTP, etc. Injected
  // once per turn so it's always in scope.
  sys += "\n\n" + TINA4_CONTEXT;
  if (tools.length) {
    sys += "\n\n" + formatToolsForPrompt(tools);
  }
  if (plan) {
    sys += "\n\n" + plan;
  }
  if (file) {
    sys += `\n\n---\nActive file: ${file.path} (${file.language})\n\`\`\`${file.language}\n${file.content}\n\`\`\``;
  } else {
    sys += "\n\n---\n(No file is currently open in the editor.)";
  }
  if (selection) {
    sys += `\n\nUser's current selection:\n\`\`\`${file?.language || ""}\n${selection}\n\`\`\``;
  }
  chatHistory.unshift({ role: "system", content: sys });

  chatHistory.push({ role: "user", content: msg });

  // Live bubble — we mutate its innerHTML as each token arrives
  const container = document.getElementById("editor-ai-messages");
  if (!container) return;
  const bubble = document.createElement("div");
  bubble.className = "ai-msg ai-bot";
  bubble.innerHTML = '<span style="opacity:0.6">Thinking…</span>';
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;

  try {
    let currentBubble = bubble;
    let round = 0;
    // Track whether the model has called a tool anywhere in this user
    // turn. The hallucination detector uses this so the final
    // acknowledgement round ("Removed the placeholder…") doesn't get
    // falsely flagged — a tool *did* fire, just in an earlier round.
    let toolsRanThisTurn = false;
    while (round < MAX_TOOL_ROUNDS) {
      const final = await aiChat(chatHistory, {
        signal: chatAbort.signal,
        onToken: (_tok, accumulated) => {
          currentBubble.textContent = accumulated;
          container.scrollTop = container.scrollHeight;
        },
      });
      chatHistory.push({ role: "assistant", content: final });
      const formatted = formatAIResponse(final);
      if (!formatted.trim()) {
        // The assistant emitted only tool_call blocks (common on
        // intermediate rounds). Rendering an empty bubble just
        // creates a grey gap between the compact tool-result rows.
        // Drop it; the tool-result bubble that follows is the
        // visible record of what happened.
        currentBubble.remove();
      } else {
        currentBubble.innerHTML = formatted;
      }
      // Auto-apply any code block where the AI named an explicit file
      // path on line 1 — that's the model saying "write this here",
      // and requiring a click for that is just friction.
      autoApplyBlocksIn(currentBubble);
      // Safety net: if the assistant *claims* to have changed a file
      // but didn't actually emit a tool_call anywhere in this user
      // turn, call out the lie. Small models sometimes skip the tool
      // and just narrate. We look at the whole turn (not just the
      // current round) so the step-3 acknowledgement after a real
      // tool call doesn't get falsely flagged.
      const callsThisRound = parseToolCalls(final, new Set((await getMcpTools()).map((t) => t.name))).length;
      if (callsThisRound > 0) toolsRanThisTurn = true;
      flagHallucinatedEditsIn(currentBubble, final, toolsRanThisTurn);

      // If the assistant emitted ```tool_call``` blocks, execute them and
      // feed the results back as a user turn so the model can continue
      // reasoning. Stop when no more tool calls are emitted — that's the
      // model's signal that it's done.
      const calls = parseToolCalls(final, new Set((await getMcpTools()).map((t) => t.name)));
      if (!calls.length) break;

      // One compact bubble for the whole round. Each tool_call becomes
      // a single line inside it; identical lines (same tool + same
      // touched path) collapse into `… ×N`. Read-only tool output
      // (database_query, file_read, …) still gets its own <details>.
      const roundBubble = document.createElement("div");
      roundBubble.className = "ai-msg ai-bot";
      roundBubble.style.cssText = "padding:0.35rem 0.6rem;font-size:0.72rem;display:flex;flex-direction:column;gap:0.15rem";
      container.appendChild(roundBubble);
      container.scrollTop = container.scrollHeight;

      const results: string[] = [];
      const lineKeys: string[] = []; // in-order dedupe keys
      const linesByKey = new Map<string, { count: number; html: string }>();

      for (const c of calls) {
        // Safety guard — see guardFileWrite.
        const guard = await guardFileWrite(c.name, c.arguments);
        const r = guard ?? await callMcpTool(c.name, c.arguments);
        const formatted = r.ok
          ? (typeof r.result === "string" ? r.result : JSON.stringify(r.result, null, 2))
          : `ERROR: ${r.error || "tool call failed"}`;
        const truncated = formatted.length > 4000 ? formatted.slice(0, 4000) + "\n…(truncated)" : formatted;
        const touched = r.ok ? extractTouchedPath(c.name, c.arguments, (r as any).result) : "";
        if (touched) await refreshAfterToolMutation(touched);

        let lineHtml: string;
        let key: string;
        if (!r.ok) {
          key = `err:${c.name}:${r.error}`;
          lineHtml = `<div style="color:var(--danger,#f38ba8)">✗ <code>${esc(c.name)}</code> — ${esc((r.error || "").slice(0, 120))}</div>`;
        } else if (touched) {
          key = `ok:${c.name}:${touched}`;
          lineHtml = `<div style="color:var(--success,#a6e3a1)">✓ <code>${esc(c.name)}</code> → <code>${esc(touched)}</code></div>`;
        } else {
          // Read-only tool: keep the payload accessible as details.
          key = `read:${c.name}:${Math.random()}`; // never dedupe read results
          lineHtml = `<details><summary style="cursor:pointer;list-style:none;opacity:0.85">🔧 <code>${esc(c.name)}</code></summary><pre style="margin:0.2rem 0 0;white-space:pre-wrap;font-size:0.7rem;max-height:200px;overflow:auto">${esc(truncated)}</pre></details>`;
        }
        const existing = linesByKey.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          linesByKey.set(key, { count: 1, html: lineHtml });
          lineKeys.push(key);
        }
        results.push(`\`\`\`tool_result name=${c.name}\n${truncated}\n\`\`\``);
      }

      roundBubble.innerHTML = lineKeys.map((k) => {
        const { count, html } = linesByKey.get(k)!;
        return count > 1
          ? html.replace(/<\/(div|summary)>/, ` <span style="opacity:0.55">×${count}</span></$1>`)
          : html;
      }).join("");

      chatHistory.push({ role: "user", content: results.join("\n\n") });

      // Prepare a fresh bubble for the model's follow-up
      currentBubble = document.createElement("div");
      currentBubble.className = "ai-msg ai-bot";
      currentBubble.innerHTML = '<span style="opacity:0.6">Thinking…</span>';
      container.appendChild(currentBubble);
      container.scrollTop = container.scrollHeight;
      round++;
    }
    if (round >= MAX_TOOL_ROUNDS) {
      const warn = document.createElement("div");
      warn.className = "ai-msg ai-bot";
      warn.innerHTML = `<span style="color:var(--warning,#f9e2af);opacity:0.8">⚠ Reached ${MAX_TOOL_ROUNDS} tool-call rounds — stopping. Ask again to continue.</span>`;
      container.appendChild(warn);
    }
  } catch (e: any) {
    if (e?.name === "AbortError") {
      bubble.innerHTML = '<span style="opacity:0.5">cancelled</span>';
    } else {
      bubble.innerHTML = `<span style="color:var(--danger)">Connection failed: ${esc(String(e?.message || e))}</span>`;
      // Roll back the user turn so retrying doesn't duplicate it
      chatHistory.pop();
    }
  } finally {
    chatAbort = null;
  }
}

function aiExplain(): void {
  const sel = getSelectedText();
  const input = document.getElementById("editor-ai-input") as HTMLTextAreaElement;
  if (sel && input) {
    input.value = `Explain this code:\n\`\`\`\n${sel}\n\`\`\``;
    aiSend();
  } else if (input) {
    input.value = "Explain what this file does";
    aiSend();
  }
}

function aiRefactor(): void {
  const sel = getSelectedText();
  const input = document.getElementById("editor-ai-input") as HTMLTextAreaElement;
  if (sel && input) {
    input.value = `Suggest improvements for this code:\n\`\`\`\n${sel}\n\`\`\``;
    aiSend();
  } else if (input) {
    input.value = "Suggest improvements for this file";
    aiSend();
  }
}

// ── Session panel wiring (tabs / mode / health / chips / outcomes) ─
//
// Slice 1: the right-hand panel was restructured around a supervisor
// session. Model configuration is no longer user-facing — the five
// services on andrevanzuydam.com are hardcoded (see src/ai.ts MODELS).
// These helpers own the static UI surface and stash a little state
// in localStorage so switches survive a reload.

const LS_SESSION_MODE = "tina4.editor.session.mode";
const LS_ACTIVE_TAB   = "tina4.editor.session.tab";
type SessionMode = "supervisor" | "qa";
type SessionTab  = "activity" | "plan" | "thoughts" | "diff" | "checks";

function getSessionMode(): SessionMode {
  const v = localStorage.getItem(LS_SESSION_MODE);
  return v === "qa" ? "qa" : "supervisor";
}

function setSessionMode(mode: SessionMode): void {
  localStorage.setItem(LS_SESSION_MODE, mode);
  applySessionModeToDOM(mode);
}

function applySessionModeToDOM(mode: SessionMode): void {
  const wrap = document.getElementById("session-mode-toggle");
  if (!wrap) return;
  wrap.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });
  // Update the input placeholder so the user knows what Send will do.
  // Supervisor = work-producing; Q&A = read-only dialogue.
  const input = document.getElementById("editor-ai-input") as HTMLTextAreaElement | null;
  if (input) {
    input.placeholder = mode === "qa"
      ? "Ask a question — Q&A mode won't write files."
      : "Describe the change (supervisor will propose a plan if none is active)...";
  }
}

/** Switch the visible tab, persist the choice, clear alert badges that
 *  make sense to clear on view (e.g. "5 new thoughts" disappears once
 *  you actually look at them). */
function switchTab(tab: SessionTab): void {
  localStorage.setItem(LS_ACTIVE_TAB, tab);
  document.querySelectorAll<HTMLButtonElement>(".session-tab").forEach((btn) => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle("active", active);
    if (active) btn.classList.remove("has-alert");
  });
  document.querySelectorAll<HTMLElement>(".session-tab-panel").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tab;
  });
  // Tab-entry side-effects — thoughts panel re-loads its list so the
  // user sees the freshest observations without waiting for the next
  // poll. Diff tab pulls a fresh diff so RAG warnings reflect the
  // current branch state (agents commit between switches). Cheap
  // calls; no harm in repeating.
  if (tab === "thoughts") loadThoughtsBanner();
  if (tab === "diff" && currentSession) refreshSessionDiff();
}

/** Set the small badge next to a tab label (e.g. "3" next to Thoughts).
 *  Pass 0 or null to clear. `alert=true` gives it the warning color. */
function setTabBadge(tab: "plan" | "thoughts", count: number | null, alert = false): void {
  const badge = document.getElementById(`tab-badge-${tab}`);
  const btn   = document.querySelector<HTMLButtonElement>(`.session-tab[data-tab="${tab}"]`);
  if (!badge) return;
  if (!count) {
    badge.textContent = "";
    btn?.classList.remove("has-alert");
    return;
  }
  badge.textContent = String(count);
  btn?.classList.toggle("has-alert", alert);
}

/** Flip completion on/off, persist, refresh the indicator. Called from
 *  the ⚡ button in the status strip. */
function toggleCompletion(): void {
  completionEnabled = !completionEnabled;
  try { localStorage.setItem("tina4.editor.completion.enabled", completionEnabled ? "true" : "false"); } catch { /* private mode */ }
  refreshCompletionIndicator();
}

/** Visual state on the ⚡ button: disabled / off-plan / on-plan.
 *  Called after anything that might change any of those: toggle,
 *  plan indicator render, page load. */
function refreshCompletionIndicator(): void {
  const btn = document.getElementById("completion-toggle");
  if (!btn) return;
  btn.classList.remove("disabled", "on-plan", "off-plan");
  if (!completionEnabled) {
    btn.classList.add("disabled");
    btn.setAttribute("title", "Completion off — click to enable");
    return;
  }
  if (activeCompletionPlanIntent) {
    btn.classList.add("on-plan");
    btn.setAttribute("title", `Completion on-plan: ${activeCompletionPlanIntent.slice(0, 80)}`);
  } else {
    btn.classList.add("off-plan");
    btn.setAttribute("title", "Completion on (off-plan — no intent boost)");
  }
}

/** Poll reachability for each of the 5 backing services once per page
 *  load, then every 30s. Writes .up / .down classes onto the dots. If
 *  a service is down the dot goes red; no noisy toast — the strip is
 *  there so the user can glance at it, not be nagged. */
let _healthTimer: number | null = null;
async function probeAllModels(): Promise<void> {
  const targets: Array<{ key: ModelKey; url: string }> = [
    { key: "chat",   url: MODELS.chat.endpoint },
    { key: "vision", url: MODELS.vision.endpoint },
    { key: "embed",  url: MODELS.embed.endpoint },
    { key: "image",  url: MODELS.image.endpoint },
    { key: "rag",    url: MODELS.rag.endpoint },
  ];
  await Promise.all(targets.map(async ({ key, url }) => {
    const up = await probeEndpoint(url);
    const dot = document.querySelector<HTMLElement>(`.model-dot[data-model="${key}"]`);
    if (!dot) return;
    dot.classList.toggle("up", up);
    dot.classList.toggle("down", !up);
  }));
}

function startHealthPoll(): void {
  if (_healthTimer) return;
  probeAllModels();
  _healthTimer = window.setInterval(probeAllModels, 30_000);
}

/** Set the session activity strip's caption (e.g. "coder: writing
 *  src/routes/contact.py"). Pass null to hide the strip — default
 *  state when nothing is in flight. */
function setActivityCaption(caption: string | null): void {
  const strip = document.getElementById("session-activity-strip");
  const text  = document.getElementById("session-activity-text");
  if (!strip || !text) return;
  if (!caption) {
    strip.setAttribute("hidden", "");
    text.textContent = "idle";
    return;
  }
  strip.removeAttribute("hidden");
  text.textContent = caption;
}

/** Update the header meta line — e.g. "Standard · 2/3 steps · 1 pending".
 *  Pass "" to clear. The title line above stays stable; meta changes
 *  as the session progresses. */
function setSessionMeta(title: string | null, meta: string | null): void {
  const t = document.getElementById("session-title");
  const m = document.getElementById("session-meta");
  if (t && title !== null) t.textContent = title;
  if (m) m.textContent = meta || "";
}

// ── Decision chips in the activity stream ──────────────────────────
//
// When the supervisor asks a question ("commit now or keep going?")
// we render the answer options inline as tappable chips. One click
// beats typing. Chips can either submit text back to the chat (fill
// input + send) or dispatch a custom handler registered by the caller.

interface ActivityChip {
  label: string;
  /** Visual weight — the recommended option gets `primary`. */
  variant?: "primary" | "default" | "subdued";
  /** What the chip does when clicked. Default: fill the input with
   *  `label` and send as a user turn. */
  onClick?: () => void;
  /** If set, replaces the input with this text instead of the label
   *  (useful when the label is terse like "yes" but the prompt should
   *  say "yes, commit the staged changes now"). */
  replyAs?: string;
}

function addActivityChips(prompt: string, chips: ActivityChip[]): HTMLElement | null {
  const container = document.getElementById("editor-ai-messages");
  if (!container) return null;
  const row = document.createElement("div");
  row.className = "ai-msg ai-bot";
  row.style.cssText = "padding:0.4rem 0.6rem;background:transparent;border-left:2px solid var(--info,#89b4fa)";
  const chipsWrap = document.createElement("div");
  chipsWrap.className = "activity-chips";
  const promptEl = document.createElement("div");
  promptEl.className = "activity-chips-prompt";
  promptEl.textContent = prompt;
  chipsWrap.appendChild(promptEl);
  for (const chip of chips) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `activity-chip ${chip.variant || "default"}`;
    btn.textContent = chip.label;
    btn.addEventListener("click", () => {
      // Spend the chip — other chips in the same row grey out too so
      // the user can't click twice.
      chipsWrap.querySelectorAll<HTMLButtonElement>(".activity-chip").forEach((b) => b.classList.add("spent"));
      if (chip.onClick) {
        chip.onClick();
        return;
      }
      const input = document.getElementById("editor-ai-input") as HTMLTextAreaElement | null;
      if (input) {
        input.value = chip.replyAs || chip.label;
        aiSend();
      }
    });
    chipsWrap.appendChild(btn);
  }
  row.appendChild(chipsWrap);
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
  return row;
}

/** Drop an outcome line into the Activity stream — the compact
 *  "✓ src/x.py — added POST /contact" format that replaces pasting
 *  entire code blocks. Clicking jumps to the Diff tab (later slice
 *  will resolve the commit; for now it just switches tab). */
function addActivityOutcome(path: string, note: string, ok = true): HTMLElement | null {
  const container = document.getElementById("editor-ai-messages");
  if (!container) return null;
  const row = document.createElement("div");
  row.className = `activity-outcome${ok ? "" : " failed"}`;
  row.innerHTML = `
    <span class="outcome-icon">${ok ? "✓" : "✗"}</span>
    <span class="outcome-path">${esc(path)}</span>
    <span class="outcome-note">${esc(note)}</span>
  `;
  row.addEventListener("click", () => {
    switchTab("diff");
    // TODO: later slice — select the matching file/commit in the
    // Diff viewer. For now the tab switch is enough to tell the user
    // where to look.
  });
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;
  return row;
}

// ── Session lifecycle (slice 2) ───────────────────────────────────
//
// Front-end state for the currently-open supervisor session. The
// server is the source of truth — this is just a small cache to drive
// UI without refetching on every tab switch. Revive from
// `listSessions()` on page load so a browser reload doesn't abandon
// in-flight work.

let currentSession: SessionMeta | null = null;
let currentDiff: SessionDiff | null = null;

/** Persist the session id across page reloads so dev-admin can pick
 *  it back up without needing the user to navigate to "resume." */
const LS_CURRENT_SESSION = "tina4.editor.session.id";

function setCurrentSession(meta: SessionMeta | null): void {
  currentSession = meta;
  if (meta) {
    localStorage.setItem(LS_CURRENT_SESSION, meta.id);
  } else {
    localStorage.removeItem(LS_CURRENT_SESSION);
  }
  renderSessionHeader();
  refreshSessionButtons();
}

/** Header + action-button visibility reflect whether a session is
 *  active and whether it has changes ready to apply. Called any time
 *  the session or diff state changes. */
function renderSessionHeader(): void {
  if (!currentSession) {
    setSessionMeta("No active session", "");
    return;
  }
  const changeCount = currentDiff?.files.length ?? 0;
  const commitCount = currentDiff?.commits.length ?? 0;
  const warnCount = currentDiff?.warnings.length ?? 0;
  const title = currentSession.title || `session ${currentSession.id.slice(0, 8)}`;
  const bits: string[] = [];
  if (commitCount) bits.push(`${commitCount} commit${commitCount === 1 ? "" : "s"}`);
  if (changeCount) bits.push(`${changeCount} file${changeCount === 1 ? "" : "s"}`);
  if (warnCount) bits.push(`⚠ ${warnCount}`);
  setSessionMeta(title, bits.join(" · "));
}

/** Apply / Revise / Cancel are only meaningful when a session exists.
 *  Apply additionally requires at least one changed file — nothing to
 *  commit otherwise. Revise is enabled whenever there's work to
 *  iterate on; for the slice-2 stub we treat it the same as "keep
 *  the conversation going" so it's enabled as soon as a session is
 *  active. */
function refreshSessionButtons(): void {
  const revise = document.getElementById("btn-session-revise") as HTMLButtonElement | null;
  const apply = document.getElementById("btn-session-apply") as HTMLButtonElement | null;
  const cancel = document.getElementById("btn-session-cancel") as HTMLButtonElement | null;
  const hasSession = !!currentSession;
  const hasChanges = (currentDiff?.files.length ?? 0) > 0;
  if (revise) revise.disabled = !hasSession;
  if (apply) apply.disabled = !hasChanges;
  if (cancel) cancel.disabled = !hasSession;
}

/** Render the Diff tab contents from the current session diff.
 *  Called whenever the diff is refreshed (tab switch or commit). */
function renderDiffTab(): void {
  const empty = document.getElementById("diff-empty-state");
  const content = document.getElementById("diff-content-area");
  if (!empty || !content) return;

  if (!currentSession || !currentDiff || currentDiff.files.length === 0) {
    empty.style.display = "";
    content.setAttribute("hidden", "");
    return;
  }

  empty.style.display = "none";
  content.removeAttribute("hidden");

  // Summary — "3 files on branch tina4/supervise/abc, forked from 8823f1b"
  const summary = document.getElementById("diff-summary");
  if (summary) {
    const fcount = currentDiff.files.length;
    const ccount = currentDiff.commits.length;
    summary.innerHTML = `
      <strong>${fcount}</strong> file${fcount === 1 ? "" : "s"} across
      <strong>${ccount}</strong> commit${ccount === 1 ? "" : "s"} on
      <span class="diff-sha">${esc(currentDiff.branch)}</span>
      · forked from <span class="diff-sha">${esc(currentDiff.base_sha.slice(0, 7))}</span>
    `;
  }

  // Files — one row per changed path. Status glyph is a single
  // letter (A/M/D/R) because anything richer is noise at 280px wide.
  const filesEl = document.getElementById("diff-files");
  if (filesEl) {
    // Group warnings by path so we can stick a ⚠ glyph on rows that
    // have concerns. Keeps the list scanable — user sees which files
    // need attention without flipping between sections.
    const warnByPath = new Map<string, number>();
    for (const w of currentDiff.warnings) {
      warnByPath.set(w.path, (warnByPath.get(w.path) ?? 0) + 1);
    }
    filesEl.innerHTML = currentDiff.files.map((f) => {
      const statusLetter = (f.status[0] || "M").toUpperCase();
      const warnCount = warnByPath.get(f.path) ?? 0;
      return `
        <div class="diff-file-row" data-path="${esc(f.path)}" onclick="window.__editorOpenFile('${esc(f.path)}')">
          <span class="diff-file-status s-${esc(statusLetter)}">${esc(statusLetter)}</span>
          <span class="diff-file-path">${esc(f.path)}</span>
          ${warnCount > 0 ? `<span class="diff-file-warn" title="${warnCount} warning${warnCount === 1 ? "" : "s"}">⚠</span>` : ""}
          <span class="diff-file-stats">
            <span class="add">+${f.additions}</span><span class="del">−${f.deletions}</span>
          </span>
        </div>
      `;
    }).join("");
  }

  // Warnings — grouped, kind-colored, with RAG reference when
  // provided. Empty string when there are no warnings.
  const warningsEl = document.getElementById("diff-warnings");
  if (warningsEl) {
    if (currentDiff.warnings.length === 0) {
      warningsEl.innerHTML = "";
    } else {
      const items = currentDiff.warnings.map((w) => {
        const refHtml = w.reference
          ? `<div class="diff-warning-ref">↳ ${esc(w.reference)}</div>`
          : "";
        const lineHtml = w.line ? ` <span style="opacity:0.6">(line ${w.line})</span>` : "";
        return `
          <div class="diff-warning-item ${esc(w.kind)}">
            <div class="diff-warning-path">${esc(w.path)}${lineHtml}</div>
            <div class="diff-warning-msg"><span class="diff-warning-kind">${esc(w.kind)}</span>${esc(w.message)}</div>
            ${refHtml}
          </div>
        `;
      }).join("");
      const header = `<div class="diff-warnings-header">⚠ ${currentDiff.warnings.length} concern${currentDiff.warnings.length === 1 ? "" : "s"} from RAG verification</div>`;
      warningsEl.innerHTML = header + items;
    }
  }

  // Commit log — compact row per session-branch commit.
  const commitsEl = document.getElementById("diff-commits");
  if (commitsEl) {
    if (currentDiff.commits.length === 0) {
      commitsEl.innerHTML = "";
    } else {
      const rows = currentDiff.commits.map((c) => {
        const agent = c.trailer?.agent || "";
        return `
          <div class="diff-commit-row">
            <span class="diff-commit-sha">${esc(c.sha.slice(0, 7))}</span>
            <span class="diff-commit-subject">${esc(c.subject)}</span>
            ${agent ? `<span class="diff-commit-agent">${esc(agent)}</span>` : ""}
          </div>
        `;
      }).join("");
      commitsEl.innerHTML = `<div class="diff-commits-header">commits</div>${rows}`;
    }
  }
}

/** Pull the latest diff for the current session. Updates the header
 *  summary + button states. Silent on failure — the diff is advisory
 *  until the user actually clicks Apply. */
async function refreshSessionDiff(): Promise<void> {
  if (!currentSession) {
    currentDiff = null;
    renderSessionHeader();
    refreshSessionButtons();
    return;
  }
  try {
    currentDiff = await getSessionDiff(currentSession.id);
  } catch (e) {
    // Session may have been cancelled externally (e.g. worktree
    // removed by hand). Drop the stale ref rather than wedging the UI.
    currentDiff = null;
    if (String(e).includes("not found")) {
      setCurrentSession(null);
      return;
    }
  }
  renderSessionHeader();
  refreshSessionButtons();
  updateSessionSummaryStrip();
  renderDiffTab();
}

/** On page load: if a session id was persisted, try to revive it
 *  from the server's session list. If it's gone, clear the stored
 *  id silently. */
async function reviveSessionFromStorage(): Promise<void> {
  const id = localStorage.getItem(LS_CURRENT_SESSION);
  if (!id) return;
  try {
    const sessions = await listSessions();
    const match = sessions.find((s) => s.id === id);
    if (match) {
      currentSession = match;
      await refreshSessionDiff();
      return;
    }
  } catch { /* offline / server down — leave storage as-is */ }
  localStorage.removeItem(LS_CURRENT_SESSION);
}

/** Ask the supervisor to iterate. Slice 2 doesn't have the revise
 *  endpoint yet (that's a richer chat loop), so we fall back to the
 *  Activity chips pattern — prompt the user for what to revise and
 *  send it through the existing /chat stream once the supervisor
 *  stream integration lands. For now, surface an honest placeholder. */
function sessionRevise(): void {
  if (!currentSession) return;
  const input = document.getElementById("editor-ai-input") as HTMLTextAreaElement | null;
  if (input) {
    input.placeholder = `Revise session ${currentSession.id.slice(0, 8)} — what should change?`;
    input.focus();
  }
  addActivityChips(
    `Revising session ${currentSession.id.slice(0, 8)}. Tell me what to change, or pick:`,
    [
      { label: "Make it smaller", variant: "default", replyAs: "Narrow the scope — keep only the essential change" },
      { label: "Add tests",       variant: "default", replyAs: "Add tests for the code you wrote" },
      { label: "Different approach", variant: "subdued", replyAs: "Try a different approach — tell me what you'd do differently" },
    ],
  );
}

/** Apply the session's proposal to the user's working tree. All
 *  changed files get committed in one squash-commit. Partial apply
 *  (per-file accept) lands in a later slice when the diff viewer
 *  gains checkboxes. */
async function sessionApply(): Promise<void> {
  if (!currentSession) return;
  const id = currentSession.id;
  const changed = currentDiff?.files.length ?? 0;
  if (!changed) {
    addAIMessage('<span style="opacity:0.6">Nothing to apply — session has no changes.</span>', "bot");
    return;
  }
  addAIMessage(`<span style="opacity:0.75">Applying session <code>${esc(id.slice(0, 8))}</code>…</span>`, "bot");
  try {
    const result = await commitSession(id, []);
    const applied = result.applied.length;
    const warningLine = result.warnings.length
      ? `<div style="opacity:0.7;margin-top:0.2rem">${esc(result.warnings.join(" · "))}</div>`
      : "";
    addAIMessage(
      `<span style="color:var(--success,#a6e3a1)">✓ Applied ${applied} file${applied === 1 ? "" : "s"}</span> · <code style="opacity:0.7">${esc(result.sha.slice(0, 7))}</code>${warningLine}`,
      "bot",
    );
    // Refresh file tree + open buffers so the new state is visible.
    await refreshAllOpenDirs();
    for (const path of result.applied) await syncOpenBuffer(path);
    // Session stays open for further revisions. Refresh the diff so
    // the Apply button disables until new work lands.
    await refreshSessionDiff();
  } catch (e: any) {
    addAIMessage(`<span style="color:var(--danger,#f38ba8)">✗ Apply failed: ${esc(String(e?.message || e))}</span>`, "bot");
  }
}

/** Drop the session worktree and branch. Asks for confirmation only
 *  when there's real work staged — cancelling a brand-new empty
 *  session shouldn't require a modal. */
async function sessionCancel(): Promise<void> {
  if (!currentSession) return;
  const id = currentSession.id;
  const changed = currentDiff?.files.length ?? 0;
  if (changed > 0) {
    const ok = window.confirm(`Cancel session and discard ${changed} changed file${changed === 1 ? "" : "s"}? This is not undoable.`);
    if (!ok) return;
  }
  try {
    await cancelSession(id);
    addAIMessage(`<span style="opacity:0.65">Session ${esc(id.slice(0, 8))} cancelled.</span>`, "bot");
    setCurrentSession(null);
    currentDiff = null;
  } catch (e: any) {
    addAIMessage(`<span style="color:var(--danger,#f38ba8)">Cancel failed: ${esc(String(e?.message || e))}</span>`, "bot");
  }
}

/** Bootstrap button in the empty Activity tab — lets the user open
 *  a session without waiting for the Send-triggers-session wiring
 *  in a later slice. Prompts for a one-line title. */
async function startSessionFromActivity(): Promise<void> {
  const title = window.prompt("What are you working on? (used as the commit subject when you Apply)", "") || "";
  if (title.trim().length === 0) return;
  await startSession(title.trim(), "");
  // Hide the bootstrap card once a session exists — the status strip
  // now carries the session identity.
  const card = document.getElementById("activity-session-bootstrap");
  if (card) card.style.display = "none";
  // Summary strip reveals itself as state accumulates.
  updateSessionSummaryStrip();
}

/** Populate the compact "3 files · 5 commits" strip at the top of
 *  the Activity tab. Hidden when there's no session or nothing has
 *  happened yet. */
function updateSessionSummaryStrip(): void {
  const strip = document.getElementById("session-summary-strip");
  const chip = document.getElementById("summary-chip-session");
  if (!strip || !chip) return;
  if (!currentSession || !currentDiff || currentDiff.files.length === 0) {
    strip.setAttribute("hidden", "");
    return;
  }
  const files = currentDiff.files.length;
  const commits = currentDiff.commits.length;
  const warn = currentDiff.warnings.length;
  const parts: string[] = [
    `<strong>${files}</strong> file${files === 1 ? "" : "s"}`,
    `<strong>${commits}</strong> commit${commits === 1 ? "" : "s"}`,
  ];
  if (warn > 0) parts.push(`<strong style="color:var(--warning,#f9e2af)">⚠ ${warn}</strong>`);
  chip.innerHTML = parts.join(" · ");
  strip.removeAttribute("hidden");
}

/** Create a new session. Called from the empty Plan tab or (later)
 *  when the user hits Send with no active session. The title is
 *  optional — defaults to "session <id>" server-side. Exposes the
 *  helper on window so other surfaces (plan switcher, chat) can kick
 *  off a session with one call. */
async function startSession(title: string, plan: string = ""): Promise<SessionMeta | null> {
  try {
    const meta = await createSession({ title, plan });
    setCurrentSession(meta);
    await refreshSessionDiff();
    addAIMessage(
      `<span style="color:var(--info,#89b4fa)">▶ Session started</span> · <code>${esc(meta.id.slice(0, 8))}</code> on branch <code>${esc(meta.branch)}</code>`,
      "bot",
    );
    return meta;
  } catch (e: any) {
    addAIMessage(`<span style="color:var(--danger,#f38ba8)">Couldn't start session: ${esc(String(e?.message || e))}</span>`, "bot");
    return null;
  }
}

// ── Image generation (diffusion) ───────────────────────────────────

async function aiImagePrompt(): Promise<void> {
  const input = document.getElementById("editor-ai-input") as HTMLTextAreaElement;
  const prompt = input?.value?.trim() || (window.prompt("Image prompt:") || "").trim();
  if (!prompt) return;
  if (input) input.value = "";

  const container = document.getElementById("editor-ai-messages");
  if (!container) return;

  addAIMessage(`🎨 <em>${esc(prompt)}</em>`, "user");
  const bubble = document.createElement("div");
  bubble.className = "ai-msg ai-bot";
  bubble.innerHTML = '<span style="opacity:0.6">Generating image…</span>';
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;

  try {
    const r = await aiGenerateImage(prompt);
    if (r.images?.length) {
      bubble.innerHTML = r.images.map((src) =>
        `<img src="${src}" style="max-width:100%;border-radius:4px;margin-bottom:4px" alt="${esc(prompt)}">`
      ).join("");
    } else {
      bubble.innerHTML = `<span style="color:var(--danger)">No image returned${r.error ? ": " + esc(r.error) : ""}</span>`;
    }
  } catch (e: any) {
    bubble.innerHTML = `<span style="color:var(--danger)">Image failed: ${esc(String(e?.message || e))}</span>`;
  }
}

// Each AI code block gets indexed here so the toolbar buttons can look
// up the raw (unescaped) content when the user clicks Apply / Copy /
// Insert. We never put raw code into an inline onclick handler — that
// way unsafe characters in AI output can't break the page.
let _aiBlockCounter = 0;
const aiCodeBlocks = new Map<string, { code: string; path: string | null; lang: string }>();

/** Look for a leading comment that names a file path, e.g.
 *   // src/routes/home.ts
 *   # src/app.py
 *   <!-- src/templates/index.html -->
 * The AI's system prompt asks for exactly this. Returns {path, rest} if
 * found, otherwise {path: null, rest: original code}. */
function extractPathHint(code: string): { path: string | null; rest: string } {
  const firstLine = code.split("\n", 1)[0] || "";
  const m = firstLine.match(/^\s*(?:\/\/|#|<!--)\s*([\w./\-]+\.\w+)\s*(?:-->)?\s*$/);
  if (m && m[1].includes("/")) {
    return { path: m[1], rest: code.slice(firstLine.length + 1) };
  }
  return { path: null, rest: code };
}

function formatAIResponse(text: string): string {
  let t = text.replace(/\\n/g, "\n");

  // Tool-call fenced blocks have already been parsed and executed by
  // the chat loop; the ✓ result bubble that follows is the real
  // record. Showing a "→ calling X…" placeholder for every call just
  // duplicates that record, so strip them entirely. Same for any
  // ```tool_result``` blocks echoed back — the bubble is the receipt.
  // Match closed fences AND unclosed (truncated) ones — qwen sometimes
  // streams the JSON body but never emits the trailing ```.
  t = t.replace(/```tool_call\s*\n[\s\S]*?(?:```|$)/g, "");
  t = t.replace(/```tool_result[^\n]*\n[\s\S]*?```/g, "");
  // Stripping those blocks leaves behind the blank lines that
  // surrounded them. Without this, the later `\n → <br>` pass turns
  // that empty region into a wall of <br> tags and the bubble shows
  // a big empty gap above the acknowledgement sentence. Collapse any
  // run of ≥2 newlines into a single one, and trim leading/trailing.
  t = t.replace(/\n{2,}/g, "\n").trim();
  // If that left only whitespace, collapse to nothing so the bubble
  // doesn't render as an empty rectangle.
  if (!t.replace(/\s+/g, "").length) t = "";

  // Code blocks → fenced block + toolbar (Copy / Insert / Apply / Save as…)
  t = t.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang, rawCode) => {
    const { path, rest } = extractPathHint(rawCode as string);
    const id = `aiblk_${++_aiBlockCounter}`;
    aiCodeBlocks.set(id, { code: rest, path, lang: (lang as string) || "" });

    const escCode = (rest as string).split("\n").map((line: string) => {
      if (line.startsWith("+")) return `<span class="ai-diff-add">${esc(line)}</span>`;
      if (line.startsWith("-")) return `<span class="ai-diff-del">${esc(line)}</span>`;
      return esc(line);
    }).join("\n");

    const pathLabel = path ? esc(path) : "active file";
    const applyDisabled = !path && !activeFile;

    // When the AI has given us an explicit file path in the first-line
    // comment, that's a clear "write this here" instruction — we queue
    // an auto-apply and render the block *collapsed* as a one-line
    // acknowledgement chip. The user can click "view" to expand if they
    // want to see the diff. Dumping the full file after every auto-apply
    // buries the chat in walls of code.
    const autoApply = !!path;
    if (autoApply) {
      return `<div class="ai-codeblock ai-codeblock-collapsed" data-block-id="${id}" data-auto-apply="1">
        <div class="ai-codeblock-bar">
          <span class="ai-codeblock-lang" title="${esc(pathLabel)}">
            <span class="ai-codeblock-status" data-status>⏳</span>
            <code>${esc(path!)}</code>
          </span>
          <span class="ai-codeblock-actions">
            <button class="ai-codeblock-btn" onclick="window.__aiBlockToggle('${id}')" title="Show / hide code">view</button>
          </span>
        </div>
        <pre style="display:none"><code>${escCode}</code></pre>
      </div>`;
    }

    return `<div class="ai-codeblock" data-block-id="${id}">
      <div class="ai-codeblock-bar">
        <span class="ai-codeblock-lang" title="${esc(pathLabel)}">${esc(lang || "code")}${path ? ` · ${esc(path)}` : ""}</span>
        <span class="ai-codeblock-actions">
          <button class="ai-codeblock-btn" onclick="window.__aiBlockCopy('${id}')" title="Copy to clipboard">Copy</button>
          <button class="ai-codeblock-btn" onclick="window.__aiBlockInsert('${id}')" title="Insert at cursor in the open editor" ${activeFile ? "" : "disabled"}>Insert</button>
          <button class="ai-codeblock-btn ai-codeblock-apply" onclick="window.__aiBlockApply('${id}')" title="Overwrite ${pathLabel}" ${applyDisabled ? "disabled" : ""}>Apply</button>
          <button class="ai-codeblock-btn" onclick="window.__aiBlockSaveAs('${id}')" title="Save to a new path">Save as…</button>
        </span>
      </div>
      <pre><code>${escCode}</code></pre>
    </div>`;
  });

  // Inline code
  t = t.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.3);padding:0.1rem 0.3rem;border-radius:0.2rem">$1</code>');

  // Bold
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Newlines — but preserve paragraphs around our ai-codeblock divs
  t = t.replace(/\n/g, "<br>");
  // Strip the <br>s immediately inside our codeblock divs (pre already handles newlines)
  t = t.replace(/(<div class="ai-codeblock"[\s\S]*?<\/div>)(<br>)+/g, "$1");
  t = t.replace(/(<br>)+(<div class="ai-codeblock")/g, "$2");

  return t;
}

// ── AI code block actions ────────────────────────────────────

async function aiBlockCopy(id: string): Promise<void> {
  const blk = aiCodeBlocks.get(id);
  if (!blk) return;
  try {
    await navigator.clipboard.writeText(blk.code);
    flashBlock(id, "Copied");
  } catch {
    flashBlock(id, "Copy failed", true);
  }
}

function aiBlockInsert(id: string): void {
  const blk = aiCodeBlocks.get(id);
  if (!blk) return;
  const file = openFiles.find((f) => f.path === activeFile);
  if (!file?.view) {
    flashBlock(id, "Open a file first", true);
    return;
  }
  file.view.dispatch(file.view.state.replaceSelection(blk.code));
  file.dirty = true;
  renderTabs();
  flashBlock(id, "Inserted");
}

/** Detect "I made the change" narration that isn't backed by an actual
 *  tool_call in the same turn — small models (gemma, phi) sometimes
 *  skip the tool and just describe what they'd have done. Appending a
 *  warning chip is cheaper than silently letting the user think the
 *  file changed. */
function flagHallucinatedEditsIn(
  bubble: HTMLElement,
  text: string,
  hadToolCall: boolean,
): void {
  if (hadToolCall) return;
  // Catch both past-tense "I did it" and future/progressive "I'm doing it"
  // — small models love to say "Implementing step N" and stop. Either
  // phrasing near a path-like token OR near step/plan/route/model/
  // migration/table keywords counts as a suspicious claim. We also
  // catch "will/going to" to flag commitments the model didn't honour.
  const pastClaim = /\b(added|updated|changed|modified|created|removed|deleted|fixed|inserted|wrote|patched|generated|saved|implemented|built|replaced)\b/i;
  const futureClaim = /\b(implementing|adding|updating|changing|creating|removing|fixing|writing|patching|saving|building|will\s+(add|create|update|implement|write|patch|build)|going\s+to\s+(add|create|update|implement|write|patch|build))\b/i;
  const workishTarget = /\b([\w./\-]+\.\w{1,6}|step\s+\d+|the\s+plan|the\s+(migration|route|model|template|middleware|table|endpoint|form))\b/i;
  const isClaim = (pastClaim.test(text) || futureClaim.test(text)) && workishTarget.test(text);
  if (!isClaim) return;
  const warn = document.createElement("div");
  warn.style.cssText = "font-size:0.7rem;margin-top:0.35rem;padding:4px 8px;border-left:2px solid var(--warning,#f9e2af);background:rgba(249,226,175,0.08);color:var(--warning,#f9e2af);border-radius:2px";
  warn.textContent = "⚠ The assistant described work it was about to do but didn't call a tool in this turn — nothing changed on disk. Nudge it to actually use file_patch / file_write / migration_create.";
  bubble.appendChild(warn);
}

/** Intercept file-destroying tool calls before they hit the server.
 *  Returns an error `McpCallResult` to short-circuit the call when the
 *  proposed write is almost certainly a fragment, or null to let the
 *  call proceed normally. The model gets the error back as a
 *  `tool_result`, reads the remediation, and retries — usually with
 *  file_patch. */
async function guardFileWrite(
  name: string,
  args: Record<string, unknown>,
): Promise<{ ok: false; error: string } | null> {
  if (name !== "file_write") return null;
  const path = (args?.path as string) || "";
  const content = (args?.content as string) ?? "";
  if (!path) return null;
  // Look up the existing file size. If it doesn't exist, this is a new
  // file and the write is fine — there's nothing to destroy.
  let existingSize = 0;
  try {
    const info = await api(`/file?path=${encodeURIComponent(path)}`);
    existingSize = ((info as any)?.content || "").length;
  } catch {
    return null; // assume new file
  }
  if (existingSize === 0) return null;
  const newSize = content.length;
  // A write that shrinks the file to < 40% of its previous size is
  // almost always a fragment. 40% leaves room for genuine cleanups
  // (removing comments, dead code) but catches "model sent just the
  // form element of a 1.5KB file".
  if (newSize < existingSize * 0.4) {
    const shrinkPct = Math.round(100 - (newSize / existingSize) * 100);
    return {
      ok: false,
      error:
        `REFUSED: file_write on ${path} would shrink it by ${shrinkPct}% ` +
        `(${existingSize} → ${newSize} bytes). This looks like a fragment, ` +
        `not a full file. Either:\n` +
        `  1. Use file_patch with a minimal old_string/new_string for targeted edits, OR\n` +
        `  2. Call file_read first, then file_write with the COMPLETE updated file contents.`,
    };
  }
  return null;
}

/** Dig a project-relative file path out of a tool call so we know what
 *  the UI needs to refresh. Different tools report the path in different
 *  shapes; we check arguments first (what the model was aiming at) then
 *  fall back to the tool's own result payload. Returns "" when the tool
 *  didn't actually touch a file. */
function extractTouchedPath(
  name: string,
  args: Record<string, unknown>,
  result: unknown,
): string {
  const fromArg = (args?.path ?? args?.filename) as string | undefined;
  // file_write returns {written: "src/foo.py", bytes: N}
  // file_patch returns {patched: "src/foo.py", replacements: N}
  // asset_upload returns {uploaded: "src/public/x.png", bytes: N}
  // migration_create returns {created: "migrations/001_x.sql"}
  let fromResult: string | undefined;
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    fromResult = (r.written ?? r.patched ?? r.uploaded ?? r.created) as string | undefined;
  }
  const path = (fromResult || fromArg || "").toString();
  // Only mutating tools trigger a refresh. file_read / file_list /
  // database_query etc. don't need one.
  const mutators = new Set([
    "file_write",
    "file_patch",
    "asset_upload",
    "migration_create",
    "migration_run",
    "database_execute",
    "seed_table",
  ]);
  return mutators.has(name) ? path : "";
}

/** After a mutating MCP tool call, make the change visible in the
 *  editor: reload the file tree, and if the touched file is open in a
 *  tab, refresh its buffer from disk so the user sees the new content. */
async function refreshAfterToolMutation(path: string): Promise<void> {
  try {
    // Always refresh the tree — new files / deleted files need to show up.
    await loadFileTree(".");
  } catch { /* non-fatal */ }
  if (!path) return;
  const open = openFiles.find((f) => f.path === path);
  if (!open) return;
  try {
    const fresh = await api(`/file?path=${encodeURIComponent(path)}`);
    const content = (fresh as any)?.content ?? "";
    if (open.view) {
      open.view.dispatch({
        changes: { from: 0, to: open.view.state.doc.length, insert: content },
      });
    }
    open.content = content;
    open.dirty = false;
    renderTabs();
    updateStatusBar(`Reloaded ${path} after tool call`);
  } catch { /* non-fatal */ }
}

/** Scan a rendered AI bubble for code blocks flagged with
 *  `data-auto-apply="1"` and apply each one sequentially. The
 *  corresponding flag is set in `formatAIResponse` whenever the code
 *  block's first-line comment names a real project file path. */
function autoApplyBlocksIn(container: HTMLElement): void {
  const blocks = container.querySelectorAll<HTMLElement>('.ai-codeblock[data-auto-apply="1"]');
  if (!blocks.length) return;
  // Sequentialise so two blocks targeting the same file don't race.
  (async () => {
    for (const el of Array.from(blocks)) {
      const id = el.getAttribute("data-block-id");
      if (!id) continue;
      // Mark as consumed immediately so a re-render (e.g. post-tool-call
      // follow-up) doesn't re-apply it.
      el.removeAttribute("data-auto-apply");
      try {
        await aiBlockApply(id);
      } catch {
        /* errors surface through flashBlock */
      }
    }
  })();
}

/** Flip the collapsed/expanded state of an auto-apply chip. */
function aiBlockToggle(id: string): void {
  const root = document.querySelector<HTMLElement>(`.ai-codeblock[data-block-id="${id}"]`);
  if (!root) return;
  const pre = root.querySelector<HTMLElement>("pre");
  if (!pre) return;
  pre.style.display = pre.style.display === "none" ? "" : "none";
}

/** Set the ⏳ / ✓ / ✗ indicator on a collapsed auto-apply chip. */
function setBlockStatus(id: string, icon: string, color?: string): void {
  const el = document.querySelector<HTMLElement>(
    `.ai-codeblock[data-block-id="${id}"] [data-status]`,
  );
  if (!el) return;
  el.textContent = icon;
  if (color) el.style.color = color;
}

async function aiBlockApply(id: string): Promise<void> {
  const blk = aiCodeBlocks.get(id);
  if (!blk) return;
  const target = blk.path || activeFile;
  if (!target) {
    setBlockStatus(id, "✗", "var(--danger,#f38ba8)");
    flashBlock(id, "No target file", true);
    return;
  }
  // No confirm dialog — one click applies. The user can undo with
  // Ctrl+Z in the editor if the result was wrong, and the tab will
  // show dirty-state feedback either way.
  try {
    await api("/file/save", "POST", { path: target, content: blk.code });
    setBlockStatus(id, "✓", "var(--success,#a6e3a1)");
    flashBlock(id, "Applied");

    // If the file is open in the editor, refresh its buffer so the
    // user sees the new contents. If it isn't open, open it.
    const existing = openFiles.find((f) => f.path === target);
    if (existing?.view) {
      existing.view.dispatch({
        changes: { from: 0, to: existing.view.state.doc.length, insert: blk.code },
      });
      existing.content = blk.code;
      existing.dirty = false;
      renderTabs();
      updateStatusBar(`Applied AI suggestion to ${target}`);
    } else {
      await openFile(target);
    }
    // Tree might show it as a new file — refresh
    await loadFileTree(".");
  } catch (e: any) {
    setBlockStatus(id, "✗", "var(--danger,#f38ba8)");
    flashBlock(id, `Apply failed: ${e?.message || e}`, true);
  }
}

async function aiBlockSaveAs(id: string): Promise<void> {
  const blk = aiCodeBlocks.get(id);
  if (!blk) return;
  const suggested = blk.path || "src/new-file";
  const target = prompt("Save to path (relative to project root):", suggested);
  if (!target) return;

  try {
    await api("/file/save", "POST", { path: target, content: blk.code });
    flashBlock(id, `Saved → ${target}`);
    await loadFileTree(".");
    await openFile(target);
  } catch (e: any) {
    flashBlock(id, `Save failed: ${e?.message || e}`, true);
  }
}

/** Briefly flash a toast on a code block's toolbar. */
function flashBlock(id: string, msg: string, err = false): void {
  const el = document.querySelector<HTMLElement>(`.ai-codeblock[data-block-id="${id}"] .ai-codeblock-lang`);
  if (!el) return;
  const prev = el.textContent;
  el.textContent = msg;
  el.style.color = err ? "var(--danger, #f38ba8)" : "var(--success, #a6e3a1)";
  setTimeout(() => {
    el.textContent = prev;
    el.style.color = "";
  }, 1500);
}

// ── Context menu ──
let ctxMenuEl: HTMLElement | null = null;

function showCtxMenu(e: MouseEvent, path: string, isDir: boolean): void {
  hideCtxMenu();
  const menu = document.createElement("div");
  menu.className = "editor-ctx-menu";
  menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;z-index:200`;

  if (isDir) {
    menu.innerHTML = `
      <div class="ctx-item" onclick="window.__editorNewFile('${esc(path)}')">📄 New File <span class="ctx-shortcut">Ctrl+N</span></div>
      <div class="ctx-item" onclick="window.__editorNewFolder('${esc(path)}')">📁 New Folder <span class="ctx-shortcut">Ctrl+Shift+N</span></div>
      <div class="ctx-sep"></div>
      <div class="ctx-item" onclick="window.__editorRename('${esc(path)}',true)">✏️ Rename</div>
      <div class="ctx-item ctx-danger" onclick="window.__editorDelete('${esc(path)}',true)">🗑️ Delete <span class="ctx-shortcut">Del</span></div>
    `;
  } else {
    menu.innerHTML = `
      <div class="ctx-item" onclick="window.__editorOpenFile('${esc(path)}')">📄 Open</div>
      <div class="ctx-sep"></div>
      <div class="ctx-item" onclick="window.__editorRename('${esc(path)}',false)">✏️ Rename <span class="ctx-shortcut">F2</span></div>
      <div class="ctx-item" onclick="window.__editorDuplicate('${esc(path)}')">📋 Duplicate</div>
      <div class="ctx-sep"></div>
      <div class="ctx-item ctx-danger" onclick="window.__editorDelete('${esc(path)}',false)">🗑️ Delete <span class="ctx-shortcut">Del</span></div>
    `;
  }

  document.body.appendChild(menu);
  ctxMenuEl = menu;

  // Close on click elsewhere
  setTimeout(() => {
    document.addEventListener("click", hideCtxMenu, { once: true });
  }, 0);
}

function hideCtxMenu(): void {
  if (ctxMenuEl) { ctxMenuEl.remove(); ctxMenuEl = null; }
}

async function newFile(dirPath: string): Promise<void> {
  hideCtxMenu();
  const name = prompt("New file name:");
  if (!name) return;
  const filePath = dirPath === "." ? name : `${dirPath}/${name}`;
  try {
    await api("/file/save", "POST", { path: filePath, content: "" });
    await loadFileTree(dirPath);
    openFile(filePath);
  } catch (e: any) {
    alert("Failed: " + e.message);
  }
}

async function newFolder(dirPath: string): Promise<void> {
  hideCtxMenu();
  const name = prompt("New folder name:");
  if (!name) return;
  const folderPath = dirPath === "." ? name : `${dirPath}/${name}`;
  // Create folder by saving a .gitkeep inside it
  try {
    await api("/file/save", "POST", { path: `${folderPath}/.gitkeep`, content: "" });
    expandedDirs.add(folderPath);
    await loadFileTree(dirPath);
  } catch (e: any) {
    alert("Failed: " + e.message);
  }
}

async function renameItem(path: string, _isDir: boolean): Promise<void> {
  hideCtxMenu();
  const parts = path.split("/");
  const oldName = parts.pop() || "";
  const parentDir = parts.join("/") || ".";
  const newName = prompt("Rename to:", oldName);
  if (!newName || newName === oldName) return;
  const newPath = parentDir === "." ? newName : `${parentDir}/${newName}`;
  try {
    await api("/file/rename", "POST", { from: path, to: newPath });
    // Update open tabs
    const openIdx = openFiles.findIndex(f => f.path === path);
    if (openIdx >= 0) {
      openFiles[openIdx].path = newPath;
      if (activeFile === path) activeFile = newPath;
      renderTabs();
    }
    await loadFileTree(parentDir);
  } catch (e: any) {
    alert("Rename failed: " + e.message);
  }
}

async function deleteItem(path: string, isDir: boolean): Promise<void> {
  hideCtxMenu();
  const what = isDir ? "folder" : "file";
  if (!confirm(`Delete ${what} "${path}"?`)) return;
  try {
    await api("/file/delete", "POST", { path, is_dir: isDir });
    // Close if open
    const openIdx = openFiles.findIndex(f => f.path === path);
    if (openIdx >= 0) closeFile(path);
    const parentDir = path.split("/").slice(0, -1).join("/") || ".";
    await loadFileTree(parentDir);
  } catch (e: any) {
    alert("Delete failed: " + e.message);
  }
}

async function duplicateFile(path: string): Promise<void> {
  hideCtxMenu();
  const parts = path.split("/");
  const name = parts.pop() || "";
  const ext = name.includes(".") ? "." + name.split(".").pop() : "";
  const base = ext ? name.slice(0, -ext.length) : name;
  const newName = `${base}-copy${ext}`;
  const parentDir = parts.join("/") || ".";
  const newPath = parentDir === "." ? newName : `${parentDir}/${newName}`;

  try {
    const data = await api<any>(`/file?path=${encodeURIComponent(path)}`);
    await api("/file/save", "POST", { path: newPath, content: data.content });
    await loadFileTree(parentDir);
    openFile(newPath);
  } catch (e: any) {
    alert("Duplicate failed: " + e.message);
  }
}

// ── Menu ──
function toggleMenu(): void {
  const dd = document.getElementById("editor-menu-dropdown");
  if (!dd) return;
  const show = dd.style.display === "none";
  dd.style.display = show ? "block" : "none";
  if (show) {
    // Close on next click anywhere
    setTimeout(() => {
      const closer = (e: MouseEvent) => {
        if (!(e.target as HTMLElement)?.closest(".editor-menu-wrapper")) {
          dd.style.display = "none";
        }
        document.removeEventListener("click", closer);
      };
      document.addEventListener("click", closer);
    }, 0);
  }
}

// ── Global handlers ──
// ── Dependency search ──
async function depsSearch(): Promise<void> {
  const input = document.getElementById("deps-search-input") as HTMLInputElement;
  const query = input?.value?.trim();
  if (!query) return;

  const results = document.getElementById("deps-search-results");
  if (results) results.innerHTML = '<div class="text-sm text-muted" style="padding:8px;text-align:center">Searching...</div>';

  const fileName = activeFile?.split("/").pop() || "";
  const pkgInfo = PKG_FILES[fileName];
  if (!pkgInfo) return;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`/__dev/api/deps/search?q=${encodeURIComponent(query)}&registry=${pkgInfo.registry}`, { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    const packages = data.packages || [];

    if (!results) return;

    if (packages.length === 0) {
      results.innerHTML = '<div class="text-sm text-muted" style="padding:8px;text-align:center">No packages found</div>';
      return;
    }

    results.innerHTML = packages.map((pkg: any) =>
      `<div class="deps-item">
        <div class="deps-item-name">${esc(pkg.name)}</div>
        <div class="deps-item-desc">${esc(pkg.description || "")}</div>
        <div class="deps-item-meta">
          <span>${esc(pkg.version || "")}</span>
          <button class="btn btn-sm" style="font-size:0.6rem;padding:2px 8px;color:var(--success);border-color:var(--success)" onclick="window.__depsInstall('${esc(pkg.name)}','${esc(pkg.version || "")}')">+ Install</button>
        </div>
      </div>`
    ).join("");
  } catch (e: any) {
    if (results) results.innerHTML = `<div class="text-sm" style="padding:8px;color:var(--danger)">${esc(e.message || "Search failed")}</div>`;
  }
}

async function depsInstall(name: string, version: string): Promise<void> {
  const fileName = activeFile?.split("/").pop() || "";
  const pkgInfo = PKG_FILES[fileName];
  if (!pkgInfo) return;

  const results = document.getElementById("deps-search-results");
  if (results) results.innerHTML = `<div class="text-sm text-muted" style="padding:8px;text-align:center">Installing ${esc(name)}...</div>`;

  try {
    const data = await api<any>("/deps/install", "POST", {
      name, version, registry: pkgInfo.registry, file: activeFile,
    });

    if (results) {
      results.innerHTML = `<div class="text-sm" style="padding:8px;color:var(--success)">✔ ${esc(data.message || `Installed ${name}`)}</div>`;
    }

    // Reload the file to reflect changes
    if (activeFile) {
      const fileData = await api<any>(`/file?path=${encodeURIComponent(activeFile)}`);
      const openFile = openFiles.find(f => f.path === activeFile);
      if (openFile && fileData.content) {
        openFile.content = fileData.content;
        openFile.dirty = false;
        renderContent();
        renderInstalledDeps(pkgInfo);
      }
    }
  } catch (e: any) {
    if (results) results.innerHTML = `<div class="text-sm" style="padding:8px;color:var(--danger)">✗ ${esc(e.message || "Install failed")}</div>`;
  }
}

(window as any).__depsSearch = depsSearch;
(window as any).__depsInstall = depsInstall;

// ── Scaffold ──
async function scaffold(type: string): Promise<void> {
  const name = prompt(`Name for the new ${type}:`);
  if (!name) return;

  const output = document.getElementById("scaffold-output");
  if (output) { output.style.display = "block"; output.textContent = `Generating ${type} "${name}"...`; }

  try {
    const data = await api<any>("/scaffold", "POST", { type, name });
    if (output) {
      output.innerHTML = `<span style="color:var(--success)">✔</span> ${esc(data.message || `Created ${type}: ${name}`)}`;
      if (data.path) {
        output.innerHTML += `\n<span style="color:var(--info);cursor:pointer;text-decoration:underline" onclick="window.__editorOpenFile('${esc(data.path)}')">${esc(data.path)}</span>`;
      }
    }
    // Refresh file tree
    loadFileTree(".");
    // Open the generated file
    if (data.path) setTimeout(() => openFile(data.path), 500);
  } catch (e: any) {
    if (output) output.innerHTML = `<span style="color:var(--danger)">✗</span> ${esc(e.message || "Failed")}`;
  }
}

async function scaffoldRun(command: string): Promise<void> {
  const output = document.getElementById("scaffold-output");
  if (output) { output.style.display = "block"; output.textContent = `Running ${command}...`; }

  try {
    const data = await api<any>("/scaffold/run", "POST", { command });
    if (output) {
      const ok = data.success !== false;
      output.innerHTML = `<span style="color:var(--${ok ? "success" : "danger"})">${ok ? "✔" : "✗"}</span> ${esc(data.output || data.message || command + " complete")}`;
    }
    // Refresh file tree after migration/seed
    if (command === "migrate" || command === "seed") loadFileTree(".");
  } catch (e: any) {
    if (output) output.innerHTML = `<span style="color:var(--danger)">✗</span> ${esc(e.message || "Failed")}`;
  }
}

(window as any).__scaffold = scaffold;
(window as any).__scaffoldRun = scaffoldRun;

// ── Splitters (resizable panels) ───────────────────────────────
//
// Two draggable dividers: one between the file tree and the editor,
// one between the editor and the right (AI / deps) panel. Widths
// persist to localStorage so the layout survives a reload.

const LS_SIDEBAR_W = "tina4.editor.sidebar-width";
const LS_RIGHT_W = "tina4.editor.right-panel-width";

function applySavedPanelWidths(): void {
  const sw = localStorage.getItem(LS_SIDEBAR_W);
  const rw = localStorage.getItem(LS_RIGHT_W);
  const sidebar = document.getElementById("editor-sidebar");
  const right = document.getElementById("editor-right-panel");
  if (sidebar && sw) sidebar.style.width = sw + "px";
  if (right && rw) right.style.width = rw + "px";
}

function setupSplitters(): void {
  const layout = document.querySelector<HTMLElement>(".editor-layout");
  const sidebar = document.getElementById("editor-sidebar");
  const right = document.getElementById("editor-right-panel");
  const leftSplit = document.getElementById("editor-splitter-left");
  const rightSplit = document.getElementById("editor-splitter-right");
  if (!layout || !sidebar || !right || !leftSplit || !rightSplit) return;

  applySavedPanelWidths();

  // Sidebar splitter — drag right to grow, left to shrink. Clamp 160–600px.
  attachDrag(leftSplit, (dx) => {
    const startW = parseFloat(getComputedStyle(sidebar).width);
    return (d) => {
      const next = Math.max(160, Math.min(600, startW + d));
      sidebar.style.width = next + "px";
      return next;
    };
  }, (finalW) => localStorage.setItem(LS_SIDEBAR_W, String(Math.round(finalW))));

  // Right panel splitter — drag left to grow, right to shrink. Clamp 200–800px.
  attachDrag(rightSplit, () => {
    const startW = parseFloat(getComputedStyle(right).width);
    return (d) => {
      const next = Math.max(200, Math.min(800, startW - d));
      right.style.width = next + "px";
      return next;
    };
  }, (finalW) => localStorage.setItem(LS_RIGHT_W, String(Math.round(finalW))));
}

/** Attach a mousedown → mousemove → mouseup drag pipeline to a handle. */
function attachDrag(
  handle: HTMLElement,
  start: (downX: number) => (delta: number) => number,
  done: (finalW: number) => void,
): void {
  handle.addEventListener("mousedown", (down) => {
    down.preventDefault();
    handle.classList.add("dragging");
    // Disable text selection + force the resize cursor while dragging
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const downX = down.clientX;
    const step = start(downX);
    let lastW = 0;
    const onMove = (e: MouseEvent) => { lastW = step(e.clientX - downX); };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      handle.classList.remove("dragging");
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (lastW) done(lastW);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  // Double-click resets that panel to its stylesheet default (240 / 280).
  handle.addEventListener("dblclick", () => {
    const sidebar = document.getElementById("editor-sidebar");
    const right = document.getElementById("editor-right-panel");
    if (handle.id === "editor-splitter-left" && sidebar) {
      sidebar.style.width = ""; localStorage.removeItem(LS_SIDEBAR_W);
    }
    if (handle.id === "editor-splitter-right" && right) {
      right.style.width = ""; localStorage.removeItem(LS_RIGHT_W);
    }
  });
}

// ── Tab context menu (close / close others / close left / close right / close all)

function showTabCtxMenu(event: MouseEvent, path: string): void {
  // Drop any existing menu first so we don't stack them
  document.querySelectorAll(".tab-ctx-menu").forEach((n) => n.remove());

  const idx = openFiles.findIndex((f) => f.path === path);
  const hasLeft = idx > 0;
  const hasRight = idx >= 0 && idx < openFiles.length - 1;
  const hasOthers = openFiles.length > 1;

  // We used to emit each item with an inline `onclick="..."` built
  // from a handler string, but that was brittle — any path char that
  // needed escaping in an HTML attribute context (apostrophe, ampersand,
  // etc.) could silently break the JS. Instead, tag each item with
  // a `data-action` attribute and bind ONE click listener on the menu
  // that dispatches. Fewer moving parts, no string escaping traps.
  const item = (label: string, action: string, enabled: boolean) =>
    `<div class="tab-ctx-item ${enabled ? "" : "disabled"}"${enabled ? ` data-action="${action}"` : ""}>
       <span>${label}</span>
     </div>`;

  const menu = document.createElement("div");
  menu.className = "tab-ctx-menu";
  menu.innerHTML =
    item("Close", "close", true) +
    item("Close Others", "close-others", hasOthers) +
    `<div class="tab-ctx-sep"></div>` +
    item("Close to the Left", "close-left", hasLeft) +
    item("Close to the Right", "close-right", hasRight) +
    `<div class="tab-ctx-sep"></div>` +
    item("Close All", "close-all", openFiles.length > 0);

  menu.addEventListener("click", (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    switch (action) {
      case "close":        closeFile(path); break;
      case "close-others": closeOtherFiles(path); break;
      case "close-left":   closeFilesToLeft(path); break;
      case "close-right":  closeFilesToRight(path); break;
      case "close-all":    closeAllFiles(); break;
    }
    menu.remove();
  });

  document.body.appendChild(menu);
  // Clamp to viewport
  const x = Math.min(event.clientX, window.innerWidth - 190);
  const y = Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 10);
  menu.style.left = x + "px";
  menu.style.top = y + "px";

  // Dismiss on any outside click / escape / scroll
  const dismiss = (e?: Event) => {
    if (e && menu.contains(e.target as Node)) return;
    menu.remove();
    document.removeEventListener("mousedown", dismiss, true);
    document.removeEventListener("keydown", keydown, true);
    document.removeEventListener("scroll", dismiss, true);
  };
  const keydown = (e: KeyboardEvent) => { if (e.key === "Escape") dismiss(); };
  // Defer one tick so the click that opened the menu doesn't immediately close it
  setTimeout(() => {
    document.addEventListener("mousedown", dismiss, true);
    document.addEventListener("keydown", keydown, true);
    document.addEventListener("scroll", dismiss, true);
  }, 0);
}

function closeTabCtxMenu(): void {
  document.querySelectorAll(".tab-ctx-menu").forEach((n) => n.remove());
}

function closeOtherFiles(keepPath: string): void {
  const toClose = openFiles.filter((f) => f.path !== keepPath).map((f) => f.path);
  toClose.forEach((p) => closeFile(p));
}

function closeFilesToLeft(ofPath: string): void {
  const idx = openFiles.findIndex((f) => f.path === ofPath);
  if (idx < 1) return;
  const toClose = openFiles.slice(0, idx).map((f) => f.path);
  toClose.forEach((p) => closeFile(p));
}

function closeFilesToRight(ofPath: string): void {
  const idx = openFiles.findIndex((f) => f.path === ofPath);
  if (idx < 0 || idx >= openFiles.length - 1) return;
  const toClose = openFiles.slice(idx + 1).map((f) => f.path);
  toClose.forEach((p) => closeFile(p));
}

function closeAllFiles(): void {
  // Snapshot the list — closeFile() mutates openFiles as we iterate
  const toClose = openFiles.map((f) => f.path);
  toClose.forEach((p) => closeFile(p));
}

(window as any).__editorToggleMenu = toggleMenu;
(window as any).__editorCtxMenu = showCtxMenu;
(window as any).__editorNewFile = newFile;
(window as any).__editorNewFolder = newFolder;
(window as any).__editorRename = renameItem;
(window as any).__editorDelete = deleteItem;
(window as any).__editorDuplicate = duplicateFile;
(window as any).__editorToggleDir = toggleDir;
(window as any).__editorOpenFile = openFile;
(window as any).__editorSwitchFile = switchToFile;
(window as any).__editorCloseFile = closeFile;
(window as any).__editorCloseAll = closeAllFiles;
(window as any).__editorCloseLeft = closeFilesToLeft;
(window as any).__editorCloseRight = closeFilesToRight;
(window as any).__editorCloseOthers = closeOtherFiles;
(window as any).__editorTabCtxMenu = showTabCtxMenu;
(window as any).__editorTabCtxClose = closeTabCtxMenu;
(window as any).__editorPopOut = popOut;
(window as any).__editorSave = saveCurrentFile;
(window as any).__editorToggleAI = toggleAI;
(window as any).__editorAISend = aiSend;
(window as any).__editorAIExplain = aiExplain;
(window as any).__editorAIRefactor = aiRefactor;
(window as any).__editorAIImage = aiImagePrompt;
// Session panel wiring — tab switch, mode toggle, stub action buttons.
// Exposed on window because the corresponding DOM nodes use onclick
// attributes; refactor these to addEventListener once slice 2 lands.
(window as any).__editorTabSwitch = switchTab;
(window as any).__editorSetMode = setSessionMode;
(window as any).__editorSessionRevise = sessionRevise;
(window as any).__editorSessionApply = sessionApply;
(window as any).__editorSessionCancel = sessionCancel;
(window as any).__editorSessionStart = startSession;
(window as any).__editorSessionStartFromActivity = startSessionFromActivity;
(window as any).__editorOpenPlanSwitcher = openPlanSwitcher;
(window as any).__editorPlanSwitcher = openPlanSwitcher;
(window as any).__editorToggleCompletion = toggleCompletion;
(window as any).__editorPlanSwitch = switchPlan;
(window as any).__editorPlanOpen = openPlanFile;
(window as any).__editorPlanCreate = createPlanFromModal;
(window as any).__editorPlanRun = runCurrentPlan;
(window as any).__editorPlanStop = stopPlanRun;
(window as any).__editorThoughtAct = actOnThought;
(window as any).__editorThoughtDismiss = dismissThoughtChip;
(window as any).__editorThoughtsClearAll = clearAllThoughts;

// AI code-block toolbar actions — wired into the onclick= attributes
// emitted by formatAIResponse(). Registering here (not inline) keeps
// raw AI output out of inline handlers and lets us swap the impl
// without regenerating every previous message.
(window as any).__aiBlockCopy = aiBlockCopy;
(window as any).__aiBlockInsert = aiBlockInsert;
(window as any).__aiBlockApply = aiBlockApply;
(window as any).__aiBlockSaveAs = aiBlockSaveAs;
(window as any).__aiBlockToggle = aiBlockToggle;

// Prevent browser default Ctrl+S when editor is active
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "s" && activeFile) {
    e.preventDefault();
    saveCurrentFile();
  }
});

// Enter to send in AI input / deps search
document.addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement;
  if (target?.id === "editor-ai-input" && e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    aiSend();
  }
  if (target?.id === "deps-search-input" && e.key === "Enter") {
    e.preventDefault();
    depsSearch();
  }
});

// Keyboard shortcuts for file operations
document.addEventListener("keydown", (e) => {
  if (!activeFile && !document.querySelector(".editor-layout")) return;
  const inInput = (e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA";
  if (inInput) return;

  // Ctrl+N — new file in current expanded dir
  if ((e.ctrlKey || e.metaKey) && e.key === "n" && !e.shiftKey) {
    e.preventDefault();
    const dir = activeFile ? activeFile.split("/").slice(0, -1).join("/") || "." : ".";
    newFile(dir);
  }
  // Ctrl+Shift+N — new folder
  if ((e.ctrlKey || e.metaKey) && e.key === "N" && e.shiftKey) {
    e.preventDefault();
    const dir = activeFile ? activeFile.split("/").slice(0, -1).join("/") || "." : ".";
    newFolder(dir);
  }
  // F2 — rename active file
  if (e.key === "F2" && activeFile) {
    e.preventDefault();
    renameItem(activeFile, false);
  }
  // Delete — delete active file (only when not in editor)
  if (e.key === "Delete" && activeFile && !(e.target as HTMLElement)?.closest(".cm-editor")) {
    e.preventDefault();
    deleteItem(activeFile, false);
  }
});
