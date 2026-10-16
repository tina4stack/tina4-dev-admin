import {mountVoiceInput} from '../voice-input';
import {showImageHover,hideImageHover} from '../image-hover-preview';
import {inferFileName,imageFolder} from '../editor-file-actions';
import {loadTina4Css} from '../ai-tina4-css';
import {prepareImportedSource} from '../code-security';
import {mountNotebook} from './Notebook';
import {inlineAgentCommand} from '../inline-agent-command';
import {saveProjectContext, groundProjectContext, importPdfContext, selectProjectContext, publishReferencedImages} from '../project-context';
import { PreviewBrowser } from "../preview-browser";
import { capturePreview } from "../preview-capture";
import { mountMarkdownEditor, renderChatMarkdown } from "../markdown-editor";
import { api, esc } from "../api.js";
import { callMcpTool } from "../mcp.js";
import { codeMenu, previewRoutes } from "../editor-code-menu";
import { ghostCompletion, requestCompletion } from "../ai-completion.js";
import { runAgent, createAgentSession } from "../ai-agent.js";
import type { McpTool } from "../mcp.js";
import { gatewayHint, GatewayError } from "../ai-gateway.js";
// The agent chat (Rust supervisor: chat / execute / threads / sessions /
// thoughts) was removed from the dev-admin in 3.13.132. The right pane now
// hosts only the framework-grounding + plans panels; the code editor + inline
// completion is the landing. The MCP tool bridge (callMcpTool) stays — the
// plan panel and plan indicator use it, and external AI coders use the REST
// shim it fronts.

// ── CodeMirror imports ──
import { EditorState, Compartment, Prec } from "@codemirror/state";
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
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { rust } from "@codemirror/legacy-modes/mode/rust";
import { go } from "@codemirror/legacy-modes/mode/go";
import { java } from "@codemirror/legacy-modes/mode/clike";

// ── State ──
interface OpenFile {
  path: string;
  content: string;
  language: string;
  dirty: boolean;
  view?: EditorView;
  // The file changed on disk while THIS buffer had unsaved edits. We never
  // clobber unsaved work, so we flag the conflict on the tab instead. A clean
  // buffer is silently adopted from disk and never carries this flag.
  diskChanged?: boolean;
}

let openFiles: OpenFile[] = [];
let activeFile: string | null = null;
let activeDir: string | null = null;  // Most recently clicked folder — highlighted in the tree for visual feedback
let expandedDirs: Set<string> = new Set([".", "src", "src/routes", "src/orm", "src/templates"]);
let container: HTMLElement | null = null;
let fileTreeCache: Map<string, any[]> = new Map();
let assistantImages: string[] = [];
let assistantImageNames:string[]=[];
let assistantFiles: {name:string; content:string}[] = [];
let attachmentReads: Promise<void> = Promise.resolve();
let assistantBusy = false;
let assistantSession = createAgentSession();
try {
  const saved = JSON.parse(sessionStorage.getItem("tina4-assistant-session") || "null");
  if (saved && Array.isArray(saved.conversation) && Array.isArray(saved.changedFiles)) {
    assistantSession = { ...assistantSession, ...saved };
  }
} catch { /* Storage may be unavailable or contain an older session format. */ }

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
    case "ruby": return StreamLanguage.define(ruby);
    case "rust": return StreamLanguage.define(rust);
    case "go": return StreamLanguage.define(go);
    case "java": return StreamLanguage.define(java);
    case "scss":
    case "sass": return css();   // css() is already imported; close enough for SCSS
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
            <div class="editor-side-modes">
              <button class="editor-mode active" id="editor-mode-assistant" onclick="window.__editorSideMode('assistant')">Assistant</button>
              <button class="editor-mode" id="editor-mode-files" onclick="window.__editorSideMode('files')">Files</button>
              <button class="editor-mode" id="editor-mode-notebook" onclick="window.__editorSideMode('notebook')">Notebook</button>
            </div>
          </div>
          <div style="display:flex;gap:4px;align-items:center">
            <span id="editor-branch" class="text-sm text-muted"></span>
            <button class="btn btn-sm" onclick="window.__editorPopOut()" title="Pop out to new window" style="font-size:0.65rem;padding:2px 6px">&#x29C9;</button>
          </div>
        </div>
        <div id="editor-file-tree" class="editor-file-tree"></div>
        <div id="editor-notebook" hidden style="flex:1;overflow:auto;min-height:0"></div>
        <div id="editor-assistant" class="editor-assistant" hidden>
          <div class="assistant-messages" id="assistant-messages">
            <div class="assistant-welcome">Ask about this Tina4 project. The open file is included as context.</div>
          </div>
          <div class="assistant-composer-wrap">
            <div id="assistant-status" class="assistant-status" role="status" aria-live="polite"></div>
            <div id="assistant-voice-status" role="status" aria-live="polite" class="assistant-voice-status"></div>
            <div id="assistant-image-list" class="assistant-image-list"></div>
            <textarea id="assistant-prompt" rows="3" placeholder="Give me something to do" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();window.__assistantSend()}"></textarea>
            <div class="assistant-composer-actions">
              <label class="assistant-attach" title="Add image" aria-label="Add image"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></svg><input id="assistant-image-input" type="file" accept="image/*" multiple hidden></label>
              <label class="assistant-attach" title="Add project context" aria-label="Add project context"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M14 2H5v20h14V7zM14 2v5h5M8 12h8M8 16h5"/><path d="M20 12v6m-3-3h6"/></svg><input id="assistant-context-input" type="file" accept="application/pdf,.pdf,text/*,.md,.json,.csv,.py,.js,.ts,.twig,.scss,.yaml,.yml,.toml" multiple hidden></label>
              <button type="button" class="btn btn-sm assistant-mic" id="assistant-mic" aria-label="Start live microphone" aria-pressed="false" title="Start live microphone (browser speech service)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></svg></button>
              <button class="btn btn-sm" id="assistant-reset" onclick="window.__assistantReset()" title="Clear conversation and start fresh">New chat</button>
              <button class="btn btn-sm" id="assistant-send" onclick="window.__assistantSend()">Send</button>
            </div>
          </div>
        </div>
        <div class="editor-scaffold-bar" id="editor-scaffold-bar">
          <div class="scaffold-label">Scaffold</div>
          <div class="scaffold-form">
            <select id="scaffold-kind" class="scaffold-select" onchange="window.__scaffoldKindChange()" title="What to scaffold"></select>
            <input id="scaffold-name" class="scaffold-input" placeholder="name" onkeydown="if(event.key==='Enter')window.__scaffoldGenerate()" />
            <button class="scaffold-btn scaffold-gen" onclick="window.__scaffoldGenerate()" title="Generate">Generate</button>
          </div>
          <div id="scaffold-hint" class="scaffold-hint"></div>
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
    </div>
  `;

  // Add editor-specific styles
  addEditorStyles();
  setupAssistantComposer();
  setEditorSideMode("assistant");

  // Wire up the draggable column splitters (sidebar + right panel).
  setupSplitters();

  // Load the file tree, then restore the workspace the user left behind —
  // expanded folders, open tabs, and which tab was active — from
  // localStorage. Browser-level durability so F5 doesn't wipe context.
  loadFileTree(".").then(() => restoreEditorState());
  // Fill the scaffold dropdown from the framework's generator list.
  populateScaffoldKinds();
  // Populate the plan indicator (and, through it, the inline-completion
  // plan intent) on initial load via the MCP plan_current tool.
  callMcpTool("plan_current", {}).then((r) => {
    renderPlanIndicator((r.ok && (r as any).result) || null);
  });
  // Watch for file-system changes (external editors, `tina4 generate`,
  // etc.) so the tree and open tabs stay in sync without a page reload.
  startLiveReloadWatcher();

  // Paint the ⚡ inline-completion indicator to its persisted state. The
  // agent chat / supervisor session panel (mode toggle, model health
  // poll, session revive) was removed in 3.13.132; completion is the
  // only AI feature that remains in the editor.
  refreshCompletionIndicator();
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

/** Parse the generator's "Created <path>" lines into the list of new paths. */
function pathsFromOutput(output?: string): string[] {
  if (!output) return [];
  const paths: string[] = [];
  const re = /Created\s+(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(output))) paths.push(m[1]);
  return paths;
}

/** Surface just-created files in the tree WITHOUT a full refresh: expand each
 *  file's ancestor folders and re-fetch ONLY those folders (so a new file - or
 *  a new directory a generator made along the way, e.g. src/services/ - shows
 *  immediately), then render once. Touches the path's folders only, never the
 *  whole tree, and the folder auto-opens to reveal the file like an IDE does. */
async function revealNewFiles(paths: string[]): Promise<void> {
  const dirs = new Set<string>(["."]);
  for (const path of paths) {
    const parts = path.split("/");
    let cur = "";
    for (let i = 0; i < parts.length - 1; i++) {
      cur = cur ? cur + "/" + parts[i] : parts[i];
      expandedDirs.add(cur);
      dirs.add(cur);
    }
  }
  await Promise.all(
    [...dirs].map(async (d) => {
      try {
        const data = await api<any>(`/files?path=${encodeURIComponent(d)}`);
        fileTreeCache.set(d, data.entries || []);
      } catch { /* leave this folder's cache as-is */ }
    }),
  );
  renderFileTree();
}

function renderFileTree(): void {
  const treeEl = document.getElementById("editor-file-tree");
  if (!treeEl) return;
  treeEl.innerHTML = renderDir(".", 0);
}

