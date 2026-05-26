import { api, esc } from "../api.js";
import {
  chat as aiChat,
  ChatMessage,
  generateImage as aiGenerateImage,
  probeEndpoint,
  ragSearch,
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
import { detectFramework, getFrameworkOverlay } from "../framework-context.js";
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
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, Decoration, MatchDecorator, ViewPlugin } from "@codemirror/view";
import type { ViewUpdate, DecorationSet } from "@codemirror/view";
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

// ── Twig decoration overlay ──
//
// CodeMirror's lang-html owns the HTML grammar. We layer a
// MatchDecorator on top that recognises Twig's three delimiter
// shapes:
//   - `{% ... %}` — control flow (extends, block, if, for, set, …)
//   - `{{ ... }}` — value interpolation
//   - `{# ... #}` — comments
//
// Each match gets a distinct CSS class so the editor's theme can
// colour them. Without this overlay, Twig markers blend into the
// HTML payload and the file reads like grey text.
const TWIG_DECORATION_REGEX = /\{%[-+]?[\s\S]*?[-+]?%\}|\{\{[-+]?[\s\S]*?[-+]?\}\}|\{#[\s\S]*?#\}/g;

function twigClassFor(match: string): string {
  if (match.startsWith("{%")) return "tw-tag";
  if (match.startsWith("{{")) return "tw-expr";
  if (match.startsWith("{#")) return "tw-comment";
  return "tw-tag";
}

const twigMatchDecorator = new MatchDecorator({
  regexp: TWIG_DECORATION_REGEX,
  decoration: (match) => Decoration.mark({
    class: twigClassFor(match[0]),
    attributes: { "data-twig": twigClassFor(match[0]) },
  }),
});

function twigDecorationExt() {
  return [
    ViewPlugin.fromClass(class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = twigMatchDecorator.createDeco(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = twigMatchDecorator.updateDeco(update, this.decorations);
        }
      }
    }, { decorations: (v) => v.decorations }),
    EditorView.baseTheme({
      ".tw-tag":     { color: "#cba6f7", fontWeight: "600" },        // mauve — control flow
      ".tw-expr":    { color: "#f9e2af" },                           // yellow — value
      ".tw-comment": { color: "#6c7086", fontStyle: "italic" },      // overlay grey — comment
    }),
  ];
}

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
    // Twig templates use Jinja2-style syntax — `{%`, `{{`, `{#`,
    // `extends`/`block`/`if`/`for` keywords — embedded inside HTML.
    // Earlier we just used the Jinja2 stream-mode for the whole file,
    // but that meant `<h1>`, `<p>`, attribute strings etc. all rendered
    // as plain text — readers asked for HTML tag colour to come
    // through. Now we use html() as the base language so HTML
    // structure gets full lang-html highlighting, AND overlay a
    // decoration extension that visually distinguishes Twig
    // delimiters (`{% ... %}`, `{{ ... }}`, `{# ... #}`) on top.
    case "twig":
    case "jinja":
    case "jinja2":
    case "frond": return [html(), twigDecorationExt()];
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
        <!-- Threads pane (embedded — replaces the old session+tabs UI).
             The developer needs to see file tree + editor + chat at
             once, so this lives in the right pane rather than a modal.
             Two views: LIST (cards with status pills) and DETAIL
             (chat + reply input). Same supervisor pipeline as before;
             only the visual shell changed. -->
        <div id="editor-ai-panel" class="right-panel-view threads-pane">

          <!-- LIST VIEW header — when looking at the thread list. -->
          <header class="threads-pane-head" id="threads-pane-head-list">
            <h3 class="threads-pane-title">Threads</h3>
            <button type="button" class="threads-new-btn" onclick="window.__threadsNew()" title="Start a new conversation">+ New</button>
          </header>

          <!-- DETAIL VIEW header — when inside a thread. Includes the
               back arrow + thread title + small action menu (rename,
               archive done, etc). -->
          <header class="threads-pane-head threads-pane-head-detail" id="threads-pane-head-detail" hidden>
            <button type="button" class="threads-back-btn" onclick="window.__threadsShowList()" title="Back to thread list" aria-label="Back">&larr;</button>
            <h3 class="threads-pane-title" id="threads-detail-title">Thread</h3>
            <button type="button" class="threads-icon-btn" onclick="window.__threadsRenameActive()" title="Rename thread" aria-label="Rename">&#9998;</button>
            <button type="button" class="threads-icon-btn" onclick="window.__threadsArchiveActive()" title="Archive as done" aria-label="Archive">&#10003;</button>
          </header>

          <!-- LIST body: clickable rows -->
          <div class="threads-list-view" id="threads-list-view">
            <div class="threads-rows" id="threads-rows">
              <div class="threads-empty">Loading…</div>
            </div>
          </div>

          <!-- DETAIL body: status pill strip + chat + reply input. The
               #editor-ai-messages id is kept on the chat container for
               backward compat with legacy callers (addAIMessage etc.). -->
          <div class="threads-detail-view" id="threads-detail-view" hidden>
            <div class="threads-detail-meta" id="threads-detail-meta"></div>
            <div id="editor-ai-messages" class="threads-chat"></div>
            <form class="threads-reply" id="threads-reply-form">
              <div class="threads-reply-row">
                <textarea
                  id="threads-reply-input"
                  rows="2"
                  placeholder='Reply (Enter to send) — start with "New Topic:" to spawn a fresh thread'
                  aria-label="Reply"></textarea>
                <button type="submit" class="threads-send-btn" id="threads-send-btn" aria-label="Send" title="Send (Enter)">&uarr;</button>
              </div>
            </form>
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
  // (removed: old session-tab restore — Activity/Plan/Diff/Checks
  // tabs no longer exist; the threads pane is always active.)
  startHealthPoll();
  refreshCompletionIndicator();
  reviveSessionFromStorage().catch(() => { /* offline is fine */ });
  // Repaint persisted chat bubbles so a refresh doesn't wipe context.
  // chatHistory was already loaded from localStorage at module init;
  // we just need to render the user/assistant messages back into the
  // activity panel. System messages are filtered out (rebuilt per turn).
  restoreChatBubbles();
}

/** Re-render chat bubbles from `chatHistory` after a page reload. The
 *  activity panel starts with the placeholder "How can I help…" line;
 *  if there's any persisted history, drop the placeholder and replay
 *  the user/assistant turns in order. Tool-call metadata is lost
 *  (we don't persist it) — that's fine, it was a per-turn artefact. */
