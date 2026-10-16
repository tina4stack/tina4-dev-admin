import {editMarkerGuidance} from './edit-markers';
import {checkProposedSource} from './code-security';
import {fillRange} from './ai-fill-contract';
import {groundCompletionImages} from "./ai-image-placeholders";
import {loadTina4Css,tina4CssGuidance} from "./ai-tina4-css";
/**
 * In-editor AI completion — ghost text as you type.
 *
 * What the user sees: after a short idle, a greyed-out suggestion
 * extending from the cursor. Tab accepts the whole thing, Esc (or
 * any typing) dismisses.
 *
 * The local chat model receives the full file before and after the cursor.
 * Nearby comments and docstrings describe the insertion's contract. A complete
 * response is validated before ghost text becomes available for Tab acceptance.
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
import { streamChat } from "./ai-gateway";
import { selectionMessages, selectionProblem } from "./ai-selection";
import { trimSuffixOverlap, completionCode, repeatsExistingCode, selectionCompletion, templateCompletionProblem } from "./ai-completion-output";

// ── Ghost state (what the user currently sees) ─────────────────

/**
 * The in-flight or currently-displayed ghost text. `from` is the
 * cursor position at the time the suggestion was requested — if the
 * user moves elsewhere before it arrives, we drop the suggestion.
 */
interface GhostState {
  from: number;
  to: number;
  /** Accumulated completion tokens. Streaming appends to this. */
  text: string;
  /** The request id this ghost was issued from. Lets late responses
   *  abort themselves if a newer trigger has fired. */
  requestId: number;
}

