/**
 * Client for the Rust agent server (tina4 CLI's agent subsystem).
 *
 * The Rust process runs alongside the framework on port 9200 and
 * hosts a supervisor-routed multi-agent system: `supervisor` parses
 * the user intent and dispatches to `planner`, `coder`, `vision`,
 * `debug`, or `image-gen` specialists. The endpoints we care about:
 *
 *   POST /chat      SSE stream — send a message, get routed to an agent
 *   POST /execute   SSE stream — run a plan file autonomously
 *   GET  /thoughts  proactive observations (convention hints, TODOs)
 *   GET  /history   full conversation transcript
 *   GET  /agents    agent ID list
 *
 * SSE event shapes (observed):
 *   event: status   data: {agent, text}
 *   event: message  data: {agent, content, files_changed?: string[]}
 *   event: done     data: {}
 *
 * All calls go through the Vite dev proxy (`/__dev/api/{chat,execute,
 * thoughts,history,agents}`) which rewrites to `http://localhost:9200`
 * — so the browser never sees the raw port and there's no CORS drama.
 */

export interface AgentEvent {
  event: "status" | "message" | "done" | "error";
  agent?: string;
  text?: string;       // for status
  content?: string;    // for message
  files_changed?: string[];
  raw?: unknown;       // original parsed JSON payload
}

export interface Thought {
  id: string;
  timestamp: string;
  message: string;
  category?: string;
  actions?: { label: string; action: string }[];
  dismissed?: boolean;
}

export interface HistoryItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  agent?: string;
}

const BASE = "/__dev/api";

/** POST a plan file to /execute and stream SSE events.
 *  Rejects on HTTP error or fetch failure; resolves when `event: done`. */
export async function streamExecute(
  planFile: string,
  onEvent: (e: AgentEvent) => void,
  opts: { signal?: AbortSignal } = {},
): Promise<void> {
  const r = await fetch(`${BASE}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({ plan_file: planFile }),
  });
  if (!r.ok || !r.body) {
    throw new Error(`execute ${r.status}: ${await safeText(r)}`);
  }
  await readSSE(r.body, onEvent);
}

/** POST a chat message through the supervisor and stream the reply. */
export async function streamSupervisorChat(
  message: string,
  onEvent: (e: AgentEvent) => void,
  opts: { signal?: AbortSignal; agent?: string } = {},
): Promise<void> {
  const body: Record<string, unknown> = { message };
  if (opts.agent) body.agent = opts.agent;
  const r = await fetch(`${BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify(body),
  });
  if (!r.ok || !r.body) {
    throw new Error(`chat ${r.status}: ${await safeText(r)}`);
  }
  await readSSE(r.body, onEvent);
}

/** List current proactive observations from the Rust thought engine. */
export async function listThoughts(): Promise<Thought[]> {
  try {
    const r = await fetch(`${BASE}/thoughts`);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data.filter((t: Thought) => !t.dismissed) : [];
  } catch {
    return [];
  }
}

/** Mark a thought dismissed server-side. Best-effort — the Rust server
 *  may not expose a DELETE endpoint, in which case we degrade to a
 *  client-side hide (see Editor.ts). */
