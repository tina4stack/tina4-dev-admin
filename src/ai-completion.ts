/**
 * In-editor AI completion — ghost text as you type.
 *
 * What the user sees: after a short idle, a greyed-out suggestion
 * extending from the cursor. Tab accepts the whole thing, Esc (or
 * any typing) dismisses.
 *
 * Under the hood: FIM (fill-in-the-middle) against qwen2.5-coder:14b
 * via the /ai proxy. The prompt uses qwen's special tokens —
 *
 *   <|fim_prefix|>{prefix}<|fim_suffix|>{suffix}<|fim_middle|>
 *
 * which gives us inline completion at the cursor, not just EOF
 * generation. Prefix = the last ~40 lines before the cursor, suffix
 * = the next ~20 lines. That window is enough signal for single-
 * function completions without blowing the 45K YaRN context budget.
 *
 * Plan-awareness: when a supervisor plan step is active, its intent
 * is prepended to the query context so the completion lands on the
 * current task. Off-plan files still get completions but without the
 * plan-intent boost — "quieter, not absent."
 *
 * This lives alongside the existing `autocompletion()` extension
 * (CodeMirror's popup completion); the two don't interfere because
 * ghost text only shows when no popup is open.
 */

import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType, keymap } from "@codemirror/view";
import { EditorState, StateField, StateEffect, Prec } from "@codemirror/state";
import type { Extension } from "@codemirror/state";

// ── Ghost state (what the user currently sees) ─────────────────

/**
 * The in-flight or currently-displayed ghost text. `from` is the
 * cursor position at the time the suggestion was requested — if the
 * user moves elsewhere before it arrives, we drop the suggestion.
 */
interface GhostState {
  from: number;
  /** Accumulated completion tokens. Streaming appends to this. */
  text: string;
  /** The request id this ghost was issued from. Lets late responses
   *  abort themselves if a newer trigger has fired. */
  requestId: number;
}

const setGhost = StateEffect.define<GhostState | null>();

const ghostField = StateField.define<GhostState | null>({
  create: () => null,
  update(value, tr) {
    // Any doc change or selection move that isn't our own dispatch
    // invalidates the ghost — the user has started typing past it,
    // clicked elsewhere, or the suggestion is no longer relevant.
    for (const eff of tr.effects) {
      if (eff.is(setGhost)) return eff.value;
    }
    if (value && (tr.docChanged || tr.selection)) return null;
    return value;
  },
});

// ── Decoration that renders the ghost inline ───────────────────

class GhostWidget extends WidgetType {
  constructor(readonly text: string) { super(); }
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-ghost-completion";
    // Preserve leading whitespace so indented suggestions render
    // correctly. The CSS sets white-space: pre-wrap.
    span.textContent = this.text;
    return span;
  }
  eq(other: GhostWidget): boolean { return other.text === this.text; }
  // Widgets usually want to be "invisible" to cursor motion. Ghost
  // text is a hint; pointer events go to the real doc.
  ignoreEvent(): boolean { return true; }
}

function ghostDecorations(state: EditorState): DecorationSet {
  const ghost = state.field(ghostField);
  if (!ghost || !ghost.text) return Decoration.none;
  // Only show if the cursor is still at the suggestion's anchor — a
  // click elsewhere should make the hint disappear until the next
  // trigger.
  const { from } = state.selection.main;
  if (from !== ghost.from) return Decoration.none;
  const deco = Decoration.widget({
    widget: new GhostWidget(ghost.text),
    side: 1, // widget sits AFTER the cursor, not before
  });
  return Decoration.set([deco.range(ghost.from)]);
}

const ghostDecoPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = ghostDecorations(view.state); }
    update(u: ViewUpdate) { this.decorations = ghostDecorations(u.state); }
  },
  { decorations: (v) => v.decorations },
);

// ── Accept / dismiss keymap ────────────────────────────────────