/** Gently refresh git-status decorations on the file tree WITHOUT
 *  tearing down + re-rendering it.
 *
 *  This is the reload-signal path: a file was saved somewhere and its
 *  git status (M / A / U / D / clean) may have changed. We re-fetch the
 *  already-loaded directory listings to learn the fresh statuses, update
 *  the cached entries in place, and then patch ONLY the affected DOM
 *  nodes — swapping the `git-<status>` class and the dot label on the
 *  existing `.tree-item` elements.
 *
 *  Crucially this never calls `renderFileTree()` (no `innerHTML` rebuild),
 *  so the tree never flickers, the scroll position is preserved, and the
 *  user's expanded/collapsed state is untouched. Open editor buffers are
 *  deliberately NOT resynced — the dashboard IS the editor, and a save
 *  must never disturb what the user is actively editing.
 *
 *  Caveat: because we only patch existing nodes, brand-new files or
 *  deletions won't appear/disappear until the next explicit tree action
 *  (expand/collapse, open, or a tool-mutation refresh). That's an
 *  intentional trade for zero editing disruption on every save. */
async function applyGitStatusInPlace(): Promise<void> {
  const treeEl = document.getElementById("editor-file-tree");
  if (!treeEl) return;

  // Re-fetch only the dirs we've actually loaded — tiny JSON fetches.
  // We do NOT touch `fileTreeCache` until each fetch resolves, so a
  // failed/partial fetch can never blank out the live tree.
  const dirs = Array.from(new Set(["." , ...Array.from(fileTreeCache.keys()), ...Array.from(expandedDirs)]));
  const fresh = await Promise.all(
    dirs.map(async (d) => {
      try {
        const data = await api<any>(`/files?path=${encodeURIComponent(d)}`);
        // Keep the branch chip current — cheap and useful on checkout.
        if (data?.branch) {
          const branchEl = document.getElementById("editor-branch");
          if (branchEl) branchEl.textContent = `⎇ ${data.branch}`;
        }
        return [d, (data?.entries || []) as any[]] as const;
      } catch {
        return null; // tolerate a dir that vanished
      }
    }),
  );

  // Index fresh statuses by path and update the cache in place.
  const statusByPath = new Map<string, string>();
  for (const result of fresh) {
    if (!result) continue;
    const [dir, entries] = result;
    fileTreeCache.set(dir, entries);
    for (const entry of entries) {
      statusByPath.set(entry.path, entry.git_status || "clean");
    }
  }

  // Patch the existing DOM nodes — class swap + dot label only. Reading
  // `dataset.path` gives us the browser-decoded path so we sidestep any
  // attribute-selector escaping headaches.
  const STATUS_CLASSES = ["git-clean", "git-untracked", "git-modified", "git-added", "git-deleted"];
  const items = treeEl.querySelectorAll<HTMLElement>(".tree-item[data-path]");
  for (const el of Array.from(items)) {
    const path = el.dataset.path;
    if (!path) continue;
    const status = statusByPath.get(path);
    if (status === undefined) continue; // node not in the refreshed set
    el.classList.remove(...STATUS_CLASSES);
    el.classList.add(`git-${status}`);
    updateGitDot(el, status);
  }
}

/** In-place patch of a single tree item's git dot. Adds, updates, or
 *  removes the `.tree-git-dot` span to match `status` without rebuilding
 *  the row. Mirrors `gitDot()`'s label scheme. */
function updateGitDot(el: HTMLElement, status: string): void {
  const labels: Record<string, string> = {
    untracked: "U",
    modified: "M",
    added: "A",
    deleted: "D",
  };
  const label = labels[status];
  let dot = el.querySelector<HTMLElement>(".tree-git-dot");
  if (!label) {
    // clean (or unknown) → no dot. CSS hides `.git-clean .tree-git-dot`
    // anyway, but drop it so the markup matches a fresh render.
    if (dot) dot.remove();
    return;
  }
  if (!dot) {
    dot = document.createElement("span");
    dot.className = "tree-git-dot";
    el.appendChild(dot);
  }
  dot.title = status;
  dot.textContent = label;
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
// (matches the framework's dev-toolbar contract). On a reload signal
// we do the MINIMUM: a gentle, in-place refresh of the file tree's
// git-status decorations. We deliberately do NOT re-render the tree or
// resync open editor buffers — the dashboard IS the editor, and a save
// must never flicker the tree, reset its scroll, or stomp on what the
// user is actively typing.

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

/** Debounced, in-place git-status refresh — bursts of file events (a
 *  plan run writes 5 files in 200 ms) shouldn't produce 5 round-trips.
 *
 *  This is intentionally gentle: it only repaints git-status decorations
 *  on the EXISTING tree nodes. It never rebuilds the tree and never
 *  touches open editor buffers, so saving a file leaves the user's
 *  editing session — cursor, scroll, selection, expanded folders —
 *  completely undisturbed. */
let _reloadPending: number | null = null;
function handleReloadSignal(): void {
  if (_reloadPending !== null) return;
  _reloadPending = window.setTimeout(async () => {
    _reloadPending = null;
    await applyGitStatusInPlace().catch(() => { /* non-fatal — tree stays as-is */ });
    await resyncOpenFilesFromDisk().catch(() => { /* non-fatal — buffers stay as-is */ });
  }, 300);
}

/** Re-read every open file from disk after a change (an external edit, an AI
 *  agent, a SCSS recompile). A buffer with NO unsaved edits adopts the new
 *  content in place - cursor/scroll preserved - so the editor reflects reality
 *  instead of showing stale text. A buffer WITH unsaved edits is never
 *  clobbered: it keeps the user's work and the tab flags "changed on disk".
 *  This is the editor half of "both update when code changes" - the preview
 *  reloads, and an open file the user is NOT editing refreshes too. */
async function resyncOpenFilesFromDisk(): Promise<void> {
  let changed = false;
  for (const file of openFiles) {
    // Raster images carry no text buffer (content is ""); nothing to resync.
    if (file.language === "image") continue;
    let diskContent: string;
    try {
      const data = await api<any>(`/file?path=${encodeURIComponent(file.path)}`);
      diskContent = data.content;
    } catch {
      // The file may have been deleted or moved - leave the buffer untouched.
      continue;
    }
    if (diskContent === file.content) {
      if (file.diskChanged) { file.diskChanged = false; changed = true; }
      continue;
    }
    if (file.dirty) {
      // Unsaved edits AND the file moved under us: keep the user's work, flag it.
      if (!file.diskChanged) { file.diskChanged = true; changed = true; }
      continue;
    }
    // Clean buffer - adopt the disk content.
    file.content = diskContent;
    file.diskChanged = false;
    changed = true;
    const view = file.view;
    if (view) {
      // Replace the whole document, keeping the caret where it was (clamped to
      // the new length). Dispatching fires the updateListener, which would mark
      // the buffer dirty - so we reset the flag right after, since it now MATCHES
      // disk and carries no unsaved edits.
      const head = Math.min(view.state.selection.main.head, diskContent.length);
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: diskContent },
        selection: { anchor: head },
        scrollIntoView: false,
      });
      file.dirty = false;
    } else if (file.language === "markdown" || file.language === "svg") {
      // Preview-rendered files (no live CodeMirror view in the preview pane):
      // re-render if this is the one on screen.
      if (file.path === activeFile) renderContent();
    }
  }
  if (changed) renderTabs();
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
        data-path="${escapedPath}"
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
      const eye = previewUrlFor(entry.path)
        ? `<span class="tree-eye" title="Preview this page" onclick="event.stopPropagation();window.__editorPreview('${escapedPath}')">${EYE_SVG}</span>`
        : "";
      html += `<div class="tree-item tree-file ${statusClass} ${isActive ? "active" : ""}" style="padding-left:${indent + 16}px"
        data-path="${escapedPath}"
        ${/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(entry.name) ? `tabindex="0" onmouseenter="window.__editorImageHover(this)" onmouseleave="window.__editorImageHoverHide()" onfocus="window.__editorImageHover(this)" onblur="window.__editorImageHoverHide()" draggable="true" ondragstart="window.__editorImageDrag(event,this.dataset.path)" ondblclick="window.__editorImageHoverHide();window.__editorOpenFile(this.dataset.path)" onkeydown="if(event.key==='Enter'){window.__editorImageHoverHide();window.__editorOpenFile(this.dataset.path)}" aria-label="${esc(entry.name)} — drag into HTML to insert; double-click to open"` : `onclick="window.__editorOpenFile('${escapedPath}')"` }
        oncontextmenu="event.preventDefault();window.__editorCtxMenu(event,'${escapedPath}',false)">
        <span class="tree-icon">${icon}</span>
        <span class="tree-name">${esc(entry.name)}</span>
        ${eye}
        ${fileDot}
      </div>`;
    }
  }

  return html;
}

// A small eye shown next to previewable files in the tree.
const EYE_SVG = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8Z"/><circle cx="8" cy="8" r="2"/></svg>';

/** The URL a file renders at, or null when it is not previewable. A page
 *  template (src/templates/pages/<name>.twig) maps to its route /<name>
 *  (index -> /), and a static HTML file under public/ to its served path. */
function previewUrlFor(path: string): string | null {
  const p = path.replace(/\\/g, "/");
  const page = p.match(/(?:^|\/)templates\/pages\/(.+)\.twig$/);
  if (page) { const slug = page[1]; return slug === "index" ? "/" : "/" + slug; }
  const htmlPublic = p.match(/(?:^|\/)public\/(.+\.html?)$/i);
  if (htmlPublic) return "/" + htmlPublic[1];
  return null;
}

/** Preview a file: in the split view drive the right-hand preview iframe;
 *  otherwise open the rendered URL in a reusable preview window. */
function editorPreview(path: string): void {
  const url = previewUrlFor(path);
  if (!url) return;
  previewRouteUrl(url);
}