function restoreChatBubbles(): void {
  const persistable = chatHistory.filter((m) => m.role !== "system");
  if (persistable.length === 0) return;
  const container = document.getElementById("editor-ai-messages");
  if (!container) return;
  // Drop the "How can I help with this file?" placeholder when we
  // have real history to show.
  const placeholder = container.querySelector(".ai-msg.ai-bot");
  if (placeholder && placeholder.textContent?.trim().startsWith("How can I help")) {
    placeholder.remove();
  }
  for (const m of persistable) {
    if (m.role === "user") {
      addAIMessage(esc(String(m.content)), "user");
    } else if (m.role === "assistant") {
      const bubble = document.createElement("div");
      bubble.className = "ai-msg ai-bot";
      bubble.innerHTML = formatAIResponse(String(m.content));
      container.appendChild(bubble);
    }
  }
  container.scrollTop = container.scrollHeight;
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
  // WebSocket URL — always point at the page's own origin. The
  // framework (PHP / Python / Ruby / Node) serves `/__dev_reload`
  // on the same host:port as the SPA itself, so reusing
  // `location.host` keeps the client framework-agnostic and
  // port-agnostic. Previously we hardcoded `:7200` (the rust CLI's
  // dev-proxy port) which broke every framework where the CLI
  // wasn't in front of the server.
  const wsProto = location.protocol === "https:" ? "wss" : "ws";
  const wsUrl = `${wsProto}://${location.host}/__dev_reload`;
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
  // Earlier versions tried to re-bootstrap the SPA inside the popup
  // by re-importing Editor.ts via Vite's /@fs/ shim. That only works
  // during `npm run dev` — in the deployed (composer install) bundle
  // the @fs path doesn't exist, the import rejects silently, and the
  // new window stays blank. Users clicked the button and nothing
  // happened.
  //
  // Simpler + working: open the same dev-admin URL in a new tab.
  // The existing SPA bootstraps itself from scratch there, the user
  // gets a second editor instance, localStorage keeps each tab's
  // workspace state separate because open files are scoped to the
  // page. Zero moving parts.
  const adminUrl = `${window.location.origin}/__dev`;
  const win = window.open(adminUrl, "_blank", "noopener,noreferrer");
  if (!win) {
    // Popup blocker fired — fall back to a nav hint the user can
    // dismiss. Better than silent failure.
    alert(
      "Couldn't open a new dev-admin window. Your browser's popup blocker may be active — allow popups for this site, or open /__dev manually in a new tab.",
    );
  }
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

    /* ── Threads pane (embedded in right panel) ── */
    .threads-pane { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
    .threads-pane-head {
      display: flex; align-items: center; gap: 0.4rem;
      padding: 0.55rem 0.7rem; background: #181825;
      border-bottom: 1px solid #313244; flex-shrink: 0;
    }
    .threads-pane-head[hidden] { display: none; }
    .threads-pane-title {
      flex: 1; margin: 0; font-size: 0.85rem; font-weight: 600;
      color: #cdd6f4;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .threads-back-btn, .threads-icon-btn {
      background: transparent; border: 1px solid #313244; color: #cdd6f4;
      width: 26px; height: 26px; padding: 0; border-radius: 4px;
      font-size: 0.85rem; line-height: 1; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .threads-back-btn:hover, .threads-icon-btn:hover { background: rgba(137,180,250,0.12); border-color: #89b4fa; }
    .threads-new-btn {
      background: transparent; border: 1px solid #89b4fa; color: #89b4fa;
      padding: 0.2rem 0.6rem; border-radius: 4px; cursor: pointer;
      font-size: 0.72rem; font-weight: 600; line-height: 1.4;
    }
    .threads-new-btn:hover { background: rgba(137,180,250,0.12); }

    /* List + detail bodies share the flex shell — only one visible at a time. */
    .threads-list-view, .threads-detail-view {
      flex: 1; display: flex; flex-direction: column; min-height: 0;
    }
    .threads-list-view[hidden], .threads-detail-view[hidden] { display: none; }
    .threads-rows { flex: 1; overflow-y: auto; padding: 0.2rem 0; }
    .threads-empty {
      padding: 1.5rem 0.8rem; text-align: center; color: #9399b2;
      font-size: 0.78rem; font-style: italic;
    }

    /* Row cards — denser than the modal version since the pane is narrower (280px). */
    .thread-row-card {
      padding: 0.55rem 0.7rem; cursor: pointer;
      border-bottom: 1px solid #1e1e2e;
      transition: background 0.12s;
      position: relative;
    }
    .thread-row-card:hover { background: #181825; }
    .thread-row-card.active { background: rgba(137,180,250,0.1); border-left: 2px solid #89b4fa; padding-left: calc(0.7rem - 2px); }
    /* Per-row archive × — invisible until the row is hovered so the
       list stays clean. Stop-propagation prevents the click from also
       triggering the row's open-detail handler. */
    .thread-row-archive {
      position: absolute; top: 4px; right: 4px;
      background: transparent; border: none;
      color: #9399b2; cursor: pointer;
      width: 18px; height: 18px; padding: 0; line-height: 1;
      border-radius: 3px; font-size: 0.85rem;
      opacity: 0; transition: opacity 0.12s, background 0.12s;
    }
    .thread-row-card:hover .thread-row-archive { opacity: 0.7; }
    .thread-row-archive:hover { opacity: 1 !important; background: rgba(243,139,168,0.15); color: #f38ba8; }
    .thread-row-line1 {
      display: flex; align-items: center; gap: 0.4rem;
      margin-bottom: 0.25rem; font-size: 0.65rem; min-width: 0;
    }
    .thread-row-date { color: #9399b2; font-family: ui-monospace, "SF Mono", monospace; font-size: 0.6rem; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .thread-row-count { margin-left: auto; color: #9399b2; flex-shrink: 0; }
    .thread-row-preview {
      font-size: 0.78rem; color: #cdd6f4; line-height: 1.35;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden; text-overflow: ellipsis; min-width: 0; overflow-wrap: anywhere;
    }

    /* Status pills (reference UX text labels). */
    .status-pill {
      display: inline-block; padding: 0.05rem 0.4rem; border-radius: 3px;
      font-size: 0.58rem; font-weight: 700; letter-spacing: 0.04em;
      text-transform: uppercase; line-height: 1.4;
      border: 1px solid transparent; flex-shrink: 0;
    }
    .status-pill[data-status="done"]              { background: rgba(166,227,161,0.15); color: #a6e3a1; border-color: rgba(166,227,161,0.3); }
    .status-pill[data-status="awaiting_customer"] { background: rgba(203,166,247,0.15); color: #cba6f7; border-color: rgba(203,166,247,0.3); }
    .status-pill[data-status="wont_do"]           { background: rgba(147,153,178,0.15); color: #9399b2; border-color: rgba(147,153,178,0.3); }
    .status-pill[data-status="blocked"]           { background: rgba(243,139,168,0.15); color: #f38ba8; border-color: rgba(243,139,168,0.3); }
    .status-pill[data-status="feedback"]          { background: rgba(250,179,135,0.15); color: #fab387; border-color: rgba(250,179,135,0.3); }
    .status-pill[data-status="running"]           { background: rgba(137,180,250,0.15); color: #89b4fa; border-color: rgba(137,180,250,0.3); animation: pill-pulse 1.4s ease-in-out infinite; }
    .status-pill[data-status="idle"]              { background: rgba(147,153,178,0.08); color: #9399b2; border-color: rgba(147,153,178,0.2); }
    @keyframes pill-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }

    /* Detail body */
    .threads-detail-meta {
      padding: 0.45rem 0.7rem; border-bottom: 1px solid #313244;
      display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;
      font-size: 0.7rem; color: #9399b2; flex-wrap: wrap;
    }
    .threads-chat {
      flex: 1; overflow-y: auto; padding: 0.6rem;
      display: flex; flex-direction: column; gap: 0.5rem;
    }
    .threads-chat .ai-msg { padding: 0.45rem 0.6rem; border-radius: 6px; max-width: 92%; line-height: 1.4; font-size: 0.8rem; word-wrap: break-word; overflow-wrap: anywhere; }
    .threads-chat .ai-user { align-self: flex-end; background: rgba(137,180,250,0.18); color: #cdd6f4; }
    .threads-chat .ai-bot  { align-self: flex-start; background: #1e1e2e; color: #cdd6f4; }
    /* Action pills — clickable shortcuts under an assistant bubble or
       in empty-state. Pills are suggestions: the user can always type
       a free answer instead. Click sends pill text as next user turn. */
    .action-pills { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.4rem; align-self: flex-start; max-width: 92%; }
    .action-pills.spent { opacity: 0.45; pointer-events: none; }
    .action-pill {
      background: rgba(137,180,250,0.1); border: 1px solid rgba(137,180,250,0.35);
      color: #cdd6f4; padding: 0.2rem 0.7rem; border-radius: 12px;
      font-size: 0.72rem; line-height: 1.4; cursor: pointer;
      transition: background 0.12s, border-color 0.12s, transform 0.08s;
      font-family: inherit;
    }
    .action-pill:hover:not(:disabled) { background: rgba(137,180,250,0.22); border-color: #89b4fa; }
    .action-pill:active:not(:disabled) { transform: scale(0.97); }
    .action-pill:disabled { opacity: 0.4; cursor: not-allowed; text-decoration: line-through; }
    .action-pill-primary {
      background: #89b4fa; color: #1e1e2e; border-color: transparent; font-weight: 600;
    }
    .action-pill-primary:hover:not(:disabled) { background: #b4befe; }
    .threads-reply { padding: 0.5rem 0.6rem 0.6rem; border-top: 1px solid #313244; flex-shrink: 0; }
    .threads-reply-row { display: flex; gap: 0.4rem; align-items: flex-end; }
    .threads-reply-row textarea {
      flex: 1; resize: vertical; min-height: 38px;
      background: #11111b; color: #cdd6f4; border: 1px solid #313244;
      border-radius: 16px; padding: 0.45rem 0.7rem;
      font-family: inherit; font-size: 0.78rem; line-height: 1.4;
    }
    .threads-reply-row textarea:focus { outline: none; border-color: #89b4fa; }
    .threads-send-btn {
      width: 34px; height: 34px; border-radius: 50%; border: none;
      background: #1e1e2e; color: #cdd6f4; font-size: 1rem;
      cursor: pointer; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; line-height: 1; padding: 0;
    }
    .threads-send-btn:hover { background: #313244; }
    .threads-send-btn:disabled { opacity: 0.4; cursor: wait; }

    /* Thread sidebar — left-rail list of conversations inside the
       Activity panel. Each thread row is one line: status pip, title,
       message count. Active thread row has a brighter background. The
       row itself is clickable (switches thread); right-click opens
       rename. The "+ New" button sits at the top in the header. */
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

// Conversation history for the chat panel. Persisted to localStorage
// so an accidental page refresh doesn't wipe context — users were
// losing 10+ turn conversations to a stray ⌘R. We cap at the last
// LS_CHAT_MAX entries so the storage doesn't unbounded-grow.
const LS_CHAT_HISTORY = "tina4.editor.chatHistory.v1";
const LS_CHAT_MAX = 200;

function loadChatHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(LS_CHAT_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveChatHistory(): void {
  try {
    // Drop the system message if it ever survived in the array — it's
    // rebuilt each turn from active-file state and we don't want a
    // stale snapshot pinned across reloads.
    const persistable = chatHistory
      .filter((m) => m.role !== "system")
      .slice(-LS_CHAT_MAX);
    localStorage.setItem(LS_CHAT_HISTORY, JSON.stringify(persistable));
  } catch { /* quota / privacy mode — silent */ }
}
const chatHistory: ChatMessage[] = loadChatHistory();

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

// ── Threads ────────────────────────────────────────────────────────
//
// A "thread" is a sustained conversation with the supervisor. Each
// thread has its own id, title, and server-side message history
// (history.json filtered by thread_id). The sidebar in the Activity
// panel lists them with a status pip — running, needs-input, error,
// done, idle — so you can scan parallel work at a glance.
//
// State model:
//   threadList[]            — all threads (metadata + status_hint)
//   activeThreadId          — which thread the chat UI is showing
//   threadMessageCache      — per-thread message arrays, populated
//                             lazily on first switch and after each
//                             new turn. Avoids re-fetching on every
//                             tab toggle.
//   threadInFlight[id]      — true while an HTTP request is in flight
//                             for this thread. Drives the "running"
//                             pip even though the server doesn't know.

interface ThreadMeta {
  id: string;
  title: string;
  created_at: string;
  last_message_at: string;
  archived: boolean;
  message_count?: number;
  // Status vocabulary matches the Rust agent's compute_thread_status
  // output (see agent.rs). Kept as a wide string so a new server-side
  // status doesn't immediately break the SPA build — the pill renderer
  // falls back to UPPERCASING the raw key when unknown.
  status_hint?:
    | "idle"
    | "done"
    | "awaiting_customer"
    | "wont_do"
    | "blocked"
    | "feedback"
    | "running"
    | "error"
    | "needs_input"
    | string;
  /** "feedback" for customer-feedback tickets, undefined for normal
   *  developer-chat threads. Drives the read-only ticket view + the
   *  NEW FEEDBACK pill. */
  kind?: "feedback" | string;
  /** For feedback threads — who submitted it. Shown as "📨 from <sender>". */
  sender?: string;
  /** When archived, why. "done" or "wont_do" — drives the DONE vs
   *  WONT DO pill copy. Absent on open threads. */
  closure_reason?: "done" | "wont_do" | string;
}

interface ThreadMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  thread_id?: string;
  agent?: string;
}

let threadList: ThreadMeta[] = [];
let activeThreadId: string | null = null;
const threadMessageCache = new Map<string, ThreadMessage[]>();
const threadInFlight = new Set<string>();

const LS_ACTIVE_THREAD = "tina4.editor.activeThread.v1";

async function apiThreadsList(): Promise<ThreadMeta[]> {
  const r = await fetch("/__dev/api/threads");
  if (!r.ok) throw new Error(`threads list ${r.status}`);
  return r.json();
}

async function apiThreadsCreate(title?: string): Promise<ThreadMeta> {
  const r = await fetch("/__dev/api/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(title ? { title } : {}),
  });
  if (!r.ok) throw new Error(`threads create ${r.status}`);
  return r.json();
}

async function apiThreadsPatch(id: string, patch: Partial<ThreadMeta>): Promise<ThreadMeta> {
  const r = await fetch(`/__dev/api/threads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`threads patch ${r.status}`);
  return r.json();
}

async function apiThreadMessages(id: string): Promise<ThreadMessage[]> {
  const r = await fetch(`/__dev/api/threads/${encodeURIComponent(id)}/messages`);
  if (!r.ok) throw new Error(`thread messages ${r.status}`);
  return r.json();
}

/** Re-render the sidebar from threadList. Cheap — only ever updates
 *  innerHTML of #thread-list, which is small. Active row is
 *  highlighted; in-flight threads show "running" status overriding
 *  whatever the server-computed hint was. */
function renderThreadSidebar(): void {
  const list = document.getElementById("thread-list");
  if (!list) return;
  if (!threadList.length) {
    list.innerHTML = `<div class="thread-list-empty">No threads yet — click + New</div>`;
    return;
  }
  // Most-recent first by last_message_at; archived threads at the bottom.
  const sorted = [...threadList]
    .filter((t) => !t.archived)
    .sort((a, b) => (b.last_message_at || "").localeCompare(a.last_message_at || ""));
  list.innerHTML = sorted.map((t) => {
    const status = threadInFlight.has(t.id) ? "running" : (t.status_hint || "idle");
    const activeAttr = t.id === activeThreadId ? " active" : "";
    const count = t.message_count || 0;
    const countLabel = count > 0 ? `<span class="thread-count">${count}</span>` : "";
    return `<div class="thread-row${activeAttr}" data-status="${status}" data-thread-id="${esc(t.id)}"
                 onclick="window.__editorThreadSwitch('${esc(t.id)}')"
                 ondblclick="window.__editorThreadRename('${esc(t.id)}')"
                 title="Double-click to rename">
      <span class="thread-pip"></span>
      <span class="thread-title">${esc(t.title)}</span>
      ${countLabel}
    </div>`;
  }).join("");
}

/** Pull fresh thread list from server; preserve in-flight markers so
 *  the badge for a thread you're actively chatting in doesn't flap
 *  back to idle while the response is mid-flight. */
async function refreshThreadList(): Promise<void> {
  try {
    threadList = await apiThreadsList();
    renderThreadSidebar();
  } catch (e) {
    console.error("refreshThreadList failed", e);
  }
}

/** Repaint the messages container from the cache for one thread.
 *  Doesn't fetch — caller is responsible for ensuring the cache is
 *  populated (loadThreadMessages handles that). */
function paintThreadMessages(threadId: string): void {
  const container = document.getElementById("editor-ai-messages");
  if (!container) return;
  const msgs = threadMessageCache.get(threadId) || [];
  if (!msgs.length) {
    container.innerHTML = `<div class="ai-msg ai-bot" style="opacity:0.6">Start the conversation…</div>`;
    return;
  }
  container.innerHTML = "";
  for (const m of msgs) {
    const div = document.createElement("div");
    div.className = `ai-msg ai-${m.role === "user" ? "user" : "bot"}`;
    if (m.role === "user") {
      div.textContent = m.content;
    } else {
      div.innerHTML = formatAIResponse(m.content);
    }
    container.appendChild(div);
  }
  container.scrollTop = container.scrollHeight;
}

async function loadThreadMessages(threadId: string, force = false): Promise<void> {
  if (!force && threadMessageCache.has(threadId)) return;
  try {
    const msgs = await apiThreadMessages(threadId);
    threadMessageCache.set(threadId, msgs);
  } catch (e) {
    console.error(`loadThreadMessages(${threadId}) failed`, e);
    threadMessageCache.set(threadId, []);
  }
}

/** Switch the active thread. Persists choice to localStorage so reload
 *  lands on the same thread. Triggers a fetch of messages (if not
 *  already cached) and repaints the chat container. */
async function switchThread(threadId: string): Promise<void> {
  if (threadId === activeThreadId) return;
  activeThreadId = threadId;
  try { localStorage.setItem(LS_ACTIVE_THREAD, threadId); } catch {}
  renderThreadSidebar();
  await loadThreadMessages(threadId);
  paintThreadMessages(threadId);
}

/** Create a new thread, switch to it, clear the input. Title defaults
 *  to "New thread" until the user's first message comes in — at which
 *  point the Rust upsert auto-titles it from the message content. */
async function newThread(): Promise<void> {
  try {
    const t = await apiThreadsCreate();
    threadList.push(t);
    threadMessageCache.set(t.id, []);
    await switchThread(t.id);
    const input = document.getElementById("editor-ai-input") as HTMLTextAreaElement | null;
    input?.focus();
  } catch (e) {
    addAIMessage(`<span style="color:var(--danger)">Couldn't create thread: ${esc(String((e as Error)?.message || e))}</span>`, "bot");
  }
}

/** Inline-edit a thread title. Replaces the title span with an input,
 *  blur/Enter commits, Escape cancels. */
async function renameThreadInline(threadId: string): Promise<void> {
  const row = document.querySelector(`.thread-row[data-thread-id="${CSS.escape(threadId)}"]`);
  const titleSpan = row?.querySelector(".thread-title") as HTMLElement | null;
  if (!row || !titleSpan) return;
  const original = titleSpan.textContent || "";
  const input = document.createElement("input");
  input.className = "thread-title-edit";
  input.value = original;
  titleSpan.replaceWith(input);
  input.focus();
  input.select();
  const restore = (text: string) => {
    const span = document.createElement("span");
    span.className = "thread-title";
    span.textContent = text;
    input.replaceWith(span);
  };
  const commit = async () => {
    const next = input.value.trim();
    if (!next || next === original) { restore(original); return; }
    try {
      const updated = await apiThreadsPatch(threadId, { title: next });
      const t = threadList.find((x) => x.id === threadId);
      if (t) t.title = updated.title;
      restore(updated.title);
    } catch (e) {
      console.error("rename failed", e);
      restore(original);
    }
  };
  input.addEventListener("blur", () => { void commit(); });
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); input.blur(); }
    else if (ev.key === "Escape") { ev.preventDefault(); restore(original); }
  });
}

/** First-load bootstrap: fetch threads, pick the most recent (or the
 *  localStorage-remembered active id), populate the cache, paint. If
 *  there are no threads at all, leave the placeholder — the user
 *  clicks + New on the first interaction. */
async function bootstrapThreads(): Promise<void> {
  await refreshThreadList();
  // Embedded pane always defaults to the list view; the developer
  // picks which thread to enter. (The modal version auto-jumped into
  // the last-active thread on open — but the pane is always visible
  // so opening doesn't happen, and presenting the list as the home
  // gives an at-a-glance inbox view of what needs attention.)
  if (!threadList.length) {
    activeThreadId = null;
    renderThreadsListView();
    return;
  }
  // Restore last-active thread id locally so a Send (which assumes
  // activeThreadId is set) still works after reload — but stay on
  // the list view visually.
  try {
    const pickId = localStorage.getItem(LS_ACTIVE_THREAD);
    if (pickId && threadList.some((t) => t.id === pickId)) {
      activeThreadId = pickId;
    }
  } catch {}
  threadsShowList();
}

// Expose for the inline HTML onclick handlers in the sidebar.
(window as any).__editorThreadNew = () => { void newThread(); };
(window as any).__editorThreadSwitch = (id: string) => { void switchThread(id); };
(window as any).__editorThreadRename = (id: string) => { void renameThreadInline(id); };

// ── Threads pane (embedded in the right panel) ──────────────────────
//
// Two views inside the pane: LIST and DETAIL. The pane is always
// visible — no modal, no open/close. switchView() toggles the right
// pair of header + body elements. Same supervisor pipeline as before;
// only the visual shell changed.

/** Status pill copy — matches the reference UX (uppercase text labels
 *  not coloured balls). Map is server-side status_hint → display text;
 *  if the server emits a status we don't know about we fall back to
 *  the raw key so it's visible (not silently swallowed). */
const STATUS_PILL_LABELS: Record<string, string> = {
  done: "DONE",
  awaiting_customer: "AWAITING YOU",
  wont_do: "WONT DO",
  blocked: "BLOCKED",
  feedback: "NEW FEEDBACK",
  idle: "IDLE",
  running: "RUNNING",
};

function statusPillHtml(status: string): string {
  const label = STATUS_PILL_LABELS[status] || status.toUpperCase();
  return `<span class="status-pill" data-status="${esc(status)}">${esc(label)}</span>`;
}

/** Format an ISO timestamp / Unix-secs-with-Z string into the
 *  reference's "DD/MM/YYYY HH:MM" format. Defensive against the
 *  Rust agent's slightly weird timestamp format (the existing
 *  "1779817292Z" pattern is unix-seconds-then-Z; new ones might
 *  be proper ISO — handle both). */
function fmtThreadDate(s: string): string {
  if (!s) return "";
  let d: Date;
  if (/^\d+Z$/.test(s)) {
    d = new Date(parseInt(s, 10) * 1000);
  } else {
    d = new Date(s);
  }
  if (isNaN(d.getTime())) return s;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

let threadsPaneView: "list" | "detail" = "list";
let threadsPaneAbort: AbortController | null = null;

function threadsShowList(): void {
  threadsPaneView = "list";
  const el = (id: string) => document.getElementById(id);
  el("threads-pane-head-list")!.hidden = false;
  el("threads-pane-head-detail")!.hidden = true;
  el("threads-list-view")!.hidden = false;
  el("threads-detail-view")!.hidden = true;
  void refreshThreadList().then(renderThreadsListView);
}

async function threadsShowDetail(threadId: string): Promise<void> {
  threadsPaneView = "detail";
  await switchThread(threadId);  // updates activeThreadId, populates cache
  const meta = threadList.find((t) => t.id === threadId);
  if (!meta) return;
  const el = (id: string) => document.getElementById(id);
  el("threads-pane-head-list")!.hidden = true;
  el("threads-pane-head-detail")!.hidden = false;
  el("threads-list-view")!.hidden = true;
  el("threads-detail-view")!.hidden = false;
  el("threads-detail-title")!.textContent = meta.title || "Thread";
  // Meta strip: pill + sender (for feedback threads) + date.
  const metaEl = el("threads-detail-meta")!;
  const senderHtml = meta.sender ? `<span>📨 from ${esc(meta.sender)}</span>` : "";
  metaEl.innerHTML = `${statusPillHtml(meta.status_hint || "idle")} <span>${esc(fmtThreadDate(meta.last_message_at))}</span> ${senderHtml}`;
  // Paint messages into the in-pane chat container.
  paintThreadsChat(threadId);
  // Focus the reply input.
  setTimeout(() => (el("threads-reply-input") as HTMLTextAreaElement | null)?.focus(), 30);
}

/** Archive the active thread as done. ✓ button in the detail header.
 *  Closes the thread (PATCH archived=true + closure_reason="done"),
 *  pops back to the list. */
async function threadsArchiveActive(): Promise<void> {
  if (!activeThreadId) return;
  const id = activeThreadId;
  try {
    await apiThreadsPatch(id, { archived: true, closure_reason: "done" } as any);
    // Optimistically update local state so the list reflects immediately.
    const meta = threadList.find((t) => t.id === id);
    if (meta) { meta.archived = true; meta.closure_reason = "done"; }
    activeThreadId = null;
    threadsShowList();
  } catch (e) {
    console.error("archive failed", e);
  }
}

/** Archive a thread directly from the list × button. No confirm —
 *  archive is reversible (data stays on disk), and adding a confirm
 *  to every dismissal would be friction. If the user nukes the wrong
 *  one, threads.json on disk still has the row with archived:true. */
async function threadsArchiveFromList(id: string): Promise<void> {
  try {
    await apiThreadsPatch(id, { archived: true } as any);
    const meta = threadList.find((t) => t.id === id);
    if (meta) meta.archived = true;
    // If we were viewing the killed thread, fall back to list view.
    if (activeThreadId === id) {
      activeThreadId = null;
      threadsShowList();
    } else {
      renderThreadsListView();
    }
  } catch (e) {
    console.error("archive-from-list failed", e);
  }
}

function renderThreadsListView(): void {
  const rows = document.getElementById("threads-rows");
  if (!rows) return;
  if (!threadList.length) {
    rows.innerHTML = `
      <div class="threads-empty">
        <div style="margin-bottom:0.6rem">No threads yet.</div>
        <button type="button" class="action-pill action-pill-primary"
                onclick="window.__threadsNew()">Get started</button>
      </div>`;
    return;
  }
  const sorted = [...threadList]
    .filter((t) => !t.archived)
    .sort((a, b) => (b.last_message_at || "").localeCompare(a.last_message_at || ""));
  rows.innerHTML = sorted.map((t) => {
    const status = threadInFlight.has(t.id) ? "running" : (t.status_hint || "idle");
    const date = fmtThreadDate(t.last_message_at);
    const count = t.message_count || 0;
    // Pull the first user message from the cache as a preview, if we
    // already have messages loaded. Otherwise just the title.
    const cached = threadMessageCache.get(t.id) || [];
    const firstUser = cached.find((m) => m.role === "user");
    const preview = firstUser ? firstUser.content : t.title;
    return `<div class="thread-row-card" data-thread-id="${esc(t.id)}"
                 onclick="window.__threadsShowDetail('${esc(t.id)}')">
      <button type="button" class="thread-row-archive"
              onclick="event.stopPropagation();window.__threadsArchiveFromList('${esc(t.id)}')"
              title="Archive this thread" aria-label="Archive">&times;</button>
      <div class="thread-row-line1">
        ${statusPillHtml(status)}
        <span class="thread-row-date">&middot; ${esc(date)}</span>
        <span class="thread-row-count">${count} msg</span>
      </div>
      <div class="thread-row-preview">${esc(preview)}</div>
    </div>`;
  }).join("");
}

/** Extract pills from a stored assistant message.
 *
 *  The backend persists pills as a trailing HTML comment
 *  `<!--TINA4_PILLS:["opt1","opt2"]-->` appended after the message
 *  text. Returns { display: the user-visible text without the marker,
 *  pills: parsed array or [] }. Keeps the storage scheme out of the
 *  rendered DOM. */
const PILLS_MARKER = /\n?<!--TINA4_PILLS:(\[.*?\])-->\s*$/;
function extractPills(content: string): { display: string; pills: string[] } {
  const m = content.match(PILLS_MARKER);
  if (!m) return { display: content, pills: [] };
  let pills: string[] = [];
  try { pills = JSON.parse(m[1]); } catch {}
  return { display: content.replace(PILLS_MARKER, ""), pills };
}

/** Render a row of action pills under an assistant bubble. Clicking
 *  a pill sends its text as the next user turn immediately (no
 *  intermediate edit step — pill IS the answer). Pills are only
 *  attached to the LAST assistant message; older pills get stripped
 *  during repaint so they can't be clicked retroactively. */
function renderPills(host: HTMLElement, pills: string[]): void {
  if (!pills.length) return;
  const row = document.createElement("div");
  row.className = "action-pills";
  for (const p of pills) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "action-pill";
    b.textContent = p;
    b.addEventListener("click", () => {
      // Mark all pills in this row as spent so they can't be clicked twice.
      row.querySelectorAll(".action-pill").forEach((el) => el.setAttribute("disabled", ""));
      row.classList.add("spent");
      void threadsSendPillText(p);
    });
    row.appendChild(b);
  }
  host.appendChild(row);
}

/** Pill-click send. Same as threadsSend but takes the text from the
 *  pill rather than the textarea. Doesn't touch the input — the user
 *  may have something half-typed they want to keep. */
async function threadsSendPillText(text: string): Promise<void> {
  const input = document.getElementById("threads-reply-input") as HTMLTextAreaElement | null;
  if (input) {
    // Temporarily stash the pill text so threadsSend reads it. After
    // sending, restore whatever the user had typed.
    const stash = input.value;
    input.value = text;
    try { await threadsSend(); } finally {
      // If the input was empty before, leave it empty; otherwise
      // restore the user's half-typed message.
      if (stash) input.value = stash;
    }
  }
}

function paintThreadsChat(threadId: string): void {
  const chat = document.getElementById("threads-chat");
  if (!chat) return;
  const msgs = threadMessageCache.get(threadId) || [];
  if (!msgs.length) {
    chat.innerHTML = `<div class="ai-msg ai-bot" style="opacity:0.6">Start the conversation…</div>`;
    return;
  }
  chat.innerHTML = "";
  // Find the index of the last assistant message — only IT gets pills.
  // Earlier pills are stale (the user already moved past that question).
  let lastAssistantIdx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "assistant") { lastAssistantIdx = i; break; }
  }
  msgs.forEach((m, i) => {
    const div = document.createElement("div");
    div.className = `ai-msg ai-${m.role === "user" ? "user" : "bot"}`;
    if (m.role === "user") {
      div.textContent = m.content;
      chat.appendChild(div);
      return;
    }
    // Assistant turn — extract pills, render only on the last one.
    const meta = threadList.find((t) => t.id === threadId);
    const { display, pills } = extractPills(m.content);
    if (meta?.kind === "feedback") {
      div.innerHTML = renderFeedbackTicket(display);
    } else {
      div.innerHTML = formatAIResponse(display);
    }
    chat.appendChild(div);
    if (i === lastAssistantIdx) {
      renderPills(chat, pills);
    }
  });
  chat.scrollTop = chat.scrollHeight;
}

function renderFeedbackTicket(jsonContent: string): string {
  try {
    const t = JSON.parse(jsonContent);
    return `
      <div style="display:flex;flex-direction:column;gap:0.3rem">
        <div style="font-weight:600">${esc(t.title || "(no title)")}</div>
        <div style="display:flex;gap:0.4rem;font-size:0.7rem;color:#9399b2">
          <span>category: ${esc(t.category || "-")}</span>
          <span>severity: ${esc(t.severity || "-")}</span>
        </div>
        <div style="margin-top:0.3rem">${esc(t.summary || "")}</div>
      </div>`;
  } catch {
    return formatAIResponse(jsonContent);
  }
}

async function threadsNew(): Promise<void> {
  try {
    const t = await apiThreadsCreate();
    threadList.push(t);
    threadMessageCache.set(t.id, []);
    await threadsShowDetail(t.id);
  } catch (e) {
    console.error("threadsNew failed", e);
  }
}

async function threadsRenameActive(): Promise<void> {
  if (!activeThreadId) return;
  const meta = threadList.find((t) => t.id === activeThreadId);
  if (!meta) return;
  const next = window.prompt("Rename thread:", meta.title);
  if (next == null || next.trim() === "" || next === meta.title) return;
  try {
    const updated = await apiThreadsPatch(activeThreadId, { title: next.trim() });
    meta.title = updated.title;
    const titleEl = document.getElementById("threads-detail-title");
    if (titleEl) titleEl.textContent = updated.title;
    renderThreadsListView();
  } catch (e) {
    console.error("rename failed", e);
  }
}

/** Modal-scoped send. Wires the reply textarea to supervisorChat
 *  with the modal's chat container as the render target. Detects
 *  the "New Topic:" prefix and spawns a fresh thread first.
 *  (Task 29 is technically the prefix work but it's three lines so
 *  I do it here while everything is hot.) */
async function threadsSend(): Promise<void> {
  const input = document.getElementById("threads-reply-input") as HTMLTextAreaElement | null;
  if (!input) return;
  let msg = input.value.trim();
  if (!msg) return;
  input.value = "";

  // Detect "New Topic:" prefix (case-insensitive). Strip it, create
  // a new thread, switch into it, then send the rest as the first
  // turn. Empty message after stripping = just opens the new thread.
  const m = msg.match(/^new topic:\s*(.*)$/is);
  if (m) {
    const rest = m[1].trim();
    try {
      const t = await apiThreadsCreate(rest.slice(0, 80) || undefined);
      threadList.push(t);
      threadMessageCache.set(t.id, []);
      await threadsShowDetail(t.id);
      if (!rest) return;
      msg = rest;
    } catch (e) {
      console.error("New Topic spawn failed", e);
      return;
    }
  }

  if (!activeThreadId) {
    // Shouldn't happen — detail view requires an active thread — but
    // guard anyway.
    try {
      const t = await apiThreadsCreate(msg.slice(0, 80));
      threadList.push(t);
      threadMessageCache.set(t.id, []);
      activeThreadId = t.id;
    } catch (e) {
      console.error("auto-create failed", e);
      return;
    }
  }

  const threadId = activeThreadId!;

  // Local cache append + immediate paint so the user's bubble shows
  // up instantly while the supervisor is still thinking.
  const cache = threadMessageCache.get(threadId) || [];
  cache.push({
    id: `local-${Date.now()}`,
    role: "user",
    content: msg,
    timestamp: new Date().toISOString(),
    thread_id: threadId,
  });
  threadMessageCache.set(threadId, cache);
  paintThreadsChat(threadId);

  threadInFlight.add(threadId);
  renderThreadsListView();
  const chat = document.getElementById("threads-chat");
  threadsPaneAbort?.abort();
  threadsPaneAbort = new AbortController();
  try {
    await supervisorChat(msg, threadId, threadsPaneAbort.signal, chat);
  } catch (e: any) {
    if (e?.name !== "AbortError") {
      const errDiv = document.createElement("div");
      errDiv.className = "ai-msg ai-bot";
      errDiv.style.color = "var(--danger,#f38ba8)";
      errDiv.textContent = `Connection failed: ${e?.message || e}`;
      chat?.appendChild(errDiv);
    }
  } finally {
    threadInFlight.delete(threadId);
    threadsPaneAbort = null;
    try { await loadThreadMessages(threadId, /*force=*/true); } catch {}
    await refreshThreadList();
    paintThreadsChat(threadId);
    // Refresh meta strip too in case status_hint changed.
    const meta = threadList.find((t) => t.id === threadId);
    if (meta) {
      const metaEl = document.getElementById("threads-detail-meta")!;
      const senderHtml = meta.sender ? `<span>📨 from ${esc(meta.sender)}</span>` : "";
      metaEl.innerHTML = `${statusPillHtml(meta.status_hint || "idle")} <span>${esc(fmtThreadDate(meta.last_message_at))}</span> ${senderHtml}`;
    }
  }
}

// Wire reply form + Enter-to-send. The form is always in the DOM
// (just hidden when in list view) so event handlers attach cleanly
// once on bootstrap. Using delegated handlers via the form's submit
// event so it works regardless of when the form becomes visible.
queueMicrotask(() => {
  const form = document.getElementById("threads-reply-form") as HTMLFormElement | null;
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      void threadsSend();
    });
  }
  const input = document.getElementById("threads-reply-input") as HTMLTextAreaElement | null;
  if (input) {
    input.addEventListener("keydown", (e) => {
      // Enter sends; Shift+Enter inserts a newline.
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        void threadsSend();
      }
    });
  }
});

// Window shims for inline onclick handlers in renderEditor's HTML.
(window as any).__threadsShowList = () => threadsShowList();
(window as any).__threadsShowDetail = (id: string) => { void threadsShowDetail(id); };
(window as any).__threadsNew = () => { void threadsNew(); };
(window as any).__threadsRenameActive = () => { void threadsRenameActive(); };
(window as any).__threadsArchiveActive = () => { void threadsArchiveActive(); };
(window as any).__threadsArchiveFromList = (id: string) => { void threadsArchiveFromList(id); };

// Kick off the bootstrap once the DOM is rendered. The renderEditor()
// builder writes the sidebar markup synchronously, so we can fetch on
// the next tick safely.
queueMicrotask(() => { void bootstrapThreads(); });

/**
 * Supervisor-mode chat: routes the turn through POST /__dev/api/chat,
 * which the Python dev_admin proxies to the Rust agent's /chat endpoint.
 *
 * The Rust supervisor runs the full multi-agent loop (supervisor decides
 * → planner / coder / debug / respond) with the Tina4-aware system
 * prompts AND uses Anthropic Claude when ANTHROPIC_API_KEY is set. The
 * response is an SSE stream of typed events:
 *
 *   event: status   data: {"text":"...","agent":"..."}        progress
 *   event: message  data: {"content":"...","agent":"..."}     final reply
 *   event: plan     data: {"content":"...","file":"...","approve":true}
 *   event: error    data: {"message":"..."}
 *   event: done
 *
 * We render `status` into a small grey progress line at the top of the
 * bubble, swap it for the `message`/`plan` content once it arrives, and
 * surface `error` in red. The SPA's chatHistory only retains the final
 * assistant content so the visible timeline stays clean across reloads.
 */
async function supervisorChat(
  msg: string,
  threadId: string | null,
  abortSignal: AbortSignal,
  targetContainer?: HTMLElement | null,
): Promise<void> {
  // When the new threads modal is open it passes #threads-chat as the
  // render target. Old callers (the legacy right-panel path, now hidden
  // but kept for backward compat) get #editor-ai-messages.
  const container = targetContainer
    ?? document.getElementById("threads-chat")
    ?? document.getElementById("editor-ai-messages");
  if (!container) return;

  const bubble = document.createElement("div");
  bubble.className = "ai-msg ai-bot";
  const statusLine = document.createElement("div");
  statusLine.style.cssText = "font-size:0.72rem;opacity:0.7;margin-bottom:0.3rem;font-family:var(--font-mono,monospace)";
  statusLine.innerHTML = '<span style="opacity:0.6">→ supervisor: thinking…</span>';
  const contentDiv = document.createElement("div");
  bubble.appendChild(statusLine);
  bubble.appendChild(contentDiv);
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;

  const response = await fetch("/__dev/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: msg, thread_id: threadId }),
    signal: abortSignal,
  });

  if (!response.ok) {
    let detail = "";
    try { detail = (await response.text()).slice(0, 400); } catch {}
    statusLine.remove();
    contentDiv.innerHTML =
      `<span style="color:var(--danger,#f38ba8)">Supervisor unavailable (HTTP ${response.status}).</span>` +
      (detail ? `<pre style="font-size:0.7rem;opacity:0.7;margin-top:0.3rem;white-space:pre-wrap">${esc(detail)}</pre>` : "") +
      `<div style="font-size:0.75rem;opacity:0.7;margin-top:0.3rem">Run <code>tina4 serve</code> (auto-spawns the agent) or set <code>TINA4_SUPERVISOR_URL</code>.</div>`;
    return;
  }
  if (!response.body) {
    statusLine.remove();
    contentDiv.innerHTML = `<span style="color:var(--danger,#f38ba8)">Supervisor returned no body.</span>`;
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assistantContent = "";
  let touchedFiles: string[] = [];

  // Drain the stream in newline-pair-delimited SSE frames. Each frame
  // is `event: <name>\ndata: <json>\n\n`. We accumulate text into a
  // buffer and parse complete frames as they arrive — partial frames
  // stay in the buffer until the next chunk completes them.
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let frameEnd: number;
    while ((frameEnd = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, frameEnd);
      buffer = buffer.slice(frameEnd + 2);
      let eventName = "message";
      let dataStr = "";
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
      }
      if (!dataStr) continue;
      let payload: any;
      try { payload = JSON.parse(dataStr); } catch { payload = { text: dataStr, content: dataStr }; }

      if (eventName === "status") {
        const agent = String(payload.agent || "supervisor");
        const text = String(payload.text || "");
        statusLine.innerHTML = `<span style="color:var(--info,#89b4fa)">[${esc(agent)}]</span> ${esc(text)}`;
        if (payload.backup) {
          statusLine.innerHTML += ` <span style="opacity:0.5">(backup: ${esc(String(payload.backup))})</span>`;
        }
      } else if (eventName === "message") {
        const agent = String(payload.agent || "supervisor");
        const content = String(payload.content || "");
        assistantContent = content;
        statusLine.innerHTML = `<span style="opacity:0.6">↳ ${esc(agent)}</span>`;
        contentDiv.innerHTML = formatAIResponse(content);
        // Pills arrive on the SSE message payload as
        // suggested_replies: ["opt1", "opt2"]. Render them under the
        // bubble. Any prior pill row on this same bubble is replaced
        // (live updates during streaming).
        const pills = Array.isArray(payload.suggested_replies)
          ? payload.suggested_replies.map((s: any) => String(s)).filter(Boolean)
          : [];
        bubble.querySelectorAll(".action-pills").forEach((el) => el.remove());
        if (pills.length) {
          renderPills(bubble, pills);
        }
        if (Array.isArray(payload.files_changed)) {
          touchedFiles = payload.files_changed.map((s: any) => String(s));
        }
      } else if (eventName === "plan") {
        const content = String(payload.content || "");
        const file = String(payload.file || "");
        assistantContent = content;
        statusLine.innerHTML = `<span style="opacity:0.6">↳ planner</span> · plan saved to <code>${esc(file)}</code>`;
        contentDiv.innerHTML = formatAIResponse(content);
        // Three pills under every plan. Clicking "Make changes" sends
        // that as the user turn; supervisor naturally responds with
        // "what changes?" and the user types specifics. Pills are
        // conversational shortcuts, not whole answers — the user
        // can always type instead.
        if (payload.approve !== false) {
          bubble.querySelectorAll(".action-pills").forEach((el) => el.remove());
          renderPills(bubble, ["Go ahead", "Make changes", "Cancel"]);
        }
      } else if (eventName === "error") {
        const errMsg = String(payload.message || "Supervisor error");
        statusLine.innerHTML = `<span style="color:var(--danger,#f38ba8)">✗ error</span>`;
        contentDiv.innerHTML = `<span style="color:var(--danger,#f38ba8)">${esc(errMsg)}</span>`;
      }
      container.scrollTop = container.scrollHeight;
    }
  }

  // Refresh the file tree for any files the coder wrote. Done after
  // the stream completes so we batch the redraws rather than one per
  // file as they arrive.
  for (const f of touchedFiles) {
    try { await refreshAfterToolMutation(f); } catch {}
  }

  if (assistantContent) {
    chatHistory.push({ role: "assistant", content: assistantContent });
    saveChatHistory();
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
      ? "Ask a question…"
      : "Describe the change…";
  }
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

// ── Image generation (diffusion) ───────────────────────────────────

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

/** Minimal markdown → HTML pass for rendering ```markdown``` fenced
 *  blocks as formatted prose in chat bubbles. Intentionally tiny — we
 *  only care about the constructs the coding LLMs actually emit in
 *  plans: ATX headings, ordered/unordered lists (with two-space
 *  indented sub-items), bold, italic, and inline code. Anything we
 *  don't recognise falls through as escaped text, so malformed input
 *  is safe. The caller keeps the raw markdown in `aiCodeBlocks` so
 *  Copy/Apply still write the untouched source. */
function renderMarkdownInline(md: string): string {
  const inline = (s: string): string =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.3);padding:0.1rem 0.3rem;border-radius:0.2rem">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  const lines = md.split("\n");
  const out: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let subOpen = false;
  const closeSub = () => { if (subOpen) { out.push("</ul>"); subOpen = false; } };
  const closeList = () => { closeSub(); if (listType) { out.push(`</${listType}>`); listType = null; } };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { closeList(); continue; }

    // ATX heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { closeList(); out.push(`<h${h[1].length} style="margin:0.4rem 0 0.2rem;font-size:${1.05 - h[1].length * 0.05}rem">${inline(h[2])}</h${h[1].length}>`); continue; }

    // Sub-item (two-space or tab indent + bullet)
    const sub = line.match(/^(?:\s{2,}|\t)[-*]\s+(.*)$/);
    if (sub && listType) {
      if (!subOpen) { out.push('<ul style="margin:0.1rem 0 0.1rem 1.2rem">'); subOpen = true; }
      out.push(`<li>${inline(sub[1])}</li>`);
      continue;
    }

    // Ordered list
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      if (listType !== "ol") { closeList(); out.push('<ol style="margin:0.2rem 0 0.2rem 1.2rem">'); listType = "ol"; }
      else closeSub();
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    // Unordered list
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      if (listType !== "ul") { closeList(); out.push('<ul style="margin:0.2rem 0 0.2rem 1.2rem">'); listType = "ul"; }
      else closeSub();
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p style="margin:0.2rem 0">${inline(line)}</p>`);
  }
  closeList();
  return out.join("");
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
    // ALWAYS keep the raw source in the map — Copy / Insert / Apply /
    // Save as… must round-trip the original text verbatim so the user
    // can still write the untouched markdown to disk.
    aiCodeBlocks.set(id, { code: rest, path, lang: (lang as string) || "" });

    // Markdown blocks render as formatted prose in the bubble (headings,
    // lists, bold, inline code) instead of a monospace dump — reading a
    // plan as raw `##` and `-` characters is painful. The raw copy lives
    // in `aiCodeBlocks` above so Copy / Apply still grab the source.
    const isMarkdown = /^(markdown|md)$/i.test((lang as string) || "");
    const escCode = isMarkdown
      ? renderMarkdownInline(rest as string)
      : (rest as string).split("\n").map((line: string) => {
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
        <pre style="display:none"${isMarkdown ? ' class="ai-codeblock-md"' : ""}>${isMarkdown ? escCode : `<code>${escCode}</code>`}</pre>
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
      <pre${isMarkdown ? ' class="ai-codeblock-md"' : ""}>${isMarkdown ? escCode : `<code>${escCode}</code>`}</pre>
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
(window as any).__editorTabCtxMenu = showTabCtxMenu;
(window as any).__editorPopOut = popOut;
(window as any).__editorToggleAI = toggleAI;
// Plan panel wiring — the popup plan switcher / runner. Keeps
// working while we figure out where plan UI lives in the new
// threads-pane model (currently nowhere visible — popup gone).
(window as any).__editorPlanSwitch = switchPlan;
(window as any).__editorPlanOpen = openPlanFile;
(window as any).__editorPlanCreate = createPlanFromModal;
(window as any).__editorPlanRun = runCurrentPlan;
(window as any).__editorPlanStop = stopPlanRun;
(window as any).__editorThoughtDismiss = dismissThoughtChip;

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

// Enter-to-send in deps search. The Enter binding for the threads
// chat input is wired separately inside the threads pane code (the
// old editor-ai-input target is gone with the right-panel rewrite).
document.addEventListener("keydown", (e) => {
  const target = e.target as HTMLElement;
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