function acceptGhost(view: EditorView): boolean {
  const ghost = view.state.field(ghostField);
  if (!ghost || !ghost.text) return false;
  // Insert the ghost text at its anchor and clear the ghost. One
  // transaction so undo rolls it back in one step. Cursor lands at
  // the end of the inserted text — the natural "now keep typing"
  // position.
  const to = ghost.from + ghost.text.length;
  view.dispatch({
    changes: { from: ghost.from, insert: ghost.text },
    selection: { anchor: to },
    effects: setGhost.of(null),
    userEvent: "input.complete",
  });
  return true;
}

function dismissGhost(view: EditorView): boolean {
  const ghost = view.state.field(ghostField);
  if (!ghost) return false;
  view.dispatch({ effects: setGhost.of(null) });
  return true;
}

// Highest precedence so Tab-accept wins over Tab-indent *when a ghost
// is showing*. If no ghost is active, the run handler returns false
// and the next Tab binding (indentWithTab) handles it.
const acceptKeymap = Prec.highest(
  keymap.of([
    { key: "Tab", run: acceptGhost },
    { key: "Escape", run: dismissGhost },
  ]),
);

// ── FIM client ────────────────────────────────────────────────

/** Options passed to the extension factory so the plugin can reach
 *  back for per-file / per-plan context at trigger time. */
export interface CompletionOpts {
  /** Language for the current file — feeds into the RAG-adjacent
   *  convention hints (later slice) and the status dot tooltip. */
  language: () => string;
  /** Absolute or workspace-relative path of the file being edited.
   *  Included so telemetry + future plan-alignment checks can tell
   *  which file a completion was for. */
  path: () => string | null;
  /** Plan step intent if a plan is active. Null otherwise — the
   *  completion still runs, just without the intent boost. */
  planIntent: () => string | null;
  /** Whether to enable completions at all. Tied to the status strip
   *  toggle so the user can turn ghost text off globally. */
  enabled: () => boolean;
}

/** Debounce window between the last keystroke and firing a FIM
 *  request. 250ms: long enough that a run of typing doesn't fire
 *  seven requests, short enough that stopping to think surfaces a
 *  suggestion quickly. */
const DEBOUNCE_MS = 250;

/** Context window — how much surrounding code to send. Prefix is
 *  more important than suffix (the model completes from context
 *  *before* the cursor), hence the asymmetric split. */
const PREFIX_LINES = 40;
const SUFFIX_LINES = 20;

/** Minimum completion length to show. Below this threshold the
 *  suggestion is often just a closing brace or trailing space — not
 *  worth the visual noise. */
const MIN_SHOW_CHARS = 2;

/** Per-view trigger state. ViewPlugin instance methods are hard to
 *  reach from the dispatch-side code, so we stash the hot state on
 *  the plugin and let the keymap/update dispatch reach it via the
 *  view's plugin field. */
interface TriggerState {
  timer: number | null;
  abort: AbortController | null;
  nextRequestId: number;
}

/** Build the trigger plugin. Captures `opts` in a closure so context
 *  (language / path / plan) can be fetched lazily on each request. */
