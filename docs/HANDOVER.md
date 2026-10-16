# Dev Admin handover — current checkpoint, 16 October 2026

This checkpoint supersedes the historical notes below. User stopped implementation/testing, then requested this documentation update. **Do not resume the tests or Codex work without a new request.** Subsequent user request: commit/push the Dev Admin checkpoint and stop all local testing services. Model, gateway and playground LaunchAgents were unloaded; the adapter, scratch playground and remaining benchmark servers were sent shutdown signals.

## Working tree and scope

- Dev Admin: `/Users/mac/projects/tina4/tina4-dev-admin`, branch **main**, substantial modified and untracked source/test/bundle files. Work is being saved as the 16 October checkpoint commit. Preserve unresolved work; this is not a release or a claim that all scenarios pass.
- Python-first integration; do not assume PHP/Ruby/Node parity or current bundle deployment.
- Shared model implementation: `/Users/mac/projects/tina4-harness/src/harness/`.
- Main playground: `/Users/mac/projects/tina4/dev-admin-playground`, split at **http://127.0.0.1:7150/__dev/split**.
- Disposable evaluation project: `/tmp/tina4-home-eval-20261015`, split on **7151**. Keep generated evaluation files out of the main playground.
- Detailed scenario evidence: `tina4-dev-admin/plan/scenario-validation.md`.
- Repeatable demo and acceptance prompts: `tina4-dev-admin/docs/DEMO-CHEAT-SHEET.md`.

## Status and evidence

| Area | Current status |
|---|---|
| Mechanism | Model-driven routing, scaffolding then content, bounded edits, installed Tina4CSS guidance, apply with Undo, preview capture/review and interaction checks are implemented but not uniformly reliable. |
| Context/editor | PDF text and extracted-image context, project uploads, image insertion/hover preview, inline commands, AI-FILL handling, notebook and voice UI exist in the working tree. These are not all newly verified at this checkpoint. |
| Validation | HTML/Twig structure, real asset/local-link checks, content preservation, lint/security feedback and bounded review/JSON recovery have accumulated fixes. Passing validators does not establish visual or functional quality. |
| Recorded regression tests | Prior session reported 193 tests passing with TypeScript/build passing; scenario log's last written count is 191. No fresh suite run for this handover; reconcile against current HEAD before claiming green. |
| Live successes | Bakery home with correct supplied hours and unrelated PDF excluded; button insertion plus contrast repair; isolated About link navigation; real image publication/rendering; scaffold Undo in one live case. See scenario log for limits. |
| Live failures | Combined About creation + home link still fails; PDF company build/image completeness and visual quality remain inconsistent; calculator eight-case repair has no established pass. |
| Follow-up classifier | Latest `/tmp/tina4-followup-contentcheck.log`: **20/22**, not a full pass. “Fix the unreadable button text. Keep the content and images.” and “Keep the wording and fix the overlap.” incorrectly routed to content instead of appearance. |
| Voice | Browser speech service reported unavailable. Silence timing alone does not fix that backend failure. |

Recent source work includes responsive utilities inside media queries in the class catalog and rejection of custom declarations that retain conflicting installed utilities. The independent-boolean follow-up classifier experiment regressed routing; current source reverted to the four-way classifier with a second content-change check for appearance. Latest source, built dist, main 7150 and scratch 7151 may differ: **rebuild and deliberately deploy before a new live test**. Do not report a source fix as deployed merely because the source exists.

## Start the local model and Dev Admin

Current model is **Gemma E2B, 4-bit, MLX/Metal**, not Qwen or E4B. Verify `/info`; UI labels can be stale.

The persistent LaunchAgents are under `/Users/mac/Library/LaunchAgents/` and use KeepAlive. This starts them if unloaded, or starts an already-loaded stopped job:

```sh
for service in com.tina4.devadmin-model com.tina4.devadmin-gateway com.tina4.devadmin-playground; do
  if ! launchctl print "gui/$(id -u)/$service" >/dev/null 2>&1; then
    launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/$service.plist"
  fi
  launchctl kickstart "gui/$(id -u)/$service"
done
```

After loading weights, check:

```sh
curl -fsS http://127.0.0.1:11439/info
curl -fsS http://127.0.0.1:7150/__dev/split > /dev/null
```

Expected model identity: `mlx-community__gemma-4-e2b-it-4bit`, backend `mlx`, device `metal-gpu`.

