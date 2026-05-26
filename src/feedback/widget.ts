/**
 * tina4-feedback-widget — customer-facing intake chat.
 *
 * Loaded only by whitelisted users via a framework-injected script
 * tag (<script src="/__feedback/widget.js" data-tina4-feedback>).
 * Renders a floating 💬 button bottom-right; clicking opens a small
 * modal that POSTs conversational turns to /__feedback/api/turn.
 *
 * Zero dependencies. Builds to a standalone IIFE bundle separate from
 * the dev admin SPA (which is ~1MB and would be wildly inappropriate
 * to load on every customer page).
 *
 * Tier 1 security model: customer text never reaches a file-write
 * path. Backend forwards to the Rust "intake" agent which has no
 * tools; its only output is structured ticket JSON. Acting on a
 * ticket requires the developer to click [Act on this →] in the
 * dev admin.
 */

interface TurnRequest {
  message: string;
  context: {
    url: string;
    viewport: string;
    ua: string;
  };
  conversation_id?: string;
}

interface AskResponse {
  ask: string;
  conversation_id: string;
}

interface FinalResponse {
  final: {
    title: string;
    category: string;
    severity: string;
    summary: string;
    original_text: string;
  };
  thread_id: string;
  submitted: true;
}

type TurnResponse = AskResponse | FinalResponse | { error: string; hint?: string };

// ── Bootstrap guard ──────────────────────────────────────────────────
// Bail if already loaded (defensive: framework injection is idempotent
// but a developer could include this twice during testing). ALSO bail
// if we're on a developer dashboard path — the customer feedback widget
// and the dev admin chat are two completely different concepts and
// should never coexist on the same page. The framework middleware also
// enforces this server-side; this is belt-and-suspenders for the case
// where the widget script got cached from a prior page view.
const _pathBlocked = (() => {
  try {
    const p = window.location.pathname || "";
    return p.startsWith("/__dev") || p.startsWith("/__feedback");
  } catch {
    return false;
  }
})();

if (_pathBlocked) {
  // eslint-disable-next-line no-console
  console.info("tina4-feedback-widget: skipping on developer path");
} else if ((window as any).__tina4FeedbackLoaded) {
  // eslint-disable-next-line no-console
  console.warn("tina4-feedback-widget already loaded; skipping");
} else {
  (window as any).__tina4FeedbackLoaded = true;
  bootstrap();
}

function bootstrap(): void {
  // Pull brand colour from the host page's CSS variables. --primary is
  // a common Tina4 convention; fall back to a neutral blue if absent.
  const root = getComputedStyle(document.documentElement);
  const brand = (root.getPropertyValue("--primary") || "").trim() || "#3b82f6";

  injectStyles(brand);
  const button = renderButton();
  document.body.appendChild(button);

  let modal: HTMLDivElement | null = null;
  let conversationId: string | undefined;
  const turns: { role: "user" | "ai"; text: string }[] = [];

  button.addEventListener("click", () => {
    if (modal) {
      modal.remove();
      modal = null;
      button.style.display = "";  // restore visibility on close
      return;
    }
    modal = renderModal();
    document.body.appendChild(modal);
    // Hide the floating button while the modal is open — matches the
    // reference UX (no "two bubbles at once" — the modal already has
    // its own × close button).
    button.style.display = "none";
    setTimeout(() => modal?.querySelector("textarea")?.focus(), 0);
  });

  function renderModal(): HTMLDivElement {
    const m = document.createElement("div");
    m.className = "tina4-fb-modal";
    m.innerHTML = `
      <div class="tina4-fb-head">
        <span class="tina4-fb-title">Tell us what's not working</span>
        <button type="button" class="tina4-fb-close" aria-label="Close">×</button>
      </div>
      <div class="tina4-fb-context">
        <span>📍 ${escapeHtml(location.pathname + location.search)}</span>
        <span>📐 ${window.innerWidth}×${window.innerHeight}</span>
      </div>
      <div class="tina4-fb-chat" role="log"></div>
      <form class="tina4-fb-form">
        <textarea
          rows="3"
          placeholder="What's hard to use here? Be specific — which field, which button, what you expected."
          aria-label="Feedback message"
        ></textarea>
        <button type="submit" class="tina4-fb-send">Send</button>
      </form>
    `;
    m.querySelector(".tina4-fb-close")?.addEventListener("click", () => {
      m.remove();
      modal = null;
      button.style.display = "";  // restore floating button when × clicked
    });
    const form = m.querySelector("form") as HTMLFormElement;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const ta = form.querySelector("textarea") as HTMLTextAreaElement;
      const text = ta.value.trim();
      if (!text) return;
      ta.value = "";
      void sendTurn(text);
    });
    repaintChat(m);
    return m;
  }

  function repaintChat(host: HTMLElement): void {
    const chat = host.querySelector(".tina4-fb-chat");
    if (!chat) return;
    if (!turns.length) {
      chat.innerHTML = `<div class="tina4-fb-hint">Your feedback lands directly with the team — no email loop. We'll ask a quick follow-up if we need to.</div>`;
      return;
    }
    chat.innerHTML = turns.map((t) => {
      const cls = t.role === "user" ? "tina4-fb-user" : "tina4-fb-ai";
      return `<div class="tina4-fb-msg ${cls}">${escapeHtml(t.text)}</div>`;
    }).join("");
    chat.scrollTop = chat.scrollHeight;
  }

  async function sendTurn(text: string): Promise<void> {
    if (!modal) return;
    turns.push({ role: "user", text });
    repaintChat(modal);
    setBusy(modal, true);

    const body: TurnRequest = {
      message: text,
      context: {
        url: location.pathname + location.search,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        ua: navigator.userAgent,
      },
      conversation_id: conversationId,
    };
    let result: TurnResponse;
    try {
      const r = await fetch("/__feedback/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      result = await r.json();
      if (!r.ok) {
        const err = (result as any)?.error || `HTTP ${r.status}`;
        turns.push({ role: "ai", text: `Couldn't send: ${err}` });
        repaintChat(modal);
        setBusy(modal, false);
        return;
      }
    } catch (e: any) {
      turns.push({ role: "ai", text: `Network issue: ${e?.message || e}` });
      repaintChat(modal);
      setBusy(modal, false);
      return;
    }

    if ("ask" in result) {
      conversationId = result.conversation_id;
      turns.push({ role: "ai", text: result.ask });
      repaintChat(modal);
      setBusy(modal, false);
      modal?.querySelector("textarea")?.focus();
    } else if ("final" in result) {
      turns.push({
        role: "ai",
        text: `Thanks — filed as: "${result.final.title}". The team will take it from here.`,
      });
      repaintChat(modal);
      setBusy(modal, false);
      // Reset conversation state — next open is a fresh thread.
      conversationId = undefined;
      turns.length = 0;
      setTimeout(() => {
        modal?.remove();
        modal = null;
        button.style.display = "";  // restore floating button on auto-close
      }, 4500);
    } else {
      const err = (result as any)?.error || "unexpected response";
      turns.push({ role: "ai", text: `Issue: ${err}` });
      repaintChat(modal);
      setBusy(modal, false);
    }
  }

  function setBusy(host: HTMLElement, busy: boolean): void {
    const btn = host.querySelector(".tina4-fb-send") as HTMLButtonElement | null;
    const ta = host.querySelector("textarea") as HTMLTextAreaElement | null;
    if (btn) {
      btn.disabled = busy;
      btn.textContent = busy ? "Sending…" : "Send";
    }
    if (ta) ta.disabled = busy;
  }
}

