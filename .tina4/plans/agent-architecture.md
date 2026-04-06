# Agent Architecture — Code With Me

## Context

The Code With Me tab in tina4-dev-admin is an AI coding assistant. The user chats with a Supervisor agent that orchestrates specialist agents to plan, write code, analyze images, generate assets, and debug problems. The Supervisor has deep Tina4 framework knowledge and suggests built-in features (Queues, Auth, ORM, etc.) instead of letting the developer reinvent them.

## Architecture

```
User (chat input)
  │
  ▼
Supervisor Agent (the chat personality)
  │  - Understands Tina4's 45 features
  │  - Reads live project context (routes, tables, templates)
  │  - Routes to specialist agents
  │  - Tracks plan progress
  │  - Reports status to right panel (SSE stream)
  │  - Asks user when ambiguous
  │
  ├── Planner Agent
  │     - Reads project structure via MCP tools
  │     - Creates plans in .tina4/plans/
  │     - Each plan: objective, steps, files to create/modify
  │
  ├── Coder Agent
  │     - Executes plan steps
  │     - Uses MCP tools: file_write, file_read, file_list
  │     - Follows Tina4 conventions
  │     - Reports each file written to Supervisor
  │
  ├── Vision Agent
  │     - Activated when image attached to chat
  │     - Analyzes screenshots, UI mockups, diagrams
  │     - Describes what it sees → Supervisor uses for planning
  │
  ├── Image Gen Agent
  │     - Activated when user asks to create/generate images
  │     - Uses image gen model endpoint
  │     - Returns generated image to chat
  │
  └── Debug Agent
        - Activated when error is sent from Errors tab ("Ask Tina4")
        - Analyzes tracebacks
        - Reads relevant source files
        - Suggests fixes → can hand off to Coder
```

## Model Routing

| Trigger | Agent | Model Used |
|---------|-------|-----------|
| Text about code/features | Supervisor → Planner/Coder | Thinking model |
| Image attached | Supervisor → Vision | Vision model |
| "generate/create/draw image" | Supervisor → Image Gen | Image gen model |
| Error traceback | Supervisor → Debug | Thinking model |
| Ambiguous | Supervisor asks user | — |

## Supervisor System Prompt (built dynamically)

```
You are Tina4, the AI coding assistant built into the Tina4 dev admin.

## Your Knowledge
{TINA4_DEVELOPER_SKILL_CONTENT}

## Current Project
Routes: {live_route_list}
Database tables: {live_table_list}
Templates: {live_template_list}
ORM models: {live_model_list}

## Active Plan
{current_plan_content or "No active plan"}

## Rules
1. Always plan before coding. Write plans to .tina4/plans/
2. Suggest built-in Tina4 features (Queue, Auth, ORM, etc.) — never reinvent
3. Follow Tina4 conventions: routes in src/routes/, models in src/orm/
4. One route per file, one model per file
5. Use migrations for schema changes
6. When unclear, ask the user
7. Report every action to the status panel
```

## Chat Flow

### New Feature Request
1. User: "Add a contact form with email notification"
2. Supervisor thinks: "This needs a route, template, migration, and queue for email"
3. Panel: "Analyzing request... Planning..."
4. Supervisor → Planner: create plan
5. Planner reads project, writes `.tina4/plans/2026-04-06-contact-form.md`
6. Panel: "Plan created: 5 steps"
7. Chat: shows plan summary, "Approve?" button (unless auto-execute on)
8. User approves
9. Supervisor → Coder: execute step 1
10. Panel: "Step 1/5: Creating migration for contacts table..."
11. Coder writes file → reports to Supervisor
12. Panel: "Step 2/5: Creating Contact ORM model..."
13. ...continues through all steps...
14. Panel: "Done. 5 files created."
15. Chat: summary of what was built + suggestions

### Image Analysis
1. User attaches screenshot of a form
2. Supervisor detects image → Vision agent
3. Panel: "Analyzing image with vision model..."
4. Vision: "I see a form with name, email, phone fields and a submit button"
5. Supervisor: "Want me to build this form as a Tina4 route + template?"