function previewRouteUrl(url: string): void {
  try {
    if (window.parent !== window) {
      const pv = window.parent.document.getElementById("t4-preview") as HTMLIFrameElement | null;
      if (pv) { pv.src = url; return; }
    }
  } catch { /* cross-origin - fall through to a window */ }
  window.open(url, "tina4preview");
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
    // A dirty buffer whose file also changed on disk: flag the conflict so the
    // user knows the two have diverged (we kept their unsaved edits).
    const conflictDot = f.diskChanged ? `<span title="Changed on disk - your unsaved edits are kept" style="color:var(--err,#f38ba8);margin-left:2px">&#9888;</span>` : "";
    return `<div class="editor-tab ${isActive ? "active" : ""}"
        onclick="window.__editorSwitchFile('${esc(f.path)}')"
        oncontextmenu="event.preventDefault();window.__editorTabCtxMenu(event,'${esc(f.path)}')">
      <span>${esc(name)}${dirtyDot}${conflictDot}</span>
      <span class="editor-tab-close" onclick="event.stopPropagation();window.__editorCloseFile('${esc(f.path)}')">&times;</span>
    </div>`;
  }).join("");
}

// ── Render content (CodeMirror or markdown preview) ──
let destroyMarkdownEditor: (() => void) | undefined;

