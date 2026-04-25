/**
 * AI client — fixed configuration for the andrevanzuydam.com model stack.
 *
 * Five services, known ports, routed through Vite proxies so the browser
 * only ever talks to same-origin URLs:
 *
 *   /ai      → Qwen2.5-Coder-14B @ 45K YaRN   (chat + FIM completion)   :11437
 *   /vision  → Qwen2.5-VL-7B                  (image understanding)     :11434
 *   /embed   → nomic-embed-text               (semantic retrieval)      :11435
 *   /image   → SDXL Turbo                     (diffusion)               :11436
 *   /rag     → tina4-rag                      (framework docs)          :11438
 *
 * No per-user configuration. Previously the panel exposed provider /
 * base URL / model / API key — that flexibility caused more confusion
 * than it was worth ("which preset am I on?") and none of it maps onto
 * our actual topology. Change endpoints here + in vite.config.ts and
 * every caller picks them up. One source of truth.
 */

export const MODELS = {
  chat:   { endpoint: "/ai",    model: "qwen2.5-coder:14b" },
  vision: { endpoint: "/vision", model: "qwen2.5-vl:7b" },
  embed:  { endpoint: "/embed",  model: "nomic-embed-text" },
  image:  { endpoint: "/image",  model: "sdxl-turbo" },
  rag:    { endpoint: "/rag" },
} as const;

export type ModelKey = keyof typeof MODELS;

// ── Chat ─────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOpts {
  onToken?: (token: string, accumulated: string) => void;
  signal?: AbortSignal;
  /** Rare: override the chat model for experiments. Defaults to MODELS.chat.model. */
  model?: string;
}

/**
 * Streaming chat against the Ollama NDJSON protocol on /ai. Returns the
 * final accumulated assistant text once the stream completes.
 */
export async function chat(messages: ChatMessage[], opts: ChatOpts = {}): Promise<string> {
  const model = opts.model || MODELS.chat.model;
  const response = await fetch(`${MODELS.chat.endpoint}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: opts.signal,
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!response.ok) throw new Error(`chat ${response.status}: ${await safeText(response)}`);
  if (!response.body) {
    const data = await response.json();
    const text = data?.message?.content ?? "";
    if (text) opts.onToken?.(text, text);
    return text;
  }

  let accumulated = "";
  await streamLines(response.body, (line) => {
    try {
      const obj = JSON.parse(line);
      const tok = obj?.message?.content ?? obj?.response ?? "";
      if (tok) {
        accumulated += tok;
        opts.onToken?.(tok, accumulated);
      }
    } catch {
      /* non-JSON keepalive */
    }
  });
  return accumulated;
}

// ── Image generation (OpenAI /images/generations style) ──────────

export interface ImageResult {
  /** data: URLs or http URLs — drop-in for an <img src>. */
  images: string[];
  error?: string;
}

/**
 * POST a prompt to /image/v1/images/generations and return data: URLs.
 * SDXL Turbo behind the proxy speaks the OpenAI images API; we also
 * tolerate the Automatic1111 shape in case the backend flips.
 */
export async function generateImage(
  prompt: string,
  opts: { width?: number; height?: number; steps?: number } = {},
): Promise<ImageResult> {
  const width = opts.width || 512;
  const height = opts.height || 512;
  try {
    const r = await fetch(`${MODELS.image.endpoint}/v1/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        n: 1,
        size: `${width}x${height}`,
        model: MODELS.image.model,
        response_format: "b64_json",
      }),
    });
    if (!r.ok) return { images: [], error: `${r.status}: ${await safeText(r)}` };
    const data = await r.json();
    const imgs: string[] = [];
    if (Array.isArray(data.data)) {
      for (const v of data.data) {
        if (v?.b64_json) imgs.push(`data:image/png;base64,${v.b64_json}`);
        else if (v?.url) imgs.push(v.url);
      }
    } else if (Array.isArray(data.images)) {
      for (const v of data.images) {
        if (typeof v === "string") {
          imgs.push(v.startsWith("data:") || v.startsWith("http") ? v : `data:image/png;base64,${v}`);
        }
      }
    } else if (Array.isArray(data.urls)) {
      imgs.push(...data.urls);
    }
    return { images: imgs.filter(Boolean) };
  } catch (e: any) {
    return { images: [], error: String(e?.message || e) };
  }
}

