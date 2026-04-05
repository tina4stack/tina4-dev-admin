// Tina4 Dev Admin — Unified SPA
import { getTheme, applyTheme, CSS } from "./styles/theme.js";
import { renderRoutes } from "./components/Routes.js";
import { renderDatabase } from "./components/Database.js";
import { renderErrors } from "./components/Errors.js";
import { renderSystem } from "./components/System.js";
import { renderMetrics } from "./components/Metrics.js";
import { renderChat } from "./components/Chat.js";

// Inject global styles
const style = document.createElement("style");
style.textContent = CSS;
document.head.appendChild(style);

// Apply theme
const theme = getTheme();
applyTheme(theme);

type TabDef = { id: string; label: string; render: (el: HTMLElement) => void };

const tabs: TabDef[] = [
  { id: "chat", label: "Code With Me", render: renderChat },
  { id: "routes", label: "Routes", render: renderRoutes },
  { id: "database", label: "Database", render: renderDatabase },
  { id: "errors", label: "Errors", render: renderErrors },
  { id: "metrics", label: "Metrics", render: renderMetrics },
  { id: "system", label: "System", render: renderSystem },
];

let activeTab = "chat";

function renderApp(): void {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="dev-admin">
      <div class="dev-header">
        <h1><span>Tina4</span> Dev Admin</h1>
        <span class="text-sm text-muted">${theme.name} &bull; v3.10</span>
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

(window as any).__switchTab = switchTab;

// Boot
renderApp();
