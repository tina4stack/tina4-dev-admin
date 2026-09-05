import { beforeEach, describe, expect, it, vi } from "vitest";
// Importing the module runs its top-level window wiring, so we can assert
// which window.__ handlers exist after the agent chat removal (3.13.132).
import { renderEditor } from "../src/components/Editor";

// The agent chat (Rust supervisor: threads / chat / execute / sessions /
// thoughts) and the right-side Tools panel were removed. This suite is the
// regression that keeps them gone: the chat window handlers must NOT be wired,
// the surviving grounding/plans handlers must remain available to the MCP
// workflow, and renderEditor must remain a full-width editor with no panel.

describe("agent chat removed — window wiring", () => {
  it("does NOT wire any agent-chat / supervisor handler on window", () => {
    for (const gone of [
      "__threadsNew",
      "__threadsSend",
      "__threadsShowList",
      "__threadsShowDetail",
      "__threadsArchiveActive",
      "__editorPlanRun",   // ▶ hand plan to the Rust supervisor
      "__editorPlanStop",
      "__editorThoughtDismiss",
      "__buildPlanNow",
      "__aiBlockApply",
      "__aiBlockInsert",
    ]) {
      expect((window as any)[gone], `${gone} should be gone with the agent`).toBeUndefined();
    }
  });

  it("still wires the surviving editor + grounding + plans handlers", () => {
    for (const kept of [
      "__groundingToggle",   // 🔑 framework grounding (mcp.tina4.com)
      "__groundingSave",
      "__plansToggle",       // 📋 plans browser (MCP-backed)
      "__plansOpen",
      "__editorToggleAI",
      "__editorPlanOpen",
      "__editorOpenFile",    // code editor
      "__editorSwitchFile",
    ]) {
      expect((window as any)[kept], `${kept} must survive the agent removal`).toBeTypeOf("function");
    }
  });
});

describe("agent chat and right-side Tools panel removed", () => {
  beforeEach(() => {
    // renderEditor fetches the file tree + git status + plan and opens a
    // live-reload socket. Stub each with the shape its caller reads so the
    // render is a pure DOM exercise (no server, no console noise).
    global.fetch = vi.fn(async (url: any) => {
      const u = String(url);
      const body: any = u.includes("/git/status") ? { branch: "", files: [] }
        : u.includes("/mcp/call") ? { ok: true, result: null }
        : u.includes("/files") ? { branch: "", entries: [] }
        : []; // anything else: an empty listing
      // The api() helper reads response.text() then JSON.parses it, so the
      // stub must serialise the body (an empty text() yields `undefined`).
      return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as any;
    }) as any;
    (global as any).WebSocket = class { close() {} send() {} addEventListener() {} } as any;
    document.body.innerHTML = `<div id="app"></div>`;
  });

  it("keeps the editor full-width and paints no chat or Tools panel", () => {
    renderEditor(document.getElementById("app")!);

    // The right-side panel and its controls were removed with the agent
    // harness. Grounding and plans remain handler-level MCP integrations.
    expect(document.getElementById("editor-right-panel")).toBeNull();
    expect(document.getElementById("editor-ai-panel")).toBeNull();
    expect(document.getElementById("editor-deps-panel")).toBeNull();
    expect(document.getElementById("grounding-toggle-btn")).toBeNull();
    expect(document.getElementById("plans-toggle-btn")).toBeNull();

    // The agent chat DOM is gone: no reply input, no chat message list, no
    // threads list/detail, no "+ New conversation" button.
    expect(document.getElementById("threads-reply-input")).toBeNull();
    expect(document.getElementById("editor-ai-messages")).toBeNull();
    expect(document.getElementById("threads-list-view")).toBeNull();
    expect(document.getElementById("threads-detail-view")).toBeNull();
    expect(document.querySelector(".threads-new-btn")).toBeNull();

    // The code editor (the landing) is present.
    expect(document.getElementById("editor-file-tree")).not.toBeNull();
    expect(document.getElementById("editor-content")).not.toBeNull();
  });
});
