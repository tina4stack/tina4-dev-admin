# Plan 01 — Stabilise the dev-admin SPA

> Phase 1 (per `plan/v3/19-SEAMLESS-DEV-ADMIN.md`). Three of the most
> disruptive live failures, all client-side or near-client. Coordinated
> release across PHP / Python / Ruby / Node.

## Goal

Make a supervisor session resilient: the dev-admin SPA itself never
gets kicked out of view, the file tree always reflects disk state,
and every framework error page (404 / 403 / 500) keeps the dev
toolbar visible.

## Steps

- [ ] **Step 1 — DevReload no longer reloads the dev-admin SPA itself.**
  In `src/components/Editor.ts` `startLiveReloadWatcher()`, when the
  page URL is under `/__dev*`, drop the `location.reload()` branch.
  Replace with `refreshAllOpenDirs()` + per-buffer resync of any open
  files. Fixes "I have to open /__dev again" and "chat lost on reload".

- [ ] **Step 2 — Granular file-tree refresh after MCP tool mutations.**
  In `refreshAfterToolMutation(path)`, walk from `path`'s parent dir up
  to root and reload each level that's currently expanded
  (`expandedDirs` set). Today only root reloads, so a write to
  `src/routes/foo.php` is invisible until manual click-out + click-in.

- [ ] **Step 3 — PHP: dev toolbar injects on 404 / 403 / 500.**
  Already drafted in `Tina4/Router.php` (`injectDevToolbar()` helper).
  Wire `renderError()` calls through it so error responses keep the
  toolbar in debug mode.

- [ ] **Step 4 — Python: same toolbar-on-error fix.**
  Mirror PHP: any path that returns an HTML error response in dev
  mode runs through the toolbar injector. Add a small helper if one
  doesn't exist.

- [ ] **Step 5 — Ruby: same toolbar-on-error fix.**
  Same shape as Python.

- [ ] **Step 6 — Node: same toolbar-on-error fix.**
  Same shape as Python / Ruby. `devAdmin.ts` already has toolbar
  rendering — extend the response wrapper that handles errors.

- [ ] **Step 7 — Smoke harness updates.**
  Update `plan/v3/tools/pre-release-smoke.py`:
  - Add a check that the SPA's WebSocket reload does NOT trigger a
    full-page reload when the page is `/__dev` (replay the WS
    payload, assert chat panel still in DOM).
  - Add a check that touching a nested file via `file_write` makes
    that file appear in `/__dev/api/files?path=<parent>` after the
    response (already trivially true, but confirms the flow).
  - 404-toolbar check is already in there, will green up.

- [ ] **Step 8 — Run the smoke against all four frameworks.**
  Boot each framework against a temp project, run the harness, all
  green. No exceptions, no "PHP first ship later".

- [ ] **Step 9 — Coordinated release.**
  - tina4-dev-admin: build + ship bundle to all 4 framework
    public/js/ dirs.
  - tina4-php → 3.11.31
  - tina4-python → 3.11.24
  - tina4-ruby → 3.11.19
  - tina4-nodejs → 3.11.19
  All four tagged in the same wave. No partial releases.

## Verification per step

| Step | How we verify |
|---|---|
| 1 | Open dev-admin, send a chat with `file_write` tool, observe chat panel stays mounted, no scroll reset. Replay WS reload event manually via DevTools → page does not reload |
| 2 | `file_write src/routes/test.php` from chat → `test.php` appears in left tree without click |
| 3-6 | `curl http://localhost:<port>/no-such-route` → response HTML contains the toolbar `<div>` marker |
| 7 | `python3 plan/v3/tools/pre-release-smoke.py --port <port>` exits 0 on every framework |
| 8 | (covered by 7 across all 4 ports) |
| 9 | All four `gh release view <tag>` show the same release notes |

## Out of scope

- Hot route discovery (Phase 2)
- Worktree-aware MCP (Phase 3)
- New scaffold tools — `route_create`, `template_create`,
  `image_generate` (next Phase 1 plan)
- Twig syntax highlighting (next Phase 1 plan)
- Decision ledger / chat export (Sections I/J — separate plan)

## Notes

- The uncommitted `image_generate` draft in `tina4-php Tina4/MCP.php`
  stays on disk between sessions. It does NOT ship in this wave.
- Stubs forbidden — if a framework can't do toolbar-on-error
  cleanly, it gets a real implementation, not a `// TODO`.