export async function dismissThought(id: string): Promise<boolean> {
  try {
    // Try DELETE first (REST convention), fall back to POST /dismiss.
    let r = await fetch(`${BASE}/thoughts/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (r.status === 404 || r.status === 405) {
      r = await fetch(`${BASE}/thoughts/${encodeURIComponent(id)}/dismiss`, { method: "POST" });
    }
    return r.ok;
  } catch {
    return false;
  }
}

/** List available agent IDs. Used when populating an "agent:" picker. */
export async function listAgents(): Promise<string[]> {
  try {
    const r = await fetch(`${BASE}/agents`);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// ── SSE reader ─────────────────────────────────────────────────────

async function readSSE(
  body: ReadableStream<Uint8Array>,
  onEvent: (e: AgentEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let pendingEvent = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE frames end in a blank line. Split on \n, dispatch on empty-line flush.
      let idx = buffer.indexOf("\n");
      while (idx >= 0) {
        const line = buffer.slice(0, idx).replace(/\r$/, "");
        buffer = buffer.slice(idx + 1);
        if (line === "") {
          // frame boundary — handled per-line below
        } else if (line.startsWith("event:")) {
          pendingEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          const payload = line.slice(5).trim();
          try {
            const parsed = payload ? JSON.parse(payload) : {};
            onEvent({
              event: (pendingEvent as AgentEvent["event"]) || "message",
              agent: parsed.agent,
              text: parsed.text,
              content: parsed.content,
              files_changed: parsed.files_changed,
              raw: parsed,
            });
          } catch {
            /* skip non-JSON keepalives */
          }
          pendingEvent = "";
        }
        idx = buffer.indexOf("\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function safeText(r: Response): Promise<string> {
  try { return (await r.text()).slice(0, 200); } catch { return ""; }
}

// ── Supervisor sessions ────────────────────────────────────────────
//
// Each "session" is a git worktree + branch managed by session.rs in
// the Rust binary. The endpoints below let dev-admin create, inspect,
// commit, and cancel them — same lifecycle dev-admin renders in the
// status strip + tabs. Error responses come back as {"error": string};
// we surface that to callers rather than throwing so the UI can show
// the reason without a stack trace.

export interface SessionMeta {
  id: string;
  branch: string;
  worktree: string;
  title: string;
  plan: string;
  created_at: number;
  base_sha: string;
}

export interface DiffFile {
  path: string;
  status: string; // "A" | "M" | "D" | "R" | ...
  additions: number;
  deletions: number;
}

export interface SessionCommit {
  sha: string;
  subject: string;
  trailer: Record<string, string>;
}

export interface RagWarning {
  path: string;
  kind: "convention" | "risk" | "info" | string;
  message: string;
  line?: number;
  reference?: string;
}

export interface SessionDiff {
  id: string;
  branch: string;
  base_sha: string;
  files: DiffFile[];
  commits: SessionCommit[];
  warnings: RagWarning[];
}

export interface CommitResult {
  applied: string[];
  skipped: string[];
  sha: string;
  warnings: string[];
}

/** Create a supervisor session. Returns the metadata needed to render
 *  the status strip. Rejects with the server's error string on failure
 *  (e.g. "project is not a git repository"). */
export async function createSession(input: { title?: string; plan?: string } = {}): Promise<SessionMeta> {
  const r = await fetch(`${BASE}/supervise/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: input.title || "", plan: input.plan || "" }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data?.error) {
    throw new Error(data?.error || `create ${r.status}`);
  }
  return data as SessionMeta;
}

/** Fetch an active session's diff, commit log, and any RAG warnings.
 *  Used to populate the Diff tab in dev-admin and to gate the Apply
 *  button (disabled if no changed files). */
export async function getSessionDiff(id: string): Promise<SessionDiff> {
  const r = await fetch(`${BASE}/supervise/diff?id=${encodeURIComponent(id)}`);
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data?.error) {
    throw new Error(data?.error || `diff ${r.status}`);
  }
  return data as SessionDiff;
}

/** Apply the session's changes to the user's working tree. Pass an
 *  empty `accept` array to apply everything, or a list of paths for
 *  partial acceptance. Server responds with what actually landed +
 *  any non-fatal warnings (e.g. "base moved since fork"). */
export async function commitSession(id: string, accept: string[] = []): Promise<CommitResult> {
  const r = await fetch(`${BASE}/supervise/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, accept }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data?.error) {
    throw new Error(data?.error || `commit ${r.status}`);
  }
  return data as CommitResult;
}

/** Drop the session worktree + branch. Idempotent — calling on an
 *  already-cancelled session returns ok. */
export async function cancelSession(id: string): Promise<void> {
  const r = await fetch(`${BASE}/supervise/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data?.error) {
    throw new Error(data?.error || `cancel ${r.status}`);
  }
}

/** List every session the server currently has on disk. Dev-admin
 *  calls this on load to rehydrate state after a browser reload. */
export async function listSessions(): Promise<SessionMeta[]> {
  try {
    const r = await fetch(`${BASE}/supervise/sessions`);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