function renderContent(): void {
  destroyMarkdownEditor?.();
  destroyMarkdownEditor = undefined;
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
  window.parent.postMessage({type:"tina4:document-mode", active:file.language === "markdown"}, location.origin);

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
    file.view?.destroy(); file.view = undefined;
    destroyMarkdownEditor = mountMarkdownEditor(contentEl, file.content, value => {
      if (file.content !== value) { file.content=value; file.dirty=true; renderTabs(); }
    }, () => { void saveCurrentFile(); });
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

async function runInlineAgentCommand(file:OpenFile,view:EditorView,from:number,to:number,instruction:string):Promise<void> {
  // Persist the user's current buffer without the command before agent edits.
  const original=view.state.doc.toString();
  const clean=original.slice(0,from)+original.slice(to);
  assistantBusy=true;
  try {
    await api('/file/save','POST',{path:file.path,content:clean});
    if(view.state.doc.toString()!==original)throw new Error('The editor changed while saving. Retry the inline command.');
    view.dispatch({changes:{from,to,insert:''}});file.content=clean;file.dirty=false;renderTabs();
    const name=file.path.match(/src\/(?:templates\/pages|scss|routes)\/([^/]+)\.[^.]+$/)?.[1];
    if(name)assistantSession.activePage={name,files:[file.path]};
    const input=document.getElementById('assistant-prompt') as HTMLTextAreaElement|null;
    if(!input)throw new Error('Assistant prompt is unavailable.');
    input.value=`Apply this instruction to the current page in ${file.path}: ${instruction}`;
    setEditorSideMode('assistant');
  } catch(error){updateStatusBar(String((error as Error).message),true);assistantBusy=false;return;}
  assistantBusy=false;
  await sendAssistantMessage();
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

  let inlineCommandTimer:ReturnType<typeof setTimeout>|undefined;
  const cancelInlineCommand=()=>{if(inlineCommandTimer!==undefined)clearTimeout(inlineCommandTimer);inlineCommandTimer=undefined;};
  const updateListener = EditorView.updateListener.of(update => {
    if(update.docChanged || update.selectionSet)cancelInlineCommand();
    if(update.docChanged && !assistantBusy){
      const line=update.state.doc.lineAt(update.state.selection.main.head);
      const instruction=inlineAgentCommand(line.text);
      if(instruction)inlineCommandTimer=setTimeout(()=>{
        inlineCommandTimer=undefined;
        const current=update.view.state.doc.lineAt(update.view.state.selection.main.head);
        if(!assistantBusy && current.from===line.from && current.text===line.text)
          void runInlineAgentCommand(file,update.view,current.from,current.to,instruction);
      },2500);
    }
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
        onStatus: (message) => { if (activeFile === file.path) updateStatusBar(message); },
      }),
      codeMenu(view => view.dispatch({effects: requestCompletion.of()}), previewRouteUrl),
      EditorView.domEventHandlers({
        dragover(event){if(/html|twig/i.test(file.language) && event.dataTransfer?.types.includes('application/x-tina4-image')){event.preventDefault();return true;}return false;},
        drop(event,view){
          const path=event.dataTransfer?.getData('application/x-tina4-image');
          if(!path || !/html|twig/i.test(file.language))return false;
          event.preventDefault();
          if(!/^src\/public\/images\/.+\.(png|jpe?g|gif|webp|svg|avif)$/i.test(path)){updateStatusBar('Use an image in src/public/images',true);return true;}
          const position=view.posAtCoords({x:event.clientX,y:event.clientY}) ?? view.state.selection.main.head;
          const original=view.state.doc;
          void loadTina4Css().catch(()=>null).then(catalog=>{
            if(view.state.doc!==original)return;
            const url='/'+path.slice('src/public/'.length).split('/').map(encodeURIComponent).join('/');
            const alt=path.split('/').pop()!.replace(/\.[^.]+$/,'').replace(/[-_]/g,' ').replace(/[&<>"']/g,'');
            const markup=`<img src="${url}" alt="${alt}"${catalog?.['img-fluid'] ? ' class="img-fluid"' : ''} loading="lazy">`;
            view.dispatch({changes:{from:position,insert:markup},selection:{anchor:position+markup.length}});view.focus();
          });return true;
        }
      }),
      Prec.highest(keymap.of([{key:'Enter',run:view=>{
        const line=view.state.doc.lineAt(view.state.selection.main.head);
        const instruction=inlineAgentCommand(line.text);
        if(!instruction)return false;
        if(assistantBusy){updateStatusBar('Wait for the current request to finish.',true);return true;}
        cancelInlineCommand();
        void runInlineAgentCommand(file,view,line.from,line.to,instruction);
        return true;
      }}])),
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
      ViewPlugin.fromClass(class {destroy(){cancelInlineCommand();}}),
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

    .editor-layout.notebook-mode .editor-sidebar { width:100% !important; flex:1 !important; max-width:none !important; }
    .editor-layout.notebook-mode .editor-main, .editor-layout.notebook-mode .editor-resizer, .editor-layout.notebook-mode .editor-scaffold-bar { display:none !important; }
    #editor-notebook[hidden] { display:none; }
    .editor-layout { display: flex; position: absolute; inset: 0; overflow: hidden; }

    .editor-sidebar { width: 240px; flex-shrink: 0; background: var(--bg, #181825); border-right: 1px solid var(--border, #313244); display: flex; flex-direction: column; overflow: hidden; }
    .editor-sidebar [hidden] { display: none !important; }
    .editor-sidebar-header { padding: 0.5rem 0.75rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border, #313244); flex-shrink: 0; }
    .editor-side-modes { display: flex; gap: 3px; }
    .editor-mode { background: transparent; color: var(--muted, #a6adc8); border: 1px solid transparent; border-radius: 4px; padding: 3px 7px; font-size: 0.72rem; cursor: pointer; }
    .editor-mode.active { background: var(--surface, #313244); color: var(--text, #cdd6f4); border-color: var(--border, #45475a); }
    .editor-file-tree { flex: 1; overflow-y: auto; padding: 0.25rem 0; font-size: 0.8rem; }
    .editor-assistant { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
    .assistant-messages { flex: 1; min-height: 0; overflow: auto; padding: 10px; display: flex; flex-direction: column; gap: 9px; }
    .assistant-welcome { color: var(--muted, #a6adc8); font-size: 0.78rem; line-height: 1.5; padding: 8px; }
    .assistant-message { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 0.78rem; line-height: 1.5; padding: 8px 9px; border-radius: 8px; }
    .assistant-message-user { background: var(--surface, #313244); align-self: flex-end; max-width: 94%; }
    .assistant-message-assistant { background: var(--bg-alt, #20202f); align-self: stretch; border: 1px solid var(--border, #313244); }
    .assistant-thinking { color: var(--muted, #a6adc8); font-size: 0.72rem; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--border, #313244); }
    .assistant-thinking-content { white-space: normal; min-width: 0; }
    .assistant-thinking-content .toastui-editor-contents { font-size: 0.75rem; line-height: 1.6; color: var(--muted, #a6adc8); }
    .assistant-thinking-content .toastui-editor-contents pre { overflow-x: auto; white-space: pre; padding: 10px; border-radius: 6px; }
    .assistant-thinking-content .toastui-editor-contents pre code { overflow-wrap: normal; white-space: pre; }
    .assistant-thinking-content .toastui-editor-contents h1, .assistant-thinking-content .toastui-editor-contents h2, .assistant-thinking-content .toastui-editor-contents h3 { font-size: 0.85rem; margin-top: 14px; }
    .assistant-thinking-label { font-weight: 600; cursor: pointer; }
    .assistant-thinking[open] > .assistant-thinking-label { margin-bottom: 6px; }
    .assistant-composer-wrap { border-top: 1px solid var(--border, #313244); padding: 8px; display: flex; flex-direction: column; gap: 6px; transition: background 120ms ease, border-color 120ms ease; }
    .assistant-composer-wrap.assistant-drop-active { background: rgba(137, 180, 250, 0.12); border-color: var(--info, #89b4fa); }
    .assistant-composer-wrap textarea { width: 100%; resize: vertical; min-height: 58px; max-height: 160px; background: var(--surface, #313244); border: 1px solid var(--border, #45475a); color: var(--text, #cdd6f4); border-radius: 6px; padding: 7px; font: inherit; font-size: 0.78rem; }
    .assistant-composer-actions { display: flex; align-items: center; gap: 8px; font-size: 0.7rem; color: var(--muted, #a6adc8); }
    .assistant-composer-actions #assistant-send { margin-left: auto; }
    .assistant-attach { cursor: pointer; }
    .assistant-mic[aria-pressed="true"] { color: #fff; background: #a52036; }
    .assistant-voice-status { font-size: 0.75rem; line-height: 1.4; }
    .assistant-status { min-height: 20px; color: var(--muted, #a6adc8); font-size: 0.8rem; font-weight: 600; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; }
    .assistant-status[data-state="active"] { color: #a5b4fc; }
    .assistant-status[data-state="active"]::before { content: ""; width: 12px; height: 12px; flex-shrink: 0; border: 2px solid #475569; border-top-color: #a5b4fc; border-radius: 50%; animation: assistant-spin 0.8s linear infinite; }
    .assistant-status[data-state="waiting"] { color: #facc15; }
    .assistant-status[data-state="error"] { color: #fca5a5; }
    @keyframes assistant-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .assistant-status[data-state="active"]::before { animation: none; } }
    .assistant-image-list { display: flex; flex-wrap: wrap; gap: 4px; }
    .assistant-sources { margin-top: 6px; font-size: 0.7rem; color: var(--text-muted, #a6adc8); }
    .assistant-sources summary { cursor: pointer; }
    .assistant-sources ul { max-height: 180px; overflow-y: auto; padding-left: 18px; margin: 6px 0; overflow-wrap: anywhere; }
    .assistant-image-chip { background: var(--surface, #313244); border-radius: 10px; padding: 2px 7px; font-size: 0.65rem; color: var(--text, #cdd6f4); }

    .tree-item { padding: 3px 8px; cursor: pointer; display: flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; user-select: none; }
    .tree-item:hover { background: rgba(255,255,255,0.05); }
    .tree-item.active { background: var(--info, #89b4fa); color: #1e1e2e; }
    .tree-arrow { width: 12px; text-align: center; font-size: 0.7rem; flex-shrink: 0; }
    .tree-icon { font-size: 0.75rem; flex-shrink: 0; }
    .tree-name { overflow: hidden; text-overflow: ellipsis; }
    .tree-eye { margin-left: auto; opacity: 0.4; display: inline-flex; align-items: center; cursor: pointer; flex-shrink: 0; padding: 0 2px; color: var(--text, #cdd6f4); }
    .tree-eye:hover { opacity: 1; color: #89b4fa; }
    .tree-item.active .tree-eye { opacity: 0.75; }

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
    .scaffold-form { display: flex; gap: 3px; margin-bottom: 4px; align-items: center; }
    .scaffold-select { flex: 1 1 auto; min-width: 0; font-size: 0.68rem; padding: 3px 4px; background: var(--surface, #313244); border: 1px solid var(--border, #45475a); border-radius: 3px; color: var(--text, #cdd6f4); }
    .scaffold-input { flex: 1 1 auto; min-width: 0; width: 50px; font-size: 0.68rem; padding: 3px 5px; background: var(--bg, #181825); border: 1px solid var(--border, #45475a); border-radius: 3px; color: var(--text, #cdd6f4); }
    .scaffold-gen { font-weight: 600; flex: 0 0 auto; }
    .scaffold-hint { font-size: 0.62rem; color: var(--muted, #6c7086); margin-bottom: 4px; min-height: 1em; line-height: 1.3; }
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
    /* ── Tools pane (right panel: grounding + plans dropdowns) ── */
    .tools-pane { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
    .threads-pane-head {
      display: flex; align-items: center; gap: 0.4rem;
      padding: 0.55rem 0.7rem; background: #181825;
      border-bottom: 1px solid #313244; flex-shrink: 0;
    }
    .threads-pane-title {
      flex: 1; margin: 0; font-size: 0.85rem; font-weight: 600;
      color: #cdd6f4;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .threads-icon-btn {
      background: transparent; border: 1px solid #313244; color: #cdd6f4;
      width: 26px; height: 26px; padding: 0; border-radius: 4px;
      font-size: 0.85rem; line-height: 1; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .threads-icon-btn:hover { background: rgba(137,180,250,0.12); border-color: #89b4fa; }
    .threads-icon-btn.active { background: rgba(137,180,250,0.18); border-color: #89b4fa; color: #89b4fa; }

    /* Plans + grounding dropdowns — slide in below the header when the
       plans (chip) / grounding (key) toggle is clicked. Plan rows open the
       .md file in the code editor on the left. */
    .plans-panel {
      flex-shrink: 0; max-height: 260px; overflow-y: auto;
      border-bottom: 1px solid #313244; background: rgba(0,0,0,0.15);
    }
    .plans-panel[hidden] { display: none; }
    .plans-rows .plan-row {
      padding: 0.45rem 0.7rem; cursor: pointer;
      border-bottom: 1px solid #1e1e2e; font-size: 0.72rem;
      line-height: 1.3;
    }
    .plans-rows .plan-row:hover { background: #181825; }
    .plans-rows .plan-row .plan-name { color: #cdd6f4; font-weight: 500; }
    .plans-rows .plan-row .plan-meta { color: #9399b2; font-size: 0.65rem; margin-top: 0.15rem; }

    .threads-empty {
      padding: 1.5rem 0.8rem; text-align: center; color: #9399b2;
      font-size: 0.78rem; font-style: italic;
    }
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

function setEditorSideMode(mode: "files" | "assistant" | "notebook"): void {
  const assistant = mode === "assistant";
  const notebook=mode==='notebook';
  document.querySelector('.editor-layout')?.classList.toggle('notebook-mode',notebook);
  document.getElementById('editor-notebook')?.toggleAttribute('hidden',!notebook);
  document.getElementById('editor-mode-notebook')?.classList.toggle('active',notebook);
  if(notebook)void mountNotebook(document.getElementById('editor-notebook')!);
  document.getElementById("editor-file-tree")?.toggleAttribute("hidden", mode!=="files");
  document.getElementById("editor-assistant")?.toggleAttribute("hidden", !assistant);
  document.getElementById("editor-mode-files")?.classList.toggle("active", mode==="files");
  document.getElementById("editor-mode-assistant")?.classList.toggle("active", assistant);
  if (assistant) document.getElementById("assistant-prompt")?.focus();
}

let disposeVoice:(()=>void)|undefined;
function setupAssistantComposer(): void {
  disposeVoice?.();
  const mic=document.getElementById('assistant-mic') as HTMLButtonElement;
  const voicePrompt=document.getElementById('assistant-prompt') as HTMLTextAreaElement;
  const voiceStatus=document.getElementById('assistant-voice-status')!;
  disposeVoice=mountVoiceInput(mic,voicePrompt,voiceStatus,async()=>{if(assistantBusy)throw new Error('Assistant busy');await sendAssistantMessage();});
  for(const id of ['assistant-image-input','assistant-context-input']) {
    const input=document.getElementById(id) as HTMLInputElement|null;
    input?.addEventListener('change',()=>{for(const file of Array.from(input.files||[]))queueAssistantFile(file);input.value='';});
  }
  const prompt = document.getElementById("assistant-prompt");
  const composer = document.querySelector(".assistant-composer-wrap");
  composer?.addEventListener("dragover", (event) => {
    event.preventDefault();
    composer.classList.add("assistant-drop-active");
  });
  composer?.addEventListener("dragleave", (event) => {
    if (!composer.contains((event as DragEvent).relatedTarget as Node | null)) composer.classList.remove("assistant-drop-active");
  });
  composer?.addEventListener("drop", (event) => {
    event.preventDefault();
    composer.classList.remove("assistant-drop-active");
    Array.from((event as DragEvent).dataTransfer?.files || [])
      .forEach(queueAssistantFile);
  });
  prompt?.addEventListener("paste", (event) => {
    const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith("image/"));
    if (files.length) {
      event.preventDefault();
      files.forEach(addAssistantImage);
    }
  });
}

function renderAssistantAttachments(): void {
  const list=document.getElementById("assistant-image-list");
  if(!list)return;
  list.replaceChildren();
  const chip=(label:string, remove:()=>void)=>{
    const button=document.createElement('button');button.type='button';
    button.className='assistant-image-chip';button.textContent=label+' ×';button.title='Remove '+label;
    button.onclick=()=>{remove();renderAssistantAttachments();};list.append(button);
  };
  assistantImages.forEach((_,i)=>chip(assistantImageNames[i] || 'Image '+(i+1),()=>{assistantImages.splice(i,1);assistantImageNames.splice(i,1);}));
  assistantFiles.forEach((file,i)=>chip(file.name,()=>{assistantFiles.splice(i,1);}));
}
function queueAssistantFile(file:File):void {
  attachmentReads=attachmentReads.then(async()=>{
    if(file.type==='application/pdf' || /\.pdf$/i.test(file.name)){
      const status=assistantBubble('assistant',`Importing ${file.name}…`);
      const records=await importPdfContext(file,message=>{status.textContent=message;});
      const related=records.filter(r=>r.sources?.some(source=>source.document===file.name));
      status.textContent=`Saved ${file.name}: ${related.filter(r=>r.kind==='page').length} pages and ${related.filter(r=>r.kind==='image').length} reusable images in project context. ${related.filter(r=>r.warnings?.length).length} items have extraction or summary warnings.`;
      return;
    }
    if(assistantImages.length+assistantFiles.length>=8)throw new Error('Attach at most 8 files per message.');
    if(file.type.startsWith('image/')) {
      if(file.size>1024*1024)throw new Error('Context images must be smaller than 1 MB.');
      const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d')!.drawImage(bitmap,0,0);const data=canvas.toDataURL('image/png');bitmap.close();canvas.width=0;canvas.height=0;
      assistantImages.push(data.split(',',2)[1]);assistantImageNames.push(file.name);
    } else {
      if(!file.type.startsWith('text/') && !/\.(txt|md|markdown|csv|json|html?|css|scss|js|ts|tsx|jsx|py|php|rb|twig|xml|ya?ml|toml|sql|log)$/i.test(file.name))throw new Error('Use a text, Markdown or source file for context. Export Word or PDF documents as text first.');
      if(file.size>64*1024)throw new Error('Context files must be smaller than 64 KB.');
      const content=await file.text();
      if(content.includes('\0'))throw new Error('This file contains binary data. Please attach a text version.');
      if(content.length+assistantFiles.reduce((n,f)=>n+f.content.length,0)>24000)throw new Error('Attached context exceeds 24,000 characters. Use a shorter excerpt.');
      assistantFiles.push({name:file.name,content});
    }
    renderAssistantAttachments();
  }).catch(error=>{assistantBubble('assistant',String(error.message || error));});
}
function addAssistantImage(file:File):void { queueAssistantFile(file); }

function assistantBubble(role: "user" | "assistant", text: string): HTMLElement {
  const bubble = document.createElement("div");
  bubble.className = `assistant-message assistant-message-${role}`;
  bubble.textContent = text;
  document.getElementById("assistant-messages")?.appendChild(bubble);
  bubble.parentElement?.scrollTo(0, bubble.parentElement.scrollHeight);
  return bubble;
}

async function approveAssistantTool(tool: McpTool, args: Record<string, unknown>): Promise<boolean> {
  if (assistantSession.planSaved && ["scaffold", "plan_complete_step", "plan_note"].includes(tool.name)) return true;
  if(tool.name!=="plan_create") return false;
  const card=assistantBubble("assistant", "");
  const heading=document.createElement("strong");heading.textContent="Review the plan";
  const preview=document.createElement("div");
  preview.style.cssText="max-height:280px;overflow:auto;margin:8px 0";
  const steps=Array.isArray(args.steps)?args.steps:[];
  renderChatMarkdown(preview,`# ${args.title}\n\nGoal: ${args.goal||""}\n\n## Steps\n\n${steps.map(step=>`- [ ] ${step}`).join("\n")}`);
  const apply=document.createElement("button");apply.className="btn btn-sm";apply.textContent="Approve plan & build";
  const cancel=document.createElement("button");cancel.className="btn btn-sm";cancel.textContent="Cancel";
  card.append(heading,preview,apply,cancel);card.scrollIntoView({block:"nearest"});
  return new Promise(resolve=>{
    cancel.onclick=()=>{apply.disabled=cancel.disabled=true;resolve(false);};
    apply.onclick=()=>{
      const details=document.createElement("details"),summary=document.createElement("summary");
      summary.textContent=`✓ Approved · ${String(args.title||"Plan")}`;
      details.append(summary,preview);card.replaceChildren(details);resolve(true);
    };
  });
}

async function sendAssistantMessage(): Promise<void> {
  if (assistantBusy) return;
  const input = document.getElementById("assistant-prompt") as HTMLTextAreaElement | null;
  const prompt = input?.value.trim();
  if (!prompt) return;
  assistantBusy = true;
  const resetButton=document.getElementById("assistant-reset") as HTMLButtonElement | null;
  if(resetButton) resetButton.disabled=true;
  if (input) input.value = "";
  await attachmentReads;
  const files=assistantFiles;
  assistantFiles=[];
  const images = assistantImages;
  const imageNames=assistantImageNames;
  assistantImages = [];assistantImageNames=[];
  const imageList = document.getElementById("assistant-image-list");
  if (imageList) imageList.innerHTML = "";
  assistantBubble("user", `${prompt}${files.length ? `\n[Files: ${files.map(f=>f.name).join(", ")}]` : ""}${images.length ? `\n[${images.length} image${images.length === 1 ? "" : "s"} attached]` : ""}`);
  const answerBubble = assistantBubble("assistant", "");
  const thinkingSection = document.createElement("details");
  thinkingSection.className = "assistant-thinking";
  thinkingSection.hidden = true;
  thinkingSection.open = true;
  const thinkingLabel = document.createElement("summary");
  thinkingLabel.className = "assistant-thinking-label";
  thinkingLabel.textContent = "Thinking";
  const thinkingText = document.createElement("div");
  thinkingText.className = "assistant-thinking-content";
  let thinkingMarkdown = "", thinkingTimer:ReturnType<typeof setTimeout>|undefined;
  const flushThinking = () => {
    if(thinkingTimer!==undefined)clearTimeout(thinkingTimer);
    thinkingTimer=undefined;
    if(!thinkingMarkdown)return;
    const messages=answerBubble.parentElement;
    const following=messages ? messages.scrollHeight-messages.scrollTop-messages.clientHeight<80 : false;
    renderChatMarkdown(thinkingText,thinkingMarkdown);
    if(messages&&following)messages.scrollTop=messages.scrollHeight;
  };
  thinkingSection.append(thinkingLabel, thinkingText);
  const answerText = document.createElement("div");
  answerText.textContent = "Connecting to local model…";
  answerBubble.append(thinkingSection, answerText);
  let thinkingStep = 0;
  const started = performance.now();
  const status = document.getElementById("assistant-status");
  const send = document.getElementById("assistant-send") as HTMLButtonElement | null;
  if (send) { send.disabled = true; send.textContent = "Working…"; }
  let activity = "Thinking…";
  let activityState = "active";
  let finalStatus = "Done";
  const showActivity = (text: string, state = "active") => {
    activity = text; activityState = state;
    if (status) { status.dataset.state = state; status.textContent = `${text} · ${Math.floor((performance.now() - started) / 1000)}s`; }
  };
  showActivity("Thinking…");
  const activityTimer = window.setInterval(() => showActivity(activity, activityState), 1000);

  const file = openFiles.find((candidate) => candidate.path === activeFile);
  const currentContent = file?.view?.state.doc.toString() ?? file?.content ?? "";
  const context = file
    ? `Open file: ${file.path}\nLanguage: ${file.language}\n\n${currentContent.slice(0, 10000)}`
    : undefined;
  const changes=new Map<string,{before:string|null;after:string;applied:boolean}>();
  const pendingChanges=new Map<string,{before:string|null;after:string;applied:boolean}>();
  const scaffoldedPaths=new Set<string>();
  let undoButton:HTMLButtonElement|null=null;
  const showUndo=()=>{
    if(undoButton) return;
    const card=assistantBubble("assistant", "Changes applied · ");
    undoButton=document.createElement("button");
    undoButton.className="btn btn-sm";undoButton.textContent="Undo changes";undoButton.disabled=true;
    card.append(undoButton);
    undoButton.onclick=async()=>{
      if(assistantBusy) return;
      undoButton!.disabled=true;
      const applied=[...changes].filter(([,change])=>change.applied);
      try {
        for(const [path,change] of applied) {
          const current=await callMcpTool("file_read",{path});
          if(!current.ok || current.result!==change.after || openFiles.some(file=>file.path===path && file.dirty))
            throw new Error(`${path} changed since this edit. Undo stopped to preserve your newer work.`);
        }
        for(const [path,change] of applied.reverse()) {
          if(change.before===null) {
            await api("/file/delete","POST",{path,is_dir:false});
            closeFile(path);
          } else await api("/file/save","POST",{path,content:change.before});
          change.applied=false;
        }
        assistantSession.verified=false;
        assistantSession.conversation.push({role:"user",content:"I undid the last assistant file changes. Read the current files before continuing."});
        sessionStorage.setItem("tina4-assistant-session",JSON.stringify(assistantSession));
        await resyncOpenFilesFromDisk();
        try {const frame=window.parent.document.getElementById("t4-preview") as HTMLIFrameElement|null;if(frame) frame.contentWindow?.location.reload();}catch{}
        card.textContent="Changes undone";
      } catch(error) {
        const message=document.createElement("div");message.textContent=String((error as Error).message);card.append(message);
        undoButton!.disabled=false;
      }
    };
  };
  try {
    showActivity('Loading project context…');
    let references;
    try {references=await saveProjectContext(files,images.map((content,i)=>({name:imageNames[i] || `Image ${i+1}`,content})));}
    catch(error){assistantFiles=files;assistantImages=images;assistantImageNames=imageNames;renderAssistantAttachments();throw error;}
    const selectedReferences=selectProjectContext(references,[assistantSession.plan?.goal,assistantSession.brief,...assistantSession.conversation.filter(m=>m.role==="user").slice(-3).map(m=>m.content),prompt].filter(Boolean).join("\n"));
    const referenceImages=images;
    if(selectedReferences.length) {
      const note=document.createElement('details');note.className='assistant-sources';
      const summary=document.createElement('summary');
      summary.textContent=`Sources · ${selectedReferences.length} references`;
      const list=document.createElement('ul');
      for(const name of new Set(selectedReferences.map(r=>r.name))) {
        const item=document.createElement('li');item.textContent=name;list.append(item);
      }
      note.append(summary,list);answerBubble.append(note);
    }
    showActivity('Thinking…');
    const result = await runAgent({
      session: assistantSession,
      authorizeTool: async (tool, args) => {
        if(["file_write","file_patch"].includes(tool.name)) {
          const path=String(args.path||"");
          if(openFiles.some(file=>file.path===path && file.dirty)) throw new Error(`Save your unsaved edits to ${path} first.`);
          const read=await callMcpTool("file_read",{path});
          if(!read.ok || typeof read.result!=="string") throw new Error(`Could not read ${path} before applying changes.`);
          const before=scaffoldedPaths.has(path) || read.result.startsWith("File not found:") ? null : read.result;
          const after=tool.name==="file_write" ? String(args.content??"") : (before||"").replace(String(args.old_string||""),String(args.new_string||""));
          await publishReferencedImages(after);
          pendingChanges.set(path,{before:changes.has(path) ? changes.get(path)!.before : before,after,applied:false});
          showActivity(`Applying ${path}…`);
          return true;
        }
        thinkingSection.open = false;
        thinkingLabel.textContent = tool.name === "plan_create"
          ? "Thinking complete · Plan ready for review"
          : "Thinking complete · Next change prepared";
        showActivity("Waiting for your approval", "waiting");
        const approved = await approveAssistantTool(tool, args);
        showActivity("Working…");
        return approved;
      },
      model: "mlx-community/gemma-4-e4b-it-4bit",
      task: prompt,
      projectReferences: groundProjectContext(selectedReferences,references),
      context,
      previewRoute: (() => {
        try {
          const preview = window.parent.document.getElementById("t4-preview") as HTMLIFrameElement | null;
          return preview?.contentWindow?.location.pathname;
        } catch { return undefined; }
      })(),
      previewBrowser: (() => {
        try {
          const frame=window.parent.document.getElementById("t4-preview") as HTMLIFrameElement | null;
          return frame ? new PreviewBrowser(()=>{if(!frame.contentDocument)throw new Error('Preview unavailable');return frame.contentDocument;}) : undefined;
        } catch {return undefined;}
      })(),
      capturePreview: (() => {
        try {
          const frame=window.parent.document.getElementById("t4-preview") as HTMLIFrameElement | null;
          return frame ? (route?:string,focus?:string)=>capturePreview(frame,route,focus) : undefined;
        } catch {return undefined;}
      })(),
      images:referenceImages,
      think: true,
      onEvent: (event) => {
        const messages = answerBubble.parentElement;
        const following = messages ? messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80 : false;
        if (event.type === "thinking" && event.text) {
          thinkingSection.hidden = false;
          if (thinkingStep !== event.step) thinkingSection.open = true;
          if (thinkingStep && thinkingStep !== event.step) thinkingMarkdown += "\n\n---\n\n";
          thinkingStep = event.step;
          thinkingMarkdown += event.text;
          if(thinkingTimer===undefined)thinkingTimer=setTimeout(flushThinking,100);
          answerText.textContent = "";
          showActivity("Thinking…");
          thinkingLabel.textContent = "Thinking…";
        }
        if(event.type==="visual_review") {
          const details=document.createElement("details"),label=document.createElement("summary");
          label.textContent=event.text?.startsWith("Visual inspection complete") ? "Visual inspection · behaviour not verified" : "Preview findings";
          const review=document.createElement("div");renderChatMarkdown(review,event.text||"");details.append(label,review);answerBubble.append(details);
        }
        if(event.type==="preview" && event.capture) {
          const details=document.createElement("details");
          const label=document.createElement("summary");
          label.textContent=`Preview captured · ${event.capture.route} · ${event.capture.width}×${event.capture.height}`;
          const image=document.createElement("img");
          image.src=`data:image/png;base64,${event.capture.image}`;
          image.alt="Preview sent to the local model";image.style.cssText="max-width:100%;max-height:400px;object-fit:contain";
          details.append(label,image);answerBubble.append(details);
        }
        if (event.type === "phase") {
          if(!assistantSession.projectReferences) answerBubble.querySelector(".assistant-sources")?.remove();
          showActivity(event.text || "Working…");
          answerText.textContent = event.text || "Working…";
        }
        if (event.type === "content") showActivity("Thinking · preparing response…");
        if (event.type === "tool_start") showActivity("Working · applying next step…");
        if (event.type === "tool_result") showActivity("Working · checking result…");
        if (event.type === "blocked") showActivity("Waiting for your approval", "waiting");
        if (event.type === "tool_result") {
          let result: any;
          try { result = JSON.parse(event.text || "null"); } catch { result = null; }
          if (!result?.error && result?.ok !== false) {
            if (event.tool === "scaffold") {
              const created=pathsFromOutput(result?.output);
              created.forEach(path=>scaffoldedPaths.add(path));
              void revealNewFiles(created);
            }
            if (["file_write", "file_patch"].includes(event.tool || "") && event.args?.path) {
              const path = String(event.args.path);
              const change=pendingChanges.get(path);if(change) {change.applied=true;changes.set(path,change);pendingChanges.delete(path);showUndo();}
              void (async () => { await revealNewFiles([path]); await resyncOpenFilesFromDisk(); await openFile(path); })();
            }

          }
        }
        if (messages && following) messages.scrollTop = messages.scrollHeight;
      },
    });
    // Include untouched generator files in the same Undo transaction.
    for(const path of scaffoldedPaths) {
      if(changes.has(path))continue;
      const read=await callMcpTool("file_read",{path});
      if(read.ok && typeof read.result==="string" && !read.result.startsWith("File not found:")) {
        changes.set(path,{before:null,after:read.result,applied:true});showUndo();
      }
    }
    renderChatMarkdown(answerText, result.answer);
    finalStatus = result.stopped === "error" ? "Could not complete" : result.stopped === "clarification" ? "Waiting for your answer" : result.stopped === "approval_required" ? "Stopped · change not applied" : result.stopped === "step_limit" ? "Stopped · unfinished" : "Done";
    // Reuse the result instead of spending another model call summarising it.
    const outcome = result.answer.replace(/\s+/g, " ").trim();
    const brief = outcome.length > 140 ? `${outcome.slice(0, 137).trimEnd()}…` : outcome;
    thinkingLabel.textContent = result.stopped === "approval_required"
      ? "Thinking complete · Awaiting approval"
      : result.stopped === "step_limit"
        ? "Thinking stopped · Step limit reached"
        : result.stopped === "error" ? "Thinking stopped · Task unfinished"
        : `Thinking complete · ${brief || "Response ready"}`;

  } catch (error) {
    answerText.textContent = error instanceof GatewayError ? gatewayHint(error) : String((error as Error)?.message || error);
    thinkingLabel.textContent = "Thinking interrupted · Request failed";
    finalStatus = "Could not complete";
  } finally {
    try { sessionStorage.setItem("tina4-assistant-session", JSON.stringify(assistantSession)); } catch { /* Storage quota does not block editing. */ }
    assistantBusy = false;
    if(undoButton) (undoButton as HTMLButtonElement).disabled=false;
    if(resetButton) resetButton.disabled=false;
    window.clearInterval(activityTimer);
    if (send) { send.disabled = false; send.textContent = "Send"; }
    flushThinking();
    thinkingSection.open = false;
    showActivity(finalStatus, finalStatus.startsWith("Failed") ? "error" : finalStatus.startsWith("Waiting") ? "waiting" : "idle");
    input?.focus();
  }
}

(window as any).__editorSideMode = setEditorSideMode;
(window as any).__assistantSend = sendAssistantMessage;
(window as any).__assistantReset = () => {
  if(assistantBusy) return;
  assistantSession=createAgentSession();
  assistantImages=[];assistantImageNames=[];
  assistantFiles=[];
  try { sessionStorage.removeItem("tina4-assistant-session"); } catch {}
  document.getElementById("assistant-messages")?.replaceChildren();
  document.getElementById("assistant-image-list")?.replaceChildren();
  const status=document.getElementById("assistant-status");
  if(status) {status.textContent="Ready for a new task";status.dataset.state="idle";}
  const input=document.getElementById("assistant-prompt") as HTMLTextAreaElement | null;
  if(input) {input.value="";input.focus();}
};

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

// (removed: legacy chatHistory + LS_CHAT_HISTORY / load+save helpers.
// Per-thread message state now lives in threadMessageCache, hydrated
// from /__dev/api/threads/{id}/messages on switch. The old globals were
// leaking cross-thread bubbles via restoreChatBubbles on page load.)

/** Feed the active plan's current step into the inline-completion FIM
 *  prompt. Before 3.13.132 this also rendered a plan strip with a ▶ Run
 *  button that handed the plan to the Rust supervisor; the supervisor is
 *  gone, so this now only caches the completion intent and refreshes the
 *  ⚡ indicator. Plans themselves are browsed via the 📋 plans panel. */
function renderPlanIndicator(plan: any): void {
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

// Plans dropdown open/closed state (the 📋 toggle in the Tools pane).
let plansPanelOpen = false;

async function plansToggle(): Promise<void> {
  const panel = document.getElementById("plans-panel");
  const btn = document.getElementById("plans-toggle-btn");
  if (!panel) return;
  plansPanelOpen = !plansPanelOpen;
  panel.hidden = !plansPanelOpen;
  btn?.classList.toggle("active", plansPanelOpen);
  if (plansPanelOpen) await renderPlansPanel();
}

async function renderPlansPanel(): Promise<void> {
  const rows = document.getElementById("plans-rows");
  if (!rows) return;
  rows.innerHTML = `<div class="threads-empty">Loading plans…</div>`;
  try {
    const r = await callMcpTool("plan_list", {});
    const plans = (r.ok && Array.isArray((r as any).result)) ? (r as any).result : [];
    if (!plans.length) {
      rows.innerHTML = `<div class="threads-empty">No plans yet — they appear here when the planner agent creates one.</div>`;
      return;
    }
    // Newest first by name (filenames start with unix timestamps).
    const sorted = [...plans].sort((a: any, b: any) =>
      String(b.name || b.file || "").localeCompare(String(a.name || a.file || ""))
    );
    rows.innerHTML = sorted.map((p: any) => {
      const name = String(p.name || p.file || "");
      // Server returns full project-relative path (e.g.
      // ".tina4/plans/1779827045-plan.md" vs "plan/foo.md"); use
      // that for opening so both directories work.
      const fullPath = String(p.path || `plan/${name}`);
      const title = String(p.title || name).slice(0, 60);
      const done = p.steps_done ?? p.progress?.done ?? 0;
      const total = p.steps_total ?? p.progress?.total ?? 0;
      const steps = total > 0 ? `${done}/${total} steps` : "";
      const current = p.is_current || p.current ? " · ★ current" : "";
      return `<div class="plan-row" onclick="window.__plansOpen('${esc(fullPath)}')" title="Open ${esc(fullPath)} in editor">
        <div class="plan-name">${esc(title)}</div>
        <div class="plan-meta">${esc(name)}${steps ? " · " + esc(steps) : ""}${current}</div>
      </div>`;
    }).join("");
  } catch (e) {
    rows.innerHTML = `<div class="threads-empty" style="color:var(--danger,#f38ba8)">Failed to load plans</div>`;
  }
}

/** Open a plan file in the code editor on the left. Caller passes
 *  the full project-relative path (`.tina4/plans/X.md` or `plan/X.md`)
 *  returned by plan_list, so we don't have to guess which dir. */
async function plansOpen(path: string): Promise<void> {
  try {
    await openFile(path);
  } catch (e) {
    console.error("plansOpen failed", e);
  }
  // Auto-close the panel after opening — user has what they wanted.
  plansPanelOpen = false;
  const panel = document.getElementById("plans-panel");
  if (panel) panel.hidden = true;
  document.getElementById("plans-toggle-btn")?.classList.remove("active");
}

(window as any).__plansToggle = () => { void plansToggle(); };
(window as any).__plansOpen = (name: string) => { void plansOpen(name); };

// ── Framework-grounding token panel ─────────────────────────────────
// The coder/planner agents ground against mcp.tina4.com (tina4_context)
// when a Bearer token is configured; otherwise they fall back to the
// local tina4-rag corpus. This panel lets the developer paste that
// token. The Rust agent owns the .env write + token resolution
// (/__dev/api/grounding/{status,token} → agent /mcp/{status,token}).

let groundingPanelOpen = false;

async function groundingToggle(): Promise<void> {
  const panel = document.getElementById("grounding-panel");
  const btn = document.getElementById("grounding-toggle-btn");
  if (!panel) return;
  // Close the plans panel if it's open — one dropdown at a time.
  if (plansPanelOpen) { void plansToggle(); }
  groundingPanelOpen = !groundingPanelOpen;
  panel.hidden = !groundingPanelOpen;
  btn?.classList.toggle("active", groundingPanelOpen);
  if (groundingPanelOpen) await renderGroundingPanel();
}

/** The grounding status the agent / framework returns for the token panel. */
export interface GroundingStatus {
  configured?: boolean;
  source?: string; // "personal" | "free" | "none" (absent on older backends)
  last4?: string;
  dev_email?: string; // on the free trial: the git email that identifies it
  url?: string;
}

/**
 * Decide the panel's status line + (for the free trial) the persistent
 * register nudge, from a grounding status. Pure — no DOM, no fetch — so the
 * three-state logic is unit-testable in isolation. `source` is authoritative
 * when present; older backends send only `configured`, so we fall back to it.
 */
export function groundingStatusView(status: GroundingStatus): { source: string; stateHtml: string; nudgeHtml: string } {
  const url = esc(status.url || "https://mcp.tina4.com");
  const source = status.source || (status.configured ? "personal" : "none");
  if (source === "personal") {
    return {
      source,
      stateHtml: `<span style="color:var(--success,#a6e3a1)">&#9679; Your token</span> <span style="opacity:0.6">(…${esc(status.last4 || "")})</span>`,
      nudgeHtml: "",
    };
  }
  if (source === "free") {
    // Free trial — grounding works, but persistently nudge them to register.
    // If the agent reported the git email that identifies the trial, show it
    // so the developer knows exactly what rides the shared token (transparency).
    const attributed = status.dev_email
      ? ` Identified to the server as <code>${esc(status.dev_email)}</code>.`
      : "";
    return {
      source,
      stateHtml: `<span style="color:var(--warn,#f9e2af)">&#127873; Free trial</span> — grounding via <code>${url}</code> on the shared <code>FREE-TOKEN</code>.`,
      nudgeHtml: `<div style="margin:0.4rem 0;padding:0.4rem 0.55rem;border:1px solid var(--warn,#f9e2af);border-radius:6px;background:color-mix(in srgb, var(--warn,#f9e2af) 12%, transparent)">
      You're trying Tina4 grounding for free.${attributed} Register for your <strong>own</strong> token — higher limits, no shared rate cap.
      <a href="https://profile.tina4.com" target="_blank" rel="noopener" style="color:var(--accent,#89b4fa);font-weight:600">Register at profile.tina4.com &rarr;</a>
    </div>`,
    };
  }
  return {
    source,
    stateHtml: `<span style="color:var(--warn,#f9e2af)">&#9675; Not set</span> — using local corpus fallback`,
    nudgeHtml: "",
  };
}

async function renderGroundingPanel(): Promise<void> {
  const body = document.getElementById("grounding-body");
  if (!body) return;
  body.innerHTML = `<div class="threads-empty">Loading…</div>`;
  let status: { configured?: boolean; source?: string; last4?: string; url?: string } = {};
  try {
    const r = await fetch("/__dev/api/grounding/status");
    if (r.ok) status = await r.json();
  } catch { /* agent may be offline — show the entry form regardless */ }

  const url = esc(status.url || "https://mcp.tina4.com");
  const { stateHtml, nudgeHtml } = groundingStatusView(status);

  body.innerHTML = `
    <div style="font-weight:600;margin-bottom:0.35rem">Framework grounding</div>
    <div style="opacity:0.85;margin-bottom:0.5rem">Ground the coder against <code>${url}</code> (version-current Tina4 API) instead of the local fallback.</div>
    <div style="margin-bottom:0.5rem">${stateHtml}</div>
    ${nudgeHtml}
    <div style="display:flex;gap:4px">
      <input type="password" id="grounding-token-input" class="input" placeholder="Paste your own TINA4_MCP_TOKEN…"
        style="flex:1;font-size:0.72rem;padding:4px 8px;height:28px" autocomplete="off" />
      <button type="button" class="btn btn-sm btn-primary" style="font-size:0.65rem;padding:2px 10px"
        onclick="window.__groundingSave()">Save</button>
    </div>
    <div id="grounding-result" style="margin-top:0.4rem;min-height:1.1em"></div>
    <div style="opacity:0.6;margin-top:0.4rem">Get a free token at <code>profile.tina4.com</code>. Stored in project <code>.env</code>; takes effect next turn.</div>
  `;
}

async function saveGroundingToken(): Promise<void> {
  const input = document.getElementById("grounding-token-input") as HTMLInputElement | null;
  const result = document.getElementById("grounding-result");
  const token = input?.value.trim();
  if (!token) {
    if (result) result.innerHTML = `<span style="color:var(--warn,#f9e2af)">Paste a token first.</span>`;
    return;
  }
  if (result) result.innerHTML = `<span style="opacity:0.7">Saving…</span>`;
  try {
    const r = await fetch("/__dev/api/grounding/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok && data.ok) {
      if (input) input.value = "";
      if (result) result.innerHTML = `<span style="color:var(--success,#a6e3a1)">&#10003; Saved (…${esc(String(data.last4 || ""))}). Grounding now uses mcp.tina4.com.</span>`;
      // Refresh the status line to reflect "Configured".
      setTimeout(() => { void renderGroundingPanel(); }, 1200);
    } else {
      if (result) result.innerHTML = `<span style="color:var(--danger,#f38ba8)">Failed: ${esc(String(data.error || r.status))}</span>`;
    }
  } catch (e: any) {
    if (result) result.innerHTML = `<span style="color:var(--danger,#f38ba8)">Agent unreachable — is <code>tina4 serve</code> running?</span>`;
  }
}

(window as any).__groundingToggle = () => { void groundingToggle(); };
(window as any).__groundingSave = () => { void saveGroundingToken(); };

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

// The currently-open file-tree context menu (removed on next open / click-away).
let ctxMenuEl: HTMLElement | null = null;

function showCtxMenu(e: MouseEvent, path: string, isDir: boolean): void {
  hideCtxMenu();
  const menu = document.createElement("div");
  menu.className = "editor-ctx-menu";
  menu.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;z-index:200`;

  if (isDir) {
    menu.innerHTML = `
      <div class="ctx-item" onclick="window.__editorNewFile('${esc(path)}')">📄 New File <span class="ctx-shortcut">Ctrl+N</span></div>
      <div class="ctx-item" onclick="window.__editorUpload('${esc(path)}')">↑ Upload files…</div>
      ${imageFolder(path) ? `<div class="ctx-item" onclick="window.__editorImageUrl('${esc(path)}')">▧ Add image from URL…</div>` : ''}
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

  if (!isDir && /(?:^|\/)routes\//.test(path)) {
    const addPreviews = (content: string) => {
      if (!menu.isConnected) return;
      for (const route of previewRoutes(content)) {
        const button=document.createElement("button"); button.className="ctx-item";
        button.textContent=`Preview GET ${route}`;
        button.onclick=()=>{hideCtxMenu();let cancelled=false;const url=route.replace(/\{([^}]+)\}/g, (_match, name)=>{const value=prompt(`Value for ${name}:`);if(!value)cancelled=true;return encodeURIComponent(value||"");});if(!cancelled)previewRouteUrl(url);};
        menu.append(button);
      }
    };
    const opened=openFiles.find(file=>file.path===path);
    queueMicrotask(()=>{ if(opened) addPreviews(opened.content); else void api<any>(`/file?path=${encodeURIComponent(path)}`).then(data=>addPreviews(data.content||"")).catch(()=>{}); });
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
  const entered = prompt("New file name (extension inferred from this folder):");
  if (!entered) return;
  try {
    const name=inferFileName(entered,dirPath,(fileTreeCache.get(dirPath)||[]).filter(e=>!e.is_dir).map(e=>e.name),(fileTreeCache.get(".")||[]).map(e=>e.name));
    const filePath = dirPath === "." ? name : `${dirPath}/${name}`;
    if((fileTreeCache.get(dirPath)||[]).some(e=>e.name===name))throw new Error("A file with this name already exists");
    await api("/file/save", "POST", { path: filePath, content: "" });
    await loadFileTree(dirPath);
    openFile(filePath);
  } catch (e: any) {
    alert("Failed: " + e.message);
  }
}

async function uploadFiles(folder:string):Promise<void> {
 hideCtxMenu();
 const picker=document.createElement('input');picker.type='file';picker.multiple=true;
 picker.onchange=async()=>{
  const results:string[]=[];
  for(const file of Array.from(picker.files||[])) {
   try {
    if(file.size>10*1024*1024)throw new Error('File exceeds 10 MiB');
    let bytes=new Uint8Array(await file.arrayBuffer());
    let text:string|null=null;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{}
    if(text!==null){const prepared=await prepareImportedSource(`${folder}/${file.name}`,text,message=>updateStatusBar(message));bytes=new TextEncoder().encode(prepared);}

    let binary='';for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
    updateStatusBar(`Checking and importing ${file.name}…`);
    const result=await api<any>('/file/import','POST',{folder,name:file.name,content:btoa(binary)});
    results.push(`${file.name}: imported · ${result.security?.reason || result.security?.status || 'security check unavailable'}`);
   }catch(error){results.push(`${file.name}: ${String(error)}`);}
  }
  await loadFileTree(folder);updateStatusBar('Import finished');alert(results.join('\n'));
 };picker.click();
}
async function addImageUrl(folder:string):Promise<void> {
 hideCtxMenu();const url=prompt('Image URL (PNG, JPEG, GIF or WebP):');if(!url)return;
 try {updateStatusBar('Downloading image…');const result=await api<any>('/file/image-url','POST',{folder,url});await loadFileTree(folder);updateStatusBar(`Added ${result.path}`);}
 catch(error){updateStatusBar(String(error),true);alert(String(error));}
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

  const devToggle = document.getElementById("deps-dev-toggle") as HTMLInputElement | null;
  const dev = !!devToggle?.checked;

  try {
    const data = await api<any>("/deps/install", "POST", {
      name, version, registry: pkgInfo.registry, file: activeFile, dev,
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
// Create a new route/model/migration/middleware. The backend contract (identical
// across Python/PHP/Ruby/Node) is `POST /scaffold/run {kind, name}` — it runs the
// framework's own `generate` and returns `{ok, output, path?}`.
// The scaffold kinds are loaded from `/scaffold` (data-driven from the
// framework's GENERATORS registry), so every generator appears in the dropdown
// and a new one needs no dashboard change. The UI is: choose a kind -> a name
// input shows when the kind needs one -> Generate.
interface ScaffoldKind { kind: string; label: string; needs_name: boolean; summary?: string; usage?: string; }
let scaffoldKinds: ScaffoldKind[] = [];

async function populateScaffoldKinds(): Promise<void> {
  const sel = document.getElementById("scaffold-kind") as HTMLSelectElement | null;
  if (!sel) return;
  try {
    const data = await api<any>("/scaffold");
    scaffoldKinds = Array.isArray(data?.kinds) ? data.kinds : [];
  } catch { scaffoldKinds = []; }
  sel.innerHTML = scaffoldKinds
    .map((k) => `<option value="${esc(k.kind)}">${esc(k.label)}</option>`)
    .join("");
  scaffoldKindChange();
}

function scaffoldKindChange(): void {
  const sel = document.getElementById("scaffold-kind") as HTMLSelectElement | null;
  const nameInput = document.getElementById("scaffold-name") as HTMLInputElement | null;
  const hint = document.getElementById("scaffold-hint");
  if (!sel) return;
  const k = scaffoldKinds.find((x) => x.kind === sel.value);
  // Hide the name field for generators that take no name (e.g. auth, base).
  if (nameInput) nameInput.style.display = k && k.needs_name === false ? "none" : "";
  if (hint) hint.textContent = k ? k.summary || "" : "";
}

async function scaffoldGenerate(): Promise<void> {
  const sel = document.getElementById("scaffold-kind") as HTMLSelectElement | null;
  const nameInput = document.getElementById("scaffold-name") as HTMLInputElement | null;
  const output = document.getElementById("scaffold-output");
  if (!sel) return;
  const kind = sel.value;
  const k = scaffoldKinds.find((x) => x.kind === kind);
  const needsName = !k || k.needs_name !== false;
  const name = (nameInput?.value || "").trim();
  if (needsName && !name) { nameInput?.focus(); return; }

  if (output) { output.style.display = "block"; output.textContent = `Generating ${kind}${name ? ` "${name}"` : ""}...`; }
  try {
    const data = await api<any>("/scaffold/run", "POST", { kind, name });
    const path = data.path || firstPathFromOutput(data.output);
    if (output) {
      output.innerHTML = `<span style="color:var(--success)">✔</span> ${esc(`Generated ${kind}${name ? ": " + name : ""}`)}`;
      if (data.output) output.innerHTML += `\n<span style="opacity:0.7">${esc(String(data.output).trim())}</span>`;
      if (path) {
        output.innerHTML += `\n<span style="color:var(--info);cursor:pointer;text-decoration:underline" onclick="window.__editorOpenFile('${esc(path)}')">${esc(path)}</span>`;
      }
    }
    if (nameInput) nameInput.value = "";
    // Surface the new file(s) into their folders (expand + re-fetch just those
    // folders) so they show immediately - no full tree refresh.
    const created = pathsFromOutput(data.output);
    await revealNewFiles(path ? Array.from(new Set([path, ...created])) : created);
    if (path) setTimeout(() => openFile(path), 400);
  } catch (e: any) {
    if (output) output.innerHTML = `<span style="color:var(--danger)">✗</span> ${esc(e.message || "Failed")}`;
  }
}

// Map each run chip to its real backend endpoint. `migrate`/`test`/`seed` are
// distinct project operations — NOT the create endpoint.
const SCAFFOLD_RUN_ENDPOINTS: Record<string, string> = {
  migrate: "/migrate",
  test: "/test",
  seed: "/seed/run",
};

async function scaffoldRun(command: string): Promise<void> {
  const output = document.getElementById("scaffold-output");
  const endpoint = SCAFFOLD_RUN_ENDPOINTS[command];
  if (!endpoint) {
    if (output) { output.style.display = "block"; output.innerHTML = `<span style="color:var(--danger)">✗</span> Unknown command: ${esc(command)}`; }
    return;
  }
  if (output) { output.style.display = "block"; output.textContent = `Running ${command}...`; }

  try {
    const data = await api<any>(endpoint, "POST", {});
    if (output) output.innerHTML = `<span style="color:var(--success)">✔</span> ${esc(summariseRun(command, data))}`;
    // Migrate/seed mutate the tree/schema — refresh so results are visible.
    if (command === "migrate" || command === "seed") loadFileTree(".");
  } catch (e: any) {
    if (output) output.innerHTML = `<span style="color:var(--danger)">✗</span> ${esc(e.message || "Failed")}`;
  }
}

/** Turn a run endpoint's JSON result into a one-line human summary. */
function summariseRun(command: string, data: any): string {
  if (!data || typeof data !== "object") return `${command} complete`;
  if (command === "migrate") {
    const a = data.applied?.length ?? 0, s = data.skipped?.length ?? 0, f = data.failed?.length ?? 0;
    return `Migrate: ${a} applied, ${s} skipped${f ? `, ${f} failed` : ""}`;
  }
  if (command === "seed") {
    const seeded = data.seeded ?? 0, failed = data.failed ?? 0;
    return `Seed: ${seeded} rows${failed ? `, ${failed} failed` : ""}`;
  }
  if (command === "test") {
    const ok = data.ok !== false && data.code === 0;
    return `Tests ${ok ? "passed" : "failed"}${data.output ? `\n${String(data.output).trim().slice(-600)}` : ""}`;
  }
  return data.output || data.message || `${command} complete`;
}

/** Pull the first plausible file path out of a `generate` command's stdout,
 *  used when the backend doesn't return a structured `path`. */
function firstPathFromOutput(output?: string): string | undefined {
  if (!output) return undefined;
  const m = String(output).match(/((?:src|migrations|routes|models)\/[\w./-]+)/);
  return m ? m[1] : undefined;
}

(window as any).__scaffoldGenerate = scaffoldGenerate;
(window as any).__scaffoldKindChange = scaffoldKindChange;
(window as any).__scaffoldRun = scaffoldRun;
(window as any).__editorPreview = editorPreview;

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
  const leftSplit = document.getElementById("editor-splitter-left");
  // The right Tools panel was removed in 3.13.132; only the sidebar splitter
  // remains and the editor fills the space the panel used to occupy.
  if (!layout || !sidebar || !leftSplit) return;

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
(window as any).__editorUpload = uploadFiles;
(window as any).__editorImageUrl = addImageUrl;
(window as any).__editorImageHover = showImageHover;
(window as any).__editorImageHoverHide = hideImageHover;
(window as any).__editorImageDrag = (event:DragEvent,path:string)=>{event.dataTransfer?.setData("application/x-tina4-image",path);if(event.dataTransfer)event.dataTransfer.effectAllowed="copy";};
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
// Plan panel wiring — the plans browser opens plan .md files in the
// editor. The ▶ supervisor-run / stop / thought-dismiss handlers went
// with the agent chat (3.13.132).
(window as any).__editorPlanSwitch = switchPlan;
(window as any).__editorPlanOpen = openPlanFile;
(window as any).__editorPlanCreate = createPlanFromModal;

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