export const requestCompletion = StateEffect.define<void>();

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
  constructor(readonly text: string, readonly replacement = false) { super(); }
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-ghost-completion";
    // Preserve leading whitespace so indented suggestions render
    // correctly. The CSS sets white-space: pre-wrap.
    span.textContent = this.replacement ? `\nReplace selection · Tab to apply · Esc to dismiss\n${this.text}` : this.text;
    return span;
  }
  eq(other: GhostWidget): boolean { return other.text === this.text && other.replacement === this.replacement; }
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
  const { from, to } = state.selection.main;
  if (from !== ghost.from || to !== ghost.to) return Decoration.none;
  const deco = Decoration.widget({
    widget: new GhostWidget(ghost.text, ghost.to > ghost.from),
    side: 1, // widget sits AFTER the cursor, not before
  });
  return Decoration.set([deco.range(ghost.to)]);
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
  const selection = view.state.selection.main;
  if (selection.from !== ghost.from || selection.to !== ghost.to) return false;
  // Recheck at insertion time too: display filtering alone must not be the
  // only boundary between a model response and source code.
  if (completionCode(ghost.text) !== ghost.text.replace(/\s+$/g, "") || repeatsExistingCode(
    ghost.text, view.state.doc.sliceString(0, ghost.from), view.state.doc.sliceString(ghost.to),
  )) {
    view.dispatch({ effects: setGhost.of(null) });
    return true;
  }
  // Insert the ghost text at its anchor and clear the ghost. One
  // transaction so undo rolls it back in one step. Cursor lands at
  // the end of the inserted text — the natural "now keep typing"
  // position.
  const to = ghost.from + ghost.text.length;
  view.dispatch({
    changes: { from: ghost.from, to: ghost.to, insert: ghost.text },
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
  onStatus?: (message: string) => void;
}

/** Debounce window between the last keystroke and firing a FIM
 *  request. 250ms: long enough that a run of typing doesn't fire
 *  seven requests, short enough that stopping to think surfaces a
 *  suggestion quickly. */
const DEBOUNCE_MS = 250;

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
        if (u.transactions.some(tr => tr.effects.some(effect => effect.is(requestCompletion)))) {
          this.cancel();
          this.state.timer = window.setTimeout(() => this.fire(true), 0);
          return;
        }
        if (!opts.enabled()) return;

        // Any doc change or selection change resets the timer. If a
        // request is in flight, abort it — stale completions arriving
        // after the user has kept typing are noise.
        if (u.docChanged || u.selectionSet) {
          this.cancel();
          // Applying a completion is not a request for another completion.
          if (u.transactions.some(tr => tr.isUserEvent("input.complete"))) {
            opts.onStatus?.("Completion applied");
            return;
          }
          this.schedule();
        }
      }

      schedule() {
        if (this.state.timer != null) window.clearTimeout(this.state.timer);
        this.state.timer = window.setTimeout(() => this.fire(), DEBOUNCE_MS);
      }

      cancel() {
        this.state.nextRequestId++;
        if (this.state.timer != null) {
          window.clearTimeout(this.state.timer);
          this.state.timer = null;
        }
        if (this.state.abort) {
          this.state.abort.abort();
          this.state.abort = null;
        }
      }

      async fire(manual = false):Promise<void> {
        if(/^\s*>>>/.test(this.view.state.doc.lineAt(this.view.state.selection.main.head).text))return;
        this.state.timer = null;
        if (!manual && !opts.enabled()) return;

        const view = this.view;
        if(manual && view.state.selection.main.empty){
          const range=fillRange(view.state.doc.toString(),view.state.selection.main.head);
          if(range){view.dispatch({selection:{anchor:range.from,head:range.to}});return this.fire(true);}
        }
        const state = view.state;
        const sel = state.selection.main;
        // One selection is a replacement target; multiple cursors are ambiguous.
        if (state.selection.ranges.length !== 1) return;

        // Skip mid-word: if the character to the left is a word
        // character, the user is in the middle of typing an identifier
        // and we'd just spam completions per keystroke. The existing
        // autocomplete popup handles that case.
        const pos = sel.from;
        if (!manual && sel.empty && pos > 0) {
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

        // Include the entire file on both sides of the insertion point.
        // A narrow window hides imports and declarations elsewhere in the file.
        const doc = state.doc;
        const prefix = doc.sliceString(0, pos);
        const suffix = doc.sliceString(sel.to);
        const selected = doc.sliceString(sel.from, sel.to);

        // Nothing to complete if both sides are empty. Guards against
        // completing on a blank buffer where FIM drifts into lore.
        if (!prefix.trim() && !suffix.trim() && !selected.trim()) return;

        const requestId = ++this.state.nextRequestId;
        this.state.abort = new AbortController();

        // Clear any stale ghost while we wait — looks flakier than
        // keeping the old one, but keeping the old one is also wrong
        // (it refers to a position that no longer exists).
        view.dispatch({ effects: setGhost.of(null) });

        let accumulated = "";
        const abort = this.state.abort;
        try {
          let feedback = "";
          for (let attempt=0; attempt<3; attempt++) {
          accumulated = "";
          opts.onStatus?.(attempt ? "Autocomplete: retrying invalid response…" : selected ? "Autocomplete: thinking about selected section…" : "Autocomplete: thinking…");
          await streamFim(
            {
              prefix,
              suffix,
              selected,
              language: opts.language(),
              path: opts.path(),
              planIntent: opts.planIntent(),
              feedback,
              manual,
            },
            abort.signal,
            (token) => {
              // If a newer request has started, drop late tokens on
              // the floor. The request was aborted but fetch may
              // already have buffered some data.
              if (requestId !== this.state.nextRequestId) return;
              accumulated += token;

            },
          );
          // Validate the complete envelope before showing an insertable hint.
          // Streaming fragments can be partial fences or explanations.
          if (requestId !== this.state.nextRequestId || (!manual && !opts.enabled())) return;
          let code = completionCode(accumulated);
          if(/html|twig/i.test(opts.language()))code=await groundCompletionImages(code,async src=>{
            // Check same-origin assets only; do not fetch invented external URLs.
            try {const url=new URL(src,location.href);if(url.origin!==location.origin)return false;
              const response=await fetch(url.href,{method:'HEAD',signal:abort.signal});return response.ok && (response.headers.get('content-type')||'').startsWith('image/');
            }catch(error){if(abort.signal.aborted)throw error;return false;}
          });
          if(requestId!==this.state.nextRequestId)return;
          let bounded = selected ? selectionCompletion(code, prefix, selected, opts.language()) : trimSuffixOverlap(manual && /html|twig/i.test(opts.language()) ? code.trimEnd() : boundCompletion(code), suffix);
          feedback = selected ? selectionProblem(bounded, {prefix, suffix, selected, language: opts.language(), path: opts.path()}) : "";
          feedback ||= templateCompletionProblem(bounded,prefix,selected,suffix,opts.language());
          if (!feedback && bounded.length >= MIN_SHOW_CHARS && bounded.trim() !== selected.trim() && !repeatsExistingCode(bounded, prefix, suffix)) {
            opts.onStatus?.("Autocomplete: checking proposed source…");
            const security=await checkProposedSource(opts.path() || 'source.txt',prefix+bounded+suffix);
            if(requestId!==this.state.nextRequestId || abort.signal.aborted)return;
            if(security.status==='error')throw new Error(security.reason);
            if(security.status==='blocked') {feedback='Fix these security findings in the proposed completion, without changing unrelated code: '+JSON.stringify(security.findings);continue;}
            if(typeof security.content==='string') {
              if(!security.content.startsWith(prefix) || !security.content.endsWith(suffix)) {
                feedback='Lint autofix would change code outside the selected completion. Resolve lint issues within the selection only.';continue;
              }
              bounded=security.content.slice(prefix.length,security.content.length-suffix.length);
            }
            view.dispatch({ effects: setGhost.of({ from: pos, to: sel.to, text: bounded, requestId }) });
            opts.onStatus?.((selected ? "Replacement ready · Tab to apply · Esc to dismiss" : "Completion ready · Tab to accept") + (security.status === "passed" ? " · Security check passed" : ` · ${security.reason}`));
            return;
          }
          feedback ||= "Output duplicated existing code or did not change the selection";
          console.warn("[completion rejected]",feedback,accumulated);
          }
          opts.onStatus?.("Completion could not satisfy the block: "+feedback);
        } catch (e: any) {
          if (e?.name === "AbortError") return;
          // Network / server errors are common when the LLM host is
          // down; silent-fail is the right UX. Toasting a red chip
          // every time would train users to disable completion.
          opts.onStatus?.("Autocomplete failed · check the local model");
          console.warn("[completion]", e);
        } finally {
          if (this.state.abort === abort) this.state.abort = null;
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
  selected: string;
  language: string;
  path: string | null;
  planIntent: string | null;
  feedback?: string;
  manual?: boolean;
}

/** Request a cursor insertion through the local Tina4 chat gateway.
 * Throws on network / HTTP errors. Callers swallow AbortError. */
async function streamFim(
  ctx: FimCtx,
  signal: AbortSignal,
  onToken: (token: string) => void,
): Promise<void> {
  const fimPrompt = ctx.selected ?
    `Implement the selected ${ctx.language} code section using its comments. Replace only the selected section. Return actual source code, never a description or placeholder. Preserve indentation.
File before selection:
${ctx.prefix}
Selected code to implement:
${ctx.selected}
File after selection:
${ctx.suffix}
Return only raw replacement source code, without Markdown fences.` :
    `Complete the missing code at the cursor in ${ctx.path || "this file"} (${ctx.language}).
Read the nearby comments and docstrings, including AI-FILL, Intent, Use and Return. Implement that contract. Existing imports and definitions are already present. Return ONLY the code to insert, not the whole file. Do not repeat the prefix or suffix. No explanations.
BEFORE CURSOR:
${ctx.prefix}
${ctx.selected ? `SELECTED SECTION TO REPLACE:\n${ctx.selected}\nReplace this entire selected section with its implementation. Use the selected comments as requirements. Remove placeholder raises/pass statements in the replacement. Preserve indentation. Code before and after the selection must remain unchanged.` : "CURSOR"}
AFTER CURSOR:
${ctx.suffix}
${ctx.feedback ? `Previous response rejected: ${ctx.feedback}. Correct this.\n` : ""}
Return just the raw missing insertion, without Markdown fences.`;

  const framework = /html|twig/i.test(ctx.language) ? await loadTina4Css() : null;
  const markerGuidance=editMarkerGuidance({[ctx.path || "current file"]:ctx.prefix+ctx.selected+ctx.suffix});
  const markupGuidance = /html|twig/i.test(ctx.language) ? "For an explicit HTML suggestion, complete the intended semantic section with useful context-aware copy and a cohesive layout using existing classes. Include accessible image placeholders when appropriate: use an existing local asset if available, otherwise an inline SVG placeholder with an accessible label, never an invented URL. Read the full document for context, but produce only the missing or selected fragment. Inside an established document or Twig block, never add a document shell: no doctype, html, head, body, extends, block or endblock wrappers. Preserve all surrounding source. A semantic header or footer within page content is allowed when requested. Produce balanced markup and respect existing surrounding tags. Do not expand a small inline edit into a whole page. Output raw code only, no fences or commentary. Do not repeat the selected instruction comment. For SVG use xmlns=\"http://www.w3.org/2000/svg\", role=\"img\" and an accessible title. Use simple rect placeholders rather than complex invented paths. Never use Tailwind classes unless the supplied installed catalog includes them. " + (framework ? tina4CssGuidance(framework) : "Reuse classes already present in the document.") : "";
  // System prompt: keeps qwen focused on "only emit the middle text."
  // Without this the chat wrapper sometimes pulls in prose
  // explanations. Plan intent is appended here so it influences the
  // completion without polluting the FIM tokens themselves.
  const systemBits: string[] = [
    "You are a code completion engine.",
    ...(ctx.manual || ctx.selected ? [markupGuidance] : []),
    "You receive the complete file split into BEFORE CURSOR and AFTER CURSOR.",
    "Output ONLY the missing middle text that goes at the cursor.",
    markerGuidance,
    "Read nearby comments and docstrings on both sides of the cursor, especially AI-FILL, Intent, Given, Use, Return and Ground annotations. They describe the implementation contract. Use the named framework APIs and return shape; do not repeat comments or imports. Do not invent imports or model definitions that are absent from the file. Only propose code that fits at this cursor without leaving conflicting placeholder statements.",
    "No explanation, no markdown fences, no restating the prefix or suffix.",
    "The prefix and suffix together contain the ENTIRE current file. Insert only missing code at their boundary; do not restart the file or repeat existing imports, declarations or markup. If nothing is missing, return an empty response.",
    `File: ${ctx.path || "untitled"}.`,
    `Language: ${ctx.language || "unknown"}.`,
  ];
  if (ctx.planIntent) {
    systemBits.push(`Current plan step: ${ctx.planIntent.slice(0, 200)}.`);
    systemBits.push("Match the plan step's intent when relevant.");
  }

  // Stream through the single gateway client — the model never gets a path
  // straight to it. FIM wants the raw middle text, so thinking is off.
  await streamChat(
    {
      model: "mlx-community/gemma-4-e4b-it-4bit",
      think: false,
      messages: ctx.selected ? selectionMessages(ctx, ctx.feedback + (markupGuidance ? `\n${markupGuidance}` : "")) : [
        { role: "system", content: systemBits.join(" ") },
        { role: "user", content: fimPrompt },
      ],
      options: {
        // Most inline suggestions are 1–8 lines — 200 tokens is plenty
        // without letting the model ramble into full function bodies.
        num_predict: /html|twig/i.test(ctx.language) && (ctx.manual || ctx.selected) ? 1800 : ctx.selected ? 1200 : 200,
        temperature: 0.15,
        stop: ["<|fim_prefix|>", "<|fim_suffix|>", "<|fim_middle|>", "<|endoftext|>"],
      },
    },
    { onContent: onToken, signal },
  );
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
