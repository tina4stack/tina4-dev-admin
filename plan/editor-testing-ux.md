# Editor testing UX

## Scope
- [x] Right-click completion/suggestion through the existing harness.
- [x] GET route previews in the existing split preview; route parameters requested.
- [x] Markdown opens as a full-width WYSIWYG document with a <> source switch and save.
- [x] Execution ledgers live under logs/plan, with legacy file migration.
- [x] Playground reset to native Tina4 starter without a cleanup backup.

## Tests
- [x] 46 frontend tests; TypeScript check; production build.
- [x] Real split editor: code menu, GET preview action, visual Markdown edit, save and source switch.
- [x] Car native scaffold, migration and 5 tests; live HTTP collection round trip. Removed during requested reset.
- [x] Python and Node ledger migration with real temporary files; PHP/Ruby syntax checks.

## Bugs
- No full PHP/Ruby behavioral suites were run for the log relocation.

## Commits
- Uncommitted workspace changes.

## Status: Ready for user testing

## Harness and Suggest Code validation — 2026-10-12

- Scaffold planning now supplies live registry descriptions, distinguishing browser pages from scheduled services. Landing/home pages default to index at /.
- Follow-ups resolve conversation references and select existing files before proposing edits. Single and batch envelopes normalize into validated patches; line ranges are available on retry. Unknown files, overlapping/out-of-bounds ranges, formatting wrappers and large destructive shrinkage are rejected before approval. Existing-file concurrency checks remain.
- Proposed edits receive a model review against the resolved instruction and resulting source. This is supplementary: model review is fallible and is not proof of semantic correctness.
- Real gateway/backend runs: both Make/Build landing-page variants completed native page builds. Landing/home naming and scheduled service planning passed separate real-model checks.
- Light-pink background and dark-navy text follow-ups passed, with Twig unchanged, unrelated CSS declarations preserved, compiled CSS checked and zero scaffold calls. Several intermediate variants failed; no claim of universal model reliability.
- Suggest Code: right click uses clicked caret for empty selections; manual requests bypass typing-only mid-word suppression; retries receive rejection feedback. Exact trailing suffix overlap is removed before showing insertable code.
- Actual split editor on isolated port 7150: comment-driven heading/link suggestion accepted with Tab and saved; one section closing tag and one Twig endblock, no Markdown fences. User project files on 7146 unchanged.
- 52 frontend tests passed, no skips; TypeScript passed. Normalization, range and suffix-overlap guards were mutation checked. Production bundle deployed to shared framework assets and active playground.
- Live evaluators: scripts/evaluate-agent.mjs, scripts/evaluate-followup.mjs, scripts/evaluate-planning.mjs. The follow-up evaluator now checks requested color and preservation of unrelated declarations, beyond successful HTTP responses.

### Reset regression
- Removed unfinished scaffold files now invalidate persisted conversation, brief, approval and scaffold state, alongside the existing completed-page reset check.
- New chat clears sessionStorage and in-memory assistant state; disabled while a request is running.
- scripts/evaluate-reset.mjs reproduces the stale unfinished build against the real backend/model: fresh clarification, zero write/scaffold calls, old conversation removed.

## 2026-10-12 — Preview navigation, capture and Undo

- Split preview is captured locally at its device viewport; the image and DOM text measurements are sent to the local model. Captures are visible in chat. Post-write checks capture again; bounded visual repairs remain fallible (live model attempted an invalid follow-up repair during testing).
- Existing-page questions have a read-only inspection path. Navigation now resolves against actual GET routes before capture; no editing/scaffolding for a show/open request. Live local-model cases: open journal → preview, change journal heading → continue to edit, missing contact → clarification.
- File edits apply after plan approval and offer Undo. Split UI confirmed heading updated, two captures produced, and Undo restored the original heading. Dirty/newer file content prevents restoration. Undo currently belongs to the live chat UI and is not restored after reload.
- A user repair removed a SCSS selector and left an unmatched brace; compilation retained old CSS, causing verification to fail. Undid that repair through the UI. Follow-up edits now reuse the existing stylesheet balance guard before writing. This is structural validation, not a full Sass compiler.
- Inline style introduction in Twig is rejected. Exact/ranged patches retain snapshot validation; malformed edits never become a successful no-op.
- New parser/SCSS guard tests mutation checked. Actual 7146 navigation confirmed /blog capture instead of starter /.
- Follow-up self-check correction: once any file/scaffold write occurs, capture runs even if core verification returns an error or throws. Each applied repair is recaptured; proposals that write nothing stop with the last findings. Passing screenshot inspection cannot override a failed source/HTTP check. At most two repair passes. 58 tests passed, TypeScript and bundle build passed after this change.

