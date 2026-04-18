/**
 * MCP tool bridge — thin client for the dev-admin REST shim at
 * `/__dev/api/mcp/tools` + `/__dev/api/mcp/call`. The backend exposes
 * the same 24 built-in dev tools the full MCP JSON-RPC server does, just
 * over plain REST so the browser can speak them without SSE/JSON-RPC.
 *
 * The registry is fetched once on demand and memoised — tools don't
 * change at runtime.
 */

export interface McpTool {
  name: string;
  description: string;
  /** JSON Schema for arguments (type: object, properties, required). */
  schema: {
    type?: string;
    properties?: Record<string, { type?: string; default?: unknown; description?: string }>;
    required?: string[];
  };
}

export interface McpCallResult<T = unknown> {
  ok: boolean;
  name?: string;
  result?: T;
  error?: string;
}

let _loadingPromise: Promise<McpTool[]> | null = null;

/** Fetch the tool list. Returns [] on failure — never throws.
 *  No long-lived cache here: callers (e.g. the chat's `getMcpTools`)
 *  own their own TTLs, which keeps this function honest when a user
 *  adds a new `@mcp_tool` handler at runtime. In-flight calls are
 *  still deduped so a burst of turns only triggers one network hit. */
export async function listMcpTools(): Promise<McpTool[]> {
  if (_loadingPromise) return _loadingPromise;
  _loadingPromise = (async () => {
    try {
      const r = await fetch("/__dev/api/mcp/tools");
      if (!r.ok) return [];
      const data = await r.json();
      return (data.tools as McpTool[]) || [];
    } catch {
      return [];
    } finally {
      _loadingPromise = null;
    }
  })();
  return _loadingPromise;
}

/** Invoke an MCP tool by name. Arguments must match the tool's schema. */
export async function callMcpTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<McpCallResult> {
  try {
    const r = await fetch("/__dev/api/mcp/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, arguments: args }),
    });
    const data = await r.json();
    return data;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * Format the tool registry for injection into an LLM system prompt.
 * The model is told to emit tool calls as a fenced block:
 *
 *   ```tool_call
 *   {"name": "file_read", "arguments": {"path": "app.py"}}
 *   ```
 *
 * Keep the prompt terse — gemma/phi-size models repeat tool lists
 * back if they're too chatty.
 */
export function formatToolsForPrompt(tools: McpTool[]): string {
  if (!tools.length) return "";
  const lines = tools.map((t) => {
    const required = t.schema.required || [];
    const props = Object.entries(t.schema.properties || {})
      .map(([k, v]) => `${k}:${v.type || "any"}${required.includes(k) ? "" : "?"}`)
      .join(", ");
    return `- ${t.name}(${props}) — ${t.description}`;
  });
  return [
    "You have access to these project tools. To call one, emit a fenced block:",
    "",
    "```tool_call",
    '{"name": "tool_name", "arguments": {"arg": "value"}}',
    "```",
    "",
    "After a call, wait for the `tool_result` block before continuing. Never fabricate results.",
    "",
    "Available tools:",
    ...lines,
  ].join("\n");
}

/**
 * Parse tool calls out of an assistant turn.
 *
 * Primary format — the one the system prompt asks for:
 *   ```tool_call
 *   {"name": "file_patch", "arguments": {"path": "x"}}
 *   ```
 *
 * Fallback format — what small models sometimes emit instead:
 *   call:file_patch(path="x", old_string="a", new_string="b")
 *   tool_call: file_patch(path="x", ...)
 *   file_patch(path="x", ...)   <- only when on its own line and the
 *                                  function name is a known tool
 *
 * The fallback is deliberately conservative: it only fires when no
 * fenced block was found AND the call appears on its own line. That
 * way regular prose like "use file_read() to check" doesn't fire.
 */
export function parseToolCalls(
  text: string,
  knownTools?: Set<string>,
): Array<{ name: string; arguments: Record<string, unknown>; raw: string }> {
  const calls: Array<{ name: string; arguments: Record<string, unknown>; raw: string }> = [];
  // Primary: well-formed fenced block. Fallback: unclosed fence
  // (qwen2.5-coder occasionally truncates before the trailing ```) —
  // in that case consume to end-of-string.
  const re = /```tool_call\s*\n([\s\S]*?)(?:```|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const obj = parseLooseJson(m[1].trim());
    if (obj && typeof obj.name === "string") {
      calls.push({
        name: obj.name,
        arguments: (obj.arguments || obj.args || {}) as Record<string, unknown>,
        raw: m[0],
      });
    }
    // Guard against zero-width matches at end-of-string.
    if (m[0].length === 0) re.lastIndex++;
  }
  if (calls.length) return calls;
  // Fallback — tolerate `call:name(args)` / `tool_call: name(args)` /
  // `name(args)` when on its own line. Only recognise names in the
  // provided `knownTools` set so prose doesn't false-positive.
  if (!knownTools || knownTools.size === 0) return calls;
  const lineRe = /^[ \t]*(?:(?:call|tool_call)\s*:\s*)?([a-zA-Z_][\w]*)\s*\(([\s\S]*?)\)\s*$/gm;
  let lm: RegExpExecArray | null;
  while ((lm = lineRe.exec(text)) !== null) {
    const name = lm[1];
    if (!knownTools.has(name)) continue;
    const args = parsePseudoArgs(lm[2]);
    calls.push({ name, arguments: args, raw: lm[0] });
  }
  return calls;
}

