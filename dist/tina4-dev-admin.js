(function(){"use strict";const B={python:{color:"#3b82f6",name:"Python"},php:{color:"#8b5cf6",name:"PHP"},ruby:{color:"#ef4444",name:"Ruby"},nodejs:{color:"#22c55e",name:"Node.js"}};function V(){const e=document.getElementById("app"),o=(e==null?void 0:e.dataset.framework)??"python",t=e==null?void 0:e.dataset.color,n=B[o]??B.python;return{framework:o,color:t??n.color,name:n.name}}function U(e){const o=document.documentElement;o.style.setProperty("--primary",e.color),o.style.setProperty("--bg","#0f172a"),o.style.setProperty("--surface","#1e293b"),o.style.setProperty("--border","#334155"),o.style.setProperty("--text","#e2e8f0"),o.style.setProperty("--muted","#94a3b8"),o.style.setProperty("--success","#22c55e"),o.style.setProperty("--danger","#ef4444"),o.style.setProperty("--warn","#f59e0b"),o.style.setProperty("--info","#3b82f6")}const K=`
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
`,W="/__dev/api";async function b(e,o="GET",t){const n={method:o,headers:{}};return t&&(n.headers["Content-Type"]="application/json",n.body=JSON.stringify(t)),(await fetch(W+e,n)).json()}function i(e){const o=document.createElement("span");return o.textContent=e,o.innerHTML}function G(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Routes <span id="routes-count" class="text-muted text-sm"></span></h2>
      <button class="btn btn-sm" onclick="window.__loadRoutes()">Refresh</button>
    </div>
    <table>
      <thead><tr><th>Method</th><th>Path</th><th>Auth</th><th>Handler</th></tr></thead>
      <tbody id="routes-body"></tbody>
    </table>
  `,z()}async function z(){const e=await b("/routes"),o=document.getElementById("routes-count");o&&(o.textContent=`(${e.count})`);const t=document.getElementById("routes-body");t&&(t.innerHTML=(e.routes||[]).map(n=>`
    <tr>
      <td><span class="method method-${n.method.toLowerCase()}">${i(n.method)}</span></td>
      <td class="text-mono"><a href="${i(n.path)}" target="_blank" style="color:inherit;text-decoration:underline dotted">${i(n.path)}</a></td>
      <td>${n.auth_required?'<span class="badge badge-warn">auth</span>':'<span class="badge badge-success">open</span>'}</td>
      <td class="text-sm text-muted">${i(n.handler||"")} <small>(${i(n.module||"")})</small></td>
    </tr>
  `).join(""))}window.__loadRoutes=z;let w=[],x=[],g=JSON.parse(localStorage.getItem("tina4_query_history")||"[]");function X(e){e.innerHTML=`
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
  `,M(),S()}async function M(){const o=(await b("/tables")).tables||[],t=document.getElementById("db-table-list");t&&(t.innerHTML=o.length?o.map(a=>`<div style="padding:0.3rem 0.5rem;cursor:pointer;border-radius:0.25rem;font-size:0.8rem;font-family:monospace" class="db-table-item" onclick="window.__selectTable('${i(a)}')" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background=''">${i(a)}</div>`).join(""):'<div class="text-sm text-muted">No tables</div>');const n=document.getElementById("db-seed-table");n&&(n.innerHTML='<option value="">Pick table...</option>'+o.map(a=>`<option value="${i(a)}">${i(a)}</option>`).join(""));const r=document.getElementById("paste-table");r&&(r.innerHTML='<option value="">Select table...</option>'+o.map(a=>`<option value="${i(a)}">${i(a)}</option>`).join(""))}function I(e){var t;(t=document.getElementById("db-limit"))!=null&&t.value;const o=document.getElementById("db-query");o&&(o.value=`SELECT * FROM ${e}`),document.querySelectorAll(".db-table-item").forEach(n=>{n.style.background=n.textContent===e?"var(--border)":""}),P()}function Y(){var t;const e=document.getElementById("db-query"),o=((t=document.getElementById("db-limit"))==null?void 0:t.value)||"20";e!=null&&e.value&&(e.value=e.value.replace(/LIMIT\s+\d+/i,`LIMIT ${o}`))}function Z(e){const o=e.trim();o&&(g=g.filter(t=>t!==o),g.unshift(o),g.length>50&&(g=g.slice(0,50)),localStorage.setItem("tina4_query_history",JSON.stringify(g)),S())}function S(){const e=document.getElementById("db-history");e&&(e.innerHTML='<option value="">Query history...</option>'+g.map((o,t)=>`<option value="${t}">${i(o.length>80?o.substring(0,80)+"...":o)}</option>`).join(""))}function ee(e){const o=parseInt(e);if(isNaN(o)||!g[o])return;const t=document.getElementById("db-query");t&&(t.value=g[o]),document.getElementById("db-history").selectedIndex=0}function te(){g=[],localStorage.removeItem("tina4_query_history"),S()}async function P(){var r,a,c;const e=document.getElementById("db-query"),o=(r=e==null?void 0:e.value)==null?void 0:r.trim();if(!o)return;Z(o);const t=document.getElementById("db-result"),n=((a=document.getElementById("db-type"))==null?void 0:a.value)||"sql";t&&(t.innerHTML='<p class="text-muted">Running...</p>');try{const u=parseInt(((c=document.getElementById("db-limit"))==null?void 0:c.value)||"20"),d=await b("/query","POST",{query:o,type:n,limit:u});if(d.error){t&&(t.innerHTML=`<p style="color:var(--danger)">${i(d.error)}</p>`);return}d.rows&&d.rows.length>0?(x=Object.keys(d.rows[0]),w=d.rows,t&&(t.innerHTML=`<p class="text-sm text-muted" style="margin-bottom:0.5rem">${d.count??d.rows.length} rows</p>
        <div style="overflow-x:auto"><table><thead><tr>${x.map(p=>`<th>${i(p)}</th>`).join("")}</tr></thead>
        <tbody>${d.rows.map(p=>`<tr>${x.map(f=>`<td class="text-sm">${i(String(p[f]??""))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`)):d.affected!==void 0?(t&&(t.innerHTML=`<p class="text-muted">${d.affected} rows affected. ${d.success?"Success.":""}</p>`),w=[],x=[]):(t&&(t.innerHTML='<p class="text-muted">No results</p>'),w=[],x=[])}catch(u){t&&(t.innerHTML=`<p style="color:var(--danger)">${i(u.message)}</p>`)}}function oe(){if(!w.length)return;const e=x.join(","),o=w.map(t=>x.map(n=>{const r=String(t[n]??"");return r.includes(",")||r.includes('"')?`"${r.replace(/"/g,'""')}"`:r}).join(","));navigator.clipboard.writeText([e,...o].join(`
`))}function ne(){w.length&&navigator.clipboard.writeText(JSON.stringify(w,null,2))}function re(){const e=document.getElementById("db-paste-modal");e&&(e.style.display="flex")}function j(){const e=document.getElementById("db-paste-modal");e&&(e.style.display="none")}async function ae(){var r,a,c,u,d;const e=(r=document.getElementById("paste-table"))==null?void 0:r.value,o=(c=(a=document.getElementById("paste-new-table"))==null?void 0:a.value)==null?void 0:c.trim(),t=o||e,n=(d=(u=document.getElementById("paste-data"))==null?void 0:u.value)==null?void 0:d.trim();if(!t||!n){alert("Select a table or enter a new table name, and paste data.");return}try{let p;try{p=JSON.parse(n),Array.isArray(p)||(p=[p])}catch{const v=n.split(`
`).map(s=>s.trim()).filter(Boolean);if(v.length<2){alert("CSV needs at least a header row and one data row.");return}const m=v[0].split(",").map(s=>s.trim().replace(/[^a-zA-Z0-9_]/g,""));p=v.slice(1).map(s=>{const y=s.split(",").map(h=>h.trim()),_={};return m.forEach((h,k)=>{_[h]=y[k]??""}),_})}if(!p.length){alert("No data rows found.");return}if(o){const m=["id INTEGER PRIMARY KEY AUTOINCREMENT",...Object.keys(p[0]).filter(y=>y.toLowerCase()!=="id").map(y=>`"${y}" TEXT`)],s=await b("/query","POST",{query:`CREATE TABLE IF NOT EXISTS "${o}" (${m.join(", ")})`,type:"sql"});if(s.error){alert("Create table failed: "+s.error);return}}let f=0;for(const v of p){const m=o?Object.keys(v).filter(h=>h.toLowerCase()!=="id"):Object.keys(v),s=m.map(h=>`"${h}"`).join(","),y=m.map(h=>`'${String(v[h]).replace(/'/g,"''")}'`).join(","),_=await b("/query","POST",{query:`INSERT INTO "${t}" (${s}) VALUES (${y})`,type:"sql"});if(_.error){alert(`Row ${f+1} failed: ${_.error}`);break}f++}document.getElementById("paste-data").value="",document.getElementById("paste-new-table").value="",document.getElementById("paste-table").selectedIndex=0,j(),M(),f>0&&I(t)}catch(p){alert("Import error: "+p.message)}}async function ie(){var t,n;const e=(t=document.getElementById("db-seed-table"))==null?void 0:t.value,o=parseInt(((n=document.getElementById("db-seed-count"))==null?void 0:n.value)||"10");if(e)try{const r=await b("/seed","POST",{table:e,count:o});r.error?alert(r.error):I(e)}catch(r){alert("Seed error: "+r.message)}}window.__loadTables=M,window.__selectTable=I,window.__updateLimit=Y,window.__runQuery=P,window.__copyCSV=oe,window.__copyJSON=ne,window.__showPaste=re,window.__hidePaste=j,window.__doPaste=ae,window.__seedTable=ie,window.__loadHistory=ee,window.__clearHistory=te;function se(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Errors <span id="errors-count" class="text-muted text-sm"></span></h2>
      <div class="flex gap-sm">
        <button class="btn btn-sm" onclick="window.__loadErrors()">Refresh</button>
        <button class="btn btn-sm btn-danger" onclick="window.__clearErrors()">Clear All</button>
      </div>
    </div>
    <div id="errors-body"></div>
  `,E()}async function E(){const e=await b("/broken"),o=document.getElementById("errors-count"),t=document.getElementById("errors-body");if(!t)return;const n=e.errors||[];if(o&&(o.textContent=`(${n.length})`),!n.length){t.innerHTML='<div class="empty-state">No errors</div>';return}t.innerHTML=n.map((r,a)=>`
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:0.75rem;margin-bottom:0.75rem">
      <div class="flex items-center" style="justify-content:space-between">
        <div>
          <span class="badge badge-danger">UNRESOLVED</span>
          <strong style="margin-left:0.5rem;font-size:0.85rem">${i(r.error||r.message||"Unknown error")}</strong>
        </div>
        <div class="flex gap-sm">
          <button class="btn btn-sm" onclick="window.__resolveError('${i(r.id||String(a))}')">Resolve</button>
          <button class="btn btn-sm btn-primary" onclick="window.__askAboutError(${a})">Ask Tina4</button>
        </div>
      </div>
      ${r.traceback?`<div class="error-trace">${i(r.traceback)}</div>`:""}
      <div class="text-sm text-muted" style="margin-top:0.5rem">${i(r.timestamp||"")}</div>
    </div>
  `).join(""),window.__errorData=n}async function de(e){await b("/broken/resolve","POST",{id:e}),E()}async function le(){await b("/broken/clear","POST"),E()}function ce(e){const t=(window.__errorData||[])[e];if(!t)return;const n=document.querySelector('[data-tab="chat"]');n&&n.click(),setTimeout(()=>{const r=document.getElementById("chat-input");r&&(r.value=`I have this error: ${t.error||t.message}

${t.traceback||""}`,r.focus())},100)}window.__loadErrors=E,window.__clearErrors=le,window.__resolveError=de,window.__askAboutError=ce;function me(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>System</h2>
      <button class="btn btn-sm" onclick="window.__loadSystem()">Refresh</button>
    </div>
    <div id="system-grid" class="metric-grid"></div>
  `,O()}async function O(){const e=await b("/system"),o=document.getElementById("system-grid");if(!o)return;const t=[{label:"Framework",value:e.framework||"Tina4"},{label:"Version",value:e.version||"?"},{label:"Runtime",value:e.runtime||e.python_version||e.php_version||e.ruby_version||e.node_version||"?"},{label:"Database",value:e.database||e.db_type||"none"},{label:"Uptime",value:e.uptime||"?"},{label:"Memory",value:e.memory||"?"},{label:"Platform",value:e.platform||"?"},{label:"Routes",value:String(e.route_count??e.routes??"?")},{label:"Debug",value:e.debug?"ON":"OFF"}];o.innerHTML=t.map(n=>`
    <div class="metric-card">
      <div class="label">${i(n.label)}</div>
      <div class="value" style="font-size:1.1rem">${i(n.value)}</div>
    </div>
  `).join("")}window.__loadSystem=O;function ue(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Code Metrics</h2>
      <div class="flex gap-sm">
        <button class="btn" onclick="window.__loadQuickMetrics()">Quick Scan</button>
        <button class="btn btn-primary" onclick="window.__loadFullMetrics()">Full Analysis</button>
      </div>
    </div>
    <div id="metrics-quick" class="metric-grid"></div>
    <div id="metrics-scan-info" class="text-sm text-muted" style="margin:0.5rem 0"></div>
    <div id="metrics-chart" style="display:none;margin:1rem 0"></div>
    <div id="metrics-complex" style="margin-top:1rem"></div>
    <div id="metrics-detail" style="margin-top:1rem"></div>
  `,N()}async function N(){const e=await b("/metrics"),o=document.getElementById("metrics-quick");!o||e.error||(o.innerHTML=[l("Files",e.file_count),l("Lines of Code",e.total_loc),l("Blank Lines",e.total_blank),l("Comments",e.total_comment),l("Classes",e.classes),l("Functions",e.functions),l("Routes",e.route_count),l("ORM Models",e.orm_count),l("Templates",e.template_count),l("Migrations",e.migration_count),l("Avg File Size",(e.avg_file_size??0)+" LOC")].join(""))}async function pe(){var a;const e=document.getElementById("metrics-chart"),o=document.getElementById("metrics-complex"),t=document.getElementById("metrics-scan-info");e&&(e.style.display="block",e.innerHTML='<p class="text-muted">Analyzing...</p>');const n=await b("/metrics/full");if(n.error||!n.file_metrics){e&&(e.innerHTML=`<p style="color:var(--danger)">${i(n.error||"No data")}</p>`);return}t&&(t.textContent=`${n.files_analyzed} files analyzed | ${n.total_functions} functions | Mode: ${n.scan_mode||"project"}`);const r=document.getElementById("metrics-quick");r&&(r.innerHTML=[l("Files Analyzed",n.files_analyzed),l("Total Functions",n.total_functions),l("Avg Complexity",n.avg_complexity),l("Avg Maintainability",n.avg_maintainability),l("Scan Mode",n.scan_mode||"project")].join("")),e&&n.file_metrics.length>0?be(n.file_metrics,e):e&&(e.innerHTML='<p class="text-muted">No files to visualize</p>'),o&&((a=n.most_complex_functions)!=null&&a.length)&&(o.innerHTML=`
      <h3 style="font-size:0.85rem;margin-bottom:0.5rem">Most Complex Functions</h3>
      <table>
        <thead><tr><th>Function</th><th>File</th><th>Line</th><th>Complexity</th><th>LOC</th></tr></thead>
        <tbody>${n.most_complex_functions.slice(0,15).map(c=>`
          <tr>
            <td class="text-mono">${i(c.name)}</td>
            <td class="text-sm text-muted" style="cursor:pointer;text-decoration:underline dotted" onclick="window.__drillDown('${i(c.file)}')">${i(c.file)}</td>
            <td>${c.line}</td>
            <td><span class="${c.complexity>10?"badge badge-danger":c.complexity>5?"badge badge-warn":"badge badge-success"}">${c.complexity}</span></td>
            <td>${c.loc}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    `)}function be(e,o){const t=o.clientWidth||900,n=Math.max(300,Math.min(500,e.length*15)),r=Math.max(...e.map(s=>s.loc||1)),a=10,c=40,u=[...e].sort((s,y)=>(s.maintainability??50)-(y.maintainability??50)),d=Math.ceil(Math.sqrt(u.length*(t/n))),p=Math.ceil(u.length/d),f=t/d,v=n/p;let m=`<svg width="${t}" height="${n}" style="background:var(--surface);border:1px solid var(--border);border-radius:0.5rem">`;u.forEach((s,y)=>{var J;const _=y%d,h=Math.floor(y/d),k=_*f+f/2,L=h*v+v/2,H=Math.max(a,Math.min(c,Math.sqrt(s.loc/r)*c)),$e=s.maintainability??50,Q=`hsl(${Math.min(120,Math.max(0,$e*1.2))}, 80%, 45%)`,T=((J=s.path)==null?void 0:J.split("/").pop())||"?";m+=`<circle cx="${k}" cy="${L}" r="${H}" fill="${Q}" fill-opacity="0.6" stroke="${Q}" stroke-width="1.5" style="cursor:pointer" onclick="window.__drillDown('${i(s.path)}')" />`,m+=`<title>${i(s.path)}
LOC: ${s.loc} | CC: ${s.avg_complexity} | MI: ${s.maintainability}</title>`,H>15&&(m+=`<text x="${k}" y="${L+3}" text-anchor="middle" fill="white" font-size="8" font-weight="600" style="pointer-events:none">${i(T.length>10?T.substring(0,8)+"..":T)}</text>`),m+=`<text x="${k}" y="${L+H+11}" text-anchor="middle" fill="var(--muted)" font-size="7" style="pointer-events:none">${i(T)}</text>`}),m+=`<rect x="${t-160}" y="8" width="150" height="50" rx="4" fill="var(--bg)" fill-opacity="0.8" stroke="var(--border)" />`,m+=`<circle cx="${t-145}" cy="22" r="5" fill="hsl(0, 80%, 45%)" /><text x="${t-135}" y="25" fill="var(--text)" font-size="8">Low maintainability</text>`,m+=`<circle cx="${t-145}" cy="36" r="5" fill="hsl(60, 80%, 45%)" /><text x="${t-135}" y="39" fill="var(--text)" font-size="8">Medium</text>`,m+=`<circle cx="${t-145}" cy="50" r="5" fill="hsl(120, 80%, 45%)" /><text x="${t-135}" y="53" fill="var(--text)" font-size="8">High maintainability</text>`,m+="</svg>",o.innerHTML=m}async function ye(e){const o=document.getElementById("metrics-detail");if(!o)return;o.innerHTML='<p class="text-muted">Loading file analysis...</p>';const t=await b("/metrics/file?path="+encodeURIComponent(e));if(t.error){o.innerHTML=`<p style="color:var(--danger)">${i(t.error)}</p>`;return}const n=t.functions||[],r=t.warnings||[];o.innerHTML=`
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:1rem">
      <div class="flex items-center" style="justify-content:space-between;margin-bottom:0.75rem">
        <h3 style="font-size:0.9rem">${i(t.path)}</h3>
        <button class="btn btn-sm" onclick="document.getElementById('metrics-detail').innerHTML=''">Close</button>
      </div>
      <div class="metric-grid" style="margin-bottom:0.75rem">
        ${l("LOC",t.loc)}
        ${l("Total Lines",t.total_lines)}
        ${l("Classes",t.classes)}
        ${l("Functions",n.length)}
      </div>
      ${n.length?`
        <table>
          <thead><tr><th>Function</th><th>Line</th><th>Complexity</th><th>LOC</th><th>Args</th></tr></thead>
          <tbody>${n.map(a=>`
            <tr>
              <td class="text-mono">${i(a.name)}</td>
              <td>${a.line}</td>
              <td><span class="${a.complexity>10?"badge badge-danger":a.complexity>5?"badge badge-warn":"badge badge-success"}">${a.complexity}</span></td>
              <td>${a.loc}</td>
              <td class="text-sm text-muted">${(a.args||[]).join(", ")}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      `:'<p class="text-muted">No functions</p>'}
      ${r.length?`
        <div style="margin-top:0.75rem">
          <h4 style="font-size:0.8rem;color:var(--warn);margin-bottom:0.25rem">Warnings</h4>
          ${r.map(a=>`<p class="text-sm" style="color:var(--warn)">Line ${a.line}: ${i(a.message)}</p>`).join("")}
        </div>
      `:""}
    </div>
  `}function l(e,o){return`<div class="metric-card"><div class="label">${i(e)}</div><div class="value">${i(String(o??0))}</div></div>`}window.__loadQuickMetrics=N,window.__loadFullMetrics=pe,window.__drillDown=ye;let R="anthropic",$="";function ge(e){e.innerHTML=`
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
        <span class="text-sm text-muted" id="ai-status">${$?"Key set":"No key"}</span>
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
  `}async function ve(){var r;const e=document.getElementById("chat-input"),o=(r=e==null?void 0:e.value)==null?void 0:r.trim();if(!o)return;e.value="";const t=document.getElementById("chat-messages");if(!t)return;t.innerHTML+=`<div class="chat-msg chat-user">${i(o)}</div>`,t.innerHTML+='<div class="chat-msg chat-bot" id="chat-loading" style="color:var(--muted)">Thinking...</div>',t.scrollTop=t.scrollHeight;const n={message:o,provider:R};$&&(n.api_key=$);try{const a=await b("/chat","POST",n),c=document.getElementById("chat-loading");c&&c.remove();let u=xe(a.reply||"No response");a.files_changed&&a.files_changed.length>0&&(u+='<div style="margin-top:0.5rem;padding:0.5rem;background:var(--bg);border-radius:0.375rem;border:1px solid var(--border)">',u+='<div class="text-sm" style="color:var(--success);font-weight:600;margin-bottom:0.25rem">Files changed:</div>',a.files_changed.forEach(d=>{u+=`<div class="text-sm text-mono">${i(d)}</div>`}),u+="</div>"),t.innerHTML+=`<div class="chat-msg chat-bot">${u}</div>`,t.innerHTML+=`<div class="text-sm text-muted" style="text-align:right;margin-bottom:0.25rem">${i(a.source||"")}</div>`,t.scrollTop=t.scrollHeight}catch{const a=document.getElementById("chat-loading");a&&(a.textContent="Error connecting",a.id="")}}async function he(){try{const e=await b("/chat/undo","POST"),o=document.getElementById("chat-messages");o&&(o.innerHTML+=`<div class="chat-msg chat-bot" style="color:var(--warn)">${i(e.message||"Undo complete")}</div>`,o.scrollTop=o.scrollHeight)}catch{alert("Nothing to undo")}}function fe(){const e=document.getElementById("ai-key");$=(e==null?void 0:e.value)||"";const o=document.getElementById("ai-status");o&&(o.textContent=$?"Key set":"No key")}function we(e){R=e}function xe(e){return e.replace(/```(\w*)\n([\s\S]*?)```/g,'<pre style="background:var(--bg);padding:0.5rem;border-radius:0.375rem;overflow-x:auto;margin:0.5rem 0;font-size:0.8rem"><code>$2</code></pre>').replace(/`([^`]+)`/g,'<code style="background:var(--bg);padding:0.1rem 0.25rem;border-radius:0.2rem;font-size:0.8em">$1</code>').replace(/\n/g,"<br>")}window.__sendChat=ve,window.__undoChat=he,window.__setAiKey=fe,window.__setProvider=we;const A=document.createElement("style");A.textContent=K,document.head.appendChild(A);const q=V();U(q);const F=[{id:"chat",label:"Code With Me",render:ge},{id:"routes",label:"Routes",render:G},{id:"database",label:"Database",render:X},{id:"errors",label:"Errors",render:se},{id:"metrics",label:"Metrics",render:ue},{id:"system",label:"System",render:me}];let C="chat";function _e(){const e=document.getElementById("app");if(!e)return;e.innerHTML=`
    <div class="dev-admin">
      <div class="dev-header">
        <h1><span>Tina4</span> Dev Admin</h1>
        <span class="text-sm text-muted">${q.name} &bull; v3.10</span>
      </div>
      <div class="dev-tabs" id="tab-bar"></div>
      <div class="dev-content" id="tab-content"></div>
    </div>
  `;const o=document.getElementById("tab-bar");o.innerHTML=F.map(t=>`<button class="dev-tab ${t.id===C?"active":""}" data-tab="${t.id}" onclick="window.__switchTab('${t.id}')">${t.label}</button>`).join(""),D(C)}function D(e){C=e,document.querySelectorAll(".dev-tab").forEach(r=>{r.classList.toggle("active",r.dataset.tab===e)});const o=document.getElementById("tab-content");if(!o)return;const t=document.createElement("div");t.className="dev-panel active",o.innerHTML="",o.appendChild(t);const n=F.find(r=>r.id===e);n&&n.render(t)}window.__switchTab=D,_e()})();