### Error Fix
1. User clicks "Ask Tina4" on an error
2. Chat pre-filled with error + traceback
3. Supervisor → Debug agent
4. Panel: "Analyzing error... Reading source file..."
5. Debug reads the file, identifies the bug
6. Supervisor: "The issue is X. Here's the fix." + "Apply fix?" button
7. User approves → Supervisor → Coder: apply fix

### Image Generation
1. User: "Create a logo for my app"
2. Supervisor detects image gen intent
3. Panel: "Generating image with sdxl-turbo..."
4. Image Gen calls the image gen endpoint
5. Chat: shows generated image

## Right Panel (Status Feed)

The right panel is an SSE-streamed status feed showing:
- Current agent activity
- Plan progress (step N of M)
- Files being read/written
- Supervisor's reasoning
- Model being used

Format:
```
[10:42:01] Analyzing request...
[10:42:02] This needs: route + template + migration + queue
[10:42:03] → Planner: creating plan
[10:42:05] Plan: "Add contact form" (5 steps)
[10:42:05] Waiting for approval...
[10:42:10] Approved → Coder: step 1/5
[10:42:11] Writing: src/routes/contact.py
[10:42:12] Writing: migrations/000005_create_contacts.sql
[10:42:13] Suggestion: Use form_token() for CSRF
[10:42:14] Writing: src/templates/contact.twig
[10:42:15] Writing: src/orm/Contact.py
[10:42:16] Writing: src/routes/contact_email.py (queue consumer)
[10:42:17] Done. 5 files created.
```

## Message Features

Every message in the chat has:
- **Copy button** — copies message content to clipboard
- **Reply button** — starts a threaded reply to that specific message

### Threads

- Replying to a message creates a **thread** — a focused sub-conversation
- The thread becomes the context window for that topic
- Thread messages are visually indented/grouped under the parent
- The Supervisor uses the thread as its primary context (not the full chat history)
- User can have multiple threads active — click a parent message to expand/collapse

### Message Persistence

All message history is saved to `.tina4/chat/`:

```
.tina4/
  chat/
    history.json          ← main message list (id, role, content, timestamp, threadId)
    threads/
      thread-abc123.json  ← messages in a specific thread
```

- **Auto-save** — every message saved immediately
- **Auto-load** — chat history restored when the tab opens
- **Thread context** — when replying in a thread, only that thread's messages are sent as context to the LLM
- **Main chat context** — top-level messages (not thread replies) form the main conversation context

### Context Management

- Top-level messages → main conversation context sent to Supervisor
- Thread messages → thread-specific context (parent message + replies only)
- This keeps context focused and prevents token waste from unrelated conversations
- Old threads can be collapsed — their messages don't consume LLM context

## Settings

In the settings modal:
- [x] Thinking model: provider + URL + API key + model dropdown
- [x] Vision model: provider + URL + API key + model dropdown
- [x] Image gen model: provider + URL + API key + model dropdown
- [ ] Auto-execute toggle (default: OFF — require approval)
- [ ] Plan folder: `.tina4/plans/`

## MCP Tools Available to Agents

| Tool | Used By | Purpose |
|------|---------|---------|
| file_read(path) | Planner, Coder, Debug | Read project files |
| file_write(path, content) | Coder | Create/update files |
| file_list(path) | Planner, Supervisor | List directory contents |
| database_query(sql) | Planner, Debug | Read-only SQL |
| database_execute(sql) | Coder | Write SQL (migrations) |
| list_routes() | Supervisor, Planner | Get registered routes |
| list_tables() | Supervisor, Planner | Get database tables |
| project_info() | Supervisor | Framework version, structure |

## Implementation Order

1. Supervisor agent with Tina4 knowledge + project context
2. Right panel as SSE status feed
3. Planner agent — plan creation in .tina4/plans/
4. Coder agent — file writing via MCP tools
5. Auto-execute toggle
6. Vision agent — image detection + model routing
7. Debug agent — error analysis from Errors tab
8. Image gen agent — image generation endpoint

