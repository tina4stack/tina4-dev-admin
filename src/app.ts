// Tina4 Dev Admin — Unified SPA
import { getTheme, applyTheme, CSS } from "./styles/theme.js";
import { renderRoutes } from "./components/Routes.js";
import { renderDatabase } from "./components/Database.js";
import { renderErrors } from "./components/Errors.js";
import { renderSystem } from "./components/System.js";
import { renderMetrics } from "./components/Metrics.js";
import { renderChat } from "./components/Chat.js";
// Thoughts is embedded in Code With Me, not a separate tab

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
  { id: "errors", label: "Errors", render: renderErrors },
  { id: "metrics", label: "Metrics", render: renderMetrics },
  { id: "system", label: "System", render: renderSystem },
];

const chatTab: TabDef = { id: "chat", label: "Code With Me", render: renderChat };

let chatUnlocked = localStorage.getItem("tina4_cwm_unlocked") === "true";
let tabs: TabDef[] = chatUnlocked ? [chatTab, ...baseTabs] : [...baseTabs];
let activeTab = chatUnlocked ? "chat" : "routes";

function renderApp(): void {
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <div class="dev-admin">
      <div class="dev-header">
        <h1><span>Tina4</span> Dev Admin</h1>
        <span class="text-sm text-muted" id="version-label" style="cursor:default;user-select:none">${theme.name} &bull; v3.10.70</span>
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

// Easter egg: 5 clicks on version label unlocks Code With Me
let unlockClicks = 0;
let unlockTimer: ReturnType<typeof setTimeout> | null = null;

document.getElementById("version-label")?.addEventListener("click", () => {
  if (chatUnlocked) return;
  unlockClicks++;
  if (unlockTimer) clearTimeout(unlockTimer);
  unlockTimer = setTimeout(() => { unlockClicks = 0; }, 2000);

  if (unlockClicks >= 5) {
    chatUnlocked = true;
    localStorage.setItem("tina4_cwm_unlocked", "true");
    tabs = [chatTab, ...baseTabs];
    activeTab = "chat";

    // Re-render tab bar
    const tabBar = document.getElementById("tab-bar");
    if (tabBar) {
      tabBar.innerHTML = tabs.map(t =>
        `<button class="dev-tab ${t.id === activeTab ? "active" : ""}" data-tab="${t.id}" onclick="window.__switchTab('${t.id}')">${t.label}</button>`
      ).join("");
    }
    switchTab("chat");
  }
});
