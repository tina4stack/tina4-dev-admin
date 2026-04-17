import { api, esc } from "../api.js";

// ── CodeMirror imports ──
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
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
      <div class="editor-right-panel" id="editor-right-panel">
        <!-- AI Assistant (default) -->
        <div id="editor-ai-panel" class="right-panel-view">
          <div class="editor-ai-header">
            <span style="font-weight:600;font-size:0.8rem">AI Assistant</span>
            <button class="btn btn-sm" id="editor-ai-toggle" onclick="window.__editorToggleAI()" style="font-size:0.6rem;padding:2px 6px" title="Toggle panel">&#x25B6;</button>
          </div>
          <div id="editor-ai-messages" class="editor-ai-messages">
            <div class="ai-msg ai-bot">How can I help with this file?</div>
          </div>
          <div class="editor-ai-input-area">
            <textarea id="editor-ai-input" class="input" placeholder="Ask about this file..." rows="2" style="flex:1;resize:none;font-size:0.8rem;min-height:36px"></textarea>
            <div style="display:flex;gap:4px;margin-top:4px">
              <button class="btn btn-sm btn-primary" onclick="window.__editorAISend()" style="flex:1;font-size:0.7rem">Send</button>
              <button class="btn btn-sm" onclick="window.__editorAIExplain()" style="font-size:0.7rem" title="Explain selected code">Explain</button>
              <button class="btn btn-sm" onclick="window.__editorAIRefactor()" style="font-size:0.7rem" title="Suggest refactoring">Refactor</button>
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

  // Load file tree
  loadFileTree(".");
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
      html += `<div class="tree-item tree-dir ${statusClass}" style="padding-left:${indent}px"
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
  renderTabs();
  renderContent();
  renderFileTree(); // Update active highlight
  updateStatusBar();
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
    return `<div class="editor-tab ${isActive ? "active" : ""}" onclick="window.__editorSwitchFile('${esc(f.path)}')">
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

  const state = EditorState.create({
    doc: file.content,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      oneDark,
      saveKeymap,
      keymap.of([...defaultKeymap, indentWithTab, ...searchKeymap]),
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
    .editor-ai-input-area { padding: 0.5rem; border-top: 1px solid var(--border, #313244); flex-shrink: 0; }

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

async function aiSend(): Promise<void> {
  const input = document.getElementById("editor-ai-input") as HTMLTextAreaElement;
  const msg = input?.value?.trim();
  if (!msg) return;
  input.value = "";

  addAIMessage(esc(msg), "user");

  // Build context: current file + selection
  const file = openFiles.find(f => f.path === activeFile);
  const context = file ? `File: ${file.path} (${file.language})\n\n${file.content}` : "";
  const selection = getSelectedText();

  addAIMessage('<span style="opacity:0.6">Thinking...</span>', "bot");

  try {
    const body: any = {
      message: msg,
      context: { file: file?.path || "", language: file?.language || "", content: context, selection },
      settings: JSON.parse(localStorage.getItem("tina4_chat_settings") || "{}"),
    };

    const response = await fetch("/__dev/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    // Remove "thinking" message
    const messages = document.getElementById("editor-ai-messages");
    if (messages?.lastElementChild?.textContent === "Thinking...") {
      messages.lastElementChild.remove();
    }

    if (!response.ok) {
      addAIMessage(`<span style="color:var(--danger)">Error: ${response.status}</span>`, "bot");
      return;
    }

    // Stream SSE response
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) accumulated += data.content;
            } catch {}
          }
        }
      }
      if (accumulated) {
        addAIMessage(formatAIResponse(accumulated), "bot");
      }
    } else {
      const data = await response.json();
      addAIMessage(formatAIResponse(data.content || data.message || JSON.stringify(data)), "bot");
    }
  } catch (e: any) {
    const messages = document.getElementById("editor-ai-messages");
    if (messages?.lastElementChild?.textContent === "Thinking...") {
      messages.lastElementChild.remove();
    }
    addAIMessage(`<span style="color:var(--danger)">Connection failed</span>`, "bot");
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

function formatAIResponse(text: string): string {
  let t = text.replace(/\\n/g, "\n");

  // Code blocks with diff colouring
  t = t.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const lines = (code as string).split("\n").map((line: string) => {
      if (line.startsWith("+")) return `<span class="ai-diff-add">${esc(line)}</span>`;
      if (line.startsWith("-")) return `<span class="ai-diff-del">${esc(line)}</span>`;
      return esc(line);
    }).join("\n");
    return `<pre><code>${lines}</code></pre>`;
  });

  // Inline code
  t = t.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.3);padding:0.1rem 0.3rem;border-radius:0.2rem">$1</code>');

  // Bold
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Newlines
  t = t.replace(/\n/g, '<br>');

  return t;
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
(window as any).__editorPopOut = popOut;
(window as any).__editorSave = saveCurrentFile;
(window as any).__editorToggleAI = toggleAI;
(window as any).__editorAISend = aiSend;
(window as any).__editorAIExplain = aiExplain;
(window as any).__editorAIRefactor = aiRefactor;

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