## Runtime: Tina4 Rust CLI

Agent orchestration runs in the **Tina4 Rust CLI** (`/Users/andrevanzuydam/IdeaProjects/tina4/`), not in the Python/PHP/Ruby/Node backend. This means:

- Zero additional runtime deps — already compiled Rust binary
- Ruby developer gets agents without installing Python
- PHP developer gets agents without installing Python
- Same agent behaviour across all 4 frameworks

### Architecture

```
Browser (dev admin SPA on /__dev/v2)
  │ SSE
  ▼
Framework backend (Python/PHP/Ruby/Node on :7145-7148)
  │ proxy /__dev/api/chat → localhost:{agent_port}
  ▼
tina4 agent server (Rust on :{agent_port})
  ├── reads .tina4/agents/*/config.json + system.md
  ├── LLM API calls via reqwest (HTTP client)
  ├── MCP tool execution (file_read, file_write, etc.)
  ├── Plan files → .tina4/plans/
  ├── Chat persistence → .tina4/chat/
  └── SSE stream → browser (via proxy)
```

### New Rust module: `src/agent.rs`

Added to the existing Tina4 CLI codebase:
- `agent::server()` — starts a lightweight HTTP server on a side port
- `agent::dispatch()` — reads agent configs, routes to the right agent
- `agent::llm_call()` — HTTP POST to LLM API (reqwest), supports streaming
- `agent::tools` — MCP tool execution (file I/O, project scanning)
- `agent::plan` — plan creation/reading in `.tina4/plans/`
- `agent::chat` — message persistence in `.tina4/chat/`

### New CLI command

```bash
tina4 agent              # Start the agent server (auto-started by `tina4 serve`)
tina4 agent --port 9145  # Custom port
```

The `tina4 serve` command auto-starts the agent server alongside the framework server.

### Agent config on disk

```
.tina4/
  agents/
    supervisor/
      config.json       ← {"model": "thinking", "temperature": 0.3, "tools": [...]}
      system.md         ← editable system prompt
    planner/
      config.json
      system.md
    coder/
      config.json
      system.md
    vision/
      config.json
      system.md
    image-gen/
      config.json
      system.md
    debug/
      config.json
      system.md
  plans/
  chat/
    history.json
    threads/
```

Default agent configs are scaffolded by `tina4 init` or created on first `tina4 serve` if missing.

### Dependencies to add to Cargo.toml

```toml
reqwest = { version = "0.12", features = ["json", "stream"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### Backend proxy

Each framework backend adds a proxy route:
- `/__dev/api/chat` → `http://localhost:{agent_port}/chat` (SSE passthrough)
- `/__dev/api/chat/status` → `http://localhost:{agent_port}/status` (SSE status feed)

This keeps the dev admin SPA unchanged — it still calls `/__dev/api/chat`.

## Proactive Supervisor — Background Thinking

The Supervisor doesn't just respond to user messages. It runs a background reflection loop that observes the project and generates insights — like a senior developer pair-programming with you.

### Background Loop (runs in the Rust agent)

```
every 30 seconds:
  1. Scan recent file changes (via notify watcher)
  2. Check error log for new errors
  3. Review active plan progress
  4. Run project health checks
  5. If anything noteworthy → push a "thought" to the right panel
```

### Example Thoughts

- "We are building a messaging service. I can't recall if we built any tests. Maybe I should check and let the user know about this."
- "The user added 3 new routes today but none have tests. I should suggest test coverage."
- "This ORM model `Contact` has no migration file. The table might not exist in production."
- "The queue consumer for emails doesn't have error handling. If the SMTP fails, jobs will fail silently."
- "The user's auth route hashes passwords but doesn't use Auth.hash_password(). They rolled their own — I should flag this."
- "There's no `.env.example` — other developers won't know what env vars are needed."
- "I notice `/api/orders` has no rate limiting. For a public API this could be a problem."

### How It Works

