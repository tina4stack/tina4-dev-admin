# Design: dev-admin AI assistant (project-aware Tina4 coding copilot)

The dev-admin AI is not a generic chat box — it is a Tina4-native copilot that runs on
the LOCAL model through the rust client gateway (:11435). The small model
(Qwen3.8-2B-Distill) is already fine-tuned for Tina4 PLAN → SCAFFOLD → FILL, so the
design leans on that rather than fighting it.

## Requirements (from the maintainer)
1. Streaming answers.
2. Thinking on/off toggle (Qwen3 `think`).
3. **Comprehensive project understanding** — it knows the codebase being worked on.
4. **Scaffolding** — it generates Tina4 models/routes/pages per convention.
5. **Fills the AI-tag slots** — the `// SLOT … // TODO … // END SLOT` blocks a scaffold emits.
6. **Vision → UI** — paste/upload a screenshot of a screen → it builds the HTML/Twig page.

## Four pillars

### A. Project comprehension (grounding, not context-stuffing)
A 2B model can't hold a whole project, so we RETRIEVE, not stuff. **Two LOCAL corpora,
searched per turn, results merged (D2):**

1. **Tina4 documentation — downloaded locally.** A one-time local pull of the docs/book
   (no network / no mcp.tina4.com dependency at query time), indexed for retrieval. Answers
   "how do I do X in Tina4" from the real docs, offline. (Complements the live API index —
   `api_search`/`api_class`/`api_method` — for exact current signatures.)
2. **The project `src/`.** The existing `project_index` (`.tina4/project_index.json`:
   `overview()`, `search(query, limit)`, `file_entry(path)`, `refresh()` — per-language
   symbol/route/import/docstring extraction) over the user's own code. Answers "where is my
   User model / what routes exist / what's in this service".

Per turn the assistant pulls top-k from BOTH, plus the active editor file/selection and DB
schema, into a compact grounding block it prepends. `refresh()` on file-save keeps the
project side current; the docs index is refreshed by an explicit re-pull.

Open: how the docs are pulled locally (a `tina4` docs-pull step, or index a local
`tina4-documentation` checkout if present) and where the local docs index lives
(`.tina4/docs_index.json` alongside the project index).