| Service | Configuration / executable | Port |
|---|---|---|
| Model | `com.tina4.devadmin-model.plist`; `/Users/mac/projects/tina4/tina4-documentation/examples/ai-server/.venv/bin/python -m harness.server`; cwd `/Users/mac/projects/tina4-harness`; PYTHONPATH points to its `src` | 11439 |
| Gateway | `com.tina4.devadmin-gateway.plist`; `/Users/mac/projects/tina4/tina4/target/debug/tina4 ai serve --backend http://127.0.0.1:11439` | 11435 |
| Playground | `com.tina4.devadmin-playground.plist`; `/usr/local/bin/tina4 serve --port 7150 --host 127.0.0.1 --no-browser --no-kill`; cwd main playground | 7150 |

Model settings are `HARNESS_MLX_LOCAL_DIR=mlx-community__gemma-4-e2b-it-4bit` and `HARNESS_MLX_REPO=mlx-community/gemma-4-e2b-it-4bit` in the model plist. Cached weights live in `/Users/mac/projects/tina4-harness/models/`:

- `mlx-community__gemma-4-e2b-it-4bit` — current.
- `mlx-community__gemma-4-e4b-it-4bit` — cached alternative.
- `qwen38-2b-distill-4bit` — cached Qwen alternative.
- `mlx-community__DeepSeek-R1-Distill-Qwen-1.5B-4bit` — also present.

To switch weights, deliberately update the model plist's matching repo/local-directory settings, unload and bootstrap that job, then verify `/info`. Do not run a duplicate server on 11439. Repetition penalty was restored to the normal backend default 1.18; experimental 1.0 was removed after worse routing results.

Logs: `/Users/mac/Library/Logs/Tina4/`, including `com.tina4.devadmin-model[-error].log`, `com.tina4.devadmin-gateway[-error].log`, and `devadmin-playground[-error].log`.

For a deliberate restart of a loaded job use `launchctl kickstart -k gui/$(id -u)/SERVICE`. To stop it persistently use `launchctl bootout gui/$(id -u)/SERVICE`; killing a KeepAlive process alone restarts it. Never kill all Python processes.

Listener snapshot during handover: **7150, 7151, 11435, 11439 and experimental 11455 were listening**. This is a point-in-time observation, not an ongoing health guarantee.

## Important testing constraints / next work when authorized

1. Keep the mechanism website- and model-agnostic. No calculator, bakery, company-name or exact-prompt special cases. Let the harness create/repair test pages; do not manually repair them and count a pass.
2. Classify the current request before preview/context routing. Read-only questions must not write. Carry agreed requirements forward without old failed operations or unrelated PDF text replacing the active brief.
3. Use installed Tina4CSS components/utilities and actual supplied public image URLs. Only reusable image assets belong in `src/public/images`; document text/metadata stay in `.tina4/context`.
4. Small edits must preserve content. Apply automatically with Undo; preview review must stay within the requested scope. Inspect actual clicks/results/errors before reporting a functional pass.
5. First resume task: settle mixed content/presentation routing and the two 22-case sweep failures, then rebuild/deploy and repeat the live follow-up. Combined create-page + existing-link remains an explicit failing scenario.
6. Pin disposable projects to the editable local Python framework with `uv add --editable /Users/mac/projects/tina4/tina4-python`. A pip-only editable install was previously replaced by `uv sync` during `tina4 serve`.

## Separate ground-wire / editor integration experiment — STOPPED, not ready

- Continue installed in Cursor; local configuration `/Users/mac/.continue/config.yaml` points to E2B's Ollama-shaped `/api/chat` on 11439, roles chat/edit/apply. End-to-end Continue UI/offline editing remains unverified. Native Cursor's custom model menu is not this integration.
- Codex experiment files: `/Users/mac/.local/share/ground-wire/adapter.py`, `offline.sb`, `cli.sb`; launcher `/Users/mac/.local/bin/ground-wire`; profile `/Users/mac/.codex/ground-wire.config.toml`; catalog `/Users/mac/.codex/ground-wire.models.json`. Original profile/catalog backed up with `.before-e2b` suffix.
- Adapter exposes `/v1/responses` at **127.0.0.1:11455**, translating text/tool envelopes to local E2B on 11439. It does not execute tools itself; Codex executes commands. Text/code only; image inputs rejected. Not a complete Responses implementation.
- Real Codex-to-E2B tool calls reached command execution. **File-edit test failed**: E2B supplied raw Python-like text to zsh, got a parse error and stopped. No successful greeting.py creation/assertion established. Do not describe the setup as working.
- Initial CLI override placement incorrectly selected the default provider; stopped and corrected explicit argument placement. Initial network policy was too permissive; corrected policy blocked a direct external curl. Nested macOS sandboxes failed, so launcher now uses an outer workspace/network Seatbelt policy and disables Codex's inner sandbox. This is experimental and needs review before reuse.
- Analytics attempts were blocked; full offline editing/command workflow has NOT passed. Model backend itself was not separately network-isolated in this test. Adapter usage currently reports zero tokens, so accounting/compaction is not reliable.
- Adapter was still listening at the initial handover, then was stopped under the subsequent shutdown request. No LaunchAgent was installed for it.
- Evidence: `/Users/mac/.local/share/ground-wire/test.jsonl`, `test.stderr`, `adapter.log`; scratch `/tmp/ground-wire-codex-test`. Logs may contain model-generated code. Keep them local.