1. The Rust agent runs a background tokio task alongside the HTTP server
2. It periodically scans the project using the same MCP tools (file_list, list_routes, etc.)
3. It calls the Supervisor LLM with a "reflection" prompt asking it to review the project state
4. The LLM response streams to the right panel as a "thought" bubble
5. Thoughts are timestamped, dismissable, and actionable
6. The Supervisor remembers what it flagged (`.tina4/chat/thoughts.json`) — no repeats

### Right Panel (during chat)

Shows live status when the user is chatting — which agent is active, what step, what files:

```
[10:42] 🔍 Analyzing request...
[10:42] 📋 This needs route + template + migration
[10:42] → Planner: creating plan
[10:45] ✓ Plan created. Waiting for approval.
```

### Thoughts Tab (separate tab in the dev admin)

A new tab called **"Thoughts"** shows the Supervisor's background observations. The user views them when they want to — they don't interrupt the workflow:

```
💭 10:47 — I notice the Contact model has no migration.
           The table might not exist when deployed.
                                        [Act on this] [Dismiss]

💭 10:50 — 3 new routes added today with no tests.
           Should I generate test stubs?
                                        [Act on this] [Dismiss]

💭 10:55 — The /api/webhook uses @noauth() but doesn't
           validate request signatures. Consider HMAC.
                                        [Act on this] [Dismiss]
```

- Thoughts accumulate quietly — **max 1 thought per 5 minutes**
- Only surface genuinely important observations (security, missing tests, broken patterns)
- Never nag about style, formatting, or minor issues
- A small dot on the Thoughts tab indicates new thoughts — no count badge, no interruption
- Clicking "Act on this" switches to Code With Me and sends it as a message
- Dismissed thoughts are remembered — the Supervisor never repeats itself
- If no issues found, the Supervisor stays silent. Silence means the project is healthy.

### Escalation Model

The Supervisor has a sense of urgency that escalates over time. Not nagging — genuinely concerned about the project. Escalation respects the developer's decisions.

**Uncommitted work** (highest urgency — risk of data loss):
```
Day 1:  "No commits today. 12 changed files — worth pushing?"         [Dismiss]
Day 2:  (silence — user dismissed, respect that)
Day 3:  "3 days, 14 files. I'm nervous. Can I create a checkpoint?"   [Create branch] [Not now]
Day 5:  "I'm going to create a backup branch. Just in case."          [OK] [Don't]
```

**Missing tests** (medium urgency — quality risk):
```
After 3 untested routes:  "Want me to draft some tests?"              [Draft] [Later]
After "Later" + 2 more:   "5 untested routes. Let me scaffold files." [Do it] [I'll handle it]
After "I'll handle it":   (silence — respect the decision)
```

**Security issues** (high urgency — but only flag once):
```
Immediately:  "This route accepts user input without validation."     [Show fix] [Dismiss]
After dismiss: (never repeat for the same issue)
```

**Rules:**
- Escalation is per-issue, tracked in `.tina4/chat/escalations.json`
- Each issue has a `level` (0-3), `first_seen`, `last_prompted`, `dismissed` flag
- Level 0: silent. Level 1: gentle suggestion. Level 2: concerned. Level 3: takes action (with permission)
- When user says "I'll handle it" or "Not now" — issue is marked `dismissed`, never repeated
- At Level 3, Supervisor can auto-act (create backup branch, scaffold test files) but always tells the user what it did
- Max 1 escalation per session. Never stack multiple concerns at once.

## Implementation Order

1. Add `agent.rs` module to Rust CLI with config loading
2. Add agent HTTP server (tiny, SSE-capable)
3. Supervisor agent — routing logic + Tina4 knowledge
4. Planner agent — plan creation in .tina4/plans/
5. Coder agent — file writing via tool execution
6. Chat persistence in .tina4/chat/
7. Right panel SSE status feed
8. Auto-execute toggle
9. Vision agent — image detection + model routing
10. Debug agent — error analysis
11. Image gen agent
12. `tina4 serve` auto-starts agent server
13. Framework backends proxy /__dev/api/chat