### B. Scaffolding (reuse the pipeline that exists)
The editor already has a Scaffold bar (`/__dev/api/scaffold` kinds + `/scaffold/run`) and a
split-preview. Chat intent → **PLAN** (the model's planner role → a plan/<task>.md) →
**SCAFFOLD** (model's scaffolder role → files with `// SLOT`/`// TODO`/`// END SLOT`) shown in
the split-preview before anything is written.

### C. Fill the AI-tag slots
Each `// SLOT <name> … // TODO … // END SLOT` is a focused fill — exactly the FIM-shaped task
the model is best at. Fill one slot at a time, grounded in the plan + project, streamed into
the editor, user accepts per slot (or "fill all"). This is the "fill in the AI tags" ask.

### D. Vision → UI (screenshot to Twig/HTML)
Composer accepts paste/drag/upload of an image → base64 `images[]` on the turn. The vision
model reads the screen and emits a Tina4 page: a Twig template extending `base.twig`, using
tina4-css classes (no inline styles, no hardcoded hex — per the dev conventions), with form
inputs carrying placeholders. Rendered in the eye-preview; slots then filled for behaviour.

### E. Micro-adjustments to front-end screens (iterate, don't regenerate)
Point at a live screen and nudge it: "make the heading bigger", "two-column cards",
"move Save to the right", "more padding here". The assistant makes a SMALL, targeted diff
to the Twig/SCSS (never a rewrite), honouring the conventions (tina4-css classes, CSS vars,
no inline styles / no hardcoded hex), re-renders the eye-preview instantly, and the user
keeps or reverts each nudge. Grounded in the file being edited + the project's SCSS tokens so
adjustments match the design system. Pairs with the live preview + per-change Apply/Revert —
it is pillar D's inverse: D makes a screen, E refines one that exists.

### F. The model sees its own preview (closed loop) + inline comments
Generation is not fire-and-forget — the assistant can SEE the rendered result and act on it:
- **Preview-see:** the eye-preview is captured (screenshot of the rendered page) and fed back
  to the (vision) model as an `images[]` turn. So vision→HTML and micro-adjust become a loop:
  generate → render → screenshot → model inspects → refine. This is what makes screen-building
  and nudges converge instead of guessing blind.
- **Inline comment tool:** the user pins a comment onto a specific element in the preview
  ("make this bigger", "wrong colour") — an anchored instruction (element selector + rect +
  the note). The assistant gets the note WITH its exact target, so the edit lands on the right
  element rather than a best-guess. Anchors ride alongside the preview screenshot, so the model
  sees both the pixels and the pinned intent. This is the precision mechanism for pillar E.

## UX surface
**The side panel toggles between Folder nav ⇄ Chat.** The editor's left panel is normally the
file tree; a toggle flips it to the Assistant. In chat mode you are talking to the
**currently open file** — that file IS the context (its content + path + language auto-
grounded, on top of the two-corpus RAG) — and edits stream into the editor while the
**preview window** updates live beside it. Switch the open file → the chat's context follows.

Composer: text + image chips (paste/drag/upload) + a thinking toggle. Turns stream; a dim
collapsible "Thinking…" block renders `message.thinking` above each answer. All edits land in
the editor + split-preview with **Apply/Revert per file / per slot / per nudge** — nothing
writes to disk without an explicit apply. The preview carries the inline-comment pins (F) and
is captured back to the model for the see-your-own-work loop.

## Decisions to lock (maintainer)
- **D1 — model strategy. RESOLVED:** ONE model. The Qwen3.8-2B-Distill is multimodal
  (vision) AND tested for coding, served by mlx-vlm on the ai-server (:11437). So a single
  backend handles chat, scaffold, slot-fill, thinking AND vision — no role-routing, no
  separate vision model. The gateway stays a dumb verbatim forwarder. (A bigger backend
  remains optional later for heavy comprehension, but is not required for any pillar.)
- **D2 — grounding. RESOLVED:** RAG over TWO LOCAL corpora, merged per turn —
  (1) Tina4 documentation downloaded locally (offline, no mcp.tina4.com), and (2) the
  project `src/` via `project_index`. Plus the open file + DB schema + live API signatures.
  Agentic tool-calling is a later option, not now.
- **D3 — write safety.** Assistant NEVER writes to disk silently — always preview +
  explicit Apply (per file / per slot). Agreed default.
- **D4 — phasing.** (1) chat + streaming + thinking + grounding → (2) scaffold + slot-fill
  → (3) vision→UI. Each is shippable.

## Open backend work (one item — the model already does vision + coding)
- Confirm/wire the ai-server's `/api/chat` (mlx-vlm serving the distill) to be Ollama-shaped:
  honor `think` → `enable_thinking` and stream `message.thinking` separately, and accept
  `images[]` on user turns. The model supports all of this; this is the server mapping only.

## Build log (Python-first; parity batched afterward — maintainer directive)
- Tool-calling mechanism: PORT the tina4-harness agent recipe (fenced `{"tool","args"}` +
  tolerant brace-scan parser + agent loop + steering + think-modes), NOT the chat-template
  XML path. Measured: XML/schema = 0/8; harness recipe + 2-step loop = 6/8. The distill does
  NOT tool-call via the template, but DOES via the harness recipe.
- `scaffold` MCP tool (wraps the in-process GENERATORS, never shells):
  - [x] Python — `tina4_python/mcp/tools.py`; tests green (conformance sweep creates a real
        route + file-created + unknown-kind/bad-name guards). 9 passed.
  - [x] Ruby — already added in-process via `CLI.new.send(handler)` (bonus; 4 specs green).
  - [ ] PHP / Node — PARKED. PHP has no clean in-process hook (procedural CLI, shells out);
        needs a main-guard + extracted `tina4GenerateInProcess()` (decision A) when parity runs.
- Tools come from the framework MCP (`register_dev_tools`): file_patch/file_list (edit/find),
  log_tail/error_log (logs), index_search/project_overview + docs_search + api_search
  (grounding), database_*, route_*, migration_*, plan_* — plus the new `scaffold`.

## Status: DESIGN locked (D1–D3); Python-first BUILD in progress. Next: port the harness
## agent loop into dev-admin wired to the Python MCP tools, measure accuracy, then parity.