### Local model comparison — 2026-10-12

Compared actual loaded MLX/Metal weights sequentially: `empero-ai/Qwen3.8-2B-Distill` (:11437) and `mlx-community/gemma-4-e4b-it-4bit` (:11438, temporary isolated server). Existing live gateway was not switched. Working branch: `main`; no release/commit.

- Same production prompts and test inputs; 12 stage scenarios. Automated scores: Qwen 8/12, Gemma 10/12. These are not full task-success scores: Qwen's description also hallucinated inline CSS, despite passing the limited automated description assertion.
- Both passed navigation cases and accepted the clean screenshot. Both failed to identify the overlapping blog headings. Visual verification remains unreliable.
- Real writes separately tested on the existing throwaway project, starting each case from identical source (white body background). Qwen: 0/3; Gemma: 2/3.
- Gemma changed only the requested heading (9.535s), and only body background-color to #f3efff (23.649s including stylesheet verification). Confirmed saved source, rendered HTTP HTML, compiled CSS, and preservation of unrelated source/declarations. No scaffold calls.
- Both failed the contextual "A light shade, please." case. Gemma resolved pink correctly but exhausted the 600-token classification budget before completing JSON. Qwen treated it as inspection.
- No new eval pages were created. Test source restored and newly created plans removed after completion. Existing test fixtures retained.
- Compatibility caveat: the historical AI server routes every token into thinking until Qwen's `</think>` appears. Gemma uses `<channel|>`, so its first run was invalid. Temporary comparison server buffered responses and split the model's actual delimiter before rerunning. This adapter fix has NOT been deployed to the user's gateway; token-stream responsiveness is not compared. Wall times are task latency, single runs, not a statistical benchmark.
- Unit tests: 58 passed; TypeScript noEmit passed. Prompt experiments remain undeployed pending further validation.
- Reports: `/tmp/tina4-small-comparison.json`, `/tmp/tina4-gemma-comparison-fixed.json`, `/tmp/tina4-model-writes.json`. Reproduction scripts: `scripts/evaluate-prompts.mjs`, `scripts/evaluate-model-writes.mjs`.

### Gemma rollout and real preview tests — 2026-10-12

- Active gateway now forwards to shared harness Gemma E4B server on11438. Qwen backend stopped. Both text and vision use model-bundled templates; the wire adapter separates Qwen/Gemma channels even across token boundaries and reports generation errors/length limits.
- Shared frontend generation reserves 2048 tokens for reasoning in addition to each stage's answer budget. A length termination retries once with a bounded larger budget (max16384); incomplete output is never forwarded to edit parsers. Live forced-exhaustion test passed without leaking partial content. Missing completion/error stream frames are explicit failures.
- Vision verdict retains the actual screenshot. Rendered text line-box intersections supplement image observations and cannot be overridden by an optimistic model verdict. This is generic geometry, not prompt/page matching.
- Split testing found a reload/canvas race (detached document). Capture now retries against the current iframe document and rejects stale snapshots.
- Real write suite: 3/3 passed (heading9.431s, lavender24.307s, contextual light-pink follow-up34.837s). Saved source, rendered HTML, compiled CSS, and unrelated declarations checked. No scaffolds.
- Actual split UI: heading edit, subsequent mint SCSS edit, and deliberately injected overlap repair all applied successfully and captured/reviewed a fresh post-write preview. Final repair restored24px spacing; heading text and mint body colour remained unchanged. Earlier detected capture race was fixed and retested.
- Evidence: `/tmp/tina4-gemma-followup-preview.png`, `/tmp/tina4-gemma-overlap-repaired.png`, `/tmp/tina4-gemma-writes-final.json`.
- Validation:58 Dev Admin unit tests, TypeScript noEmit, Vite production build,2 channel-parser tests pass. All4 framework bundles updated, plus live7146/7150 Python installations. No commits/releases.
- Disposable source edits and plans cleaned up; no new app fixture files. Original user blog has not been manually changed by these tests.
- Limits: viewport-specific checks; text-box intersections are an additional signal, not complete visual/browser-behaviour coverage. This proves the tested edits and defects, not universal model reliability.

