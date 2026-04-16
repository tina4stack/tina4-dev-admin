# tina4-dev-admin

Unified single-page **dev admin dashboard** for all four Tina4 backend frameworks — Python, PHP, Ruby, and Node.js.

The dashboard is compiled to a single JavaScript bundle (`tina4-dev-admin.js`, ~87 KB / 22 KB gzipped) and shipped with each framework. It mounts at `/__dev/` whenever `TINA4_DEBUG=true` and talks to the framework through a well-defined set of `/__dev/api/*` endpoints — same endpoints, same JSON shapes, across every backend.

## What it provides

| Tab | Shows |
|---|---|
| Routes | All registered routes with method, pattern, handler, and metadata |
| Messages | In-memory `MessageLog` with category + level filtering and search |
| Requests | Request Inspector — last 200 HTTP requests, timings, status, replay |
| Database | Table browser, SQL query runner, paginated results |
| GraphQL | Schema browser + query runner (uses the framework's built-in GraphQL engine) |
| Queue | Queue backend status, topic selector, pending/failed/dead-letter jobs, retry + replay |
| Mailbox | Dev Mailbox — captured outgoing emails with seed/clear controls |
| Broken | Broken-route / error tracker — auto-resolves and health counter |
| WebSocket | Live WebSocket connection monitor (count + per-connection actions) |
| System | Framework version, runtime version, memory, uptime, debug flag, DB connection |
| Tools | AI tool context installer, gallery deploys, metrics |

All tabs are backed by endpoints that respond the same way across Python, PHP, Ruby, and Node.js. If a framework lacks a backend for a tab (e.g., a fresh project with no DB), the tab shows a clear empty state rather than failing.

## Build & dev

```bash
npm install
npm run dev        # Vite dev server — test against a running framework on http://localhost:7145/7146/7147/7148
npm run build      # Produces dist/tina4-dev-admin.js
npm run deploy     # Fans the built bundle out to all 4 framework repos
```

The `deploy` script copies `dist/tina4-dev-admin.js` into:

- `../tina4-python/tina4_python/public/js/tina4-dev-admin.js`
- `../tina4-php/src/public/js/tina4-dev-admin.js`
- `../tina4-ruby/lib/tina4/public/js/tina4-dev-admin.js`
- `../tina4-nodejs/packages/core/public/js/tina4-dev-admin.js`

After deploying, commit the updated bundle in each framework repo.

## Built on tina4-js

The dashboard is a showcase app for [tina4-js](https://github.com/tina4stack/tina4-js) — the reactive frontend framework. Everything uses signals, `html\`\`` tagged templates, and `Tina4Element` web components. Zero third-party runtime dependencies.

## Backend contract

Each framework implements the following endpoints (full list in `DevAdmin` on the Python side, with PHP/Ruby/Node.js at parity):

```
GET  /__dev/api/status            System + framework info
GET  /__dev/api/routes            Registered routes
GET  /__dev/api/messages          Message log (filterable)
POST /__dev/api/messages/clear
GET  /__dev/api/requests          Request inspector
POST /__dev/api/requests/clear
GET  /__dev/api/tables            DB tables
GET  /__dev/api/table?name=X      Table rows (paginated)
POST /__dev/api/query             Run SQL
GET  /__dev/api/queue             Queue stats + jobs
GET  /__dev/api/queue/topics      Topic discovery
GET  /__dev/api/queue/dead-letters
POST /__dev/api/queue/retry
POST /__dev/api/queue/purge
POST /__dev/api/queue/replay
GET  /__dev/api/mailbox           Captured emails
GET  /__dev/api/mailbox/read?id=
POST /__dev/api/mailbox/seed
POST /__dev/api/mailbox/clear
GET  /__dev/api/broken            Broken-route tracker
GET  /__dev/api/websockets        WebSocket connections
GET  /__dev/api/mtime             Reload-counter for the dev-toolbar polling fallback
POST /__dev/api/reload            Called by the `tina4` Rust CLI on file changes
```

## License

MIT (c) 2007-2026 Tina4 Stack
