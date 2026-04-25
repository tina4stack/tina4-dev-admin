/**
 * Per-framework cheat-sheets prepended to the chat system prompt.
 *
 * Why this exists: `tina4-context.ts` is the long Tina4 reference, but
 * its language examples are Python-flavored (decorators, snake_case,
 * `from tina4_python.foo import bar`). When the dev-admin SPA is
 * connected to a PHP / Ruby / Node project, the Python idioms steer
 * the model wrong — it invents `$app->get()` instead of
 * `Router::get()`, or `app.rb`-shaped scaffolds in a Node app.
 *
 * Solution: detect the framework from `#app[data-framework]` in the
 * SPA shell (set per-framework by DevAdmin.php / dev_admin/__init__.py
 * / dev_admin.rb / devAdmin.ts) and prepend a tight, framework-native
 * cheat-sheet BEFORE the generic Tina4 reference. The framework-
 * specific examples appear first in the system message so the model
 * uses them as the authoritative shape.
 *
 * Keep these short. The goal is "first-edit gets the API surface
 * right", not full reference docs — the agent can call `docs_search`
 * for deep dives.
 */

export type Framework = "python" | "php" | "ruby" | "nodejs";

const PHP_OVERLAY = `
THIS PROJECT IS TINA4 PHP. Follow these idioms — they override any
Python-flavored examples in the generic Tina4 reference below.

ROUTES — files in src/routes/, auto-discovered. One resource per file.
\`\`\`php
// src/routes/hello.php
<?php
use Tina4\\Router;
use Tina4\\Request;
use Tina4\\Response;

Router::get('/hello', function (Request \$request, Response \$response) {
    return \$response->json(['message' => 'Hello, world']);
});

Router::post('/hello', function (Request \$request, Response \$response) {
    \$body = \$request->body; // already-parsed array for JSON
    return \$response->json(['echo' => \$body], 201);
})->noAuth();
\`\`\`

CRITICAL — DON'T DO THESE:
- Don't write \`\$app->get(...)\` — that's NOT a Tina4 PHP API. Use \`Router::get(...)\`.
- Don't \`new App()\` inside a route file. \`index.php\` already constructs the App and dispatches; route files just register routes at top level.
- Don't return a bare string. Use \`\$response->json([...])\`, \`\$response->text(\$str)\`, \`\$response->html(\$html)\`.

ORM — extend \\Tina4\\ORM, snake_case fields:
\`\`\`php
// src/orm/User.php
<?php
class User extends \\Tina4\\ORM {
    public \$tableName = 'users';
    public \$primaryKey = 'id';
}
// usage: \$u = new User(); \$u->load('SELECT * FROM users WHERE email = ?', [\$email]);
\`\`\`

DATABASE: \`\\Tina4\\Database\\Database::create(\$url, username: ..., password: ...)\`.

AUTH (expires_in is MINUTES since 3.11.27):
- \`\\Tina4\\Auth::getToken(\$payload, null, 60)\` — 60 minutes.
- \`\\Tina4\\Auth::checkPassword(\$plain, \$hashed)\` — args are (plaintext, hash) NOT (hash, plaintext).

TEMPLATES (Frond — Twig-compatible):
- \`return \$response->render('page.twig', ['title' => 'X']);\`
- Filter: \`{{ value | money }}\` — register in app.php with \`Frond::addFilter('money', fn(\$v) => ...);\`.

COMMON GOTCHAS:
- \`\$request->body\` is already an associative array for JSON. Don't json_decode again.
- \`\$response->json(\$data)\` returns COMPACT JSON since 3.11.25 (was pretty-printed; broke chat streaming).
- All decorators in PHP are method chains: \`Router::get(...)->noAuth()->cache(60)\`.
- Migration files in \`migrations/<NNNNNN>_<desc>.sql\` at PROJECT ROOT (not under src/).
`;

