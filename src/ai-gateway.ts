import { tina4ProjectLayout } from './ai-project-layout';
import { runtimeClock } from "./ai-clock";
// ── Tina4 AI gateway client ──────────────────────────────────
//
// dev-admin talks to ONE thing for AI: the tina4 rust client gateway
// (`tina4 ai serve`, 127.0.0.1:11435). There is no framework-side proxy any
// more — the gateway gates on the local `tina4 login` credentials, picks a
// backend (the Tina4 ai-server on :11437, else Ollama on :11434), and streams
// the model's reply straight back. Streaming, vision (`images[]`) and thinking
// (`think`) all ride the native /api/chat body verbatim.
//
// Everything AI in the SPA goes through here so the base URL and the NDJSON
// stream parsing live in exactly one place.

/** Where the gateway listens. Overridable at runtime (e.g. a settings panel
 *  can set `window.TINA4_AI_GATEWAY`) without a rebuild; defaults to the
 *  machine-wide loopback singleton. */
export function gatewayBase(): string {
  const override = (globalThis as unknown as { TINA4_AI_GATEWAY?: string })
    .TINA4_AI_GATEWAY;
  return (override && override.trim()) || "http://127.0.0.1:11435";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** base64-encoded images (no `data:` prefix) for vision turns. */
  images?: string[];
}

export interface ChatRequest {
  projectGuidance?: boolean;
  model: string;
  messages: ChatMessage[];
  /** Thinking on/off. Native Ollama/Qwen3 flag — omit to leave the model's
   *  default untouched (Ollama treats an absent flag as "unchanged"). */
  think?: boolean;
  /** Ollama-native options: num_predict, temperature, stop, … */
  options?: Record<string, unknown>;
}

/** Raised when the gateway is unreachable or refuses the call. `status` is the
 *  HTTP status (0 when the connection never completed — gateway not running). */
export class GatewayError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GatewayError";
    this.status = status;
  }
}

/** A hint the UI can show when the stream fails, mapping the failure to the
 *  one action that fixes it. */
export function gatewayHint(err: unknown): string {
  if (err instanceof GatewayError) {
    if (err.status === 401) {
      return "Sign in first: run `tina4 login`, then `tina4 ai serve`.";
    }
    if (err.status === 0) {
      return "The local AI connection failed or was interrupted. Check `tina4 ai serve` and retry.";
    }
    if (err.status === 502) {
      return "No local model is running — start the Tina4 ai-server (:11437) or Ollama (:11434).";
    }
  }
  return "AI request failed. Check `tina4 ai serve` is running.";
}

/**
 * POST /api/chat and stream the reply. The gateway forwards NDJSON — one
 * `{message:{content, thinking?}, response?, done}` object per line — so we
 * parse it once here and hand content and reasoning to the caller separately.
 *
 * - `onContent` receives answer tokens (`message.content`, or `response` for
 *   the /api/generate shape).
 * - `onThinking` receives reasoning tokens (`message.thinking`), which Ollama /
 *   Qwen3 stream BEFORE the answer when `think` is on. Omit it to ignore them.
 *
 * Throws `GatewayError` on a network / HTTP failure. Callers that fire-and-
 * forget (e.g. inline completion) swallow `AbortError`; a chat UI shows
 * `gatewayHint(err)`.
 */