### Report findings and resolve short repair requests

A live user "fix it" exposed missing context in the follow-up classification prompt: preview findings were available to the edit stage but not to intent resolution. Added current visual evidence to intent resolution, with general reference resolution from page/conversation/evidence. Navigation now reports defects as visible chat bullets and stores that answer in conversation. No prompt-specific routing branches. Verified the original blog reports overlapping CodingNotes text near(32,34); user is exercising the subsequent repair in the live split.

### Same-harness smaller-model rerun — 2026-10-12

- Qwen 2B loaded from `qwen38-2b-distill-4bit` on11439 through the same maintained adapter and its own bundled template. Isolated signed-in gateway11436; main Gemma gateway11435 unchanged.
- Parameterized existing real-write/preference scripts for model selection; prompts and assertions unchanged.
- [x] Real writes: Qwen0/3; misplaced heading accepted, malformed lavender/pink edits rejected. Sources restored.
- [x] Better-colors request: clarification, no mutation.
- [x] Stage suite:6/12 automated; heading proposal is a false positive (wrong template block), so only5/12 substantively pass. Screenshot overlap missed.
- [x] Split UI attempted navigation, heading, lavender, mint follow-up and overlap repair: all failed before a valid write. Correct-route capture worked when manually selected; geometry detected overlap, but no post-write check could be reached. Screenshot: `/tmp/tina4-qwen-split-result.png`.
- [x] Gemma current-harness rerun:3/3 real writes (22.547s heading,21.033s lavender,28.761s contextual light pink #FFE5E5). Unrelated source/declarations preserved; rendered HTML and compiled CSS checked.
- [x] Restored isolated source and bundle override; closed temporary split tab; stopped Qwen11439 and its gateway11436. Main Gemma service untouched.

- Tightened the stage heading assertion to require the exact h1 replacement, not just text presence. Reran both: Qwen5/12, Gemma11/12. Both missed screenshot-only overlap; geometric evidence remains necessary but is not sufficient for successful repairs.
- Better-colors clarification passed for both. Qwen token-limit rejection passed without partial content. Frontend59/59 unit tests, backend2/2 channel tests, TypeScript check passed.
- Single-run task latency, not a statistical speed benchmark: Qwen6.880/8.994/8.709s, all failed; Gemma22.547/21.033/28.761s, all passed.
- Reports: `/tmp/tina4-qwen-prompts-strict.json`, `/tmp/tina4-gemma-prompts-strict.json`, `/tmp/tina4-qwen-writes-final.json`, `/tmp/tina4-gemma-writes-comparison.json`, `/tmp/tina4-qwen-preference.json`, `/tmp/tina4-qwen-split-results.json`. Source hashes: `/tmp/tina4-model-comparison-source-hashes.json`.
- Remaining correctness issues are confirmed, not resolved by this comparison: small-model edit validation accepted misplaced template content; navigation can misclassify edits; screenshot-only review misses obvious overlap. Separately, main Gemma blog repair removed its heading and left a stray `>` while reporting a visual pass. Do not claim visual repair is reliable or that the main blog is fixed.
- No production prompt changes, new eval pages, commits or releases during this comparison. Only test model parameterization and the stricter heading test assertion changed.

### Preserve content through preview repairs — 2026-10-12

- [x] Supply element identities and computed ancestor layout alongside overlap geometry to the model's edit stage.
- [x] Classify presentation versus explicit content changes; automatic repairs always preserve content.
- [x] Reject presentation edits that delete/change text, template expressions, semantic headings/controls or destinations before writing.
- [x] Compare rendered content inventories after presentation writes; duplicate labels are counted separately.
- [x] Original blog: Gemma changed only hero margin from -3rem to0; logo/heading/body/link content retained; measured24px separation. Fresh preview passed.
- [x] Independent fixture: negative paragraph margin changed from -2rem to0, no text/template changes. Follow-up mint #e6fff2 rendered rgb(230,255,242). Both fresh preview checks passed.
- [x] Latest real writes3/3 (heading24.488s,lavender23.501s,contextual pink32.662s). Source/HTML/compiled CSS and preservation checked; disposable source restored and test plans removed.
- Initial checks:61 frontend tests and TypeScript/build pass. Source-preservation tests cover heading deletion, retagging, dropped dynamic content, changed destinations, stray text and duplicate rendered labels.
- Added live Markdown formatting using the existing sanitized Toast UI viewer, reused and throttled to100ms rather than recreated per token. Verified actual split DOM contains lists, paragraphs and fenced code blocks; screenshot `/tmp/tina4-formatted-thoughts.png`. A happy-dom viewer test was unsuitable (its rendered fragment omitted the first heading); browser verification used instead, no mocked renderer.
- Added fresh runtime clock to every model request, including image requests and retries. Contains local date/time, timezone, UTC instant and current year, with guidance to preserve historical/unrelated existing dates. Year-boundary test passes.
- Added visible element colours/layout evidence, semantic-review grounding to reject unused selectors, and unchanged-viewport detection after presentation edits.

- Final unit checks63/63, TypeScript and production build pass; all four shared bundles and local Python installs updated. No commits/releases.
- Actual clock request returned2026. Formatting verified in real browser, with one reused viewer and four visible code blocks in the sampled stream.
- Evidence: `/tmp/tina4-blog-preserved-repair.png`, `/tmp/tina4-gemma-preserved-fixture-repair.png`, `/tmp/tina4-preserved-followup-final.png`, `/tmp/tina4-formatted-thoughts.png`; write report `/tmp/tina4-gemma-writes-preserved-final.json`.
- Edits now accept unambiguous old_string/new_string/replacement aliases; conflicting aliases rejected. Errors identify unknown paths and missing field names. This fixes protocol variability generally; no prompt names, routes or colour values are recognized in production code.
- Source/preview target is reconciled after split reloads/manual navigation so edits are grounded in the correct rendered page.
- Remaining caveat: screenshot-only Gemma judgments are not reliable alone; actual-preview checks combine pixels, DOM geometry, visible styles and content inventories. These tests prove the exercised defects, not arbitrary visual correctness. Complex repair latency can exceed two minutes.

### Optional image generation discussion (not implemented)

SSD-1B would be an optional, lazily loaded Diffusers worker exposed through an image_generate tool. Save generated assets into the project, show progress/cancel, retain prompt/seed metadata, place assets through existing edits and verify the rendered result. Queue generation to avoid GPU contention with Gemma. First step is a local Apple Silicon memory/latency benchmark; no weights downloaded or service installed in this task.
Sources: https://huggingface.co/segmind/SSD-1B and https://huggingface.co/docs/diffusers/main/optimization/mps .

Final main-blog Reggae palette retry: failed before writing after 101s. Semantic review rejected the proposal because it changed only the body background rather than applying the requested palette more broadly. Existing files unchanged; palette workflow remains unresolved.

### Shared follow-up brief and targeted retries

- [x] Freeze the resolved instruction and preservation contract for editor and reviewer; prevent review scope expansion.
- [x] Distinguish source errors from semantic review failures; carry rejected proposal and actionable feedback into retries.
- [x] Run unit/build checks and the actual Reggae colour request in split view, comparing template content and rendered result.


Shared-brief implementation details and evidence (2026-10-12):
- One immutable brief includes the original request, resolved scope, chosen visible selector/property/value changes and preservation contract. Both editor and reviewer consume it; the plan displays the choices.
- Source and acceptance-review retries include the specific failure and previous unapplied proposal. Review cannot add new design requirements.
- Added PostCSS/SCSS syntax editing for explicit declaration choices, grouped selectors and unambiguous scoped tag selectors. Complex/ambiguous edits retain validated exact-source fallback. The model supplies values; no named-style/prompt branches or palette constants exist in production.
- Batch-level file paths normalize without overriding individual paths. Regression coverage added.
- Before-edit preview prompts now explicitly describe the baseline rather than claiming requested changes are completed.
- Final primary real split run applied dark green background, gold heading and pale text in existing blog.scss. Template byte-for-byte unchanged. No scaffold. About 50s to plan, 62s through write and preview (approval included).
- Initial experiments were not accepted as successes: unused-class edits were undone; invalid brief/overlapping edits failed before writes. Diagnostics exposed grouped selector and response envelope mismatches.
- Remaining limitation: the image reviewer incorrectly passed the dark logo on dark background. A focused follow-up test was required; do not claim autonomous visual accessibility checking is solved.
- Tina4CSS investigation: base.twig already includes /css/tina4.min.css, but generated blog.scss hardcodes its own colours. Framework theme variables are SCSS compile-time values; utilities are precompiled. No migration to Tina4CSS utilities was performed during this repair.
- 70 frontend tests pass with NODE_OPTIONS=--no-experimental-webstorage (host Node webstorage conflicts with happy-dom otherwise); TypeScript/build pass. Shared bundles deployed to all four repositories and the running playground package. Shared brief/retry tests were mutation checked.

Focused follow-up completed in the real split: logo colour became white, rest of template remained byte-for-byte unchanged, no scaffold. Fresh preview completed (60s including approval). Screenshot: /tmp/tina4-reggae-shared-brief-result.png. Image-review wording still contains an inaccurate explanation of the background despite a visibly correct logo; visual-review reliability is a remaining limitation.

### Tina4CSS default — user handoff

- Added catalog from the project’s served Tina4CSS; semantic roles and supported utilities ground scaffold and edit prompts. No named-style palette mapping.
- Class edits patch original source tags, preserving Twig, content, destinations and semantic/component classes. Unknown utilities, missing targets and dynamic class attributes are rejected.
- New page generation uses Tina4CSS by default; custom SCSS is requested only for scoped gaps and can be omitted. Ensures framework stylesheet is linked when the base does not include it.
- Existing styling changes first select utilities for present template elements. Prior exact-source review and preservation checks remain.
- 74 frontend tests, TypeScript and production build passed. Shared framework bundles and running playground package deployed.
- User requested session reset and to test personally before another real Reggae run; no new palette prompt submitted by agent. Reset chat only, retained page/project files. This revision has unit/build validation, not a claimed new end-to-end model pass.

## 2026-10-12 utility-edit validation and playground reset

- Normalized harmless metadata and no-op records in model utility proposals; removal-only operations remain explicit.
- Utility retries retain selector/class operations instead of escalating to full template rewrites. Unsupported utility requirements may use scoped SCSS.
- Added installed-colour compatible-pair guidance and source utility contrast validation; rendered capture measures opaque solid-background text contrast independently of model vision.
- 79 tests passed; TypeScript and production build passed.
- Real split run applied Reggae utility changes automatically with content/links/structure unchanged. Visual review falsely passed white text on yellow; measured checking now detects and blocks it.
- Subsequent model run still repeated low-contrast choices despite feedback and was blocked without writing. General palette reliability is not solved.
- User requested another exercise in a clean environment. Recreated dev-admin-playground using tina4 init python; removed old test data/plans/history and disposable evaluation project. Framework/harness development work is retained.
- Explain-code chat currently includes the active file but does not include highlighted selection; page-follow-up mode can favour preview context. This remains a separate gap.

## 2026-10-12 SCSS fallback, transport recovery, immediate edits

- One presentation-operation schema now supports installed utility class changes and concrete SCSS declarations, including retries without source rewrites.
- New SCSS rules are limited to page selectors or body in an existing page stylesheet. Browser CSS.supports rejects invalid descriptive values before writing.
- Interrupted generation streams retry boundedly and discard partial answers; final frames without newline work. Real HTTP socket test confirms recovery; authentication errors do not retry.
- 83 tests, TypeScript and production build passed.
- Live split: light-pink request chose #FFD1DC, changed only index.scss, preserved templates/routes/content, preview verified.
- Existing-page edits no longer create approval plans; Undo remains. Pale-blue follow-up applied without approval or new plans, content/red button preserved, rendered rgb(173,216,230). Undo restored exact files in earlier trial.
- Framework bundle was externally replaced by older build during reload. Current build is pinned under playground src/public/js/tina4-dev-admin.min.js; UX source remains tina4-dev-admin. No manual page edits.

## 2026-10-12 linked-page live exercise

- Through split assistant only: scaffolded About page, then corrected its content/return link with a focused follow-up. Initial combined create-and-link task omitted the landing-page href edit and created an incorrect About self-link.
- About preview repair loop expanded scope and became slow; stopped it by reloading after the requested content/return link had been applied.
- Selected index context and requested only href change. Model changed exactly href="#about" to href="/about" in index.twig in 35 seconds, no approval plan, Undo available. Landing styles/base unchanged.
- Clicked Read more in actual preview: /about loaded. Clicked Back to home: / loaded. No manual page edits. Combined multi-page task handling and preview repair scope remain gaps.

## Combined create and edit operations (2026-10-12)
- [x] Keep separate model-resolved new-page and existing-page obligations; execute the existing-page edit after native scaffolding in the same request.
- [x] Generate new content from its scoped brief, not the historical conversation; retain existing-page changes in the reviewable plan.
- [x] Capture every affected page with its own acceptance brief. Bound preview repair to one presentation-only edit per page; bypass intent reclassification and preserve current content/links.
- [x] Keep contradictory visual verdict defects and retry malformed verdicts once.
- [x] TypeScript, build and 85 tests across 18 files passed.
- [x] Live split combined create-and-link test, preserving existing content and styles.
- [ ] Next requested exercise: calculator through the split assistant.

### Findings from actual split reruns
- Combined operation extraction now has its own stage; overloading intent classification let Gemma put both operations in the new-page brief and leave the existing operation empty.
- An initial combined run changed the existing template by exactly `href="/about"` → `href="/about-details"`; all other pre-existing source and SCSS matched the before snapshot.
- Fixed a real capture race: file-write/route-test UI handlers navigated the iframe independently of capture. Removed those competing navigations, retry the requested route, and reject captures of another route.
- Scoped presentation-preservation checks per route: a repair of a new page must not make an unchanged navigation-only source-page screenshot fail.
- Stylesheet generation now returns `{css:null}` or `{css:"..."}`. It no longer consumes another page’s preview as its design reference.
- Presentation operations normalize selector arrays into individually validated declarations; no template rewriting added.
- Native Python page generator sanitizes Python function identifiers while retaining requested URL/template paths. Targeted AST regression test passes. Full Python pytest collection blocked by missing installed `openapi_spec_validator` (nine optional skips also reported); not a full-suite pass.
- 86 DevAdmin tests pass, TypeScript and build pass. Mutation checks caught dropped existing-page obligations and ignored visual defects.

### Final acceptance result
- One split request created `/about-details`, updated the landing page Read more href, detected low link contrast, repaired it through model-selected SCSS, recaptured About, then captured the landing page. Done in 100 seconds including approval waiting time.
- Clicked Read more → About; clicked Back to Home → `/`. Link computed color is rgb(33,37,41), replacing the failed rgb(74,144,217).
- Compared every pre-existing template, stylesheet and route against the before snapshot: identical except the requested index href change. Generated Python route parses successfully. No page implementation was manually edited.
- Added measured contrast target grounding: parent-only foreground edits cannot pretend to change a child's own foreground. Positive/negative regression test and mutation check pass.
- Final DevAdmin suite: 88 tests, 18 files; TypeScript and build passed. Shared bundle deployed to all four framework asset directories; the playground uses the identical build.
- Evidence: `/tmp/tina4-combined-about-pass.png`.
- Interaction limitation explained: the harness can navigate/capture/review, but does not yet click buttons or fill inputs. Calculator remains the next requested exercise; no calculator has been created in this run.

## Interactive page acceptance (2026-10-13)
- [x] Preserve generated page JavaScript in a local asset; validate syntax instead of silently dropping behaviour.
- [x] Expose bounded preview inspect/click/fill/assert actions using observed element references, with stale/hidden/disabled target checks.
- [ ] Have the model derive expected results and independent scenarios from the agreed brief and actual controls; show measured results, repair failures within scope, retest unchanged assertions.
- [ ] Test a calculator built entirely through the split assistant with Tina4CSS. No manually authored calculator implementation or prompt-specific harness paths.

### Interactive runner findings

- Generated page scripts were previously discarded. They now become a syntax-checked local asset referenced from the native page scaffold.
- Interaction checks operate observed DOM controls with click/fill and explicit text or numeric output assertions. IDs are accepted only when uniquely present in the observed snapshot.
- Expectations are frozen before execution and rebound to the same controls after reload. Functional repairs use runtime assertions; the visual reviewer remains responsible for presentation.
- Failed reset actions can contaminate later scenarios. Repair prompts now trace event wiring and state transitions before proposing exact patches, and reject comment-only JavaScript changes.
- The first calculator runs exposed real clear/decimal defects and invalid model patches. No calculator implementation was manually written. Runtime acceptance remains in progress.
- Model-generated tests also need validation: initial runs guessed wrong expected arithmetic and attempted a read-only fill. The runner now exposes control capabilities, isolates cases by reloading, resolves only observed targets, independently derives numeric formulas, checks them against the proposed expectation, and freezes assertions before execution.
- A blanket model approval gate produced both false approvals and false rejections. It was removed; structural/action validation and independently calculated numeric expectations gate execution. Behaviour repair success is decided by rerunning the same real actions.
- Per-case planning avoids copying large repeated JSON envelopes. Prompt schemas describe fields without ambiguous literal placeholder enums. Known equivalent target envelopes are normalized without allowing invented elements or arbitrary JavaScript.

### Calculator live outcome (2026-10-13)

- Calculator was scaffolded and implemented only by Gemma through the split assistant. No calculator source was manually written.
- The harness now executes real observed buttons, reloads between cases, freezes expectations, reports measured results, and rejects syntax-invalid repairs. Numeric formulas are parsed without JavaScript execution, including Unicode operators and trailing equals notation.
- Focused Clear case initially failed (expected 0, observed 9); Gemma corrected its event condition and the exact rerun passed.
- Final eight-case split run: addition, subtraction, multiplication, division, decimals and division-by-zero failed. Clear and recovery-to-7 passed. Outputs were 23, 94, 67, 82, 1.5225, 0, 10, 7 respectively. The event dispatcher omitted its operator branch. Gemma misdiagnosed this and proposed a syntax-invalid edit; validation prevented the write. This is NOT a successful calculator acceptance run. Recovery only asserts the final output, so it does not independently prove the intermediate Error state.
- The preview reviewer approved a poor one-column keypad; visual acceptance remains a limitation. No claim of uniform calculator design.
- All pre-existing project routes/templates/SCSS remain byte-identical to the before snapshot.
- DevAdmin TypeScript/build passed; 103 unit tests across 21 files passed. Real model planning and repair remain unreliable despite deterministic checks.
- Evidence: /tmp/tina4-calculator-final-results.json and /tmp/tina4-calculator-final-split.png.

## Source-grounded functional repair follow-up

- [x] Replace speculative long diagnosis with control → registered listener → actual dispatch branch → reachable state transition tracing, using exact current source quotes.
- [x] Plan layout and installed Tina4CSS component grouping before page generation wires functionality. Generic page prompt, no application-specific build path.
- [x] Capture click-time console errors, uncaught errors and rejected promises; carry bounded step-labelled diagnostics into repair feedback. Restore instrumentation after each case. Fatal browser errors fail the measured case.
- [x] TypeScript/build and 104 DevAdmin tests pass.
- [x] Rerun the eight fixed acceptance cases in split and record autonomous repair outcome.
- Shared DevAdmin source is the parity implementation; no backend-specific interaction logic. No commits or release requested.

### Follow-up acceptance result

- Eight of eight actual split interaction tests passed after two autonomous repair attempts (238 seconds). Results: 5, 5, 42, 4, 3.75, 0, Error, 7. Assertions stayed fixed. The model added the missing event-dispatch branch itself; no calculator implementation was manually changed.
- Preview captured/reviewed after repairs, Undo available. Pre-existing templates/routes match the earlier snapshot. index.scss differs from that snapshot, but its modification time (11:48:53) predates this repair run (12:56–13:00); it was left intact. New layout-first creation prompt is installed but has not yet been exercised on a new page; this run repaired the existing page only.
- 104 tests / 21 files and TypeScript passed after final changes. Mutation disabling fatal-error handling was detected by the new test; source restored and full suite rerun. Same shared bundle deployed to all four frameworks.
- Evidence: /tmp/tina4-calculator-repair-pass.json and /tmp/tina4-calculator-repair-pass.png.

## Creative ownership in content and style

- [x] Follow-up resolver chooses useful copy and coherent accessible styling from existing context instead of demanding user-written paragraphs or design specifications.
- [x] Intake distinguishes creative decisions from genuinely missing essential facts. Do not invent business claims, guarantees, credentials or contacts.
- [x] Shared edit brief carries the same copywriting scope to implementation and review.
- No automated tests requested for this prompt adjustment; live model behaviour is not yet validated.

## Services creative edit and HTML autocomplete tests

- Services test used only “Improve the content and style of this services page.” No clarification question, but the model repeatedly removed a closing Twig block. First write stalled Python rendering; restored the tool-created pre-edit backup and restarted. Added pre-write matching Twig block validation. Retry safely rejected malformed proposals; creative edit acceptance FAILED, not ready.
- Fixed verification requiring a nonexistent page stylesheet even when the template uses only shared styles. Content edits now also receive installed Tina4CSS guidance.
- Explicit HTML autocomplete now has 1800 tokens and keeps complete multi-line sections instead of truncating at first blank line. Automatic typing suggestions stay short. Removed contradictory code-fence instructions.
- Tested selected HTML instruction in an unsaved actual editor buffer: substantial section, two cards and copy, no Markdown fences. Installed CSS guidance improved class choices; generated image paths were still invented. Placeholder quality FAILED. Test buffer discarded; no generated suggestion saved.
- TypeScript/build passed; 105 tests passed before the final prompt-only autocomplete guidance update. Remaining limitations are recorded rather than reported as success.
- Evidence: /tmp/tina4-html-completion-test.png.

## Valid template fragments and grounded images (2026-10-13)

- [x] Template-only content edits expose the existing content slot; inheritance and outer Twig control tags are retained by the harness. Reject changed expressions, incomplete HTML and nested headings. This is a generic template operation, not a services-specific path.
- [x] HTML autocomplete verifies same-origin image assets; unavailable assets become accessible inline SVG placeholders. Existing verified assets remain intact. No external URL probes.
- [x] Live services request “Improve the content and style of this services page.” completed in 96 seconds, no clarification. Valid closing Twig/HTML tags, revised copy and classes, auto-applied with Undo and preview checks. No manual page implementation.
- [x] Actual editor HTML completion produced a 45-line section with two labelled self-contained placeholder elements, no invented image URLs or Markdown fences. Tab applied it into an unsaved buffer; discarded afterward. No index file saved.
- [x] 108 tests / 23 files, TypeScript and build pass. Mutation disabling HTML validation and missing-image handling detected; restored source and reran suite. Shared bundle deployed across four frameworks.
- Evidence: /tmp/tina4-services-valid-pass.png and /tmp/tina4-html-placeholders-pass.png.
- Limit: this validates this live request and placeholder generation, not exhaustive HTML semantics or every possible Twig construct. Complex/nested content blocks retain the guarded exact-edit path.

## Persistent playground service (2026-10-13)

- Playground moved from Codex command lifetime to macOS user LaunchAgent `com.tina4.devadmin-playground` at `~/Library/LaunchAgents/com.tina4.devadmin-playground.plist`.
- Uses `/usr/local/bin/tina4 serve --port 7146 --host 127.0.0.1 --no-browser --no-kill`, with RunAtLoad and KeepAlive. Keeps watcher and SCSS active, binds locally, never takes another process's port.
- Logs: `~/Library/Logs/Tina4/devadmin-playground.log` and `devadmin-playground-error.log`.
- Verified parent is launchd (PID 1), playground returns HTTP 200. Initial old-port release delay caused restart attempts; service recovered automatically.
- For future cleanup: `launchctl bootout gui/501/com.tina4.devadmin-playground` BEFORE stopping/deleting test data; bootstrap the plist afterward. Killing only Python now causes automatic restart.
- User can stop service with that bootout command; remove plist only if disabling future login startup is requested.
- Gemma and gateway left untouched. Other example/prototype servers left untouched.

## Interaction skill and shutdown checkpoint (2026-10-14)

- Added reusable interactive-page skill: layout before behaviour, observed event/state tracing, retained content, Tina4 CSP nonce, real clicks and unchanged assertions. No calculator-specific implementation is embedded in the harness.
- Browser tests now record output before/after each click and return runtime exceptions with the triggering action. Missing capability planning can request a repair. Function repairs can replace a parsed named declaration only. Selection accepts validated JSON objects or arrays.
- Content preservation distinguishes executable scripts from visible content and permits required controls during functional repairs. Added regressions for these boundaries.
- TypeScript, admin build and 115 tests / 24 files pass. This is not an end-to-end success claim.
- LIVE CALCULATOR STILL FAILS: initial addition returned 4 with `digitStr is not defined`. A later model repair made the display remain 0. The generic exact-edit fallback can damage handler scope despite syntactically valid JavaScript. Function generation also returned unchanged functions. Eight-case acceptance suite is NOT passing.
- Next work: keep failed function repairs bounded through retries; reject no-op function output; preserve event registration scope; rerun fixed browser expectations. Do not manually repair the calculator or introduce calculator-specific harness code.
- User requested shutdown, commit and push before this work was complete. Playground LaunchAgent unloaded; Tina4 serve processes, AI gateway and Gemma stopped. The plist remains available for an explicit restart.