const RUBY_OVERLAY = `
THIS PROJECT IS TINA4 RUBY. Follow these idioms — they override any
Python-flavored examples in the generic Tina4 reference below.

ROUTES — registered via Tina4::Router. One resource per file under routes/.
\`\`\`ruby
# routes/hello.rb
Tina4::Router.get '/hello' do |request, response|
  response.json({ message: 'Hello, world' })
end

Tina4::Router.post '/hello' do |request, response|
  body = request.body # already-parsed Hash for JSON
  response.json({ echo: body }, 201)
end
\`\`\`

ORM — class < Tina4::ORM, DSL field declarations:
\`\`\`ruby
class User < Tina4::ORM
  integer_field :id, primary_key: true, auto_increment: true
  string_field :email
end
# usage: u = User.find(5); u = User.where('email = ?', [email])
\`\`\`

DATABASE: \`Tina4::Database.new('postgres://localhost:5432/mydb', username:, password:)\`.

AUTH (expires_in is MINUTES):
- \`Tina4::Auth.get_token(payload, expires_in: 60)\`
- \`Tina4::Auth.check_password(plain, hashed)\`

PERIODIC TASKS (since 3.11.17): \`Tina4.background(interval: 2.0) { do_work }\` — never raw threads.

COMMON GOTCHAS:
- Path params use \`{id}\` not \`:id\` — matches Python/PHP.
- Method idioms: \`session.has?(:key)\`, \`request.cookies\`, \`response.json(data, 200)\`.
- Templates use ERB or Frond (Twig-compatible). \`Tina4::Template.render('page.twig', { title: 'X' })\`.
`;

const NODEJS_OVERLAY = `
THIS PROJECT IS TINA4 NODE.JS. Follow these idioms — they override any
Python-flavored examples in the generic Tina4 reference below.

ROUTES — file-based. Filename = HTTP method, directory path = URL.
\`\`\`typescript
// src/routes/hello/get.ts          → GET /hello
// src/routes/hello/post.ts         → POST /hello
// src/routes/users/[id]/get.ts     → GET /users/{id}

import type { Tina4Request, Tina4Response } from '@tina4/core';

export default async function (req: Tina4Request, res: Tina4Response) {
  return res.json({ message: 'Hello, world' });
}

export const meta = { summary: 'Say hello', tags: ['greetings'] };
\`\`\`

ORM — convention-based static fields, NO decorators:
\`\`\`typescript
// src/models/User.ts
export default class User {
  static tableName = 'users';
  static fields = {
    id:    { type: 'integer' as const, primaryKey: true, autoIncrement: true },
    email: { type: 'string' as const,  required: true },
  };
}
// usage: const u = await User.findById(5);
\`\`\`

DATABASE: \`await initDatabase({ url: 'postgres://localhost:5432/mydb' })\`.

AUTH (expires_in is MINUTES):
- \`getToken(payload, secret?, 60)\` — 60 minutes.
- \`checkPassword(plain, hashed)\`

PERIODIC TASKS (since 3.11.17): \`background(callback, 2.0)\` — clears on SIGTERM/SIGINT.

COMMON GOTCHAS:
- Imports use .js extension even though source is .ts: \`import { x } from './foo.js'\`.
- Everything is ESM (\`"type": "module"\`). No \`require()\`.
- Native node:http — no Express, no Fastify. Don't pull them in.
- Path params: \`[id]\` directories → \`{id}\` URL pattern.
`;

const PYTHON_OVERLAY = `
THIS PROJECT IS TINA4 PYTHON — the generic Tina4 reference below uses
Python-native examples directly. No translation needed.
`;

const FRAMEWORK_OVERLAYS: Record<Framework, string> = {
  python: PYTHON_OVERLAY,
  php: PHP_OVERLAY,
  ruby: RUBY_OVERLAY,
  nodejs: NODEJS_OVERLAY,
};

/** Detect the framework from the SPA shell. The dev-admin endpoint
 *  in each framework injects `data-framework="<name>"` on `#app`. We
 *  fall back to "python" so the master cheat-sheet still applies if
 *  the attribute is missing (e.g. running in Vite dev with no shell). */
export function detectFramework(): Framework {
  const el = document.getElementById("app");
  const attr = el?.dataset.framework?.toLowerCase();
  if (attr === "php" || attr === "ruby" || attr === "nodejs" || attr === "python") {
    return attr;
  }
  return "python";
}

export function getFrameworkOverlay(framework: Framework): string {
  return FRAMEWORK_OVERLAYS[framework];
}
