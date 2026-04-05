(function(){"use strict";const p={python:{color:"#3b82f6",name:"Python"},php:{color:"#8b5cf6",name:"PHP"},ruby:{color:"#ef4444",name:"Ruby"},nodejs:{color:"#22c55e",name:"Node.js"}};function H(){const e=document.getElementById("app"),r=(e==null?void 0:e.dataset.framework)??"python",t=e==null?void 0:e.dataset.color,a=p[r]??p.python;return{framework:r,color:t??a.color,name:a.name}}function I(e){const r=document.documentElement;r.style.setProperty("--primary",e.color),r.style.setProperty("--bg","#0f172a"),r.style.setProperty("--surface","#1e293b"),r.style.setProperty("--border","#334155"),r.style.setProperty("--text","#e2e8f0"),r.style.setProperty("--muted","#94a3b8"),r.style.setProperty("--success","#22c55e"),r.style.setProperty("--danger","#ef4444"),r.style.setProperty("--warn","#f59e0b"),r.style.setProperty("--info","#3b82f6")}const B=`
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); }

.dev-admin { display: flex; flex-direction: column; height: 100vh; }
.dev-header { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 1rem; background: var(--surface); border-bottom: 1px solid var(--border); }
.dev-header h1 { font-size: 1rem; font-weight: 700; }
.dev-header h1 span { color: var(--primary); }

.dev-tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); background: var(--surface); padding: 0 0.5rem; overflow-x: auto; }
.dev-tab { padding: 0.5rem 0.75rem; border: none; background: none; color: var(--muted); cursor: pointer; font-size: 0.8rem; font-weight: 500; white-space: nowrap; border-bottom: 2px solid transparent; transition: all 0.15s; }
.dev-tab:hover { color: var(--text); }
.dev-tab.active { color: var(--primary); border-bottom-color: var(--primary); }

.dev-content { flex: 1; overflow-y: auto; }
.dev-panel { padding: 1rem; display: none; }
.dev-panel.active { display: block; }
.dev-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.dev-panel-header h2 { font-size: 0.95rem; font-weight: 600; }

.btn { padding: 0.35rem 0.75rem; border: 1px solid var(--border); border-radius: 0.375rem; background: var(--surface); color: var(--text); cursor: pointer; font-size: 0.8rem; transition: all 0.15s; }
.btn:hover { background: var(--border); }
.btn-primary { background: var(--primary); border-color: var(--primary); color: white; }
.btn-primary:hover { opacity: 0.9; }
.btn-danger { background: var(--danger); border-color: var(--danger); color: white; }
.btn-sm { padding: 0.2rem 0.5rem; font-size: 0.75rem; }

.input { padding: 0.35rem 0.5rem; border: 1px solid var(--border); border-radius: 0.375rem; background: var(--bg); color: var(--text); font-size: 0.8rem; }
.input:focus { outline: none; border-color: var(--primary); }
textarea.input { font-family: "SF Mono", "Fira Code", Consolas, monospace; resize: vertical; }

table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
th { text-align: left; padding: 0.5rem; color: var(--muted); font-weight: 600; border-bottom: 1px solid var(--border); }
td { padding: 0.5rem; border-bottom: 1px solid var(--border); }
tr:hover { background: rgba(255,255,255,0.03); }

.badge { display: inline-block; padding: 0.1rem 0.4rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; }
.badge-success { background: rgba(34,197,94,0.15); color: var(--success); }
.badge-danger { background: rgba(239,68,68,0.15); color: var(--danger); }
.badge-warn { background: rgba(245,158,11,0.15); color: var(--warn); }
.badge-info { background: rgba(59,130,246,0.15); color: var(--info); }
.badge-muted { background: rgba(148,163,184,0.15); color: var(--muted); }

.method { font-weight: 700; font-size: 0.7rem; padding: 0.1rem 0.3rem; border-radius: 0.2rem; }
.method-get { color: var(--success); }
.method-post { color: var(--info); }
.method-put { color: var(--warn); }
.method-patch { color: var(--warn); }
.method-delete { color: var(--danger); }
.method-any { color: var(--muted); }

.flex { display: flex; }
.gap-sm { gap: 0.5rem; }
.items-center { align-items: center; }
.text-mono { font-family: "SF Mono", "Fira Code", Consolas, monospace; }
.text-sm { font-size: 0.8rem; }
.text-muted { color: var(--muted); }
.empty-state { text-align: center; padding: 2rem; color: var(--muted); }

.metric-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
.metric-card { background: var(--surface); border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.75rem; }
.metric-card .label { font-size: 0.7rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
.metric-card .value { font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem; }

.chat-container { display: flex; flex-direction: column; height: calc(100vh - 140px); }
.chat-messages { flex: 1; overflow-y: auto; padding: 0.75rem; }
.chat-msg { padding: 0.5rem 0.75rem; border-radius: 0.5rem; margin-bottom: 0.5rem; font-size: 0.85rem; line-height: 1.5; max-width: 85%; }
.chat-user { background: var(--primary); color: white; margin-left: auto; }
.chat-bot { background: var(--surface); border: 1px solid var(--border); }
.chat-input-row { display: flex; gap: 0.5rem; padding: 0.75rem; border-top: 1px solid var(--border); }
.chat-input-row input { flex: 1; }

.error-trace { background: var(--bg); border: 1px solid var(--border); border-radius: 0.375rem; padding: 0.5rem; font-family: monospace; font-size: 0.75rem; white-space: pre-wrap; max-height: 200px; overflow-y: auto; margin-top: 0.5rem; }

.bubble-chart { width: 100%; height: 400px; background: var(--surface); border: 1px solid var(--border); border-radius: 0.5rem; overflow: hidden; }
`,z="/__dev/api";async function i(e,r="GET",t){const a={method:r,headers:{}};return t&&(a.headers["Content-Type"]="application/json",a.body=JSON.stringify(t)),(await fetch(z+e,a)).json()}function o(e){const r=document.createElement("span");return r.textContent=e,r.innerHTML}function A(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Routes <span id="routes-count" class="text-muted text-sm"></span></h2>
      <button class="btn btn-sm" onclick="window.__loadRoutes()">Refresh</button>
    </div>
    <table>
      <thead><tr><th>Method</th><th>Path</th><th>Auth</th><th>Handler</th></tr></thead>
      <tbody id="routes-body"></tbody>
    </table>
  `,h()}async function h(){const e=await i("/routes"),r=document.getElementById("routes-count");r&&(r.textContent=`(${e.count})`);const t=document.getElementById("routes-body");t&&(t.innerHTML=(e.routes||[]).map(a=>`
    <tr>
      <td><span class="method method-${a.method.toLowerCase()}">${o(a.method)}</span></td>
      <td class="text-mono"><a href="${o(a.path)}" target="_blank" style="color:inherit;text-decoration:underline dotted">${o(a.path)}</a></td>
      <td>${a.auth_required?'<span class="badge badge-warn">auth</span>':'<span class="badge badge-success">open</span>'}</td>
      <td class="text-sm text-muted">${o(a.handler||"")} <small>(${o(a.module||"")})</small></td>
    </tr>
  `).join(""))}window.__loadRoutes=h;function F(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Database</h2>
      <div class="flex gap-sm">
        <select id="db-tables" class="input" style="width:200px" onchange="window.__loadTableInfo()">
          <option value="">Select table...</option>
        </select>
        <button class="btn btn-sm" onclick="window.__loadTables()">Refresh</button>
      </div>
    </div>
    <div style="margin-bottom:0.75rem">
      <textarea id="db-query" class="input" style="width:100%;height:80px" placeholder="SELECT * FROM ..." onkeydown="if(event.ctrlKey&&event.key==='Enter')window.__runQuery()"></textarea>
      <div class="flex gap-sm" style="margin-top:0.5rem">
        <button class="btn btn-primary btn-sm" onclick="window.__runQuery()">Run (Ctrl+Enter)</button>
      </div>
    </div>
    <div id="db-result"></div>
  `,g()}async function g(){const e=await i("/tables"),r=document.getElementById("db-tables");r&&(r.innerHTML='<option value="">Select table...</option>'+(e.tables||[]).map(t=>`<option value="${o(t)}">${o(t)}</option>`).join(""))}async function P(){const e=document.getElementById("db-tables");if(!(e!=null&&e.value))return;const r=await i("/table?name="+encodeURIComponent(e.value)),t=document.getElementById("db-result");t&&(t.innerHTML="<table><thead><tr><th>Column</th><th>Type</th><th>Nullable</th></tr></thead><tbody>"+(r.columns||[]).map(a=>`<tr><td class="text-mono">${o(a.name)}</td><td class="text-sm">${o(a.type)}</td><td>${a.nullable?"yes":"no"}</td></tr>`).join("")+"</tbody></table>")}async function j(){var a;const e=document.getElementById("db-query"),r=(a=e==null?void 0:e.value)==null?void 0:a.trim();if(!r)return;const t=document.getElementById("db-result");t&&(t.innerHTML='<p class="text-muted">Running...</p>');try{const n=await i("/query","POST",{query:r,type:"sql"});if(n.error){t&&(t.innerHTML=`<p style="color:var(--danger)">${o(n.error)}</p>`);return}if(n.rows&&n.rows.length>0){const s=Object.keys(n.rows[0]);t&&(t.innerHTML=`<p class="text-sm text-muted">${n.count??n.rows.length} rows</p>
        <table><thead><tr>${s.map(d=>`<th>${o(d)}</th>`).join("")}</tr></thead>
        <tbody>${n.rows.map(d=>`<tr>${s.map(l=>`<td class="text-sm">${o(String(d[l]??""))}</td>`).join("")}</tr>`).join("")}</tbody></table>`)}else t&&(t.innerHTML=`<p class="text-muted">${n.affected!==void 0?n.affected+" rows affected":"Done"}</p>`)}catch(n){t&&(t.innerHTML=`<p style="color:var(--danger)">${o(n.message)}</p>`)}}window.__loadTables=g,window.__loadTableInfo=P,window.__runQuery=j;function R(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Errors <span id="errors-count" class="text-muted text-sm"></span></h2>
      <div class="flex gap-sm">
        <button class="btn btn-sm" onclick="window.__loadErrors()">Refresh</button>
        <button class="btn btn-sm btn-danger" onclick="window.__clearErrors()">Clear All</button>
      </div>
    </div>
    <div id="errors-body"></div>
  `,b()}async function b(){const e=await i("/broken"),r=document.getElementById("errors-count"),t=document.getElementById("errors-body");if(!t)return;const a=e.errors||[];if(r&&(r.textContent=`(${a.length})`),!a.length){t.innerHTML='<div class="empty-state">No errors</div>';return}t.innerHTML=a.map((n,s)=>`
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:0.75rem;margin-bottom:0.75rem">
      <div class="flex items-center" style="justify-content:space-between">
        <div>
          <span class="badge badge-danger">UNRESOLVED</span>
          <strong style="margin-left:0.5rem;font-size:0.85rem">${o(n.error||n.message||"Unknown error")}</strong>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-sm" onclick="window.__resolveError('${o(n.id||String(s))}')">Resolve</button>
          <button class="btn btn-sm btn-primary" onclick="window.__askAboutError(${s})">Ask Tina4</button>
        </div>
      </div>
      ${n.traceback?`<div class="error-trace">${o(n.traceback)}</div>`:""}
      <div class="text-sm text-muted" style="margin-top:0.5rem">${o(n.timestamp||"")}</div>
    </div>
  `).join(""),window.__errorData=a}async function O(e){await i("/broken/resolve","POST",{id:e}),b()}async function q(){await i("/broken/clear","POST"),b()}function D(e){const t=(window.__errorData||[])[e];if(!t)return;const a=document.querySelector('[data-tab="chat"]');a&&a.click(),setTimeout(()=>{const n=document.getElementById("chat-input");n&&(n.value=`I have this error: ${t.error||t.message}

${t.traceback||""}`,n.focus())},100)}window.__loadErrors=b,window.__clearErrors=q,window.__resolveError=O,window.__askAboutError=D;function N(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>System</h2>
      <button class="btn btn-sm" onclick="window.__loadSystem()">Refresh</button>
    </div>
    <div id="system-grid" class="metric-grid"></div>
  `,y()}async function y(){const e=await i("/system"),r=document.getElementById("system-grid");if(!r)return;const t=[{label:"Framework",value:e.framework||"Tina4"},{label:"Version",value:e.version||"?"},{label:"Runtime",value:e.runtime||e.python_version||e.php_version||e.ruby_version||e.node_version||"?"},{label:"Database",value:e.database||e.db_type||"none"},{label:"Uptime",value:e.uptime||"?"},{label:"Memory",value:e.memory||"?"},{label:"Platform",value:e.platform||"?"},{label:"Routes",value:String(e.route_count??e.routes??"?")},{label:"Debug",value:e.debug?"ON":"OFF"}];r.innerHTML=t.map(a=>`
    <div class="metric-card">
      <div class="label">${o(a.label)}</div>
      <div class="value" style="font-size:1.1rem">${o(a.value)}</div>
    </div>
  `).join("")}window.__loadSystem=y;function U(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Code Metrics</h2>
      <div class="flex gap-sm">
        <button class="btn btn-sm" onclick="window.__loadMetrics()">Quick Scan</button>
        <button class="btn btn-sm btn-primary" onclick="window.__loadFullMetrics()">Full Analysis</button>
      </div>
    </div>
    <div id="metrics-quick" class="metric-grid"></div>
    <div id="metrics-chart" class="bubble-chart" style="display:none"></div>
    <div id="metrics-detail" style="margin-top:1rem"></div>
  `,f()}async function f(){const e=await i("/metrics"),r=document.getElementById("metrics-quick");if(!r||e.error)return;const t=[{label:"Files",value:String(e.file_count??0)},{label:"Lines of Code",value:String(e.total_loc??0)},{label:"Classes",value:String(e.classes??0)},{label:"Functions",value:String(e.functions??0)},{label:"Routes",value:String(e.route_count??0)},{label:"Templates",value:String(e.template_count??0)},{label:"Migrations",value:String(e.migration_count??0)},{label:"Avg File Size",value:String(e.avg_file_size??0)+" LOC"}];r.innerHTML=t.map(a=>`
    <div class="metric-card">
      <div class="label">${o(a.label)}</div>
      <div class="value">${o(a.value)}</div>
    </div>
  `).join("")}async function K(){var a;const e=document.getElementById("metrics-chart"),r=document.getElementById("metrics-detail");e&&(e.style.display="block",e.innerHTML='<p class="text-muted" style="padding:1rem">Analyzing...</p>');const t=await i("/metrics/full");if(t.error||!t.file_metrics){e&&(e.innerHTML=`<p style="color:var(--danger);padding:1rem">${o(t.error||"No data")}</p>`);return}Q(t.file_metrics,e),r&&(r.innerHTML=`
      <div class="metric-grid">
        <div class="metric-card"><div class="label">Files Analyzed</div><div class="value">${t.files_analyzed}</div></div>
        <div class="metric-card"><div class="label">Total Functions</div><div class="value">${t.total_functions}</div></div>
        <div class="metric-card"><div class="label">Avg Complexity</div><div class="value">${t.avg_complexity}</div></div>
        <div class="metric-card"><div class="label">Avg Maintainability</div><div class="value">${t.avg_maintainability}</div></div>
        <div class="metric-card"><div class="label">Scan Mode</div><div class="value">${o(t.scan_mode||"project")}</div></div>
      </div>
      ${(a=t.most_complex_functions)!=null&&a.length?`
        <h3 style="margin:1rem 0 0.5rem;font-size:0.85rem">Most Complex Functions</h3>
        <table><thead><tr><th>Function</th><th>File</th><th>Complexity</th><th>LOC</th></tr></thead>
        <tbody>${t.most_complex_functions.slice(0,10).map(n=>`
          <tr><td class="text-mono">${o(n.name)}</td><td class="text-sm text-muted">${o(n.file)}</td>
          <td>${n.complexity}</td><td>${n.loc}</td></tr>`).join("")}</tbody></table>
      `:""}
    `)}function Q(e,r){const t=r.clientWidth||800,a=400,n=Math.max(...e.map(c=>c.loc||1));let s=`<svg width="${t}" height="${a}" style="background:var(--surface)">`;const d=Math.ceil(Math.sqrt(e.length)),l=t/d,u=a/Math.ceil(e.length/d);e.forEach((c,T)=>{var S;const te=T%d,re=Math.floor(T/d),M=te*l+l/2,E=re*u+u/2,L=Math.max(8,Math.sqrt(c.loc/n)*Math.min(l,u)*.4),ae=c.maintainability??50,C=`hsl(${Math.min(120,Math.max(0,ae*1.2))}, 70%, 50%)`;s+=`<circle cx="${M}" cy="${E}" r="${L}" fill="${C}" fill-opacity="0.7" stroke="${C}" stroke-width="1"
      style="cursor:pointer" onclick="window.__drillDown('${o(c.path)}')" />`,s+=`<text x="${M}" y="${E+L+12}" text-anchor="middle" fill="var(--muted)" font-size="9">${o(((S=c.path)==null?void 0:S.split("/").pop())||"")}</text>`}),s+="</svg>",r.innerHTML=s}async function W(e){const r=document.getElementById("metrics-detail");if(!r)return;r.innerHTML='<p class="text-muted">Loading file analysis...</p>';const t=await i("/metrics/file?path="+encodeURIComponent(e));if(t.error){r.innerHTML=`<p style="color:var(--danger)">${o(t.error)}</p>`;return}r.innerHTML=`
    <h3 style="font-size:0.85rem;margin-bottom:0.5rem">${o(t.path)}</h3>
    <div class="metric-grid">
      <div class="metric-card"><div class="label">LOC</div><div class="value">${t.loc}</div></div>
      <div class="metric-card"><div class="label">Total Lines</div><div class="value">${t.total_lines}</div></div>
      <div class="metric-card"><div class="label">Classes</div><div class="value">${t.classes}</div></div>
      <div class="metric-card"><div class="label">Functions</div><div class="value">${(t.functions||[]).length}</div></div>
    </div>
    ${(t.functions||[]).length?`
      <table><thead><tr><th>Function</th><th>Line</th><th>Complexity</th><th>LOC</th><th>Args</th></tr></thead>
      <tbody>${t.functions.map(a=>`
        <tr><td class="text-mono">${o(a.name)}</td><td>${a.line}</td><td>${a.complexity}</td><td>${a.loc}</td><td class="text-sm text-muted">${(a.args||[]).join(", ")}</td></tr>
      `).join("")}</tbody></table>
    `:""}
    ${(t.warnings||[]).length?`
      <h3 style="margin:1rem 0 0.5rem;font-size:0.85rem;color:var(--warn)">Warnings</h3>
      ${t.warnings.map(a=>`<p class="text-sm" style="color:var(--warn)">Line ${a.line}: ${o(a.message)}</p>`).join("")}
    `:""}
  `}window.__loadMetrics=f,window.__loadFullMetrics=K,window.__drillDown=W;let w="anthropic",m="";function V(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Code With Me</h2>
      <div class="flex gap-sm items-center">
        <select id="ai-provider" class="input" style="width:120px" onchange="window.__setProvider(this.value)">
          <option value="anthropic">Claude</option>
          <option value="openai">OpenAI</option>
          <option value="ollama">Ollama</option>
        </select>
        <input type="password" id="ai-key" class="input" placeholder="API key..." style="width:200px">
        <button class="btn btn-sm btn-primary" onclick="window.__setAiKey()">Set</button>
        <span class="text-sm text-muted" id="ai-status">${m?"Key set":"No key"}</span>
      </div>
    </div>
    <div class="chat-container">
      <div class="chat-messages" id="chat-messages">
        <div class="chat-msg chat-bot">Hi! I'm Tina4. Ask me to build routes, templates, models — or ask questions about your project. I can read and write files directly.</div>
      </div>
      <div class="chat-input-row">
        <input type="text" id="chat-input" class="input" placeholder="Ask Tina4 to build something..." onkeydown="if(event.key==='Enter')window.__sendChat()" style="flex:1">
        <button class="btn btn-primary" onclick="window.__sendChat()">Send</button>
        <button class="btn btn-sm" onclick="window.__undoChat()" title="Undo last file change">Undo</button>
      </div>
    </div>
  `}async function G(){var n;const e=document.getElementById("chat-input"),r=(n=e==null?void 0:e.value)==null?void 0:n.trim();if(!r)return;e.value="";const t=document.getElementById("chat-messages");if(!t)return;t.innerHTML+=`<div class="chat-msg chat-user">${o(r)}</div>`,t.innerHTML+='<div class="chat-msg chat-bot" id="chat-loading" style="color:var(--muted)">Thinking...</div>',t.scrollTop=t.scrollHeight;const a={message:r,provider:w};m&&(a.api_key=m);try{const s=await i("/chat","POST",a),d=document.getElementById("chat-loading");d&&d.remove();let l=Z(s.reply||"No response");s.files_changed&&s.files_changed.length>0&&(l+='<div style="margin-top:0.5rem;padding:0.5rem;background:var(--bg);border-radius:0.375rem;border:1px solid var(--border)">',l+='<div class="text-sm" style="color:var(--success);font-weight:600;margin-bottom:0.25rem">Files changed:</div>',s.files_changed.forEach(u=>{l+=`<div class="text-sm text-mono">${o(u)}</div>`}),l+="</div>"),t.innerHTML+=`<div class="chat-msg chat-bot">${l}</div>`,t.innerHTML+=`<div class="text-sm text-muted" style="text-align:right;margin-bottom:0.25rem">${o(s.source||"")}</div>`,t.scrollTop=t.scrollHeight}catch{const s=document.getElementById("chat-loading");s&&(s.textContent="Error connecting",s.id="")}}async function J(){try{const e=await i("/chat/undo","POST"),r=document.getElementById("chat-messages");r&&(r.innerHTML+=`<div class="chat-msg chat-bot" style="color:var(--warn)">${o(e.message||"Undo complete")}</div>`,r.scrollTop=r.scrollHeight)}catch{alert("Nothing to undo")}}function X(){const e=document.getElementById("ai-key");m=(e==null?void 0:e.value)||"";const r=document.getElementById("ai-status");r&&(r.textContent=m?"Key set":"No key")}function Y(e){w=e}function Z(e){return e.replace(/```(\w*)\n([\s\S]*?)```/g,'<pre style="background:var(--bg);padding:0.5rem;border-radius:0.375rem;overflow-x:auto;margin:0.5rem 0;font-size:0.8rem"><code>$2</code></pre>').replace(/`([^`]+)`/g,'<code style="background:var(--bg);padding:0.1rem 0.25rem;border-radius:0.2rem;font-size:0.8em">$1</code>').replace(/\n/g,"<br>")}window.__sendChat=G,window.__undoChat=J,window.__setAiKey=X,window.__setProvider=Y;const x=document.createElement("style");x.textContent=B,document.head.appendChild(x);const _=H();I(_);const $=[{id:"chat",label:"Code With Me",render:V},{id:"routes",label:"Routes",render:A},{id:"database",label:"Database",render:F},{id:"errors",label:"Errors",render:R},{id:"metrics",label:"Metrics",render:U},{id:"system",label:"System",render:N}];let v="chat";function ee(){const e=document.getElementById("app");if(!e)return;e.innerHTML=`
    <div class="dev-admin">
      <div class="dev-header">
        <h1><span>Tina4</span> Dev Admin</h1>
        <span class="text-sm text-muted">${_.name} &bull; v3.10</span>
      </div>
      <div class="dev-tabs" id="tab-bar"></div>
      <div class="dev-content" id="tab-content"></div>
    </div>
  `;const r=document.getElementById("tab-bar");r.innerHTML=$.map(t=>`<button class="dev-tab ${t.id===v?"active":""}" data-tab="${t.id}" onclick="window.__switchTab('${t.id}')">${t.label}</button>`).join(""),k(v)}function k(e){v=e,document.querySelectorAll(".dev-tab").forEach(n=>{n.classList.toggle("active",n.dataset.tab===e)});const r=document.getElementById("tab-content");if(!r)return;const t=document.createElement("div");t.className="dev-panel active",r.innerHTML="",r.appendChild(t);const a=$.find(n=>n.id===e);a&&a.render(t)}window.__switchTab=k,ee()})();
