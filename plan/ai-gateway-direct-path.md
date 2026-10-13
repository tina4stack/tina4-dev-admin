# Task: dev-admin AI → tina4 rust client (gateway) direct, retire per-framework proxies

Decision (user): SPA talks to the tina4 Rust gateway (`tina4 ai serve`, 127.0.0.1:11435)
DIRECTLY for all AI; remove the per-framework dev_admin AI proxy + discovery endpoints.
New path must carry: **streaming**, **vision (image input)**, **thinking on/off**.

## Scope
- [x] A. tina4 Rust CLI (`src/ai_gateway.rs`): CORS added (hand-rolled `cors` middleware,
      reflects Origin + Vary, echoes requested headers, GET/POST/OPTIONS, Allow-Private-Network,
      Max-Age; preflight short-circuits before the auth gate). Local-creds gate + SSRF guard kept.
      Test `cors_answers_preflight_and_tags_normal_responses` (real ephemeral server, no mock) +
      full unit suite 316/0. NOT released yet (test-first per user). -> CLI 3.8.99 when ready.
- [ ] B. dev-admin SPA:
      - [ ] central `ai-gateway.ts` client (base `http://127.0.0.1:11435`, override via a setting)
      - [ ] streaming chat over the direct call (keep NDJSON reader)
      - [ ] vision: attach image(s) -> send as `images[]`/content parts in /api/chat
      - [ ] thinking on/off toggle -> `think` field in the request body
      - [ ] gateway-down / not-logged-in state: "run `tina4 login` then `tina4 ai serve`"
      - [ ] rebuild dist bundle
- [ ] C. Frameworks — remove AI proxy + discovery routes + handlers, assert 404:
      - [ ] python  dev_admin/__init__.py: /ai/api/chat, /ai, /vision, /embed, /image, /rag + handlers
      - [ ] php     Tina4/DevAdmin.php: same set
      - [ ] node    devAdmin.ts: same set
      - [ ] ruby    dev_admin.rb: confirm AI-service routes (agent chat already removed)
- [ ] D. Deploy rebuilt bundle into all 4 + update public/bundled-component-provenance.json

- [x] B. dev-admin SPA: central `ai-gateway.ts` (streaming + `think` + `images` + down/not-logged-in
      hints), FIM repointed through it, build clean, 0 `/ai/api/chat` in bundle, `:11435` present.
- [x] C. Removed AI proxy + probe routes + handlers in all four, with parity negative tests:
      python (94 pass incl. new removed-test, count 75→69), php (DevAdmin 90 + Swagger 24 +
      new 404 test; also dropped /image/v1/images/generations + dead $serviceProbe), ruby (6
      new 404 specs; source was already clean), node (conformance 15 pass incl. new AI block;
      source already clean).
- [x] D. Rebuilt bundle (sha256 a4d03715…) deployed to all four as tina4-dev-admin.min.js; all
      four public/bundled-component-provenance.json updated + bytes match. 0 /ai/api/chat in any.

## Parity
| Piece | Python | PHP | Ruby | Node |
|-------|--------|-----|------|------|
| AI proxy removed | ✅ | ✅ | ✅ (was clean) | ✅ (was clean) |
| negative 404 test | ✅ | ✅ | ✅ | ✅ |
| new bundle + provenance | ✅ | ✅ | ✅ | ✅ |

## Tests (real, no mocks)
- [ ] gateway: OPTIONS preflight -> 204 + ACAO/ACAM/ACAH (+ Allow-Private-Network); POST still streams
- [ ] each framework: removed AI routes 404; kept dev-admin routes still 200
- [ ] SPA: ai-gateway client targets :11435; thinking flag + image parts present in the body

## Bugs
- (none yet)

## Commits
- (log here)

## Status: Phases A–D complete + tested locally. NOT committed/released (test-first per user).
## Next: design the new dev-admin AI UX (chat panel: streaming + vision + thinking toggle).
## Gating: the direct path needs CLI 3.8.99 (gateway CORS) released for runtime; all repos uncommitted.
