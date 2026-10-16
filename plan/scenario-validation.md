# Harness scenario validation — 15 October 2026

User asked for repeated testing until stopped. Keep generated example code model-owned; fix shared mechanisms, not test-specific prompts.

## Evidence
- Baseline: 135 tests across 30 files passed; TypeScript check passed.
- New invalid-nesting regression passes (nested li and mismatched wrappers rejected).
- New empty-review regression failed before fix: false + blank issues accepted.
- Fixed review parsing to reject empty summaries and strip empty issues, triggering bounded response recovery.
- Live browser voice status reports speech service unavailable. Actual microphone transcription remains blocked by browser speech backend; timing changes cannot repair that.

## Scenario matrix
- [ ] Read-only explanation keeps files unchanged
- [ ] New page scaffold and content
- [ ] New destination from an existing link
- [ ] Short follow-up after clarification
- [ ] Narrow colour edit retains content
- [ ] Section addition retains existing content
- [ ] Image uses real public asset
- [ ] HTML/Twig validity and formatting
- [ ] Python lint repair before apply
- [ ] Functional button assertions and repair
- [ ] Preview reports actual findings or explicit inconclusive result
- [ ] Voice capture, silence boundary, manual cancellation, busy-state handling
- [ ] Full regression suite after fixes

## Status
In progress. No claim of all scenarios passing.

## Round 1 results
- Read-only explanation initially answered about an unrelated uploaded image. Fixed: relevance check now runs before answers; current preview template is supplied as evidence. Live retry correctly described index, no writes.
- Live intent matrix: initially 12/13. Existing-button verification misclassified as source edit. Clarified distinction between browser interaction and source changes; live retry 13/13.
- Workshop page: real scaffold, content and preview succeeded; three earlier templates retained exact hashes. Visual design quality remains partial (excess card nesting).
- Full suite after review regression: 137/137; TypeScript passed.
- Isolated home-page test environment: /tmp/tina4-home-eval-20261015, port 7151, editable Python framework and current dev-admin bundle. Existing user playground stays on 7150.

## Home-page rounds
- Minimal `Build me a home page`: first run invented a /demo link (404). Added generic prewrite local-link validation using actual project routes and anchors; second build passed without invented links.
- Framework scaffold referenced /css/default.css without creating its source. Added default.scss creation only when no existing default SCSS/CSS exists. Native generator regression: 75 tests passed.
- Full admin suite: 139/139 across 31 files; TypeScript passed.
- Light-pink follow-up: content retained, but opaque bg-light section hid the body colour. Initial visual pass was false. Reduced irrelevant design guidance for presentation edits, supplied measured styles, made unknown-class feedback actionable, and ensured follow-up review uses the current request rather than stale page-creation scope.
- Colour retry still fails: model repeats body declarations or invents a class; preview now reports failure. Reasoning enabled for presentation proposals did not resolve it reliably. This is NOT a pass.
- Section addition initially failed: fallback line ranges overwrote closing wrappers/Twig endblock. Kept exact-anchor patches across retries; added parser error locations; removed full-fragment advice conflicting with patch output. Content stage now uses compact page CSS guidance and reasoning. Full suite remains 139/139.
- Combined About + Read more initially routed to a historical colour request. Confirmed in classifier logs. Routing and creation partition now receive the current operation separately; editor receives resolved current scope, page purpose, source and relevant references rather than a backlog of failed operations. Historical retries are deduplicated.
- Clean combined request now plans correct About creation and outbound home-page link. Build running.
- Regression suite after continuity test: 140/140; TypeScript passed.
- About created but pending Home operation misclassified. Pending existing-page stage now executes its confirmed scope rather than rerouting; system output contract is preserved through the callback.
- Follow-up link retry still failed: paragraph in path field and href="#". No invalid patch applied.
- Undo test: generated content reverted, but scaffold-created route/template remained. Undo is incomplete for scaffolds; not counted as a pass.
- Starting fresh image-backed home-page round. Only disposable 7151 generated source/history/plans removed; main 7150 remains untouched.
- Image-backed coding club home: actual uploaded image published to public images and rendered successfully; relevant welcoming/learning copy generated. Not a full pass: preview produced vague findings and missed light text on a translucent card header.
- Added actual solid-background compositing to contrast measurements (e.g. translucent dark overlay over white); targeted regression passes. Requesting harness repair of unreadable text through split.
- Combined inspect+repair routing: initial 14/15 live intent cases; added explicit requested-modification decision before intent. Retry 15/15.
- Readability repair changed heading text-light -> text-dark and retained loaded image. Exact heading text follow-up changed only the requested h1 source text.
- Deeper source inspection found duplicate paragraph/orphan closing tag introduced earlier. Parser exposes MismatchedCloseTag as a recovery node rather than isError. Validator now rejects this too; regression passes. Model-owned cleanup test running. Readability success does not imply source-quality pass.
- PDF round first exposed environment drift: `tina4 serve` ran uv sync and replaced a pip-only editable install with released 3.13.151. Pinned local source using `uv add --editable /Users/mac/projects/tina4/tina4-python` and added Ruff as a dev dependency in the disposable project. Restart verified import path points to local repo; extraction now proceeds.
- Latest full suite: 143/143 across 31 files; TypeScript passed.
- PDF extraction on pinned local framework completed: 21 pages, 28 reusable images, zero extraction/summary warnings. Submitted short request: Build our company home page from the profile. Use its images and Tina4CSS.

