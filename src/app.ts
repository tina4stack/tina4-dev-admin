// Tina4 Dev Admin — Unified SPA
import { api, esc } from "./api.js";
import { getTheme, applyTheme, CSS } from "./styles/theme.js";
import { renderRoutes } from "./components/Routes.js";
import { renderDatabase } from "./components/Database.js";
import { renderErrors } from "./components/Errors.js";
import { renderSystem } from "./components/System.js";
import { renderMetrics } from "./components/Metrics.js";
import { renderGraphQL } from "./components/GraphQL.js";
import { renderQueue } from "./components/Queue.js";
import { renderEditor } from "./components/Editor.js";
// AI Chat is now embedded in the Code With Me editor panel

// Inject global styles
const style = document.createElement("style");
style.textContent = CSS;
document.head.appendChild(style);

// Apply theme
const theme = getTheme();
applyTheme(theme);

type TabDef = { id: string; label: string; render: (el: HTMLElement) => void };

const baseTabs: TabDef[] = [
  { id: "routes", label: "Routes", render: renderRoutes },
  { id: "database", label: "Database", render: renderDatabase },
  { id: "graphql", label: "GraphQL", render: renderGraphQL },
  { id: "queue", label: "Queue", render: renderQueue },
  { id: "errors", label: "Errors", render: renderErrors },
  { id: "metrics", label: "Metrics", render: renderMetrics },
  { id: "system", label: "System", render: renderSystem },
];

const editorTab: TabDef = { id: "editor", label: "Code With Me", render: renderEditor };

let tabs: TabDef[] = [editorTab, ...baseTabs];
let activeTab = "editor";

function renderApp(): void {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="dev-admin">
      <div class="dev-header">
        <h1><span>Tina4</span> Dev Admin</h1>
        <div style="display:flex;align-items:center;gap:0.75rem">
          <span class="text-sm text-muted" id="version-label" style="cursor:default;user-select:none">${theme.name} &bull; loading&hellip;</span>
          <button class="btn btn-sm" onclick="window.__closeDevAdmin()" title="Close Dev Admin" style="font-size:14px;width:28px;height:28px;padding:0;line-height:1">&times;</button>
        </div>
      </div>
      <div class="dev-tabs" id="tab-bar"></div>
      <div class="dev-content" id="tab-content"></div>
    </div>
  `;

  // Render tab bar
  const tabBar = document.getElementById("tab-bar")!;
  tabBar.innerHTML = tabs.map(t =>
    `<button class="dev-tab ${t.id === activeTab ? "active" : ""}" data-tab="${t.id}" onclick="window.__switchTab('${t.id}')">${t.label}</button>`
  ).join("");

  // Render active panel
  switchTab(activeTab);
}

function switchTab(id: string): void {
  activeTab = id;

  // Full-screen mode for editor — hide header and tab bar
  const header = document.querySelector(".dev-header") as HTMLElement;
  const tabBar = document.getElementById("tab-bar") as HTMLElement;
  const adminEl = document.querySelector(".dev-admin") as HTMLElement;
  const isFullscreen = (id === "editor");

  if (header) header.style.display = isFullscreen ? "none" : "";
  if (tabBar) tabBar.style.display = isFullscreen ? "none" : "";
  if (adminEl) adminEl.classList.toggle("fullscreen-editor", isFullscreen);

  // Update tab buttons
  document.querySelectorAll(".dev-tab").forEach(btn => {
    btn.classList.toggle("active", (btn as HTMLElement).dataset.tab === id);
  });

  // Render panel
  const content = document.getElementById("tab-content");
  if (!content) return;

  const panel = document.createElement("div");
  panel.className = "dev-panel active";
  content.innerHTML = "";
  content.appendChild(panel);

  const tab = tabs.find(t => t.id === id);
  if (tab) tab.render(panel);
}

function closeDevAdmin(): void {
  // If inside an iframe, remove the parent panel
  if (window.parent !== window) {
    try {
      const panel = window.parent.document.getElementById("tina4-dev-panel");
      if (panel) panel.remove();
    } catch {
      // Cross-origin — just hide ourselves
      document.body.style.display = "none";
    }
  }
}

(window as any).__closeDevAdmin = closeDevAdmin;
(window as any).__switchTab = switchTab;

// Boot
renderApp();

// Fetch version from backend
api<any>("/system")
  .then(d => {
    const label = document.getElementById("version-label");
    // PHP: d.framework.version, Python: d.framework string, fallback: d.version
    const ver = d.version
      || (typeof d.framework === "object" ? d.framework.version : null)
      || (typeof d.framework === "string" ? d.framework : null);
    if (label && ver) {
      label.innerHTML = `${theme.name} &bull; v${esc(ver)}`;
    }
  })
  .catch(() => {
    const label = document.getElementById("version-label");
    if (label) label.innerHTML = `${theme.name}`;
  });

// Easter egg removed — Code With Me is always available in dev mode.
