(function(){"use strict";const M={python:{color:"#3b82f6",name:"Python"},php:{color:"#8b5cf6",name:"PHP"},ruby:{color:"#ef4444",name:"Ruby"},nodejs:{color:"#22c55e",name:"Node.js"}};function F(){const e=document.getElementById("app"),o=(e==null?void 0:e.dataset.framework)??"python",t=e==null?void 0:e.dataset.color,r=M[o]??M.python;return{framework:o,color:t??r.color,name:r.name}}function D(e){const o=document.documentElement;o.style.setProperty("--primary",e.color),o.style.setProperty("--bg","#0f172a"),o.style.setProperty("--surface","#1e293b"),o.style.setProperty("--border","#334155"),o.style.setProperty("--text","#e2e8f0"),o.style.setProperty("--muted","#94a3b8"),o.style.setProperty("--success","#22c55e"),o.style.setProperty("--danger","#ef4444"),o.style.setProperty("--warn","#f59e0b"),o.style.setProperty("--info","#3b82f6")}const J=`
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
`,V="/__dev/api";async function c(e,o="GET",t){const r={method:o,headers:{}};return t&&(r.headers["Content-Type"]="application/json",r.body=JSON.stringify(t)),(await fetch(V+e,r)).json()}function a(e){const o=document.createElement("span");return o.textContent=e,o.innerHTML}function Q(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Routes <span id="routes-count" class="text-muted text-sm"></span></h2>
      <button class="btn btn-sm" onclick="window.__loadRoutes()">Refresh</button>
    </div>
    <table>
      <thead><tr><th>Method</th><th>Path</th><th>Auth</th><th>Handler</th></tr></thead>
      <tbody id="routes-body"></tbody>
    </table>
  `,I()}async function I(){const e=await c("/routes"),o=document.getElementById("routes-count");o&&(o.textContent=`(${e.count})`);const t=document.getElementById("routes-body");t&&(t.innerHTML=(e.routes||[]).map(r=>`
    <tr>
      <td><span class="method method-${r.method.toLowerCase()}">${a(r.method)}</span></td>
      <td class="text-mono"><a href="${a(r.path)}" target="_blank" style="color:inherit;text-decoration:underline dotted">${a(r.path)}</a></td>
      <td>${r.auth_required?'<span class="badge badge-warn">auth</span>':'<span class="badge badge-success">open</span>'}</td>
      <td class="text-sm text-muted">${a(r.handler||"")} <small>(${a(r.module||"")})</small></td>
    </tr>
  `).join(""))}window.__loadRoutes=I;let w=[],x=[],p=JSON.parse(localStorage.getItem("tina4_query_history")||"[]");function U(e){e.innerHTML=`
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
        <div class="flex gap-sm items-center" style="margin-bottom:0.25rem">
          <select id="db-history" class="input text-mono" style="flex:1" onchange="window.__loadHistory(this.value)">
            <option value="">Query history...</option>
          </select>
          <button class="btn btn-sm" onclick="window.__clearHistory()" title="Clear history" style="height:30px">Clear</button>
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
        <textarea id="paste-data" class="input text-mono" style="width:100%;height:200px" placeholder='CSV data or JSON'></textarea>
        <div class="flex gap-sm" style="margin-top:0.75rem;justify-content:flex-end">
          <button class="btn" onclick="window.__hidePaste()">Cancel</button>
          <button class="btn btn-primary" onclick="window.__doPaste()">Import</button>
        </div>
      </div>
    </div>
  `,k(),E()}async function k(){const o=(await c("/tables")).tables||[],t=document.getElementById("db-table-list");t&&(t.innerHTML=o.length?o.map(i=>`<div style="padding:0.3rem 0.5rem;cursor:pointer;border-radius:0.25rem;font-size:0.8rem;font-family:monospace" class="db-table-item" onclick="window.__selectTable('${a(i)}')" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background=''">${a(i)}</div>`).join(""):'<div class="text-sm text-muted">No tables</div>');const r=document.getElementById("db-seed-table");r&&(r.innerHTML='<option value="">Pick table...</option>'+o.map(i=>`<option value="${a(i)}">${a(i)}</option>`).join(""));const n=document.getElementById("paste-table");n&&(n.innerHTML='<option value="">Select table...</option>'+o.map(i=>`<option value="${a(i)}">${a(i)}</option>`).join(""))}function T(e){var t;(t=document.getElementById("db-limit"))!=null&&t.value;const o=document.getElementById("db-query");o&&(o.value=`SELECT * FROM ${e}`),document.querySelectorAll(".db-table-item").forEach(r=>{r.style.background=r.textContent===e?"var(--border)":""}),C()}function K(){var t;const e=document.getElementById("db-query"),o=((t=document.getElementById("db-limit"))==null?void 0:t.value)||"20";e!=null&&e.value&&(e.value=e.value.replace(/LIMIT\s+\d+/i,`LIMIT ${o}`))}function W(e){const o=e.trim();o&&(p=p.filter(t=>t!==o),p.unshift(o),p.length>50&&(p=p.slice(0,50)),localStorage.setItem("tina4_query_history",JSON.stringify(p)),E())}function E(){const e=document.getElementById("db-history");e&&(e.innerHTML='<option value="">Query history...</option>'+p.map((o,t)=>`<option value="${t}">${a(o.length>80?o.substring(0,80)+"...":o)}</option>`).join(""))}function G(e){const o=parseInt(e);if(isNaN(o)||!p[o])return;const t=document.getElementById("db-query");t&&(t.value=p[o]),document.getElementById("db-history").selectedIndex=0}function X(){p=[],localStorage.removeItem("tina4_query_history"),E()}async function C(){var n,i,m;const e=document.getElementById("db-query"),o=(n=e==null?void 0:e.value)==null?void 0:n.trim();if(!o)return;W(o);const t=document.getElementById("db-result"),r=((i=document.getElementById("db-type"))==null?void 0:i.value)||"sql";t&&(t.innerHTML='<p class="text-muted">Running...</p>');try{const l=parseInt(((m=document.getElementById("db-limit"))==null?void 0:m.value)||"20"),s=await c("/query","POST",{query:o,type:r,limit:l});if(s.error){t&&(t.innerHTML=`<p style="color:var(--danger)">${a(s.error)}</p>`);return}s.rows&&s.rows.length>0?(x=Object.keys(s.rows[0]),w=s.rows,t&&(t.innerHTML=`<p class="text-sm text-muted" style="margin-bottom:0.5rem">${s.count??s.rows.length} rows</p>
        <div style="overflow-x:auto"><table><thead><tr>${x.map(d=>`<th>${a(d)}</th>`).join("")}</tr></thead>
        <tbody>${s.rows.map(d=>`<tr>${x.map(g=>`<td class="text-sm">${a(String(d[g]??""))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`)):s.affected!==void 0?(t&&(t.innerHTML=`<p class="text-muted">${s.affected} rows affected. ${s.success?"Success.":""}</p>`),w=[],x=[]):(t&&(t.innerHTML='<p class="text-muted">No results</p>'),w=[],x=[])}catch(l){t&&(t.innerHTML=`<p style="color:var(--danger)">${a(l.message)}</p>`)}}function Y(){if(!w.length)return;const e=x.join(","),o=w.map(t=>x.map(r=>{const n=String(t[r]??"");return n.includes(",")||n.includes('"')?`"${n.replace(/"/g,'""')}"`:n}).join(","));navigator.clipboard.writeText([e,...o].join(`
`))}function Z(){w.length&&navigator.clipboard.writeText(JSON.stringify(w,null,2))}function ee(){const e=document.getElementById("db-paste-modal");e&&(e.style.display="flex")}function L(){const e=document.getElementById("db-paste-modal");e&&(e.style.display="none")}async function te(){var n,i,m,l,s;const e=(n=document.getElementById("paste-table"))==null?void 0:n.value,o=(m=(i=document.getElementById("paste-new-table"))==null?void 0:i.value)==null?void 0:m.trim(),t=o||e,r=(s=(l=document.getElementById("paste-data"))==null?void 0:l.value)==null?void 0:s.trim();if(!t||!r){alert("Select a table or enter a new table name, and paste data.");return}try{let d;try{d=JSON.parse(r),Array.isArray(d)||(d=[d])}catch{const v=r.split(`
`).map(u=>u.trim()).filter(Boolean);if(v.length<2){alert("CSV needs at least a header row and one data row.");return}const h=v[0].split(",").map(u=>u.trim().replace(/[^a-zA-Z0-9_]/g,""));d=v.slice(1).map(u=>{const y=u.split(",").map(b=>b.trim()),f={};return h.forEach((b,N)=>{f[b]=y[N]??""}),f})}if(!d.length){alert("No data rows found.");return}if(o){const h=["id INTEGER PRIMARY KEY AUTOINCREMENT",...Object.keys(d[0]).filter(y=>y.toLowerCase()!=="id").map(y=>`"${y}" TEXT`)],u=await c("/query","POST",{query:`CREATE TABLE IF NOT EXISTS "${o}" (${h.join(", ")})`,type:"sql"});if(u.error){alert("Create table failed: "+u.error);return}}let g=0;for(const v of d){const h=o?Object.keys(v).filter(b=>b.toLowerCase()!=="id"):Object.keys(v),u=h.map(b=>`"${b}"`).join(","),y=h.map(b=>`'${String(v[b]).replace(/'/g,"''")}'`).join(","),f=await c("/query","POST",{query:`INSERT INTO "${t}" (${u}) VALUES (${y})`,type:"sql"});if(f.error){alert(`Row ${g+1} failed: ${f.error}`);break}g++}document.getElementById("paste-data").value="",document.getElementById("paste-new-table").value="",document.getElementById("paste-table").selectedIndex=0,L(),k(),g>0&&T(t)}catch(d){alert("Import error: "+d.message)}}async function oe(){var t,r;const e=(t=document.getElementById("db-seed-table"))==null?void 0:t.value,o=parseInt(((r=document.getElementById("db-seed-count"))==null?void 0:r.value)||"10");if(e)try{const n=await c("/seed","POST",{table:e,count:o});n.error?alert(n.error):T(e)}catch(n){alert("Seed error: "+n.message)}}window.__loadTables=k,window.__selectTable=T,window.__updateLimit=K,window.__runQuery=C,window.__copyCSV=Y,window.__copyJSON=Z,window.__showPaste=ee,window.__hidePaste=L,window.__doPaste=te,window.__seedTable=oe,window.__loadHistory=G,window.__clearHistory=X;function re(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Errors <span id="errors-count" class="text-muted text-sm"></span></h2>
      <div class="flex gap-sm">
        <button class="btn btn-sm" onclick="window.__loadErrors()">Refresh</button>
        <button class="btn btn-sm btn-danger" onclick="window.__clearErrors()">Clear All</button>
      </div>
    </div>
    <div id="errors-body"></div>
  `,$()}async function $(){const e=await c("/broken"),o=document.getElementById("errors-count"),t=document.getElementById("errors-body");if(!t)return;const r=e.errors||[];if(o&&(o.textContent=`(${r.length})`),!r.length){t.innerHTML='<div class="empty-state">No errors</div>';return}t.innerHTML=r.map((n,i)=>`
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:0.75rem;margin-bottom:0.75rem">
      <div class="flex items-center" style="justify-content:space-between">
        <div>
          <span class="badge badge-danger">UNRESOLVED</span>
          <strong style="margin-left:0.5rem;font-size:0.85rem">${a(n.error||n.message||"Unknown error")}</strong>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-sm" onclick="window.__resolveError('${a(n.id||String(i))}')">Resolve</button>
          <button class="btn btn-sm btn-primary" onclick="window.__askAboutError(${i})">Ask Tina4</button>
        </div>
      </div>
      ${n.traceback?`<div class="error-trace">${a(n.traceback)}</div>`:""}
      <div class="text-sm text-muted" style="margin-top:0.5rem">${a(n.timestamp||"")}</div>
    </div>
  `).join(""),window.__errorData=r}async function ne(e){await c("/broken/resolve","POST",{id:e}),$()}async function ae(){await c("/broken/clear","POST"),$()}function ie(e){const t=(window.__errorData||[])[e];if(!t)return;const r=document.querySelector('[data-tab="chat"]');r&&r.click(),setTimeout(()=>{const n=document.getElementById("chat-input");n&&(n.value=`I have this error: ${t.error||t.message}

${t.traceback||""}`,n.focus())},100)}window.__loadErrors=$,window.__clearErrors=ae,window.__resolveError=ne,window.__askAboutError=ie;function se(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>System</h2>
      <button class="btn btn-sm" onclick="window.__loadSystem()">Refresh</button>
    </div>
    <div id="system-grid" class="metric-grid"></div>
  `,H()}async function H(){const e=await c("/system"),o=document.getElementById("system-grid");if(!o)return;const t=[{label:"Framework",value:e.framework||"Tina4"},{label:"Version",value:e.version||"?"},{label:"Runtime",value:e.runtime||e.python_version||e.php_version||e.ruby_version||e.node_version||"?"},{label:"Database",value:e.database||e.db_type||"none"},{label:"Uptime",value:e.uptime||"?"},{label:"Memory",value:e.memory||"?"},{label:"Platform",value:e.platform||"?"},{label:"Routes",value:String(e.route_count??e.routes??"?")},{label:"Debug",value:e.debug?"ON":"OFF"}];o.innerHTML=t.map(r=>`
    <div class="metric-card">
      <div class="label">${a(r.label)}</div>
      <div class="value" style="font-size:1.1rem">${a(r.value)}</div>
    </div>
  `).join("")}window.__loadSystem=H;function de(e){e.innerHTML=`
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
  `,B()}async function B(){const e=await c("/metrics"),o=document.getElementById("metrics-quick");if(!o||e.error)return;const t=[{label:"Files",value:String(e.file_count??0)},{label:"Lines of Code",value:String(e.total_loc??0)},{label:"Classes",value:String(e.classes??0)},{label:"Functions",value:String(e.functions??0)},{label:"Routes",value:String(e.route_count??0)},{label:"Templates",value:String(e.template_count??0)},{label:"Migrations",value:String(e.migration_count??0)},{label:"Avg File Size",value:String(e.avg_file_size??0)+" LOC"}];o.innerHTML=t.map(r=>`
    <div class="metric-card">
      <div class="label">${a(r.label)}</div>
      <div class="value">${a(r.value)}</div>
    </div>
  `).join("")}async function le(){var r;const e=document.getElementById("metrics-chart"),o=document.getElementById("metrics-detail");e&&(e.style.display="block",e.innerHTML='<p class="text-muted" style="padding:1rem">Analyzing...</p>');const t=await c("/metrics/full");if(t.error||!t.file_metrics){e&&(e.innerHTML=`<p style="color:var(--danger);padding:1rem">${a(t.error||"No data")}</p>`);return}ce(t.file_metrics,e),o&&(o.innerHTML=`
      <div class="metric-grid">
        <div class="metric-card"><div class="label">Files Analyzed</div><div class="value">${t.files_analyzed}</div></div>
        <div class="metric-card"><div class="label">Total Functions</div><div class="value">${t.total_functions}</div></div>
        <div class="metric-card"><div class="label">Avg Complexity</div><div class="value">${t.avg_complexity}</div></div>
        <div class="metric-card"><div class="label">Avg Maintainability</div><div class="value">${t.avg_maintainability}</div></div>
        <div class="metric-card"><div class="label">Scan Mode</div><div class="value">${a(t.scan_mode||"project")}</div></div>
      </div>
      ${(r=t.most_complex_functions)!=null&&r.length?`
        <h3 style="margin:1rem 0 0.5rem;font-size:0.85rem">Most Complex Functions</h3>
        <table><thead><tr><th>Function</th><th>File</th><th>Complexity</th><th>LOC</th></tr></thead>
        <tbody>${t.most_complex_functions.slice(0,10).map(n=>`
          <tr><td class="text-mono">${a(n.name)}</td><td class="text-sm text-muted">${a(n.file)}</td>
          <td>${n.complexity}</td><td>${n.loc}</td></tr>`).join("")}</tbody></table>
      `:""}
    `)}function ce(e,o){const t=o.clientWidth||800,r=400,n=Math.max(...e.map(d=>d.loc||1));let i=`<svg width="${t}" height="${r}" style="background:var(--surface)">`;const m=Math.ceil(Math.sqrt(e.length)),l=t/m,s=r/Math.ceil(e.length/m);e.forEach((d,g)=>{var q;const v=g%m,h=Math.floor(g/m),u=v*l+l/2,y=h*s+s/2,f=Math.max(8,Math.sqrt(d.loc/n)*Math.min(l,s)*.4),b=d.maintainability??50,R=`hsl(${Math.min(120,Math.max(0,b*1.2))}, 70%, 50%)`;i+=`<circle cx="${u}" cy="${y}" r="${f}" fill="${R}" fill-opacity="0.7" stroke="${R}" stroke-width="1"
      style="cursor:pointer" onclick="window.__drillDown('${a(d.path)}')" />`,i+=`<text x="${u}" y="${y+f+12}" text-anchor="middle" fill="var(--muted)" font-size="9">${a(((q=d.path)==null?void 0:q.split("/").pop())||"")}</text>`}),i+="</svg>",o.innerHTML=i}async function me(e){const o=document.getElementById("metrics-detail");if(!o)return;o.innerHTML='<p class="text-muted">Loading file analysis...</p>';const t=await c("/metrics/file?path="+encodeURIComponent(e));if(t.error){o.innerHTML=`<p style="color:var(--danger)">${a(t.error)}</p>`;return}o.innerHTML=`
    <h3 style="font-size:0.85rem;margin-bottom:0.5rem">${a(t.path)}</h3>
    <div class="metric-grid">
      <div class="metric-card"><div class="label">LOC</div><div class="value">${t.loc}</div></div>
      <div class="metric-card"><div class="label">Total Lines</div><div class="value">${t.total_lines}</div></div>
      <div class="metric-card"><div class="label">Classes</div><div class="value">${t.classes}</div></div>
      <div class="metric-card"><div class="label">Functions</div><div class="value">${(t.functions||[]).length}</div></div>
    </div>
    ${(t.functions||[]).length?`
      <table><thead><tr><th>Function</th><th>Line</th><th>Complexity</th><th>LOC</th><th>Args</th></tr></thead>
      <tbody>${t.functions.map(r=>`
        <tr><td class="text-mono">${a(r.name)}</td><td>${r.line}</td><td>${r.complexity}</td><td>${r.loc}</td><td class="text-sm text-muted">${(r.args||[]).join(", ")}</td></tr>
      `).join("")}</tbody></table>
    `:""}
    ${(t.warnings||[]).length?`
      <h3 style="margin:1rem 0 0.5rem;font-size:0.85rem;color:var(--warn)">Warnings</h3>
      ${t.warnings.map(r=>`<p class="text-sm" style="color:var(--warn)">Line ${r.line}: ${a(r.message)}</p>`).join("")}
    `:""}
  `}window.__loadMetrics=B,window.__loadFullMetrics=le,window.__drillDown=me;let P="anthropic",_="";function ue(e){e.innerHTML=`
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
        <span class="text-sm text-muted" id="ai-status">${_?"Key set":"No key"}</span>
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
  `}async function pe(){var n;const e=document.getElementById("chat-input"),o=(n=e==null?void 0:e.value)==null?void 0:n.trim();if(!o)return;e.value="";const t=document.getElementById("chat-messages");if(!t)return;t.innerHTML+=`<div class="chat-msg chat-user">${a(o)}</div>`,t.innerHTML+='<div class="chat-msg chat-bot" id="chat-loading" style="color:var(--muted)">Thinking...</div>',t.scrollTop=t.scrollHeight;const r={message:o,provider:P};_&&(r.api_key=_);try{const i=await c("/chat","POST",r),m=document.getElementById("chat-loading");m&&m.remove();let l=ge(i.reply||"No response");i.files_changed&&i.files_changed.length>0&&(l+='<div style="margin-top:0.5rem;padding:0.5rem;background:var(--bg);border-radius:0.375rem;border:1px solid var(--border)">',l+='<div class="text-sm" style="color:var(--success);font-weight:600;margin-bottom:0.25rem">Files changed:</div>',i.files_changed.forEach(s=>{l+=`<div class="text-sm text-mono">${a(s)}</div>`}),l+="</div>"),t.innerHTML+=`<div class="chat-msg chat-bot">${l}</div>`,t.innerHTML+=`<div class="text-sm text-muted" style="text-align:right;margin-bottom:0.25rem">${a(i.source||"")}</div>`,t.scrollTop=t.scrollHeight}catch{const i=document.getElementById("chat-loading");i&&(i.textContent="Error connecting",i.id="")}}async function be(){try{const e=await c("/chat/undo","POST"),o=document.getElementById("chat-messages");o&&(o.innerHTML+=`<div class="chat-msg chat-bot" style="color:var(--warn)">${a(e.message||"Undo complete")}</div>`,o.scrollTop=o.scrollHeight)}catch{alert("Nothing to undo")}}function ve(){const e=document.getElementById("ai-key");_=(e==null?void 0:e.value)||"";const o=document.getElementById("ai-status");o&&(o.textContent=_?"Key set":"No key")}function ye(e){P=e}function ge(e){return e.replace(/```(\w*)\n([\s\S]*?)```/g,'<pre style="background:var(--bg);padding:0.5rem;border-radius:0.375rem;overflow-x:auto;margin:0.5rem 0;font-size:0.8rem"><code>$2</code></pre>').replace(/`([^`]+)`/g,'<code style="background:var(--bg);padding:0.1rem 0.25rem;border-radius:0.2rem;font-size:0.8em">$1</code>').replace(/\n/g,"<br>")}window.__sendChat=pe,window.__undoChat=be,window.__setAiKey=ve,window.__setProvider=ye;const O=document.createElement("style");O.textContent=J,document.head.appendChild(O);const j=F();D(j);const z=[{id:"chat",label:"Code With Me",render:ue},{id:"routes",label:"Routes",render:Q},{id:"database",label:"Database",render:U},{id:"errors",label:"Errors",render:re},{id:"metrics",label:"Metrics",render:de},{id:"system",label:"System",render:se}];let S="chat";function he(){const e=document.getElementById("app");if(!e)return;e.innerHTML=`
    <div class="dev-admin">
      <div class="dev-header">
        <h1><span>Tina4</span> Dev Admin</h1>
        <span class="text-sm text-muted">${j.name} &bull; v3.10</span>
      </div>
      <div class="dev-tabs" id="tab-bar"></div>
      <div class="dev-content" id="tab-content"></div>
    </div>
  `;const o=document.getElementById("tab-bar");o.innerHTML=z.map(t=>`<button class="dev-tab ${t.id===S?"active":""}" data-tab="${t.id}" onclick="window.__switchTab('${t.id}')">${t.label}</button>`).join(""),A(S)}function A(e){S=e,document.querySelectorAll(".dev-tab").forEach(n=>{n.classList.toggle("active",n.dataset.tab===e)});const o=document.getElementById("tab-content");if(!o)return;const t=document.createElement("div");t.className="dev-panel active",o.innerHTML="",o.appendChild(t);const r=z.find(n=>n.id===e);r&&r.render(t)}window.__switchTab=A,he()})();