- PDF company build: first run rejected invented /services and /contact links. Retry lacked rejected candidate; generation now supplies that candidate and asks to correct all links, using reasoning for retries. Second run saved valid linked-target-free HTML, but omitted requested images and produced vague visual findings. Not a pass.
- Separated agreed request from reference corpus for saved plan and preview scope; repeated concise request and public image catalog next to generation contract to avoid losing requirements in long document context.
- Live default.css now confirmed HTTP 200 after native scaffold on pinned local framework.
- Full admin suite remains 143/143; TypeScript passed.
- PDF retry after candidate-feedback fix still alternated invented links. Navigation validator now reports every broken target together and lists actual routes/anchors. No automatic rewrite of generated HTML.
- Added model-owned prewrite completeness audit against the short explicit request, separate from document facts. Missing requested elements return to generation before applying. Needs live success evidence.
- Visual review now supports inconclusive evidence without speculative repair; added regression. Still observed hallucinated duplicate-copy finding in live round; not resolved.
- Services in-page link clicked successfully. No horizontal overflow at actual preview widths 390, 500 and 532; these are constrained by split pane, not full tablet/desktop validation.
- Undo live test after failed company build: route/template/SCSS generator files removed; only Python bytecode cache remained. Scaffold Undo fix verified for this case.
- Starting independent portfolio scenario (Alex illustrator, intro, three sample project cards, process). Company context remains available but should be excluded as irrelevant.
- Portfolio build produced three project cards, intro and process, but reused unrelated company images. Reference gate now emits request/reference subjects and permits use only for explicit reference requests or matching subject. Live revalidation pending.
- Portfolio button contrast measured 3.34:1; prior model repair altered padding. Added rejection for spacing-only operations when known contrast targets need repair, and removed historical operations from the repair instruction. Direct split repair running.
- Readability routing remains unreliable: repeated exact request classified as changing words, including after reasoning was enabled. A bad attempt renamed the CTA and misspelled button classes. Added generic installed-utility spelling validation; this prevents that class corruption but does not solve intent interpretation. Live bundle and native Gemma template verified. Do not count as fixed.
- Full suite now 147/147. Starting fresh portfolio rerun to test subject-based reference exclusion independently.
- Evidence-bounded reference guard rejected an invented quote from the company PDF during unrelated portfolio planning; Sources panel correctly disappeared. Verified live.
- Clean portfolio still invented /images/project_a.webp, project_b.webp, project_c.webp. Added same-origin image existence/content-type validation before generation writes; unchanged existing images are excluded from unrelated follow-up checks to preserve scope. Model retries must choose real supplied assets or valid inline placeholders. Live rerun in progress.
- Generic generated-button guidance now includes actual installed background colours and computed compatible text utilities. No fixed brand palette or site-specific code added.
- Repeating a test after Undo hit an existing plan-title collision. Cleared disposable plans before retry; normal same-title plan collision remains a known limitation.
- Asset-validation live rerun rejected all three invented project image URLs; subsequent candidate misspelled justify-content-center and was rejected. No invalid template applied.
- Controlled local-model setting experiment: LaunchAgent com.tina4.devadmin-model now explicitly sets HARNESS_REPETITION_PENALTY=1.0 (previously absent, backend default 1.18). Model restarted successfully as Gemma E2B; playground servers remain running. Same portfolio request rerun. This is a sampling experiment, not yet a demonstrated fix.
- Repetition-penalty 1.0 portfolio run still failed, with real nested paragraph/block errors. No conclusion that sampling change fixes generation.
- Improved paragraph nesting diagnostics and aggregate structure/class/navigation/image errors into one repair brief before writing; avoids spending separate retries discovering each defect.
- Starting independent product-home scenario: Daylight task-planning app, purpose, three benefits, short FAQ, Tina4CSS. Same Gemma E2B and disposable split environment.
- Daylight product home built with intro, exactly three benefit entries, FAQ and in-page CTA. Independent DOM confirms all content exists. Original review falsely treated below-fold sections as absent.
- Full rendered text and image loading/geometry evidence now feed visual review. Read-only recheck passed in split without edits. CTA computed colour black on installed blue after harness repair.
- Light-pink follow-up changed SCSS only; template diff empty. Browser shows rgb(255,182,193). Reviewer still falsely flagged that value against “light pink”. Agreed presentation choices now carry into rendered review; repeating after confirmed Undo.
- Located element/observed/expected evidence is now required for automatic visual repairs. Invalid reviews cannot erase deterministic measured defects.
- Light-pink retry passed end to end in 20s after preview contract used concrete accepted operations. Only index.scss changed; template identical to pre-edit baseline. Actual background rgb(255,209,220), matching #FFD1DC. Undo offered.
- Product responsive checks: no horizontal overflow at 390, 820 and 1024 pixels. Three benefit cards stack at 390px. CTA clicked and navigated to the benefits anchor. Screenshot evidence /tmp/tina4-daylight-pink-pass.png.
- Testing small card insertion below FAQ with original content preserved.
- Small card addition failed exact anchors (repeated closing tags). Added general source-offset selector insertion (before/after/prepend/append), preserving the original HTML/Twig byte-for-byte around inserted content; no page-specific insertion logic.
- Live insertion proposal now uses selector operation but chose section.faq where the source has an id. Validator refused it. Retry feedback now includes the actual source id selectors. Same prompt retest running.
- Numbered insertion targets initially exposed stylesheet tags and inline descendants. Restricted targets to the content block and structural containers. Regression coverage includes inherited stylesheet blocks and ambiguous selectors.
- Live card run then preserved original source and placed a new section immediately after FAQ. Preview reviewer invented a border requirement and judged it on the unrelated CTA; not a full pass.
- Added preview focus for new named sections even when the proposal uses exact replacement, and instant scrolling before capture. Full suite 164/164 and TypeScript/build passed. Repeating the unchanged card prompt through split.
- Additional card retries exposed confusion between source line numbers and target catalog numbers. Removed contradictory old-anchor instructions from the insertion contract and explicitly distinguished identifiers from line numbers.
- Inspected actual base64 preview images from the split UI: exact replacement additions without IDs were still captured at the page top. Added generic changed-source-range focus fallback and retained focus through subsequent visual repair. Focused element/descendant layout is now included first in review evidence.
- Automated regressions: 166/166, 34 files. TypeScript and build passed before latest one-line focus-preservation guard; bundle rebuilt successfully. Live repeat in progress. No claim of complete home-page reliability.
- Found a capture/render mismatch: preview DOM scrolled to the added section but the exact image sent to the model still showed the hero. html2canvas clones inherited smooth scrolling; synchronized clone scroll coordinates with instant scrolling in onclone. This is a capture fix rather than a prompt workaround. Live verification pending.
- Clone-scroll fix verified live: the exact model image now shows the new Task Organization card beneath FAQ, matching the preview. Evidence /tmp/tina4-card-scroll-fixed.png. Original source content retained. Reviewer still hallucinated that the visible card was missing and subsequent styling retry failed; card flow remains partial, not passed.
- Company profile retry exposed malformed reference classification (missing `use` boolean) being silently treated as irrelevant. Added bounded schema recovery; invalid classification now stops before writes rather than discarding context. Live subsequent plan correctly named Code Infinity and retained Sources.
- Grounded company candidate used real extracted image URL, but source acceptance reviewer falsely rejected Bootstrap-style utilities as not Tina4CSS and lacked profile facts. Review now receives the same reference evidence and installed-framework facts; no extra stylesheet import is required in a content fragment.
- Excluded framework diagnostic endpoints from offered local navigation destinations after the model used /health for business CTAs.
- Latest suite 168/168 with TypeScript/build passing. Company repeat through split in progress. Internal generation repair prompts now stay in logs rather than the final user-facing failure message.
- Company build falsely reported Done while independent source inspection found no img elements and CTA links only to /. Recorded as failed despite UI success.
- Added a model-resolved asset requirement before HTML generation, with deterministic verification of supplied img URLs in the resulting source. This uses the actual request and catalog, not a site-specific keyword rule. Tests cover missing, wrong, correct and unrequested images.
- Review findings with placeholder element evidence (N/A/unknown) are rejected rather than authorizing repair. Suite now 170/170; TypeScript and build passed.
- Compact reference schema reduced omitted-field failures, but still occasionally quotes the whole request; relevance quality is not fully solved.
- Added operation-first classification from the latest request alone, before business context. Live readability follow-up correctly selected appearance (previously rewrote company copy).
- Company follow-up applied text-dark; actual button foreground rgb(33,37,41) on rgb(74,144,217). Original words/image retained. Reviewer contradicted actual class/colour evidence and expected an unachieved white background; recorded partial, not full pass.
- Company page now uses a real extracted image, loaded with natural dimensions. CTA hrefs still point to /; starting targeted navigation edit test.
- Added live follow-up operation evaluation across 18 short requests (scripts/evaluate-followups.mjs). First round 16/18; effect-first classification improved to 17/18. Readability wording still classified content, so this is not a complete fix.
- Classification can opt out of general project/code-generation guidance through the gateway; implementation stages retain it. Compact reference decision uses this opt-out too.
- Existing-page appearance/content decisions now keep the original request as the instruction instead of allowing a second business-context routing stage to reinterpret it. Creation still uses the separate scaffold flow.
- Latest automated suite 171/171, TypeScript/build passed. Live navigation follow-up in progress.
- Navigation follow-up PASS in split after attribute edits, changed-link validation and visual/behaviour scope separation. Only href / -> #services and id="services" were added. No unrelated source changes. Harness reported visual pass in 17s.
- Independent click verified location hash #services and target top -0.0625px; content and extracted image preserved. Screenshot /tmp/tina4-company-link-pass.png.
- Attribute operations preserve original source outside the selected opening tag, including Twig expressions. Latest suite 173/173, TypeScript/build passed.
- Exact heading test initially falsely passed by adding a non-rendering text="..." attribute. Independent source diff caught it; Undo restored baseline.
- Unsupported HTML attribute edits now reject visible-text pseudo-attributes, inline event handlers/style/srcdoc and unsafe URL schemes. Repeated model retries still chose the pseudo-attribute.
- Added explicit plain-text target operation using original source offsets. It cannot discard nested markup or Twig expressions, and escapes markup characters. Attribute/text targets include plain-text leaves; insertions retain separate structural targets.
- Suite 174/174 and TypeScript passed; live heading repeat underway.
- Heading follow-up PASS after safe text operation and dynamic real file paths in examples. Actual h1 is “Software built around your business”; only that source text changed. Image, anchor and copy retained. Harness visual pass in 16s. Screenshot /tmp/tina4-company-heading-pass.png.