/** JSON parse that tolerates small-model sloppiness.
 *
 * Qwen and other local tool-callers often emit JSON like:
 *
 *     {"path": "src/x.py", "content": "line 1
 *     line 2
 *     line 3"}
 *
 * with LITERAL newlines inside the quoted string — strict JSON.parse
 * rejects that. We try a clean parse first; if it fails, we walk the
 * text with a small quote-aware state machine and escape any control
 * whitespace (\n \r \t) that sits inside double-quoted string values.
 * Also trims trailing commas, another common small-model tic.
 *
 * Returns null on total failure — callers treat that as "skip block".
 */
function parseLooseJson(raw: string): any | null {
  // Fast path — well-formed input (Claude, GPT-4o) lands here.
  try { return JSON.parse(raw); } catch { /* fall through */ }

  // Slow path — escape literal control chars inside strings.
  const fixed = escapeInnerWhitespace(raw);
  try { return JSON.parse(fixed); } catch { /* fall through */ }

  // Last-ditch — strip trailing commas before } or ]
  const trimmedCommas = fixed.replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(trimmedCommas); } catch { return null; }
}

/** Walk `s` tracking whether the cursor is inside a double-quoted
 *  string. Replace \n, \r, \t INSIDE strings with their escape
 *  sequences. Leaves structural whitespace between tokens alone. */
function escapeInnerWhitespace(s: string): string {
  let out = "";
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      out += c;
      escape = false;
      continue;
    }
    if (c === "\\") {
      out += c;
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      out += c;
      continue;
    }
    if (inString) {
      if (c === "\n") { out += "\\n"; continue; }
      if (c === "\r") { out += "\\r"; continue; }
      if (c === "\t") { out += "\\t"; continue; }
    }
    out += c;
  }
  return out;
}

/** Parse a best-effort `k1="v1", k2=42, k3=true` string into an object.
 *  Handles single- and double-quoted strings (with backslash escapes),
 *  numbers, booleans, and bare words. Wrong inputs degrade to a string
 *  value rather than throwing — the MCP call will surface a clear
 *  error from the backend if the shape is wrong. */
function parsePseudoArgs(source: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const s = source.trim();
  if (!s) return out;
  let i = 0;
  while (i < s.length) {
    // skip whitespace + commas
    while (i < s.length && /[\s,]/.test(s[i])) i++;
    if (i >= s.length) break;
    const nameStart = i;
    while (i < s.length && /[\w]/.test(s[i])) i++;
    const name = s.slice(nameStart, i);
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] !== "=") break;
    i++;
    while (i < s.length && /\s/.test(s[i])) i++;
    // value
    let value: unknown;
    if (s[i] === '"' || s[i] === "'") {
      const quote = s[i++];
      let buf = "";
      while (i < s.length && s[i] !== quote) {
        if (s[i] === "\\" && i + 1 < s.length) {
          const next = s[i + 1];
          buf += next === "n" ? "\n" : next === "t" ? "\t" : next;
          i += 2;
        } else {
          buf += s[i++];
        }
      }
      i++; // closing quote
      value = buf;
    } else {
      const vStart = i;
      while (i < s.length && !/[,]/.test(s[i])) i++;
      const raw = s.slice(vStart, i).trim();
      if (raw === "true") value = true;
      else if (raw === "false") value = false;
      else if (raw === "null") value = null;
      else if (/^-?\d+$/.test(raw)) value = parseInt(raw, 10);
      else if (/^-?\d*\.\d+$/.test(raw)) value = parseFloat(raw);
      else value = raw;
    }
    if (name) out[name] = value;
  }
  return out;
}
