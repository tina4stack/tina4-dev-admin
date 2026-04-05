// API wrapper for /__dev/api/* endpoints
const BASE = "/__dev/api";

export async function api<T = any>(path: string, method = "GET", body?: any): Promise<T> {
  const opts: RequestInit = { method, headers: {} };
  if (body) {
    (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  return res.json();
}

export function esc(s: string): string {
  const el = document.createElement("span");
  el.textContent = s;
  return el.innerHTML;
}