function renderButton(): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "tina4-fb-btn";
  b.setAttribute("aria-label", "Send feedback");
  b.innerHTML = "💬";
  b.title = "Tell us what's not working";
  return b;
}

function injectStyles(brand: string): void {
  const style = document.createElement("style");
  style.id = "tina4-fb-styles";
  style.textContent = `
    .tina4-fb-btn {
      position: fixed; bottom: 1.25rem; right: 1.25rem;
      width: 48px; height: 48px; border-radius: 50%; border: none;
      background: ${brand}; color: white; font-size: 1.4rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.18); cursor: pointer;
      z-index: 2147483646; transition: transform 0.15s, box-shadow 0.15s;
      display: flex; align-items: center; justify-content: center;
      line-height: 1; padding: 0;
    }
    .tina4-fb-btn:hover { transform: scale(1.06); box-shadow: 0 6px 16px rgba(0,0,0,0.22); }
    .tina4-fb-btn:active { transform: scale(0.96); }
    .tina4-fb-modal {
      position: fixed; bottom: 5rem; right: 1.25rem;
      width: 340px; max-height: 480px; display: flex; flex-direction: column;
      background: #1e1e2e; color: #cdd6f4;
      border: 1px solid #313244; border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.35);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      font-size: 0.85rem; z-index: 2147483647;
      animation: tina4-fb-in 0.18s ease-out;
    }
    @keyframes tina4-fb-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .tina4-fb-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.6rem 0.8rem; border-bottom: 1px solid #313244;
    }
    .tina4-fb-title { font-weight: 600; font-size: 0.9rem; }
    .tina4-fb-close {
      background: transparent; border: none; color: #9399b2;
      font-size: 1.4rem; line-height: 1; cursor: pointer; padding: 0 0.2rem;
    }
    .tina4-fb-close:hover { color: #cdd6f4; }
    .tina4-fb-context {
      display: flex; gap: 0.6rem; padding: 0.4rem 0.8rem;
      font-size: 0.7rem; color: #9399b2;
      border-bottom: 1px solid #313244;
      font-family: ui-monospace, "SF Mono", Menlo, monospace;
    }
    .tina4-fb-chat {
      flex: 1; overflow-y: auto; padding: 0.5rem 0.8rem;
      display: flex; flex-direction: column; gap: 0.4rem;
      min-height: 80px; max-height: 280px;
    }
    .tina4-fb-hint {
      font-size: 0.75rem; color: #9399b2; line-height: 1.4; padding: 0.3rem 0;
    }
    .tina4-fb-msg {
      padding: 0.4rem 0.6rem; border-radius: 6px;
      max-width: 85%; word-wrap: break-word; line-height: 1.35;
    }
    .tina4-fb-user { align-self: flex-end; background: ${brand}; color: white; }
    .tina4-fb-ai   { align-self: flex-start; background: #313244; }
    .tina4-fb-form {
      display: flex; flex-direction: column; gap: 0.4rem;
      padding: 0.5rem 0.8rem 0.8rem; border-top: 1px solid #313244;
    }
    .tina4-fb-form textarea {
      width: 100%; box-sizing: border-box; resize: vertical;
      min-height: 60px; font-family: inherit; font-size: 0.82rem;
      padding: 0.4rem 0.5rem; border: 1px solid #313244;
      background: #11111b; color: #cdd6f4; border-radius: 4px;
      line-height: 1.3;
    }
    .tina4-fb-form textarea:focus {
      outline: none; border-color: ${brand};
    }
    .tina4-fb-send {
      align-self: flex-end; padding: 0.35rem 0.9rem;
      background: ${brand}; color: white; border: none; border-radius: 4px;
      font-size: 0.8rem; font-weight: 500; cursor: pointer;
    }
    .tina4-fb-send:disabled { opacity: 0.55; cursor: wait; }
    .tina4-fb-send:hover:not(:disabled) { filter: brightness(1.1); }
  `;
  document.head.appendChild(style);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