- Contact + CTA test failed partial completion: correct profile phone/email were added but href remained /. Undo restored the baseline. Preview also hallucinated an absent button despite focused capture; no full pass.
- Added per-obligation source review with literal file evidence. Checklist partition must reproduce all original request wording, preventing a model summary from silently dropping the second action. Invalid or missing evidence blocks apply. Latest regressions 179/179, 35 files; TypeScript/build passed. Live repeat in progress.
- Reference routing is still inconsistent on explicit attachment requests. Enabled reasoning in the lightweight explicit-reference stage; reliability remains under live evaluation.

## Remaining home-page coverage
- Company contact + CTA, profile service fidelity and responsive layout.
- Independent business with irrelevant retained PDF (context isolation).
- New page plus existing navigation change in one request.
- Image-only brief, replacement image, asset preservation and loading.
- Plain text, colours, section insertion, reordering and removal with Undo.
- Missing facts: sensible generic copy without invented company claims.
- Bad JSON, missing target, invalid HTML and nonexistent asset recovery.
- Desktop/tablet/mobile rendering and actual link behaviour.
This is a representative mechanism matrix; unlimited website designs cannot literally be exhausted.
- Contact repeat with reasoning-enabled reference stage recognized the PDF. Exact-clause partition retained both actions. Generation then alternated missing insertion targets and nonexistent /contact. No new edit applied. Still FAIL; validator now gives a specific missing-target error rather than unrelated old/new anchor advice.
- Started fresh Hearth Bakery home-page scenario on 7151, retaining unrelated company PDF to test context exclusion. Disposable previous index and plan removed; main 7150 unchanged.
- Hearth Bakery round 1: correct subject/hours and no company-reference leakage; failed at stylesheet JSON, Undo succeeded. Stylesheet retry now includes actual rejected output and uses a focused non-thinking output contract.
- Hearth Bakery round 2: invented sourdough_logo.webp and pastry_display.webp; all HEAD checks returned 404, build rejected. No fabricated image paths applied. Added explicit empty-catalog layout instruction; round 3 in progress.
- Hearth Bakery round 3 PASS for functional build: scaffolded index, supplied opening hours retained, unrelated company context excluded, no nonexistent image references, valid stylesheet null response accepted. Preview reported no defects; independent mobile width390/scrollWidth390. Design remains plain stacked cards, not a polished visual pass. Evidence /tmp/tina4-bakery-mobile.png.
- Bakery button addition preserved all existing source and added href=#hours; independent click set hash #hours and exposed Visit Us. Preview correctly found low contrast. Automatic repair source reviewer falsely claimed unrelated copy changed despite deterministic preservation check. Recorded PARTIAL.
- Deterministic class/declaration operations now rely on their structural/preservation checks and actual rendered visual review; removed redundant source-model veto for that proven subset. Button repeat in progress. Latest suite179/179, TypeScript/build passed.
- Bakery button final repeat PASS in78s: source review rejected wrong placement, model corrected insertion beside welcome paragraph, measured contrast triggered automatic SCSS repair, final preview passed. Only added button markup plus black foreground declaration. Independent actual click -> #hours, visible target; computed foreground rgb(0,0,0) on rgb(74,144,217). Evidence /tmp/tina4-bakery-button-pass.png.
- Reviewer evidence now uses real numbered source lines to avoid copying class-name typos. Missing insertion target is resolved by a focused model selection from the actual catalog, then validated normally. Suite180/180,35files; TypeScript/build passed.
- Started About page + Read our story link on home in one request.
- About + home link initially false-passed as an in-page section edit. Undo restored home. Classifier now prioritizes new-page scope over accompanying content edits. A second router then overrode creation; removed that override by retaining the resolved operation.
- Next attempt scaffolded About but source reviewer wrongly required the home-page link inside About. Draft also invented different hours. Added explicit queued-existing-work boundary and existing-site source as factual context for layout, generation and source review. Partition now uses reasoning. Repeat pending.
- Reload recovery bug: root preview / did not map to index, bypassing existing-page partition. Fixed root/query/fragment recovery with a regression. Suite181/181.
- About repeat now explicitly includes pending home link in its plan and builds the new page with bakery identity. Existing-page insertion still failed after retries; combined request remains FAIL. About draft includes generic unsupported historical wording and lacks the planned return link, so content quality is also incomplete.
- Added accurate partial-completion message for a created page whose pending existing-page operation fails. Testing the existing link operation separately now.
- Isolated Read Our Story link PASS32s: only added /about anchor beside existing hours link; independent click rendered About. Full two-page request still failed earlier. Evidence /tmp/tina4-bakery-about-link.png. About width820/1024 has no horizontal overflow.
- Controlled21-request routing sweep: repetition penalty1.0 scored19/21 (readability and card addition misclassified); restored backend normal default1.18 scored21/21. Same model Gemma E2B, same classifier prompts/cases. Removed experimental LaunchAgent override and restarted model; verified /info reports E2B. Results /tmp/tina4-followup-penalty10.json and /tmp/tina4-followup-penalty118.json. This does not establish full page quality.
- Full About + home link repeat with normal model setting still failed: a plain paragraph was accepted as the requested link, then visual review failed on About. Added deterministic navigation-obligation validation so a label must be an anchor with a meaningful/matching destination. The model extractor can still incorrectly return an empty list; clarified extraction and added raw diagnostics.
- Multi-page visual expectations are now scoped to their originating page; regression prevents About styling requirements leaking into Home review.
- Next repeat created About but repeatedly emitted btn_secondary; rejected each attempt. Added narrow normalization of new generated underscore-spelled utilities only when the installed hyphenated class exists and no existing project name is affected. Twig attributes/custom names are preserved. Full repeat pending.
- Stage-isolation retry: source reviewer still read quoted pending-home instructions as requirements despite negative guidance. Removed those actual instructions from new-page prompts; layout now uses creationBrief rather than full combined conversation. New-page audit then passed.
- Navigation extraction now resolves Read our story as a required anchor (href unresolved/null), rather than empty list. Combined attempt stopped on missing numbered reviewer check. Added separate bounded review-format recovery so invalid review JSON does not trigger source regeneration. Genuine unmet requirements still return to editor. Latest suite184/184 before the added format-error regression; repeat pending.
- New generated styles now pass through existing page-scoping helper, preserving shared theme/component rules.
- Another About repeat failed because partitioning invented a new-page navigation requirement. Replaced freeform paraphrase partition with verbatim consecutive clauses assigned new/existing/both; deterministic reconstruction rejects additions or dropped words. Shared constraints can apply to both scopes without inventing new work. Regression covers an unrelated team-page example. Full repeat pending.
- Verbatim partition initially failed only because model omitted sentence-ending periods. Clause recovery now copies original text spans and restores omitted boundary separators from the request; words cannot be dropped or rewritten. Regression added. Suite187/187,35files, TypeScript/build passed. Live plan now correctly contains only original new-page clause and original home-link clause; build in progress.
- Final bakery combined request still FAIL: new About page created, but three home edits produced plain text instead of the required anchor. Structural navigation validation blocked each. Partial-completion message accurately reported the failed existing-page step. Shared preservation clause now applies to existing-page work; old page source no longer becomes a new-page completeness requirement.
- Started clean illustrator home-page case on7151 with three requested image placeholders and supplied demo contact alex@example.com; unrelated PDF retained to test isolation. Scratch server restarted after removing disposable bakery routes/templates/styles/plans.
- Illustrator round1 FAIL: three nonexistent placeholder filenames repeated through retries. Added generic distinction between real supplied images and explicitly requested accessible SVG placeholders.
- Illustrator round2 PARTIAL: three SVG placeholders and supplied mailto address rendered; no unrelated PDF content. Mobile three-column layout was unreadable and project copy remained generic. Contrast repair wrote a declaration without removing conflicting text-primary; preview correctly retained failure.
- Mixed responsive + copy follow-up FAIL: routed to appearance, unable to implement copy changes. Reworked classifier into independent newPage/content/appearance booleans with deterministic precedence. First22-case sweep20/22 (mixed request fixed; readability/navigation regressed). Clarified general readability and navigation semantics; repeat pending.
- Found responsive utility catalog bug: media-query classes were omitted. Catalog now includes conditional class names without treating their values as unconditional computed evidence. Presentation validator now rejects custom declarations that retain conflicting installed utilities. Tests191/191 across36files; TypeScript/build passed. No page source edited manually.