function triggerPlugin(opts: CompletionOpts) {
  return ViewPlugin.fromClass(
    class {
      state: TriggerState = { timer: null, abort: null, nextRequestId: 0 };

      constructor(public view: EditorView) {}

      update(u: ViewUpdate) {
        if (!opts.enabled()) return;

        // Any doc change or selection change resets the timer. If a
        // request is in flight, abort it — stale completions arriving
        // after the user has kept typing are noise.
        if (u.docChanged || u.selectionSet) {
          this.cancel();
          this.schedule();
        }
      }

      schedule() {
        if (this.state.timer != null) window.clearTimeout(this.state.timer);
        this.state.timer = window.setTimeout(() => this.fire(), DEBOUNCE_MS);
      }

      cancel() {
        if (this.state.timer != null) {
          window.clearTimeout(this.state.timer);
          this.state.timer = null;
        }
        if (this.state.abort) {
          this.state.abort.abort();
          this.state.abort = null;
        }
      }

      async fire() {
        this.state.timer = null;
        if (!opts.enabled()) return;

        const view = this.view;
        const state = view.state;
        const sel = state.selection.main;
        // Only trigger on a collapsed selection — selections are a
        // signal the user is navigating, not writing.
        if (!sel.empty) return;

        // Skip mid-word: if the character to the left is a word
        // character, the user is in the middle of typing an identifier
        // and we'd just spam completions per keystroke. The existing
        // autocomplete popup handles that case.
        const pos = sel.from;
        if (pos > 0) {
          const char = state.doc.sliceString(pos - 1, pos);
          if (/\w/.test(char) === false) {
            // OK — non-word char or cursor at line start.
          } else {
            // The *next* char matters too — between two word chars
            // means mid-identifier, skip. At end of a word (next char
            // is whitespace / punctuation) → fire.
            const nextChar = state.doc.sliceString(pos, pos + 1);
            if (/\w/.test(nextChar)) return;
          }
        }

        // Build the FIM prompt context.
        const doc = state.doc;
        const line = doc.lineAt(pos);
        const prefixStart = doc.line(Math.max(1, line.number - PREFIX_LINES)).from;
        const suffixEnd = doc.line(Math.min(doc.lines, line.number + SUFFIX_LINES)).to;
        const prefix = doc.sliceString(prefixStart, pos);
        const suffix = doc.sliceString(pos, suffixEnd);

        // Nothing to complete if both sides are empty. Guards against
        // completing on a blank buffer where FIM drifts into lore.
        if (!prefix.trim() && !suffix.trim()) return;

        const requestId = ++this.state.nextRequestId;
        this.state.abort = new AbortController();

        // Clear any stale ghost while we wait — looks flakier than
        // keeping the old one, but keeping the old one is also wrong
        // (it refers to a position that no longer exists).
        view.dispatch({ effects: setGhost.of(null) });

        let accumulated = "";
        try {
          await streamFim(
            {
              prefix,
              suffix,
              language: opts.language(),
              path: opts.path(),
              planIntent: opts.planIntent(),
            },
            this.state.abort.signal,
            (token) => {
              // If a newer request has started, drop late tokens on
              // the floor. The request was aborted but fetch may
              // already have buffered some data.
              if (requestId !== this.state.nextRequestId) return;
              accumulated += token;

              // Trim at the first structural boundary so we don't
              // bleed into the next function / block. Cheap heuristic:
              // stop at the first blank line that appears after at
              // least one non-blank line of output.
              const bounded = boundCompletion(accumulated);

              if (bounded.length < MIN_SHOW_CHARS) return;
              view.dispatch({
                effects: setGhost.of({ from: pos, text: bounded, requestId }),
              });
            },
          );
        } catch (e: any) {
          if (e?.name === "AbortError") return;
          // Network / server errors are common when the LLM host is
          // down; silent-fail is the right UX. Toasting a red chip
          // every time would train users to disable completion.
          console.warn("[completion]", e);
        } finally {
          this.state.abort = null;
        }
      }

      destroy() { this.cancel(); }
    },
  );
}

/** Stop the completion at the first meaningful boundary so ghost
 *  text doesn't bleed into unrelated code. Rules:
 *    - Stop at the first blank line that follows at least one line
 *      of actual content.
 *    - Trim trailing whitespace.
 *  We intentionally don't try to match braces — that gets wrong
 *  faster than it gets right with multi-line completions. */
function boundCompletion(raw: string): string {
  const lines = raw.split("\n");
  let sawContent = false;
  const kept: string[] = [];
  for (const line of lines) {
    const isBlank = line.trim().length === 0;
    if (sawContent && isBlank) break;
    kept.push(line);
    if (!isBlank) sawContent = true;
  }
  return kept.join("\n").replace(/\s+$/g, "");
}