// ── Reachability probe ──────────────────────────────────────────
//
// Used by the session panel's model health row. Any response (even 4xx)
// counts as "up" — the service is answering. Only network failures and
// 5xx mean "down." 2.5s timeout keeps the strip responsive when one of
// the backends hangs.

// ── RAG retrieval (tina4-rag at /rag) ───────────────────────────

export interface RagHit {
  text: string;
  score: number;
  source: string;
}

/** Query tina4-rag for the top-N passages relevant to `query` (and
 *  optionally an active file path for additional context). Failure
 *  is non-fatal — returns []. The chat pipeline calls this per-turn
 *  so the model gets framework-specific docs without us having to
 *  ship them inline. */
export async function ragSearch(query: string, filePath?: string, k = 3): Promise<RagHit[]> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 4000);
    const body = filePath ? { query, file: filePath, k } : { query, k };
    const r = await fetch("/rag/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return [];
    const data = await r.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    return results.slice(0, k).map((h: any) => ({
      text: String(h?.text ?? h?.content ?? "").slice(0, 800),
      score: Number(h?.score ?? 0),
      source: String(h?.source ?? h?.file ?? "rag"),
    })).filter((h: RagHit) => h.text.length > 0);
  } catch {
    return [];
  }
}

export async function probeEndpoint(url: string, timeoutMs = 2500): Promise<boolean> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: "GET", signal: ctl.signal });
    return r.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

// ── Stream reader shared by chat + any other NDJSON/SSE callers ──

async function streamLines(
  body: ReadableStream<Uint8Array>,
  onLine: (line: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf("\n");
      while (nl >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) onLine(line);
        nl = buffer.indexOf("\n");
      }
    }
    if (buffer.trim()) onLine(buffer.trim());
  } finally {
    reader.releaseLock();
  }
}

async function safeText(r: Response): Promise<string> {
  try { return (await r.text()).slice(0, 200); } catch { return ""; }
}

// ── Legacy compatibility shims ──────────────────────────────────
//
// The settings modal is gone but a few call sites still import these
// names. Return frozen values that reflect the hardcoded config so
// existing code keeps compiling without conditional loading. Remove
// the shims once callers migrate to MODELS directly.

export type Provider = "ollama";

export interface AISettings {
  provider: Provider;
  endpoint: string;
  model: string;
  apiKey?: string;
  apiPath?: string;
  imageEndpoint?: string;
  imagePath?: string;
  imageModel?: string;
  chatMode?: "direct" | "supervisor";
}

export interface ImageOpts {
  width?: number;
  height?: number;
  steps?: number;
}

export function getSettings(): AISettings {
  return {
    provider: "ollama",
    endpoint: MODELS.chat.endpoint,
    model: MODELS.chat.model,
    apiKey: "",
    apiPath: "",
    imageEndpoint: MODELS.image.endpoint,
    imagePath: "/v1/images/generations",
    imageModel: MODELS.image.model,
    chatMode: "direct",
  };
}

/** No-op — settings are compiled in. Kept so legacy callers don't crash. */
export function saveSettings(_patch: Partial<AISettings>): AISettings { return getSettings(); }

/** No-op — nothing to reset. */
export function resetSettings(): AISettings { return getSettings(); }

/** Returns the single model we're configured to use. The model picker
 *  is gone; this stub keeps the import working. */
export async function listModels(): Promise<string[]> {
  return [MODELS.chat.model];
}
