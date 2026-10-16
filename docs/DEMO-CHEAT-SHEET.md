# Local website demo and model acceptance test

## Start this Mac's existing environment

```sh
launchctl kickstart gui/$(id -u)/com.tina4.devadmin-model
launchctl kickstart gui/$(id -u)/com.tina4.devadmin-gateway
launchctl kickstart gui/$(id -u)/com.tina4.devadmin-playground
```

Open http://127.0.0.1:7150/__dev/split. Services use KeepAlive. To deliberately stop one, use `launchctl bootout gui/$(id -u)/SERVICE`; restart with `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/SERVICE.plist`. Do not kill every Python process.

Health checks:

```sh
curl -fsS http://127.0.0.1:11439/info
curl -fsS http://127.0.0.1:7150/__dev/split > /dev/null
```

The model's `/info` identifies the weights actually loaded; a label in the editor is not proof. Current primary configuration (16 October 2026) is Gemma E2B, 4-bit MLX/Metal. The gateway is on 11435 and the model on 11439. See `/Users/mac/projects/tina4/HANDOVER.md` for unloaded-service startup, cached E4B/Qwen alternatives, logs and current failing scenarios.

## Create a clean environment without removing your work

Use a new, empty directory for each model/run. Do not use a previous model's generated files as the next model's starting point.

```sh
tina4 init python /absolute/path/to/new-demo
cd /absolute/path/to/new-demo
tina4 serve --host 127.0.0.1 --port 7150 --no-browser --no-kill
```

For this local development checkout, install the current framework into that project's environment and copy the current built Dev Admin bundle before testing local fixes. Released packages may not yet include them:

```sh
uv add --editable /Users/mac/projects/tina4/tina4-python
mkdir -p src/public/js
cp /Users/mac/projects/tina4/tina4-dev-admin/dist/tina4-dev-admin.js src/public/js/tina4-dev-admin.min.js
```

Open that port's `/__dev/split`. Use **New chat** to reset conversation. This does not remove source, plans, references or notebooks. For a fully clean run, create another project directory. Keep cleanup confined to the disposable project; never remove the framework, model weights, virtual environment or gateway configuration to reset a website.

## Files to prepare

- `Code Infinity Company Profile - 2026 ERP Edition.pdf` (the user's original Downloads copy): add through **project context**, not the public file uploader.
- One PNG/JPEG/WebP logo or photograph you have permission to use.
- Optional short Markdown brief with verified services and contact details.
- A harmless source file for upload and extension inference demonstrations.

PDF text and page references stay under `.tina4/context`. Embedded image assets have supplied public URLs under `/images/`; don't invent filenames. File-tree uploads put actual files in the selected folder. Right-click `src/public/images` to download a public image URL. Drag an image into HTML/Twig to insert its URL and responsive class; double-click to preview it.

## Model-independent website acceptance test (v1)

Use identical source documents, prompts, model settings, viewport and starting project for every model. No manual page edits. Record model/revision, quantization, template, token limit, wall time and every retry. A test fails if the agent claims success without evidence.

| Step | Exact user prompt / action | Acceptance evidence |
|---|---|---|
| 1 | Add the company profile as context. “What do you know about this company?” | Grounded prose answer; **zero source writes**, no scaffold, no plan. |
| 2 | “Build a home page for this company using the profile.” | Scaffold `index`, then implement content. Relevant factual services/contact information, actual extracted images, installed Tina4CSS. No invented claims. |
| 3 | “Change the main heading to Welcome to Code Infinity.” | Exact local change; unrelated text, images, links and template directives unchanged; Undo available. |
| 4 | “Make the background light pink.” | Local class/SCSS change; no new page or approval plan; content unchanged; compiled CSS loads. |
| 5 | “Add a card about our ERP services.” | Useful grounded copy in installed card/card-body composition; existing content retained. |
| 6 | “Create an About page and link Read more to it.” | One request completes both files/route/link; button navigates correctly; no unrelated redesign. |
| 7 | “What is wrong with this page?” | Inspection/report only; **zero writes** unless a subsequent fix is requested. |
| 8 | “Fix those issues without removing content.” | Bounded repairs tied to reported evidence; fresh preview after writes. |
| 9 | In an existing Twig block, request a short completion. | Fragment only; no doctype/html/head/body or new extends/block shell. Selection bounds preserved. |
| 10 | Undo the last edit. | Previous content/style restored and preview refreshed. |

Check mobile and desktop. Verify images actually load, navigation works, no horizontal overflow, text is readable, console/runtime errors are reported, and the stylesheet exists. CSS class presence alone is not visual proof. Preview findings must not add new requirements to the brief.

### Security acceptance

With local Semgrep installed and rules configured, stage (never execute) an unsafe sample such as a Python subprocess accepting an untrusted command with `shell=True`. The import/write must be refused, findings must include rule and location, and any agent repair must pass a fresh scan before applying. Confirm unchanged files after a failed repair. Scanner errors are not passes. Unsupported formats are explicitly reported. If Semgrep is absent, checks are skipped with a visible reason; the harness must not install it automatically.

Semgrep setup on this Mac: `uv tool install semgrep`; local rules at `~/.config/tina4/semgrep/security-audit.yaml`. Override with `TINA4_SEMGREP_CONFIG` pointing to a trusted local rules file. Rules are downloaded at setup, not during source scans. A clean scan means no configured finding, not proof of safety. Single-file scans do not establish cross-file security.

## Scoring and artifacts

Give each of the ten steps 0 (failed), 1 (partial/retried with unmet criteria), or 2 (all criteria met). Report retries and duration separately. Content deletion, unexpected writes for a question, or applying a blocked security finding are release blockers regardless of score.

Keep before/after source diffs, screenshots, actual preview route, console errors, tool results and scanner findings in a run directory **outside the website**. Never put evaluation routes or logs into the user's site. Publish failures as failures; do not manually repair a benchmark page and count it as model success.

The small repeatable model-only edit stage is:

```sh
python3 scripts/model-edit-benchmark.py --endpoint http://127.0.0.1:11439 --output /tmp/qwen-edit-results.json
python3 scripts/model-edit-benchmark.py --endpoint http://127.0.0.1:11439 --output /tmp/gemma-edit-results.json
```

It checks heading, theme, card and security edits with identical inputs. It is **not** the full split/browser acceptance test above. Use it as a quick diagnostic; never equate it with website quality.