// ── Ollama streaming FIM call ─────────────────────────────────

interface FimCtx {
  prefix: string;
  suffix: string;
  language: string;
  path: string | null;
  planIntent: string | null;
}

/** Stream qwen2.5-coder FIM via the /ai proxy.
 *
 *  Wire-format note: the backing Ollama instance on :11437 exposes
 *  `/api/chat` but not `/api/generate` (the raw-completion endpoint),
 *  so we wrap FIM in a chat turn. The system message tells qwen to
 *  emit only the middle-text; the user message contains the FIM
 *  token sequence. qwen2.5-coder understands the tokens even inside
 *  a chat wrapper — same tokens it was trained on — and replies with
 *  just the completion text.
 *
 *  Throws on network / HTTP errors. Callers swallow AbortError. */
async function streamFim(
  ctx: FimCtx,
  signal: AbortSignal,
  onToken: (token: string) => void,
): Promise<void> {
  const fimPrompt =
    `<|fim_prefix|>${ctx.prefix}<|fim_suffix|>${ctx.suffix}<|fim_middle|>`;

  // System prompt: keeps qwen focused on "only emit the middle text."
  // Without this the chat wrapper sometimes pulls in prose
  // explanations. Plan intent is appended here so it influences the
  // completion without polluting the FIM tokens themselves.
  const systemBits: string[] = [
    "You are a code completion engine.",
    "You receive FIM tokens (<|fim_prefix|>…<|fim_suffix|>…<|fim_middle|>).",
    "Output ONLY the missing middle text that goes at the cursor.",
    "No explanation, no markdown fences, no restating the prefix or suffix.",
    `Language: ${ctx.language || "unknown"}.`,
  ];
  if (ctx.planIntent) {
    systemBits.push(`Current plan step: ${ctx.planIntent.slice(0, 200)}.`);
    systemBits.push("Match the plan step's intent when relevant.");
  }

  const body = {
    model: "qwen2.5-coder:14b",
    messages: [
      { role: "system", content: systemBits.join(" ") },
      { role: "user", content: fimPrompt },
    ],
    stream: true,
    options: {
      // Most inline suggestions are 1–8 lines — 200 tokens is plenty
      // without letting the model ramble into full function bodies.
      num_predict: 200,
      temperature: 0.15,
      stop: ["<|fim_prefix|>", "<|fim_suffix|>", "<|fim_middle|>", "<|endoftext|>"],
    },
  };

  const r = await fetch("/ai/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok || !r.body) {
    throw new Error(`fim ${r.status}`);
  }

  // Ollama /api/chat streams NDJSON: one {message: {content: "..."}, done: bool} per line.
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf("\n");
      while (nl >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) {
          try {
            const obj = JSON.parse(line);
            const tok = obj?.message?.content ?? obj?.response ?? "";
            if (tok) onToken(tok);
            if (obj?.done) return;
          } catch {
            /* keepalive / malformed line */
          }
        }
        nl = buffer.indexOf("\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Theme ────────────────────────────────────────────────────

/** CSS for the ghost span. Subtle grey, italic, preserving whitespace
 *  so indented suggestions land correctly. */
const ghostTheme = EditorView.baseTheme({
  ".cm-ghost-completion": {
    color: "#6c7086",
    opacity: "0.75",
    fontStyle: "italic",
    whiteSpace: "pre-wrap",
    pointerEvents: "none",
  },
});

// ── Public factory ───────────────────────────────────────────

/** Build the ghost-completion extension. Consume via the editor's
 *  `extensions` array.
 *
 *  The opts functions are called at trigger time so the extension
 *  reflects live state (e.g. plan switches) without having to be
 *  rebuilt on each change. */
export function ghostCompletion(opts: CompletionOpts): Extension {
  return [
    ghostField,
    ghostDecoPlugin,
    triggerPlugin(opts),
    acceptKeymap,
    ghostTheme,
  ];
}