async function streamOnce(
  req: ChatRequest,
  handlers: {
    onContent?: (token: string) => void;
    onThinking?: (token: string) => void;
    signal?: AbortSignal;
  },
): Promise<void> {
  const lastUser=req.messages.map(m=>m.role).lastIndexOf("user");
  const clock=runtimeClock();
  const stage=req.messages.find(message=>message.role==="system")?.content;
  const messages=req.messages.map((message,index)=>index===lastUser ? {...message,content:`${message.content}\n\n${clock}${stage ? `\n\nCurrent stage output contract: ${stage}` : ""}`} : message);
  const systemIndex=messages.findIndex(message=>message.role==='system');
  if(req.projectGuidance!==false && systemIndex>=0)messages[systemIndex]={...messages[systemIndex],content:tina4ProjectLayout+'\n\nCURRENT STAGE CONTRACT (takes precedence over general project guidance):\n'+messages[systemIndex].content};
  else if(req.projectGuidance!==false) messages.unshift({role:'system',content:tina4ProjectLayout});
  const body = { ...req, messages, stream: true };

  let r: Response;
  try {
    r = await fetch(`${gatewayBase()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: handlers.signal,
    });
  } catch (e) {
    // AbortError is a legitimate cancel — propagate it so callers can ignore it.
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    // Any other fetch rejection means the gateway socket never answered.
    throw new GatewayError(
      `AI gateway unreachable: ${(e as Error)?.message || e}`,
      0,
    );
  }

  if (!r.ok || !r.body) {
    throw new GatewayError(`AI gateway returned ${r.status}`, r.status);
  }

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const frame=(line:string):boolean=>{
    if(!line.trim())return false;
    let obj:any;try{obj=JSON.parse(line);}catch{throw new Error('Invalid AI stream frame.');}
    if(obj.error)throw new Error(String(obj.error));
    if(obj.message?.thinking)handlers.onThinking?.(obj.message.thinking);
    const token=obj.message?.content ?? obj.response ?? '';if(token)handlers.onContent?.(token);
    if(obj.done_reason==='length')throw new TokenLimitError('Model response exhausted its token budget.');
    return obj.done===true;
  };
  try {
    for (;;) {
      let part:ReadableStreamReadResult<Uint8Array>;
      try{part=await reader.read();}catch(error){
        if(handlers.signal?.aborted)throw error;
        throw new GatewayError(`AI response stream interrupted: ${String(error)}`,0);
      }
      if(part.done){buffer+=decoder.decode();if(buffer.trim() && frame(buffer))return;break;}
      buffer+=decoder.decode(part.value,{stream:true});
      let nl=buffer.indexOf('\n');
      while(nl>=0){const line=buffer.slice(0,nl);buffer=buffer.slice(nl+1);if(frame(line))return;nl=buffer.indexOf('\n');}
    }
    throw new GatewayError('AI response stream ended before completion.',0);
  } finally {
    await reader.cancel().catch(()=>{});
    reader.releaseLock();
  }
}

class TokenLimitError extends Error {}

/** Reasoning and answer share a generation budget. Retry truncated output before exposing it
 * to parsers or write tools; always bound growth and preserve the original request. */
export async function streamChat(req: ChatRequest, handlers: Parameters<typeof streamOnce>[1]): Promise<void> {
  const answerBudget = Number(req.options?.num_predict || 1200);
  let budget = Math.min(16384, answerBudget + (req.think ? 2048 : 0));
  let retryInstruction="";
  for (let attempt = 0; attempt < 3; attempt++) {
    let content = '';
    try {
      await streamOnce({...req, messages:retryInstruction ? [...req.messages,{role:"user",content:retryInstruction}] : req.messages, options:{...req.options, num_predict:budget}}, {
        ...handlers, onContent: token => { content += token; },
      });
      if (!content.trim()) throw new Error('The model returned no answer.');
      handlers.onContent?.(content);
      return;
    } catch (error) {
      if(handlers.signal?.aborted || attempt===2)throw error;
      if(error instanceof TokenLimitError && budget<16384){console.warn("Model response truncated",content.slice(0,400));retryInstruction="Your previous response exceeded the output limit. Complete only the current stage in its requested format. Be concise, omit repeated explanation and do not implement later stages. Return a complete answer within the budget.";budget=Math.min(16384,budget*2);continue;}
      if(error instanceof GatewayError && [0,502,503,504].includes(error.status)){
        await new Promise(resolve=>setTimeout(resolve,250*(attempt+1)));continue;
      }
      throw error;
    }
  }
}