---

# Historical checkpoints (superseded where inconsistent)

## Latest checkpoint — 2026-10-14

User requested all Tina4 test services stopped and current work committed/pushed.
- Dev Admin main: f774ab2 (assistant, editor, preview interactions and reusable skill). 115 tests / 24 files and TypeScript pass.
- tina4-harness main: f811c30 (Gemma model template and Ollama-compatible streaming). Two channel tests pass.
- Shared UI bundles saved on devadmin/harness-checkpoint-20261014 in Python/PHP/Ruby/Node repositories; these are checkpoint branches, not release merges.
- Calculator end-to-end repair remains failing. Do not claim eight cases pass. Latest failure: addition initially raised digitStr ReferenceError; a subsequent generic edit broke event-handler scope and output stayed zero. Preserve bounded function replacement through retries and test actual browser output next. No calculator-specific harness code or manual calculator repair.
- Services stopped: playground LaunchAgent unloaded, Tina4 serve processes, AI gateway and Gemma terminated. To restart deliberately, bootstrap ~/Library/LaunchAgents/com.tina4.devadmin-playground.plist and start the model/gateway separately.
- Detailed work log: tina4-dev-admin/plan/editor-testing-ux.md. Playground remains disposable, unversioned test data. Unrelated work in framework branches and personal harness notebooks was not included.

# HANDOVER — dev-admin AI copilot (port the tina4-harness mechanism)

> Historical handoff from 2026-10-12. Preserve for provenance; the current checkpoint above supersedes it.
> Always invoke the `tina4-maintainer` + `andres-writing-voice` skills first.

## Mission
Build a **project-aware Tina4 AI copilot inside dev-admin**, running on the LOCAL model via
the Rust gateway. Do it by **porting the proven `tina4-harness` agent mechanism** into
dev-admin. **Python-first; batch parity to PHP/Ruby/Node afterward** (maintainer directive).

Full design (7 pillars, decisions, build log): **`tina4-dev-admin/plan/ai-assistant-ux-design.md`**.
These plan docs are UNTRACKED (not committed).

## The model (measured facts — do NOT relearn)
- Model: `empero-ai/Qwen3.8-2B-Distill`, 4-bit MLX, served by **mlx-vlm** on the **ai-server :11437**
  (`app.py --managed`, cwd `tina4-documentation/examples/ai-server`). Multimodal (vision) + coding.
- `/api/chat` is **Ollama-shaped**: `{message:{content, thinking}, done, done_reason}`.
- **Thinking on/off WORKS** out of the box: `think:true` fills `message.thinking` (streamed before
  the answer); `think:false` suppresses it and still answers.
- **Vision WORKS**: `images:[<base64>]` on a user turn. The model reads a screen back accurately
  (verified: it read "Sign In"/"Log In" off a generated mockup) and does screenshot→Twig.
- **Tool-calling:** the chat-template XML path FAILS (0/8) — the fine-tune dropped it. The
  **harness recipe WORKS (6/8 with a 2-step loop)**: terse system + ONE worked example +
  name:docstring catalogue + fenced ```json {"tool","args"}``` + tolerant brace-scan parser +
  agent loop with steering. USE THE HARNESS RECIPE, not `tools=`/JSON-schema.
- **Grounding is non-negotiable:** unprompted, the model writes Flask/Django/SQLAlchemy, not
  Tina4. It must be fed Tina4 docs + project `src/` context (RAG) to stay Tina4-native.
- Probing tip: the ai-server venv was cleaned — hit `http://127.0.0.1:11437/api/chat` with stdlib
  `urllib` (no `requests`). The gateway :11435 is NOT running (needs `tina4 login` creds to start).

## The mechanism to port — tina4-harness
`/Users/mac/projects/tina4-harness/src/harness/`:
- `agent.py` — `@tool` registry, `build_system()`/`tools_prompt()`, `parse_action()` (brace scanner
  `_iter_json` + `split_thinking`), `run_agent()` loop (generate→parse→run tool→feed result→steer
  to `final_answer`, retries on no-action). THIS is the core to port.
- `chatprompts.py` — think-modes (`full/brief/off` = enable_thinking + max_tokens), render sentinels
  (`@@HARNESS_WROTE@@`→refresh preview, `@@HARNESS_APP@@`→open preview, `@@HARNESS_FIX@@`→apply to
  cell, `@@HARNESS_CHOICES@@`→pills), kernel-side intent routing (ASK vs CODE), and blunt model
  rules (no markdown headings/tables/ASCII — "render as garbage"; keep it SHORT; straight-to-code).
