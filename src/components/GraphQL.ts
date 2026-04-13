import { api, esc } from "../api.js";

let lastResult: any = null;

export function renderGraphQL(container: HTMLElement): void {
  container.innerHTML = `
    <div class="dev-panel-header">
      <h2>GraphQL Explorer</h2>
      <button class="btn btn-sm" onclick="window.__loadGqlSchema()">Refresh Schema</button>
    </div>
    <div style="display:flex;gap:1rem;height:calc(100vh - 140px)">
      <div style="width:220px;flex-shrink:0;overflow-y:auto;border-right:1px solid var(--border);padding-right:0.75rem">
        <div style="font-weight:600;font-size:0.75rem;color:var(--muted);text-transform:uppercase;margin-bottom:0.5rem">Schema</div>
        <div id="gql-types"></div>
        <div id="gql-queries" style="margin-top:1rem"></div>
        <div id="gql-mutations" style="margin-top:1rem"></div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;min-width:0">
        <div class="flex gap-sm items-center" style="margin-bottom:0.5rem">
          <button class="btn btn-primary" onclick="window.__runGqlQuery()">Execute</button>
          <button class="btn" onclick="window.__copyGqlResult()">Copy JSON</button>
          <span class="text-sm text-muted">Ctrl+Enter</span>
        </div>
        <div class="text-sm text-muted" style="font-weight:600;margin-bottom:0.25rem">Query</div>
        <textarea id="gql-query" class="input text-mono" style="width:100%;height:120px;resize:vertical" placeholder="{ users { id name email } }" onkeydown="if(event.ctrlKey&&event.key==='Enter')window.__runGqlQuery()"></textarea>
        <div class="text-sm text-muted" style="font-weight:600;margin:0.5rem 0 0.25rem">Variables (JSON)</div>
        <textarea id="gql-variables" class="input text-mono" style="width:100%;height:40px;resize:vertical" placeholder="{}"></textarea>
        <div id="gql-error" style="display:none;color:var(--danger);font-size:0.8rem;margin-top:0.25rem"></div>
        <div class="text-sm text-muted" style="font-weight:600;margin:0.5rem 0 0.25rem">Result</div>
        <pre id="gql-result" style="flex:1;overflow:auto;background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;padding:0.75rem;font-size:0.8rem;margin:0;white-space:pre-wrap;color:var(--text);font-family:monospace"></pre>
      </div>
    </div>
  `;
  loadSchema();
}

