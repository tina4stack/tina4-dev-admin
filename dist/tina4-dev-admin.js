(function(){"use strict";const E={python:{color:"#3b82f6",name:"Python"},php:{color:"#8b5cf6",name:"PHP"},ruby:{color:"#ef4444",name:"Ruby"},nodejs:{color:"#22c55e",name:"Node.js"}};function F(){const e=document.getElementById("app"),o=(e==null?void 0:e.dataset.framework)??"python",t=e==null?void 0:e.dataset.color,r=E[o]??E.python;return{framework:o,color:t??r.color,name:r.name}}function N(e){const o=document.documentElement;o.style.setProperty("--primary",e.color),o.style.setProperty("--bg","#0f172a"),o.style.setProperty("--surface","#1e293b"),o.style.setProperty("--border","#334155"),o.style.setProperty("--text","#e2e8f0"),o.style.setProperty("--muted","#94a3b8"),o.style.setProperty("--success","#22c55e"),o.style.setProperty("--danger","#ef4444"),o.style.setProperty("--warn","#f59e0b"),o.style.setProperty("--info","#3b82f6")}const q=`
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

.btn { padding: 0.35rem 0.75rem; border: 1px solid var(--border); border-radius: 0.375rem; background: var(--surface); color: var(--text); cursor: pointer; font-size: 0.8rem; transition: all 0.15s; height: 30px; line-height: 1; }
.btn:hover { background: var(--border); }
.btn-primary { background: var(--primary); border-color: var(--primary); color: white; }
.btn-primary:hover { opacity: 0.9; }
.btn-danger { background: var(--danger); border-color: var(--danger); color: white; }
.btn-sm { padding: 0.2rem 0.5rem; font-size: 0.75rem; }

.input { padding: 0.35rem 0.5rem; border: 1px solid var(--border); border-radius: 0.375rem; background: var(--bg); color: var(--text); font-size: 0.8rem; height: 30px; }
select.input { height: 30px; }
.input:focus { outline: none; border-color: var(--primary); }
textarea.input { font-family: "SF Mono", "Fira Code", Consolas, monospace; resize: vertical; height: auto; }

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
`,D="/__dev/api";async function c(e,o="GET",t){const r={method:o,headers:{}};return t&&(r.headers["Content-Type"]="application/json",r.body=JSON.stringify(t)),(await fetch(D+e,r)).json()}function n(e){const o=document.createElement("span");return o.textContent=e,o.innerHTML}function U(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Routes <span id="routes-count" class="text-muted text-sm"></span></h2>
      <button class="btn btn-sm" onclick="window.__loadRoutes()">Refresh</button>
    </div>
    <table>
      <thead><tr><th>Method</th><th>Path</th><th>Auth</th><th>Handler</th></tr></thead>
      <tbody id="routes-body"></tbody>
    </table>
  `,M()}async function M(){const e=await c("/routes"),o=document.getElementById("routes-count");o&&(o.textContent=`(${e.count})`);const t=document.getElementById("routes-body");t&&(t.innerHTML=(e.routes||[]).map(r=>`
    <tr>
      <td><span class="method method-${r.method.toLowerCase()}">${n(r.method)}</span></td>
      <td class="text-mono"><a href="${n(r.path)}" target="_blank" style="color:inherit;text-decoration:underline dotted">${n(r.path)}</a></td>
      <td>${r.auth_required?'<span class="badge badge-warn">auth</span>':'<span class="badge badge-success">open</span>'}</td>
      <td class="text-sm text-muted">${n(r.handler||"")} <small>(${n(r.module||"")})</small></td>
    </tr>
  `).join(""))}window.__loadRoutes=M;let f=[],w=[];function V(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Database</h2>
      <button class="btn btn-sm" onclick="window.__loadTables()">Refresh</button>
    </div>
    <div style="display:flex;gap:1rem;height:calc(100vh - 140px)">
      <div style="width:200px;flex-shrink:0;overflow-y:auto;border-right:1px solid var(--border);padding-right:0.75rem">
        <div style="font-weight:600;font-size:0.75rem;color:var(--muted);text-transform:uppercase;margin-bottom:0.5rem">Tables</div>
        <div id="db-table-list"></div>
        <div style="margin-top:1.5rem;border-top:1px solid var(--border);padding-top:0.75rem">
          <div style="font-weight:600;font-size:0.75rem;color:var(--muted);text-transform:uppercase;margin-bottom:0.5rem">Seed Data</div>
          <select id="db-seed-table" class="input" style="width:100%;margin-bottom:0.5rem">
            <option value="">Pick table...</option>
          </select>
          <div class="flex gap-sm">
            <input type="number" id="db-seed-count" class="input" value="10" style="width:60px">
            <button class="btn btn-sm btn-primary" onclick="window.__seedTable()">Seed</button>
          </div>
        </div>
      </div>
      <div style="flex:1;display:flex;flex-direction:column;min-width:0">
        <div class="flex gap-sm items-center" style="margin-bottom:0.5rem;flex-wrap:wrap">
          <select id="db-type" class="input" style="width:80px">
            <option value="sql">SQL</option>
            <option value="graphql">GraphQL</option>
          </select>
          <span class="text-sm text-muted">Limit</span>
          <select id="db-limit" class="input" style="width:60px">
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="500">500</option>
          </select>
          <span class="text-sm text-muted">Offset</span>
          <input type="number" id="db-offset" class="input" value="0" style="width:60px" min="0">
          <button class="btn btn-primary" onclick="window.__runQuery()">Run</button>
          <button class="btn" onclick="window.__copyCSV()">Copy CSV</button>
          <button class="btn" onclick="window.__copyJSON()">Copy JSON</button>
          <button class="btn" onclick="window.__showPaste()">Paste</button>
          <span class="text-sm text-muted">Ctrl+Enter</span>
        </div>
        <textarea id="db-query" class="input text-mono" style="width:100%;height:80px;resize:vertical" placeholder="SELECT * FROM users" onkeydown="if(event.ctrlKey&&event.key==='Enter')window.__runQuery()"></textarea>
        <div id="db-result" style="flex:1;overflow:auto;margin-top:0.75rem"></div>
      </div>
    </div>
    <div id="db-paste-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;display:none;align-items:center;justify-content:center">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:1.5rem;width:600px;max-height:80vh;overflow:auto">
        <h3 style="margin-bottom:0.75rem;font-size:0.9rem">Paste Data</h3>
        <p class="text-sm text-muted" style="margin-bottom:0.5rem">Paste CSV or JSON array. First row = column headers for CSV.</p>
        <div class="flex gap-sm items-center" style="margin-bottom:0.5rem">
          <select id="paste-table" class="input" style="flex:1"><option value="">Select existing table...</option></select>
          <span class="text-sm text-muted">or</span>
          <input type="text" id="paste-new-table" class="input" placeholder="New table name..." style="flex:1">
        </div>
        <textarea id="paste-data" class="input text-mono" style="width:100%;height:200px" placeholder='name,email&#10;Alice,alice@test.com&#10;Bob,bob@test.com'></textarea>
        <div class="flex gap-sm" style="margin-top:0.75rem;justify-content:flex-end">
          <button class="btn" onclick="window.__hidePaste()">Cancel</button>
          <button class="btn btn-primary" onclick="window.__doPaste()">Import</button>
        </div>
      </div>
    </div>
  `,$()}async function $(){const o=(await c("/tables")).tables||[],t=document.getElementById("db-table-list");t&&(t.innerHTML=o.length?o.map(s=>`<div style="padding:0.3rem 0.5rem;cursor:pointer;border-radius:0.25rem;font-size:0.8rem;font-family:monospace" class="db-table-item" onclick="window.__selectTable('${n(s)}')" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background=''">${n(s)}</div>`).join(""):'<div class="text-sm text-muted">No tables</div>');const r=document.getElementById("db-seed-table");r&&(r.innerHTML='<option value="">Pick table...</option>'+o.map(s=>`<option value="${n(s)}">${n(s)}</option>`).join(""));const a=document.getElementById("paste-table");a&&(a.innerHTML='<option value="">Select table...</option>'+o.map(s=>`<option value="${n(s)}">${n(s)}</option>`).join(""))}function k(e){var t;(t=document.getElementById("db-limit"))!=null&&t.value;const o=document.getElementById("db-query");o&&(o.value=`SELECT * FROM ${e}`),document.querySelectorAll(".db-table-item").forEach(r=>{r.style.background=r.textContent===e?"var(--border)":""}),S()}function K(){var t;const e=document.getElementById("db-query"),o=((t=document.getElementById("db-limit"))==null?void 0:t.value)||"20";e!=null&&e.value&&(e.value=e.value.replace(/LIMIT\s+\d+/i,`LIMIT ${o}`))}async function S(){var a,s,m;const e=document.getElementById("db-query"),o=(a=e==null?void 0:e.value)==null?void 0:a.trim();if(!o)return;const t=document.getElementById("db-result"),r=((s=document.getElementById("db-type"))==null?void 0:s.value)||"sql";t&&(t.innerHTML='<p class="text-muted">Running...</p>');try{const l=parseInt(((m=document.getElementById("db-limit"))==null?void 0:m.value)||"20"),i=await c("/query","POST",{query:o,type:r,limit:l});if(i.error){t&&(t.innerHTML=`<p style="color:var(--danger)">${n(i.error)}</p>`);return}i.rows&&i.rows.length>0?(w=Object.keys(i.rows[0]),f=i.rows,t&&(t.innerHTML=`<p class="text-sm text-muted" style="margin-bottom:0.5rem">${i.count??i.rows.length} rows</p>
        <div style="overflow-x:auto"><table><thead><tr>${w.map(d=>`<th>${n(d)}</th>`).join("")}</tr></thead>
        <tbody>${i.rows.map(d=>`<tr>${w.map(g=>`<td class="text-sm">${n(String(d[g]??""))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`)):i.affected!==void 0?(t&&(t.innerHTML=`<p class="text-muted">${i.affected} rows affected. ${i.success?"Success.":""}</p>`),f=[],w=[]):(t&&(t.innerHTML='<p class="text-muted">No results</p>'),f=[],w=[])}catch(l){t&&(t.innerHTML=`<p style="color:var(--danger)">${n(l.message)}</p>`)}}function J(){if(!f.length)return;const e=w.join(","),o=f.map(t=>w.map(r=>{const a=String(t[r]??"");return a.includes(",")||a.includes('"')?`"${a.replace(/"/g,'""')}"`:a}).join(","));navigator.clipboard.writeText([e,...o].join(`
`))}function Q(){f.length&&navigator.clipboard.writeText(JSON.stringify(f,null,2))}function W(){const e=document.getElementById("db-paste-modal");e&&(e.style.display="flex")}function C(){const e=document.getElementById("db-paste-modal");e&&(e.style.display="none")}async function G(){var a,s,m,l,i;const e=(a=document.getElementById("paste-table"))==null?void 0:a.value,o=(m=(s=document.getElementById("paste-new-table"))==null?void 0:s.value)==null?void 0:m.trim(),t=o||e,r=(i=(l=document.getElementById("paste-data"))==null?void 0:l.value)==null?void 0:i.trim();if(!t||!r){alert("Select a table or enter a new table name, and paste data.");return}try{let d;try{d=JSON.parse(r),Array.isArray(d)||(d=[d])}catch{const b=r.split(`
`).map(u=>u.trim()).filter(Boolean);if(b.length<2){alert("CSV needs at least a header row and one data row.");return}const h=b[0].split(",").map(u=>u.trim().replace(/[^a-zA-Z0-9_]/g,""));d=b.slice(1).map(u=>{const v=u.split(",").map(p=>p.trim()),y={};return h.forEach((p,O)=>{y[p]=v[O]??""}),y})}if(!d.length){alert("No data rows found.");return}if(o){const h=["id INTEGER PRIMARY KEY AUTOINCREMENT",...Object.keys(d[0]).filter(v=>v.toLowerCase()!=="id").map(v=>`"${v}" TEXT`)],u=await c("/query","POST",{query:`CREATE TABLE IF NOT EXISTS "${o}" (${h.join(", ")})`,type:"sql"});if(u.error){alert("Create table failed: "+u.error);return}}let g=0;for(const b of d){const h=o?Object.keys(b).filter(p=>p.toLowerCase()!=="id"):Object.keys(b),u=h.map(p=>`"${p}"`).join(","),v=h.map(p=>`'${String(b[p]).replace(/'/g,"''")}'`).join(","),y=await c("/query","POST",{query:`INSERT INTO "${t}" (${u}) VALUES (${v})`,type:"sql"});if(y.error){alert(`Row ${g+1} failed: ${y.error}`);break}g++}C(),$(),g>0&&(k(t),alert(`Imported ${g} rows into "${t}"`))}catch(d){alert("Import error: "+d.message)}}async function X(){var t,r;const e=(t=document.getElementById("db-seed-table"))==null?void 0:t.value,o=parseInt(((r=document.getElementById("db-seed-count"))==null?void 0:r.value)||"10");if(e)try{const a=await c("/seed","POST",{table:e,count:o});a.error?alert(a.error):k(e)}catch(a){alert("Seed error: "+a.message)}}window.__loadTables=$,window.__selectTable=k,window.__updateLimit=K,window.__runQuery=S,window.__copyCSV=J,window.__copyJSON=Q,window.__showPaste=W,window.__hidePaste=C,window.__doPaste=G,window.__seedTable=X;function Y(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Errors <span id="errors-count" class="text-muted text-sm"></span></h2>
      <div class="flex gap-sm">
        <button class="btn btn-sm" onclick="window.__loadErrors()">Refresh</button>
        <button class="btn btn-sm btn-danger" onclick="window.__clearErrors()">Clear All</button>
      </div>
    </div>
    <div id="errors-body"></div>
  `,_()}async function _(){const e=await c("/broken"),o=document.getElementById("errors-count"),t=document.getElementById("errors-body");if(!t)return;const r=e.errors||[];if(o&&(o.textContent=`(${r.length})`),!r.length){t.innerHTML='<div class="empty-state">No errors</div>';return}t.innerHTML=r.map((a,s)=>`
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:0.75rem;margin-bottom:0.75rem">
      <div class="flex items-center" style="justify-content:space-between">
        <div>
          <span class="badge badge-danger">UNRESOLVED</span>
          <strong style="margin-left:0.5rem;font-size:0.85rem">${n(a.error||a.message||"Unknown error")}</strong>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-sm" onclick="window.__resolveError('${n(a.id||String(s))}')">Resolve</button>
          <button class="btn btn-sm btn-primary" onclick="window.__askAboutError(${s})">Ask Tina4</button>
        </div>
      </div>
      ${a.traceback?`<div class="error-trace">${n(a.traceback)}</div>`:""}
      <div class="text-sm text-muted" style="margin-top:0.5rem">${n(a.timestamp||"")}</div>
    </div>
  `).join(""),window.__errorData=r}async function Z(e){await c("/broken/resolve","POST",{id:e}),_()}async function ee(){await c("/broken/clear","POST"),_()}function te(e){const t=(window.__errorData||[])[e];if(!t)return;const r=document.querySelector('[data-tab="chat"]');r&&r.click(),setTimeout(()=>{const a=document.getElementById("chat-input");a&&(a.value=`I have this error: ${t.error||t.message}

${t.traceback||""}`,a.focus())},100)}window.__loadErrors=_,window.__clearErrors=ee,window.__resolveError=Z,window.__askAboutError=te;function oe(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>System</h2>
      <button class="btn btn-sm" onclick="window.__loadSystem()">Refresh</button>
    </div>
    <div id="system-grid" class="metric-grid"></div>
  `,I()}async function I(){const e=await c("/system"),o=document.getElementById("system-grid");if(!o)return;const t=[{label:"Framework",value:e.framework||"Tina4"},{label:"Version",value:e.version||"?"},{label:"Runtime",value:e.runtime||e.python_version||e.php_version||e.ruby_version||e.node_version||"?"},{label:"Database",value:e.database||e.db_type||"none"},{label:"Uptime",value:e.uptime||"?"},{label:"Memory",value:e.memory||"?"},{label:"Platform",value:e.platform||"?"},{label:"Routes",value:String(e.route_count??e.routes??"?")},{label:"Debug",value:e.debug?"ON":"OFF"}];o.innerHTML=t.map(r=>`
    <div class="metric-card">
      <div class="label">${n(r.label)}</div>
      <div class="value" style="font-size:1.1rem">${n(r.value)}</div>
    </div>
  `).join("")}window.__loadSystem=I;function re(e){e.innerHTML=`
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
  `,L()}async function L(){const e=await c("/metrics"),o=document.getElementById("metrics-quick");if(!o||e.error)return;const t=[{label:"Files",value:String(e.file_count??0)},{label:"Lines of Code",value:String(e.total_loc??0)},{label:"Classes",value:String(e.classes??0)},{label:"Functions",value:String(e.functions??0)},{label:"Routes",value:String(e.route_count??0)},{label:"Templates",value:String(e.template_count??0)},{label:"Migrations",value:String(e.migration_count??0)},{label:"Avg File Size",value:String(e.avg_file_size??0)+" LOC"}];o.innerHTML=t.map(r=>`
    <div class="metric-card">
      <div class="label">${n(r.label)}</div>
      <div class="value">${n(r.value)}</div>
    </div>
  `).join("")}async function ae(){var r;const e=document.getElementById("metrics-chart"),o=document.getElementById("metrics-detail");e&&(e.style.display="block",e.innerHTML='<p class="text-muted" style="padding:1rem">Analyzing...</p>');const t=await c("/metrics/full");if(t.error||!t.file_metrics){e&&(e.innerHTML=`<p style="color:var(--danger);padding:1rem">${n(t.error||"No data")}</p>`);return}ne(t.file_metrics,e),o&&(o.innerHTML=`
      <div class="metric-grid">
        <div class="metric-card"><div class="label">Files Analyzed</div><div class="value">${t.files_analyzed}</div></div>
        <div class="metric-card"><div class="label">Total Functions</div><div class="value">${t.total_functions}</div></div>
        <div class="metric-card"><div class="label">Avg Complexity</div><div class="value">${t.avg_complexity}</div></div>
        <div class="metric-card"><div class="label">Avg Maintainability</div><div class="value">${t.avg_maintainability}</div></div>
        <div class="metric-card"><div class="label">Scan Mode</div><div class="value">${n(t.scan_mode||"project")}</div></div>
      </div>
      ${(r=t.most_complex_functions)!=null&&r.length?`
        <h3 style="margin:1rem 0 0.5rem;font-size:0.85rem">Most Complex Functions</h3>
        <table><thead><tr><th>Function</th><th>File</th><th>Complexity</th><th>LOC</th></tr></thead>
        <tbody>${t.most_complex_functions.slice(0,10).map(a=>`
          <tr><td class="text-mono">${n(a.name)}</td><td class="text-sm text-muted">${n(a.file)}</td>
          <td>${a.complexity}</td><td>${a.loc}</td></tr>`).join("")}</tbody></table>
      `:""}
    `)}function ne(e,o){const t=o.clientWidth||800,r=400,a=Math.max(...e.map(d=>d.loc||1));let s=`<svg width="${t}" height="${r}" style="background:var(--surface)">`;const m=Math.ceil(Math.sqrt(e.length)),l=t/m,i=r/Math.ceil(e.length/m);e.forEach((d,g)=>{var R;const b=g%m,h=Math.floor(g/m),u=b*l+l/2,v=h*i+i/2,y=Math.max(8,Math.sqrt(d.loc/a)*Math.min(l,i)*.4),p=d.maintainability??50,A=`hsl(${Math.min(120,Math.max(0,p*1.2))}, 70%, 50%)`;s+=`<circle cx="${u}" cy="${v}" r="${y}" fill="${A}" fill-opacity="0.7" stroke="${A}" stroke-width="1"
      style="cursor:pointer" onclick="window.__drillDown('${n(d.path)}')" />`,s+=`<text x="${u}" y="${v+y+12}" text-anchor="middle" fill="var(--muted)" font-size="9">${n(((R=d.path)==null?void 0:R.split("/").pop())||"")}</text>`}),s+="</svg>",o.innerHTML=s}async function se(e){const o=document.getElementById("metrics-detail");if(!o)return;o.innerHTML='<p class="text-muted">Loading file analysis...</p>';const t=await c("/metrics/file?path="+encodeURIComponent(e));if(t.error){o.innerHTML=`<p style="color:var(--danger)">${n(t.error)}</p>`;return}o.innerHTML=`
    <h3 style="font-size:0.85rem;margin-bottom:0.5rem">${n(t.path)}</h3>
    <div class="metric-grid">
      <div class="metric-card"><div class="label">LOC</div><div class="value">${t.loc}</div></div>
      <div class="metric-card"><div class="label">Total Lines</div><div class="value">${t.total_lines}</div></div>
      <div class="metric-card"><div class="label">Classes</div><div class="value">${t.classes}</div></div>
      <div class="metric-card"><div class="label">Functions</div><div class="value">${(t.functions||[]).length}</div></div>
    </div>
    ${(t.functions||[]).length?`
      <table><thead><tr><th>Function</th><th>Line</th><th>Complexity</th><th>LOC</th><th>Args</th></tr></thead>
      <tbody>${t.functions.map(r=>`
        <tr><td class="text-mono">${n(r.name)}</td><td>${r.line}</td><td>${r.complexity}</td><td>${r.loc}</td><td class="text-sm text-muted">${(r.args||[]).join(", ")}</td></tr>
      `).join("")}</tbody></table>
    `:""}
    ${(t.warnings||[]).length?`
      <h3 style="margin:1rem 0 0.5rem;font-size:0.85rem;color:var(--warn)">Warnings</h3>
      ${t.warnings.map(r=>`<p class="text-sm" style="color:var(--warn)">Line ${r.line}: ${n(r.message)}</p>`).join("")}
    `:""}
  `}window.__loadMetrics=L,window.__loadFullMetrics=ae,window.__drillDown=se;let B="anthropic",x="";function ie(e){e.innerHTML=`
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
        <span class="text-sm text-muted" id="ai-status">${x?"Key set":"No key"}</span>
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
  `}async function de(){var a;const e=document.getElementById("chat-input"),o=(a=e==null?void 0:e.value)==null?void 0:a.trim();if(!o)return;e.value="";const t=document.getElementById("chat-messages");if(!t)return;t.innerHTML+=`<div class="chat-msg chat-user">${n(o)}</div>`,t.innerHTML+='<div class="chat-msg chat-bot" id="chat-loading" style="color:var(--muted)">Thinking...</div>',t.scrollTop=t.scrollHeight;const r={message:o,provider:B};x&&(r.api_key=x);try{const s=await c("/chat","POST",r),m=document.getElementById("chat-loading");m&&m.remove();let l=ue(s.reply||"No response");s.files_changed&&s.files_changed.length>0&&(l+='<div style="margin-top:0.5rem;padding:0.5rem;background:var(--bg);border-radius:0.375rem;border:1px solid var(--border)">',l+='<div class="text-sm" style="color:var(--success);font-weight:600;margin-bottom:0.25rem">Files changed:</div>',s.files_changed.forEach(i=>{l+=`<div class="text-sm text-mono">${n(i)}</div>`}),l+="</div>"),t.innerHTML+=`<div class="chat-msg chat-bot">${l}</div>`,t.innerHTML+=`<div class="text-sm text-muted" style="text-align:right;margin-bottom:0.25rem">${n(s.source||"")}</div>`,t.scrollTop=t.scrollHeight}catch{const s=document.getElementById("chat-loading");s&&(s.textContent="Error connecting",s.id="")}}async function le(){try{const e=await c("/chat/undo","POST"),o=document.getElementById("chat-messages");o&&(o.innerHTML+=`<div class="chat-msg chat-bot" style="color:var(--warn)">${n(e.message||"Undo complete")}</div>`,o.scrollTop=o.scrollHeight)}catch{alert("Nothing to undo")}}function ce(){const e=document.getElementById("ai-key");x=(e==null?void 0:e.value)||"";const o=document.getElementById("ai-status");o&&(o.textContent=x?"Key set":"No key")}function me(e){B=e}function ue(e){return e.replace(/```(\w*)\n([\s\S]*?)```/g,'<pre style="background:var(--bg);padding:0.5rem;border-radius:0.375rem;overflow-x:auto;margin:0.5rem 0;font-size:0.8rem"><code>$2</code></pre>').replace(/`([^`]+)`/g,'<code style="background:var(--bg);padding:0.1rem 0.25rem;border-radius:0.2rem;font-size:0.8em">$1</code>').replace(/\n/g,"<br>")}window.__sendChat=de,window.__undoChat=le,window.__setAiKey=ce,window.__setProvider=me;const H=document.createElement("style");H.textContent=q,document.head.appendChild(H);const P=F();N(P);const j=[{id:"chat",label:"Code With Me",render:ie},{id:"routes",label:"Routes",render:U},{id:"database",label:"Database",render:V},{id:"errors",label:"Errors",render:Y},{id:"metrics",label:"Metrics",render:re},{id:"system",label:"System",render:oe}];let T="chat";function pe(){const e=document.getElementById("app");if(!e)return;e.innerHTML=`
    <div class="dev-admin">
      <div class="dev-header">
        <h1><span>Tina4</span> Dev Admin</h1>
        <span class="text-sm text-muted">${P.name} &bull; v3.10</span>
      </div>
      <div class="dev-tabs" id="tab-bar"></div>
      <div class="dev-content" id="tab-content"></div>
    </div>
  `;const o=document.getElementById("tab-bar");o.innerHTML=j.map(t=>`<button class="dev-tab ${t.id===T?"active":""}" data-tab="${t.id}" onclick="window.__switchTab('${t.id}')">${t.label}</button>`).join(""),z(T)}function z(e){T=e,document.querySelectorAll(".dev-tab").forEach(a=>{a.classList.toggle("active",a.dataset.tab===e)});const o=document.getElementById("tab-content");if(!o)return;const t=document.createElement("div");t.className="dev-panel active",o.innerHTML="",o.appendChild(t);const r=j.find(a=>a.id===e);r&&r.render(t)}window.__switchTab=z,pe()})();