- `model.py` (backend select: mlx / torch / RemoteModel), `tina4.py` (tina4 toolbelt), `vision.py`.

## Tools = the framework MCP (`register_dev_tools`)
dev-admin's agent catalogue should BE the MCP tools, run through one loop. Python: `tina4_python/mcp/tools.py`.
- edit/find: `file_patch`, `file_write`, `file_read`, `file_list`
- logs: `log_tail`, `error_log`
- grounding: `index_search`, `index_overview`, `project_overview`, `code_search`, `docs_search`,
  `api_search`/`api_class`/`api_method`
- db/routes/migrations/plan/ops: `database_*`, `route_*`, `migration_*`, `plan_*`, `git_status`, etc.
- **`scaffold(kind, name)`** — NEW, added this session (see below).

## Done this session
1. **`scaffold` MCP tool (in-process via `GENERATORS`, never shells):**
   - Python — `tina4_python/mcp/tools.py` (added near "Register all tools"); tests in
     `tests/test_mcp_dev_tools_conformance.py` (args row + `test_scaffold_creates_a_real_route_file`
     + `test_scaffold_guards_unknown_kind_and_bad_name`). **9 passed.** UNCOMMITTED.
   - Ruby — `lib/tina4/mcp.rb` (`CLI.new.send(GENERATORS[kind][:handler], name, {})`);
     `spec/mcp_dev_tools_conformance_spec.rb` (added to FIXED_TOOLS + args + assertion). 4 specs green. UNCOMMITTED.
   - PHP/Node PARKED. PHP has NO clean in-process hook (procedural CLI, no main-guard, shells out) —
     needs a main-guard + extracted `tina4GenerateInProcess()` (decision "A") during parity.
2. **Model-path tests:** `tina4-documentation/examples/ai-server/tests/test_model_paths.py` — vision,
   preview-see, thinking on/off, slot-fill PASS. The scaffold tests there use the OLD `tools=` XML
   path (now known-wrong) — SUPERSEDE them with the harness recipe. (Needs pytest+requests+PIL; the
   ai-server venv was cleaned, so re-provision or use urllib.) Run accuracy standalone: `/tmp/accuracy_retest.py`.

## Big uncommitted foundation (steps 1–4 of the gateway cleanup — ALL UNCOMMITTED)
Tested locally, needs CLI 3.8.99 (gateway CORS) released to run end-to-end:
- `tina4/src/ai_gateway.rs` — gateway CORS middleware + test (316 rust unit tests green).
  Build: `export PATH="/Users/mac/.rustup/toolchains/stable-aarch64-apple-darwin/bin:$PATH"; cargo test --bin tina4`.
- `tina4-dev-admin/src/ai-gateway.ts` (new central client: streaming + `think` + `images`) +
  `src/ai-completion.ts` (FIM repointed) + rebuilt `dist/` + deployed bundle into all 4 frameworks
  + `public/bundled-component-provenance.json` sha updated (sha256 a4d03715…). 0 `/ai/api/chat` left.
- Framework AI-proxy REMOVAL (SPA → gateway direct): removed `/ai/api/chat` + `/ai /vision /embed
  /image /rag` from py/php dev_admin (+ php image-gen), parity 404 guards added in all 4 (py 94 /
  php 90+24+1 / ruby 6 / node 15 green). Ruby/Node source was already clean.

## Already shipped (LIVE, committed) — the earlier `tina4 login` thread
- aatos profile-portal: login query-read fix + GitHub-callback fix + branded pages + **Tina4 mascot**
  → LIVE on profile.tina4.com (commits 337ac8b, 0b58fd8, b7494b0 on `CodeInfinity-Pty-Ltd/aatos` main).
- docs PR tina4stack/tina4-documentation#126 MERGED (136 `request.params`→`request.query` fixes).
- tina4stack/tina4-python#213 (CLAUDE.md `request.params` note) — open, was finishing CI; merge when green.

## Next step (Python-first)
Port the harness agent loop (fenced-JSON + tolerant parser + steering + think-modes) into the
dev-admin assistant, wire the catalogue to the **Python** MCP tools, run end-to-end vs the live
stack, measure accuracy. Then UX (folder-nav⇄chat toggle; open file = context; preview-see loop +
inline-comment anchor; vision→Twig; micro-adjust). THEN batch parity to PHP/Ruby/Node.

## Locked decisions
D1 one multimodal distill (no role-routing). D2 grounding = RAG over TWO LOCAL corpora (downloaded
Tina4 docs + project `src/`) merged per turn. D3 never silent — preview + Apply per file/slot/nudge.
Scaffolding IS a tool, wrapping in-process generators (never shell).