async function loadSchema(): Promise<void> {
  const typesEl = document.getElementById("gql-types");
  const queriesEl = document.getElementById("gql-queries");
  const mutationsEl = document.getElementById("gql-mutations");

  try {
    const d = await api<any>("/graphql/schema");
    if (d.error) {
      if (typesEl) typesEl.innerHTML = `<p class="text-sm" style="color:var(--danger)">${esc(d.error)}</p>`;
      return;
    }

    const schema = d.schema || {};
    const types = schema.types || {};
    const queries = schema.queries || {};
    const mutations = schema.mutations || {};

    // Render types
    if (typesEl) {
      const typeNames = Object.keys(types);
      if (typeNames.length) {
        typesEl.innerHTML = typeNames.map(name => {
          const fields = types[name];
          const fieldList = Object.entries(fields)
            .map(([k, v]) => `<div style="padding-left:1rem;color:var(--muted);font-size:0.7rem">${esc(k)}: <span style="color:var(--primary)">${esc(String(v))}</span></div>`)
            .join("");
          return `
            <div style="margin-bottom:0.5rem">
              <div style="font-weight:600;font-size:0.8rem;color:var(--text);cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">${esc(name)}</div>
              <div style="display:none">${fieldList}</div>
            </div>`;
        }).join("");
      } else {
        typesEl.innerHTML = '<p class="text-sm text-muted">No types registered</p>';
      }
    }

    // Render queries
    if (queriesEl) {
      const queryNames = Object.keys(queries);
      if (queryNames.length) {
        queriesEl.innerHTML = `<div style="font-weight:600;font-size:0.75rem;color:var(--muted);text-transform:uppercase;margin-bottom:0.25rem">Queries</div>` +
          queryNames.map(name => {
            const q = queries[name];
            const args = q.args ? Object.entries(q.args).map(([k, v]) => `${k}: ${v}`).join(", ") : "";
            return `<div style="font-size:0.8rem;padding:0.15rem 0;cursor:pointer;color:var(--text)" onclick="window.__insertGqlQuery('${esc(name)}','query')" title="Click to insert">${esc(name)}${args ? `(${esc(args)})` : ""}: <span style="color:var(--primary)">${esc(q.type || "")}</span></div>`;
          }).join("");
      }
    }

    // Render mutations
    if (mutationsEl) {
      const mutNames = Object.keys(mutations);
      if (mutNames.length) {
        mutationsEl.innerHTML = `<div style="font-weight:600;font-size:0.75rem;color:var(--muted);text-transform:uppercase;margin-bottom:0.25rem">Mutations</div>` +
          mutNames.map(name => {
            const m = mutations[name];
            const args = m.args ? Object.entries(m.args).map(([k, v]) => `${k}: ${v}`).join(", ") : "";
            return `<div style="font-size:0.8rem;padding:0.15rem 0;cursor:pointer;color:var(--text)" onclick="window.__insertGqlQuery('${esc(name)}','mutation')" title="Click to insert">${esc(name)}${args ? `(${esc(args)})` : ""}: <span style="color:var(--primary)">${esc(m.type || "")}</span></div>`;
          }).join("");
      }
    }
  } catch (e: any) {
    if (typesEl) typesEl.innerHTML = `<p class="text-sm" style="color:var(--danger)">${esc(e.message)}</p>`;
  }
}

function insertGqlQuery(name: string, kind: string): void {
  const textarea = document.getElementById("gql-query") as HTMLTextAreaElement;
  if (!textarea) return;
  if (kind === "mutation") {
    textarea.value = `mutation {\n  ${name} {\n    \n  }\n}`;
  } else {
    textarea.value = `{\n  ${name} {\n    \n  }\n}`;
  }
  textarea.focus();
}

async function runGqlQuery(): Promise<void> {
  const textarea = document.getElementById("gql-query") as HTMLTextAreaElement;
  const query = textarea?.value?.trim();
  if (!query) return;

  const errorEl = document.getElementById("gql-error");
  const resultEl = document.getElementById("gql-result");

  // Parse variables
  let variables: any = {};
  const varsText = (document.getElementById("gql-variables") as HTMLTextAreaElement)?.value?.trim();
  if (varsText && varsText !== "{}") {
    try {
      variables = JSON.parse(varsText);
    } catch {
      if (errorEl) {
        errorEl.style.display = "block";
        errorEl.textContent = "Invalid JSON in variables";
      }
      return;
    }
  }

  if (errorEl) errorEl.style.display = "none";
  if (resultEl) resultEl.textContent = "Executing...";

  try {
    const d = await api<any>("/query", "POST", { query, type: "graphql", variables });
    lastResult = d;

    if (d.errors && d.errors.length) {
      const errMsgs = d.errors.map((e: any) => e.message || String(e)).join("\n");
      if (errorEl) {
        errorEl.style.display = "block";
        errorEl.textContent = errMsgs;
      }
    }

    if (resultEl) {
      resultEl.textContent = JSON.stringify(d.data ?? d, null, 2);
    }
  } catch (e: any) {
    if (errorEl) {
      errorEl.style.display = "block";
      errorEl.textContent = e.message;
    }
    if (resultEl) resultEl.textContent = "";
  }
}

function copyGqlResult(): void {
  if (!lastResult) return;
  navigator.clipboard.writeText(JSON.stringify(lastResult, null, 2));
}

(window as any).__loadGqlSchema = loadSchema;
(window as any).__runGqlQuery = runGqlQuery;
(window as any).__copyGqlResult = copyGqlResult;
(window as any).__insertGqlQuery = insertGqlQuery;
