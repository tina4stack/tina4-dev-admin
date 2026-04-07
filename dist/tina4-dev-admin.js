(function(){"use strict";var Ke;const je={python:{color:"#3b82f6",name:"Python"},php:{color:"#8b5cf6",name:"PHP"},ruby:{color:"#ef4444",name:"Ruby"},nodejs:{color:"#22c55e",name:"Node.js"}};function lt(){const e=document.getElementById("app"),t=(e==null?void 0:e.dataset.framework)??"python",n=e==null?void 0:e.dataset.color,i=je[t]??je.python;return{framework:t,color:n??i.color,name:i.name}}function dt(e){const t=document.documentElement;t.style.setProperty("--primary",e.color),t.style.setProperty("--bg","#0f172a"),t.style.setProperty("--surface","#1e293b"),t.style.setProperty("--border","#334155"),t.style.setProperty("--text","#e2e8f0"),t.style.setProperty("--muted","#94a3b8"),t.style.setProperty("--success","#22c55e"),t.style.setProperty("--danger","#ef4444"),t.style.setProperty("--warn","#f59e0b"),t.style.setProperty("--info","#3b82f6")}const ct=`
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
input[type=number].input { -moz-appearance: textfield; }
input[type=number].input::-webkit-outer-spin-button, input[type=number].input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
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
.chat-msg { padding: 0.5rem 0.75rem; border-radius: 0.5rem; margin-bottom: 0.25rem; font-size: 0.85rem; line-height: 1.5; max-width: 85%; }
.chat-user { background: var(--primary); color: white; margin-left: auto; font-size: 0.8rem; padding: 0.35rem 0.65rem; max-width: 60%; border-radius: 0.5rem 0.5rem 0.15rem 0.5rem; }
.chat-bot { background: var(--surface); border: 1px solid var(--border); margin-bottom: 0.15rem; }
.chat-input-row { display: flex; gap: 0.5rem; padding: 0.75rem; border-top: 1px solid var(--border); }
.chat-input-row input { flex: 1; }

.error-trace { background: var(--bg); border: 1px solid var(--border); border-radius: 0.375rem; padding: 0.5rem; font-family: monospace; font-size: 0.75rem; white-space: pre-wrap; max-height: 200px; overflow-y: auto; margin-top: 0.5rem; }

.bubble-chart { width: 100%; height: 400px; background: var(--surface); border: 1px solid var(--border); border-radius: 0.5rem; overflow: hidden; }
`,mt="/__dev/api";async function q(e,t="GET",n){const i={method:t,headers:{}};return n&&(i.headers["Content-Type"]="application/json",i.body=JSON.stringify(n)),(await fetch(mt+e,i)).json()}function c(e){const t=document.createElement("span");return t.textContent=e,t.innerHTML}function ut(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Routes <span id="routes-count" class="text-muted text-sm"></span></h2>
      <button class="btn btn-sm" onclick="window.__loadRoutes()">Refresh</button>
    </div>
    <table>
      <thead><tr><th>Method</th><th>Path</th><th>Auth</th><th>Handler</th></tr></thead>
      <tbody id="routes-body"></tbody>
    </table>
  `,Pe()}async function Pe(){const e=await q("/routes"),t=document.getElementById("routes-count");t&&(t.textContent=`(${e.count})`);const n=document.getElementById("routes-body");n&&(n.innerHTML=(e.routes||[]).map(i=>`
    <tr>
      <td><span class="method method-${i.method.toLowerCase()}">${c(i.method)}</span></td>
      <td class="text-mono"><a href="${c(i.path)}" target="_blank" style="color:inherit;text-decoration:underline dotted">${c(i.path)}</a></td>
      <td>${i.auth_required?'<span class="badge badge-warn">auth</span>':'<span class="badge badge-success">open</span>'}</td>
      <td class="text-sm text-muted">${c(i.handler||"")} <small>(${c(i.module||"")})</small></td>
    </tr>
  `).join(""))}window.__loadRoutes=Pe;let W=[],J=[],j=JSON.parse(localStorage.getItem("tina4_query_history")||"[]");function pt(e){e.innerHTML=`
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
          <input type="number" id="db-offset" class="input" value="0" min="0" style="width:70px;height:30px;-moz-appearance:textfield;-webkit-appearance:none;margin:0">
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
  `,he(),ye()}async function he(){const t=(await q("/tables")).tables||[],n=document.getElementById("db-table-list");n&&(n.innerHTML=t.length?t.map(s=>`<div style="padding:0.3rem 0.5rem;cursor:pointer;border-radius:0.25rem;font-size:0.8rem;font-family:monospace" class="db-table-item" onclick="window.__selectTable('${c(s)}')" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background=''">${c(s)}</div>`).join(""):'<div class="text-sm text-muted">No tables</div>');const i=document.getElementById("db-seed-table");i&&(i.innerHTML='<option value="">Pick table...</option>'+t.map(s=>`<option value="${c(s)}">${c(s)}</option>`).join(""));const o=document.getElementById("paste-table");o&&(o.innerHTML='<option value="">Select table...</option>'+t.map(s=>`<option value="${c(s)}">${c(s)}</option>`).join(""))}function fe(e){var n;(n=document.getElementById("db-limit"))!=null&&n.value;const t=document.getElementById("db-query");t&&(t.value=`SELECT * FROM ${e}`),document.querySelectorAll(".db-table-item").forEach(i=>{i.style.background=i.textContent===e?"var(--border)":""}),Oe()}function gt(){var n;const e=document.getElementById("db-query"),t=((n=document.getElementById("db-limit"))==null?void 0:n.value)||"20";e!=null&&e.value&&(e.value=e.value.replace(/LIMIT\s+\d+/i,`LIMIT ${t}`))}function bt(e){const t=e.trim();t&&(j=j.filter(n=>n!==t),j.unshift(t),j.length>50&&(j=j.slice(0,50)),localStorage.setItem("tina4_query_history",JSON.stringify(j)),ye())}function ye(){const e=document.getElementById("db-history");e&&(e.innerHTML='<option value="">Query history...</option>'+j.map((t,n)=>`<option value="${n}">${c(t.length>80?t.substring(0,80)+"...":t)}</option>`).join(""))}function ht(e){const t=parseInt(e);if(isNaN(t)||!j[t])return;const n=document.getElementById("db-query");n&&(n.value=j[t]),document.getElementById("db-history").selectedIndex=0}function ft(){j=[],localStorage.removeItem("tina4_query_history"),ye()}async function Oe(){var o,s,d;const e=document.getElementById("db-query"),t=(o=e==null?void 0:e.value)==null?void 0:o.trim();if(!t)return;bt(t);const n=document.getElementById("db-result"),i=((s=document.getElementById("db-type"))==null?void 0:s.value)||"sql";n&&(n.innerHTML='<p class="text-muted">Running...</p>');try{const a=parseInt(((d=document.getElementById("db-limit"))==null?void 0:d.value)||"20"),m=await q("/query","POST",{query:t,type:i,limit:a});if(m.error){n&&(n.innerHTML=`<p style="color:var(--danger)">${c(m.error)}</p>`);return}m.rows&&m.rows.length>0?(J=Object.keys(m.rows[0]),W=m.rows,n&&(n.innerHTML=`<p class="text-sm text-muted" style="margin-bottom:0.5rem">${m.count??m.rows.length} rows</p>
        <div style="overflow-x:auto"><table><thead><tr>${J.map(u=>`<th>${c(u)}</th>`).join("")}</tr></thead>
        <tbody>${m.rows.map(u=>`<tr>${J.map(w=>`<td class="text-sm">${c(String(u[w]??""))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`)):m.affected!==void 0?(n&&(n.innerHTML=`<p class="text-muted">${m.affected} rows affected. ${m.success?"Success.":""}</p>`),W=[],J=[]):(n&&(n.innerHTML='<p class="text-muted">No results</p>'),W=[],J=[])}catch(a){n&&(n.innerHTML=`<p style="color:var(--danger)">${c(a.message)}</p>`)}}function yt(){if(!W.length)return;const e=J.join(","),t=W.map(n=>J.map(i=>{const o=String(n[i]??"");return o.includes(",")||o.includes('"')?`"${o.replace(/"/g,'""')}"`:o}).join(","));navigator.clipboard.writeText([e,...t].join(`
`))}function vt(){W.length&&navigator.clipboard.writeText(JSON.stringify(W,null,2))}function xt(){const e=document.getElementById("db-paste-modal");e&&(e.style.display="flex")}function Re(){const e=document.getElementById("db-paste-modal");e&&(e.style.display="none")}async function wt(){var o,s,d,a,m;const e=(o=document.getElementById("paste-table"))==null?void 0:o.value,t=(d=(s=document.getElementById("paste-new-table"))==null?void 0:s.value)==null?void 0:d.trim(),n=t||e,i=(m=(a=document.getElementById("paste-data"))==null?void 0:a.value)==null?void 0:m.trim();if(!n||!i){alert("Select a table or enter a new table name, and paste data.");return}try{let u;try{u=JSON.parse(i),Array.isArray(u)||(u=[u])}catch{const S=i.split(`
`).map(E=>E.trim()).filter(Boolean);if(S.length<2){alert("CSV needs at least a header row and one data row.");return}const y=S[0].split(",").map(E=>E.trim().replace(/[^a-zA-Z0-9_]/g,""));u=S.slice(1).map(E=>{const $=E.split(",").map(A=>A.trim()),x={};return y.forEach((A,te)=>{x[A]=$[te]??""}),x})}if(!u.length){alert("No data rows found.");return}if(t){const y=["id INTEGER PRIMARY KEY AUTOINCREMENT",...Object.keys(u[0]).filter($=>$.toLowerCase()!=="id").map($=>`"${$}" TEXT`)],E=await q("/query","POST",{query:`CREATE TABLE IF NOT EXISTS "${t}" (${y.join(", ")})`,type:"sql"});if(E.error){alert("Create table failed: "+E.error);return}}let w=0;for(const S of u){const y=t?Object.keys(S).filter(A=>A.toLowerCase()!=="id"):Object.keys(S),E=y.map(A=>`"${A}"`).join(","),$=y.map(A=>`'${String(S[A]).replace(/'/g,"''")}'`).join(","),x=await q("/query","POST",{query:`INSERT INTO "${n}" (${E}) VALUES (${$})`,type:"sql"});if(x.error){alert(`Row ${w+1} failed: ${x.error}`);break}w++}document.getElementById("paste-data").value="",document.getElementById("paste-new-table").value="",document.getElementById("paste-table").selectedIndex=0,Re(),he(),w>0&&fe(n)}catch(u){alert("Import error: "+u.message)}}async function _t(){var n,i;const e=(n=document.getElementById("db-seed-table"))==null?void 0:n.value,t=parseInt(((i=document.getElementById("db-seed-count"))==null?void 0:i.value)||"10");if(e)try{const o=await q("/seed","POST",{table:e,count:t});o.error?alert(o.error):fe(e)}catch(o){alert("Seed error: "+o.message)}}window.__loadTables=he,window.__selectTable=fe,window.__updateLimit=gt,window.__runQuery=Oe,window.__copyCSV=yt,window.__copyJSON=vt,window.__showPaste=xt,window.__hidePaste=Re,window.__doPaste=wt,window.__seedTable=_t,window.__loadHistory=ht,window.__clearHistory=ft;function kt(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Errors <span id="errors-count" class="text-muted text-sm"></span></h2>
      <div class="flex gap-sm">
        <button class="btn btn-sm" onclick="window.__loadErrors()">Refresh</button>
        <button class="btn btn-sm btn-danger" onclick="window.__clearErrors()">Clear All</button>
      </div>
    </div>
    <div id="errors-body"></div>
  `,se()}async function se(){const e=await q("/broken"),t=document.getElementById("errors-count"),n=document.getElementById("errors-body");if(!n)return;const i=e.errors||[];if(t&&(t.textContent=`(${i.length})`),!i.length){n.innerHTML='<div class="empty-state">No errors</div>';return}n.innerHTML=i.map((o,s)=>{const d=o.error_type?`${o.error_type}: ${o.message}`:o.error||o.message||"Unknown error",a=o.context||{},m=o.last_seen||o.first_seen||o.timestamp||"",u=m?new Date(m).toLocaleString():"";return`
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:0.75rem;margin-bottom:0.75rem">
      <div class="flex items-center" style="justify-content:space-between;flex-wrap:wrap;gap:0.5rem">
        <div style="flex:1;min-width:0">
          <span class="badge ${o.resolved?"badge-success":"badge-danger"}">${o.resolved?"RESOLVED":"UNRESOLVED"}</span>
          ${o.count>1?`<span class="badge badge-warn" style="margin-left:4px">x${o.count}</span>`:""}
          <strong style="margin-left:0.5rem;font-size:0.85rem">${c(d)}</strong>
        </div>
        <div class="flex gap-sm" style="flex-shrink:0">
          ${o.resolved?"":`<button class="btn btn-sm" onclick="window.__resolveError('${c(o.id||String(s))}')">Resolve</button>`}
          <button class="btn btn-sm btn-primary" onclick="window.__askAboutError(${s})">Ask Tina4</button>
        </div>
      </div>
      ${a.method?`<div class="text-sm text-mono" style="margin-top:0.5rem;color:var(--info)">${c(a.method)} ${c(a.path||"")}</div>`:""}
      ${o.traceback?`<pre style="margin-top:0.5rem;padding:0.5rem;background:var(--bg);border:1px solid var(--border);border-radius:4px;font-size:0.7rem;overflow-x:auto;white-space:pre-wrap;max-height:200px;overflow-y:auto">${c(o.traceback)}</pre>`:""}
      <div class="text-sm text-muted" style="margin-top:0.5rem">${c(u)}</div>
    </div>
  `}).join(""),window.__errorData=i}async function $t(e){await q("/broken/resolve","POST",{id:e}),se()}async function Et(){await q("/broken/clear","POST"),se()}function St(e){const n=(window.__errorData||[])[e];if(!n)return;const i=n.error_type?`${n.error_type}: ${n.message}`:n.error||n.message||"Unknown error",o=n.context||{},s=o.method&&o.path?`
Route: ${o.method} ${o.path}`:"",d=`I have this error: ${i}${s}

${n.traceback||""}`;window.__switchTab("chat"),setTimeout(()=>{window.__prefillChat(d)},150)}window.__loadErrors=se,window.__clearErrors=Et,window.__resolveError=$t,window.__askAboutError=St;function Tt(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>System</h2>
    </div>
    <div id="system-grid" class="metric-grid"></div>
    <div id="system-env" style="margin-top:1rem"></div>
  `,Ne()}function It(e){if(!e||e<0)return"?";const t=Math.floor(e/86400),n=Math.floor(e%86400/3600),i=Math.floor(e%3600/60),o=Math.floor(e%60),s=[];return t>0&&s.push(`${t}d`),n>0&&s.push(`${n}h`),i>0&&s.push(`${i}m`),s.length===0&&s.push(`${o}s`),s.join(" ")}function Mt(e){return e?e>=1024?`${(e/1024).toFixed(1)} GB`:`${e.toFixed(1)} MB`:"?"}async function Ne(){const e=await q("/system"),t=document.getElementById("system-grid"),n=document.getElementById("system-env");if(!t)return;const o=(e.python_version||e.php_version||e.ruby_version||e.node_version||e.runtime||"?").split("(")[0].trim(),s=[{label:"Framework",value:e.framework||"Tina4"},{label:"Runtime",value:o},{label:"Platform",value:e.platform||"?"},{label:"Architecture",value:e.architecture||"?"},{label:"PID",value:String(e.pid??"?")},{label:"Uptime",value:It(e.uptime_seconds)},{label:"Memory",value:Mt(e.memory_mb)},{label:"Database",value:e.database||"none"},{label:"DB Tables",value:String(e.db_tables??"?")},{label:"DB Connected",value:e.db_connected?"Yes":"No"},{label:"Debug",value:e.debug==="true"||e.debug===!0?"ON":"OFF"},{label:"Log Level",value:e.log_level||"?"},{label:"Modules",value:String(e.loaded_modules??"?")},{label:"Working Dir",value:e.cwd||"?"}],d=new Set(["Working Dir","Database"]);if(t.innerHTML=s.map(a=>`
    <div class="metric-card" style="${d.has(a.label)?"grid-column:1/-1":""}">
      <div class="label">${c(a.label)}</div>
      <div class="value" style="font-size:${d.has(a.label)?"0.75rem":"1.1rem"}">${c(a.value)}</div>
    </div>
  `).join(""),n){const a=[];e.debug!==void 0&&a.push(["TINA4_DEBUG",String(e.debug)]),e.log_level&&a.push(["LOG_LEVEL",e.log_level]),e.database&&a.push(["DATABASE_URL",e.database]),a.length&&(n.innerHTML=`
        <h3 style="font-size:0.85rem;margin-bottom:0.5rem">Environment</h3>
        <table>
          <thead><tr><th>Variable</th><th>Value</th></tr></thead>
          <tbody>${a.map(([m,u])=>`<tr><td class="text-mono text-sm" style="padding:4px 8px">${c(m)}</td><td class="text-sm" style="padding:4px 8px">${c(u)}</td></tr>`).join("")}</tbody>
        </table>
      `)}}window.__loadSystem=Ne;function Ct(e){e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Code Metrics</h2>
    </div>
    <div id="metrics-quick" class="metric-grid"></div>
    <div id="metrics-scan-info" class="text-sm text-muted" style="margin:0.5rem 0"></div>
    <div id="metrics-chart" style="display:none;margin:1rem 0"></div>
    <div id="metrics-detail" style="margin-top:1rem"></div>
    <div id="metrics-complex" style="margin-top:1rem"></div>
  `,Lt()}async function Lt(){var s;const e=document.getElementById("metrics-chart"),t=document.getElementById("metrics-complex"),n=document.getElementById("metrics-scan-info");e&&(e.style.display="block",e.innerHTML='<p class="text-muted">Analyzing...</p>');const i=await q("/metrics/full");if(i.error||!i.file_metrics){e&&(e.innerHTML=`<p style="color:var(--danger)">${c(i.error||"No data")}</p>`);return}if(n){const d=i.scan_mode==="framework"?'<span style="color:#cba6f7;font-weight:600">(Framework)</span> Add code to src/ to see your project':"";n.innerHTML=`${i.files_analyzed} files analyzed | ${i.total_functions} functions ${d}`}const o=document.getElementById("metrics-quick");o&&(o.innerHTML=[N("Files Analyzed",i.files_analyzed),N("Total Functions",i.total_functions),N("Avg Complexity",i.avg_complexity),N("Avg Maintainability",i.avg_maintainability)].join("")),e&&i.file_metrics.length>0?Bt(i.file_metrics,e,i.dependency_graph||{},i.scan_mode||"project"):e&&(e.innerHTML='<p class="text-muted">No files to visualize</p>'),t&&((s=i.most_complex_functions)!=null&&s.length)&&(t.innerHTML=`
      <h3 style="font-size:0.85rem;margin-bottom:0.5rem">Most Complex Functions</h3>
      <table>
        <thead><tr><th>Function</th><th>File</th><th>Line</th><th>CC</th><th>LOC</th></tr></thead>
        <tbody>${i.most_complex_functions.slice(0,15).map(d=>`
          <tr>
            <td class="text-mono">${c(d.name)}</td>
            <td class="text-sm text-muted" style="cursor:pointer;text-decoration:underline dotted" onclick="window.__drillDown('${c(d.file)}')">${c(d.file)}</td>
            <td>${d.line}</td>
            <td><span class="${d.complexity>10?"badge badge-danger":d.complexity>5?"badge badge-warn":"badge badge-success"}">${d.complexity}</span></td>
            <td>${d.loc}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    `)}function Bt(e,t,n,i){var st,at,rt;const o=t.offsetWidth||900,s=Math.max(450,Math.min(650,o*.45)),d=Math.max(...e.map(h=>h.loc))||1,a=Math.max(...e.map(h=>h.dep_count||0))||1,m=14,u=Math.min(70,o/10);function w(h){const g=Math.min((h.avg_complexity||0)/10,1),f=h.has_tests?0:1,_=Math.min((h.dep_count||0)/5,1),p=g*.4+f*.4+_*.2,r=Math.max(0,Math.min(1,p)),b=Math.round(120*(1-r)),v=Math.round(70+r*30),k=Math.round(42+18*(1-r));return`hsl(${b},${v}%,${k}%)`}function S(h){return h.loc/d*.4+(h.avg_complexity||0)/10*.4+(h.dep_count||0)/a*.2}const y=[...e].sort((h,g)=>S(h)-S(g)),E=o/2,$=s/2,x=[];let A=0,te=0;for(const h of y){const g=m+Math.sqrt(S(h))*(u-m),f=w(h);let _=!1;for(let p=0;p<800;p++){const r=E+te*Math.cos(A),b=$+te*Math.sin(A);let v=!1;for(const k of x){const L=r-k.x,z=b-k.y;if(Math.sqrt(L*L+z*z)<g+k.r+2){v=!0;break}}if(!v&&r>g+2&&r<o-g-2&&b>g+25&&b<s-g-2){x.push({x:r,y:b,vx:0,vy:0,r:g,color:f,f:h}),_=!0;break}A+=.2,te+=.04}_||x.push({x:E+(Math.random()-.5)*o*.3,y:$+(Math.random()-.5)*s*.3,vx:0,vy:0,r:g,color:f,f:h})}const qe=[];function Qe(h){const g=h.split("/").pop()||"",f=g.lastIndexOf(".");return(f>0?g.substring(0,f):g).toLowerCase()}const Ae={};x.forEach((h,g)=>{Ae[Qe(h.f.path)]=g});for(const[h,g]of Object.entries(n)){let f=null;if(x.forEach((_,p)=>{_.f.path===h&&(f=p)}),f!==null)for(const _ of g){const p=_.replace(/^\.\//,"").replace(/^\.\.\//,"").split(/[./]/);let r;for(let b=p.length-1;b>=0;b--){const v=p[b].toLowerCase();if(v&&v!=="js"&&v!=="py"&&v!=="rb"&&v!=="ts"&&v!=="index"&&(r=Ae[v],r!==void 0))break}r===void 0&&(r=Ae[Qe(_)]),r!==void 0&&f!==r&&qe.push([f,r])}}const I=document.createElement("canvas");I.width=o,I.height=s,I.style.cssText="display:block;border:1px solid var(--border);border-radius:8px;cursor:pointer;background:#0f172a";const rn=i==="framework"?'<span style="color:#cba6f7;font-weight:600">(Framework)</span> Add code to src/ to see your project':"";t.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem"><h3 style="margin:0;font-size:0.85rem">Code Landscape ${rn}</h3><span style="font-size:0.65rem;color:var(--muted)">Drag bubbles | Dbl-click to drill down</span></div><div style="position:relative" id="metrics-canvas-wrap"></div>`,document.getElementById("metrics-canvas-wrap").appendChild(I);const He=document.createElement("div");He.style.cssText="position:absolute;top:8px;left:8px;z-index:2;display:flex;gap:4px;flex-direction:column",He.innerHTML=`
    <button class="btn btn-sm" id="metrics-zoom-in" style="width:28px;height:28px;padding:0;font-size:14px;font-weight:700;line-height:1">+</button>
    <button class="btn btn-sm" id="metrics-zoom-out" style="width:28px;height:28px;padding:0;font-size:14px;font-weight:700;line-height:1">&minus;</button>
    <button class="btn btn-sm" id="metrics-zoom-fit" style="width:28px;height:28px;padding:0;font-size:10px;font-weight:700;line-height:1">Fit</button>
  `,document.getElementById("metrics-canvas-wrap").appendChild(He),(st=document.getElementById("metrics-zoom-in"))==null||st.addEventListener("click",()=>{C=Math.min(5,C*1.3)}),(at=document.getElementById("metrics-zoom-out"))==null||at.addEventListener("click",()=>{C=Math.max(.3,C*.7)}),(rt=document.getElementById("metrics-zoom-fit"))==null||rt.addEventListener("click",()=>{C=1,V=0,Y=0});const l=I.getContext("2d");let F=-1,M=-1,Xe=0,Ze=0,V=0,Y=0,C=1,ne=!1,et=0,tt=0,nt=0,ot=0;function ln(){for(let p=0;p<x.length;p++){if(p===M)continue;const r=x[p],b=E-r.x,v=$-r.y,k=.3+r.r/u*.7,L=.008*k*k;r.vx+=b*L,r.vy+=v*L}for(const[p,r]of qe){const b=x[p],v=x[r],k=v.x-b.x,L=v.y-b.y,z=Math.sqrt(k*k+L*L)||1,O=b.r+v.r+20,R=(z-O)*.002,oe=k/z*R,ie=L/z*R;p!==M&&(b.vx+=oe,b.vy+=ie),r!==M&&(v.vx-=oe,v.vy-=ie)}for(let p=0;p<x.length;p++)for(let r=p+1;r<x.length;r++){const b=x[p],v=x[r],k=v.x-b.x,L=v.y-b.y,z=Math.sqrt(k*k+L*L)||1,O=b.r+v.r+20;if(z<O){const R=40*(O-z)/O,oe=k/z*R,ie=L/z*R;p!==M&&(b.vx-=oe,b.vy-=ie),r!==M&&(v.vx+=oe,v.vy+=ie)}}for(let p=0;p<x.length;p++){if(p===M)continue;const r=x[p];r.vx*=.65,r.vy*=.65;const b=2;r.vx=Math.max(-b,Math.min(b,r.vx)),r.vy=Math.max(-b,Math.min(b,r.vy)),r.x+=r.vx,r.y+=r.vy,r.x=Math.max(r.r+2,Math.min(o-r.r-2,r.x)),r.y=Math.max(r.r+25,Math.min(s-r.r-2,r.y))}}function it(){var h;ln(),l.clearRect(0,0,o,s),l.save(),l.translate(V,Y),l.scale(C,C),l.strokeStyle="rgba(255,255,255,0.03)",l.lineWidth=1/C;for(let g=0;g<o/C;g+=50)l.beginPath(),l.moveTo(g,0),l.lineTo(g,s/C),l.stroke();for(let g=0;g<s/C;g+=50)l.beginPath(),l.moveTo(0,g),l.lineTo(o/C,g),l.stroke();for(const[g,f]of qe){const _=x[g],p=x[f],r=p.x-_.x,b=p.y-_.y,v=Math.sqrt(r*r+b*b)||1,k=F===g||F===f;l.beginPath(),l.moveTo(_.x+r/v*_.r,_.y+b/v*_.r);const L=p.x-r/v*p.r,z=p.y-b/v*p.r;l.lineTo(L,z),l.strokeStyle=k?"rgba(139,180,250,0.9)":"rgba(255,255,255,0.15)",l.lineWidth=k?3:1,l.stroke();const O=k?12:6,R=Math.atan2(b,r);l.beginPath(),l.moveTo(L,z),l.lineTo(L-O*Math.cos(R-.4),z-O*Math.sin(R-.4)),l.lineTo(L-O*Math.cos(R+.4),z-O*Math.sin(R+.4)),l.closePath(),l.fillStyle=l.strokeStyle,l.fill()}for(let g=0;g<x.length;g++){const f=x[g],_=g===F,p=_?f.r+4:f.r;_&&(l.beginPath(),l.arc(f.x,f.y,p+8,0,Math.PI*2),l.fillStyle="rgba(255,255,255,0.08)",l.fill()),l.beginPath(),l.arc(f.x,f.y,p,0,Math.PI*2),l.fillStyle=f.color,l.globalAlpha=_?1:.85,l.fill(),l.globalAlpha=1,l.strokeStyle=_?"rgba(255,255,255,0.6)":"rgba(255,255,255,0.25)",l.lineWidth=_?2.5:1.5,l.stroke();const r=((h=f.f.path.split("/").pop())==null?void 0:h.replace(/\.\w+$/,""))||"?";if(p>16){const k=Math.max(8,Math.min(13,p*.38));l.fillStyle="#fff",l.font=`600 ${k}px monospace`,l.textAlign="center",l.fillText(r,f.x,f.y-2),l.fillStyle="rgba(255,255,255,0.65)",l.font=`${k-1}px monospace`,l.fillText(`${f.f.loc} LOC`,f.x,f.y+k)}const b=Math.max(9,p*.3),v=b*.7;if(p>14&&f.f.dep_count>0){const k=f.y-p+v+3;l.beginPath(),l.arc(f.x,k,v,0,Math.PI*2),l.fillStyle="#ea580c",l.fill(),l.fillStyle="#fff",l.font=`bold ${b}px sans-serif`,l.textAlign="center",l.fillText("D",f.x,k+b*.35)}if(p>14&&f.f.has_tests){const k=f.y+p-v-3;l.beginPath(),l.arc(f.x,k,v,0,Math.PI*2),l.fillStyle="#16a34a",l.fill(),l.fillStyle="#fff",l.font=`bold ${b}px sans-serif`,l.textAlign="center",l.fillText("T",f.x,k+b*.35)}}l.restore(),requestAnimationFrame(it)}I.addEventListener("mousemove",h=>{const g=I.getBoundingClientRect(),f=(h.clientX-g.left-V)/C,_=(h.clientY-g.top-Y)/C;if(ne){V=nt+(h.clientX-et),Y=ot+(h.clientY-tt);return}if(M>=0){be=!0,x[M].x=f+Xe,x[M].y=_+Ze,x[M].vx=0,x[M].vy=0;return}F=-1;for(let p=x.length-1;p>=0;p--){const r=x[p],b=f-r.x,v=_-r.y;if(Math.sqrt(b*b+v*v)<r.r+4){F=p;break}}I.style.cursor=F>=0?"grab":"default"}),I.addEventListener("mousedown",h=>{const g=I.getBoundingClientRect(),f=(h.clientX-g.left-V)/C,_=(h.clientY-g.top-Y)/C;if(h.button===2){ne=!0,et=h.clientX,tt=h.clientY,nt=V,ot=Y,I.style.cursor="move";return}F>=0&&(M=F,Xe=x[M].x-f,Ze=x[M].y-_,be=!1,I.style.cursor="grabbing")});let be=!1;I.addEventListener("mouseup",h=>{if(ne){ne=!1,I.style.cursor="default";return}if(M>=0){be||ve(x[M].f.path),I.style.cursor="grab",M=-1,be=!1;return}}),I.addEventListener("mouseleave",()=>{F=-1,M=-1,ne=!1}),I.addEventListener("dblclick",h=>{const g=I.getBoundingClientRect(),f=(h.clientX-g.left-V)/C,_=(h.clientY-g.top-Y)/C;for(let p=x.length-1;p>=0;p--){const r=x[p],b=f-r.x,v=_-r.y;if(Math.sqrt(b*b+v*v)<r.r+4){ve(r.f.path);break}}}),I.addEventListener("contextmenu",h=>h.preventDefault()),requestAnimationFrame(it)}async function ve(e){const t=document.getElementById("metrics-detail");if(!t)return;t.innerHTML='<p class="text-muted">Loading file analysis...</p>';const n=await q("/metrics/file?path="+encodeURIComponent(e));if(n.error){t.innerHTML=`<p style="color:var(--danger)">${c(n.error)}</p>`;return}const i=n.functions||[],o=Math.max(1,...i.map(s=>s.complexity));t.innerHTML=`
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:1rem">
      <div class="flex items-center" style="justify-content:space-between;margin-bottom:0.75rem">
        <h3 style="font-size:0.9rem">${c(n.path)}</h3>
        <button class="btn btn-sm" onclick="document.getElementById('metrics-detail').innerHTML=''">Close</button>
      </div>
      <div class="metric-grid" style="margin-bottom:0.75rem">
        ${N("LOC",n.loc)}
        ${N("Total Lines",n.total_lines)}
        ${N("Classes",n.classes)}
        ${N("Functions",i.length)}
        ${N("Imports",n.imports?n.imports.length:0)}
      </div>
      ${i.length?`
        <h4 style="font-size:0.8rem;color:var(--info);margin-bottom:0.5rem">Cyclomatic Complexity by Function</h4>
        ${i.sort((s,d)=>d.complexity-s.complexity).map(s=>{const d=s.complexity/o*100,a=s.complexity>10?"#ef4444":s.complexity>5?"#f59e0b":"#22c55e";return`<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:3px;font-size:0.75rem">
            <div style="width:200px;flex-shrink:0;text-align:right;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c(s.name)}">${c(s.name)}</div>
            <div style="flex:1;height:14px;background:var(--bg);border-radius:2px;overflow:hidden"><div style="width:${d}%;height:100%;background:${a}"></div></div>
            <div style="width:180px;flex-shrink:0;font-family:monospace;text-align:right"><span style="color:${a}">CC:${s.complexity}</span> <span style="color:var(--muted)">${s.loc} LOC L${s.line}</span></div>
          </div>`}).join("")}
      `:'<p class="text-muted">No functions</p>'}
    </div>
  `}function N(e,t){return`<div class="metric-card"><div class="label">${c(e)}</div><div class="value">${c(String(t??0))}</div></div>`}window.__drillDown=ve;const ae={tina4:{model:"",url:"http://41.71.84.173:11437"},custom:{model:"",url:"http://localhost:11434"},anthropic:{model:"claude-sonnet-4-20250514",url:"https://api.anthropic.com"},openai:{model:"gpt-4o",url:"https://api.openai.com"}},G={thinking:{model:"",url:"http://41.71.84.173:11437"},vision:{model:"",url:"http://41.71.84.173:11434"},imageGen:{model:"",url:"http://41.71.84.173:11436"}};function re(e="tina4",t="thinking"){if(e==="tina4"&&G[t]){const i=G[t];return{provider:e,model:i.model,url:i.url,apiKey:""}}const n=ae[e]||ae.tina4;return{provider:e,model:n.model,url:n.url,apiKey:""}}function xe(e,t="thinking"){const n={...re("tina4",t),...e||{}};return n.provider==="ollama"&&(n.provider="custom"),n.model==="tina4-v1"&&(n.model=""),n.provider==="tina4"&&G[t]&&(n.url=G[t].url),n}function zt(){try{const e=JSON.parse(localStorage.getItem("tina4_chat_settings")||"{}");return{thinking:xe(e.thinking,"thinking"),vision:xe(e.vision,"vision"),imageGen:xe(e.imageGen,"imageGen")}}catch{return{thinking:re("tina4","thinking"),vision:re("tina4","vision"),imageGen:re("tina4","imageGen")}}}function qt(e){localStorage.setItem("tina4_chat_settings",JSON.stringify(e)),T=e,U()}let T=zt(),H="Idle";const le=[];function At(){const e=document.getElementById("chat-messages");if(!e)return;const t=[];e.querySelectorAll(".chat-msg").forEach(n=>{var s;const i=n.classList.contains("chat-user")?"user":"assistant",o=((s=n.querySelector(".chat-msg-content"))==null?void 0:s.innerHTML)||"";o.includes("Hi! I'm Tina4.")||t.push({role:i,content:o})});try{localStorage.setItem("tina4_chat_history",JSON.stringify(t))}catch{}}function Ht(){try{const e=localStorage.getItem("tina4_chat_history");if(!e)return;const t=JSON.parse(e);if(!t.length)return;t.reverse().forEach(n=>{const i=(n.content||"").trim();i&&B(i,n.role==="user"?"user":"bot")})}catch{}}function jt(){localStorage.removeItem("tina4_chat_history");const e=document.getElementById("chat-messages");e&&(e.innerHTML=`<div class="chat-msg chat-bot">Hi! I'm Tina4. Ask me to build routes, templates, models — or ask questions about your project.</div>`),de=0}function Pt(e){var n,i,o,s,d,a,m,u,w,S;e.innerHTML=`
    <div class="dev-panel-header">
      <h2>Code With Me</h2>
      <div class="flex gap-sm">
        <button class="btn btn-sm" onclick="window.__clearChat()" title="Clear chat history">Clear</button>
        <button class="btn btn-sm" id="chat-thoughts-btn" title="Supervisor thoughts">Thoughts <span id="thoughts-dot" style="display:none;color:var(--info)">&#9679;</span></button>
        <button class="btn btn-sm" id="chat-settings-btn" title="Settings">&#9881; Settings</button>
      </div>
    </div>
    <div style="display:flex;gap:0.5rem;flex:1;min-height:0;overflow:hidden">
      <div style="flex:1;display:flex;flex-direction:column;min-height:0">
        <div style="display:flex;gap:0.5rem;align-items:flex-start;padding:0.5rem 0;flex-shrink:0">
          <textarea id="chat-input" class="input" placeholder="Ask Tina4 to build something..." rows="2" style="flex:1;resize:vertical;min-height:36px;max-height:200px;font-family:inherit;font-size:inherit"></textarea>
          <div style="display:flex;flex-direction:column;gap:4px">
            <button class="btn btn-primary" id="chat-send-btn" style="white-space:nowrap">Send</button>
            <div style="display:flex;gap:4px">
              <input type="file" id="chat-file-input" multiple style="display:none" />
              <button class="btn btn-sm" id="chat-file-btn" style="font-size:0.65rem;padding:2px 6px">File</button>
              <button class="btn btn-sm" id="chat-mic-btn" style="font-size:0.65rem;padding:2px 6px">Mic</button>
            </div>
          </div>
        </div>
        <div id="chat-attachments" style="display:none;margin-bottom:0.375rem;font-size:0.75rem"></div>
        <div id="chat-status-bar" style="display:none;padding:6px 12px;background:var(--surface);border:1px solid var(--info);border-radius:0.375rem;margin-bottom:0.5rem;font-size:0.75rem;color:var(--info);align-items:center;gap:8px;flex-shrink:0">
          <span style="display:inline-block;width:12px;height:12px;border:2px solid var(--info);border-top-color:transparent;border-radius:50%;animation:t4spin 0.8s linear infinite"></span>
          <span id="chat-status-text">Thinking...</span>
        </div>
        <style>@keyframes t4spin{to{transform:rotate(360deg)}}</style>
        <div id="chat-messages" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:0.5rem;padding:0.25rem 0">
          <div class="chat-msg chat-bot">Hi! I'm Tina4. Ask me to build routes, templates, models — or ask questions about your project.</div>
        </div>
      </div>
      <div id="chat-summary" style="width:200px;flex-shrink:0;background:var(--surface);border:1px solid var(--border);border-radius:0.5rem;padding:0.75rem;font-size:0.75rem;overflow-y:auto"></div>
    </div>

    <!-- Thoughts Panel (slides in from right) -->
    <div id="chat-thoughts-panel" style="display:none;position:absolute;top:0;right:0;bottom:0;width:300px;background:var(--surface);border-left:1px solid var(--border);z-index:50;overflow-y:auto;padding:0.75rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem">
        <h3 style="font-size:0.85rem;margin:0">Thoughts</h3>
        <button class="btn btn-sm" id="chat-thoughts-close" style="width:24px;height:24px;padding:0;font-size:14px;line-height:1">&times;</button>
      </div>
      <div id="thoughts-list"></div>
    </div>

    <!-- Settings Modal -->
    <div id="chat-modal-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:100;align-items:center;justify-content:center">
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:0.75rem;padding:1.25rem;width:750px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.3)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
          <h3 style="font-size:0.95rem;margin:0">AI Settings</h3>
          <button class="btn btn-sm" id="chat-modal-close" style="width:28px;height:28px;padding:0;font-size:16px;line-height:1">&times;</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;margin-bottom:0.75rem">
          ${["thinking","vision","imageGen"].map(y=>`
          <fieldset style="border:1px solid var(--border);border-radius:0.375rem;padding:0.5rem 0.75rem;margin:0">
            <legend class="text-sm" style="font-weight:600;padding:0 4px">${y==="imageGen"?"Image Generation":y.charAt(0).toUpperCase()+y.slice(1)}</legend>
            <div style="margin-bottom:0.375rem"><label class="text-sm text-muted" style="display:block;margin-bottom:2px">Provider</label><select id="set-${y}-provider" class="input" style="width:100%"><option value="tina4">Tina4 Cloud</option><option value="custom">Custom / Local</option><option value="anthropic">Anthropic (Claude)</option><option value="openai">OpenAI</option></select></div>
            <div id="set-${y}-url-row" style="margin-bottom:0.375rem"><label class="text-sm text-muted" style="display:block;margin-bottom:2px">URL</label><input type="text" id="set-${y}-url" class="input" style="width:100%" /></div>
            <div id="set-${y}-key-row" style="margin-bottom:0.375rem"><label class="text-sm text-muted" style="display:block;margin-bottom:2px">API Key</label><input type="password" id="set-${y}-key" class="input" placeholder="sk-..." style="width:100%" /></div>
            <button class="btn btn-sm btn-primary" id="set-${y}-connect" style="width:100%;margin-bottom:0.375rem">Connect</button>
            <div id="set-${y}-result" class="text-sm" style="min-height:1.2em;margin-bottom:0.375rem"></div>
            <div style="margin-bottom:0.375rem"><label class="text-sm text-muted" style="display:block;margin-bottom:2px">Model</label><select id="set-${y}-model" class="input" style="width:100%" disabled><option value="">-- connect first --</option></select></div>
          </fieldset>`).join("")}
        </div>
        <button class="btn btn-primary" id="chat-modal-save" style="width:100%">Save Settings</button>
      </div>
    </div>
  `,(n=document.getElementById("chat-send-btn"))==null||n.addEventListener("click",K),(i=document.getElementById("chat-thoughts-btn"))==null||i.addEventListener("click",Te),(o=document.getElementById("chat-thoughts-close"))==null||o.addEventListener("click",Te),(s=document.getElementById("chat-settings-btn"))==null||s.addEventListener("click",Ot),(d=document.getElementById("chat-modal-close"))==null||d.addEventListener("click",Se),(a=document.getElementById("chat-modal-save"))==null||a.addEventListener("click",Rt),(m=document.getElementById("chat-modal-overlay"))==null||m.addEventListener("click",y=>{y.target===y.currentTarget&&Se()}),(u=document.getElementById("chat-file-btn"))==null||u.addEventListener("click",()=>{var y;(y=document.getElementById("chat-file-input"))==null||y.click()}),(w=document.getElementById("chat-file-input"))==null||w.addEventListener("change",en),(S=document.getElementById("chat-mic-btn"))==null||S.addEventListener("click",nn);const t=document.getElementById("chat-input");t==null||t.addEventListener("keydown",y=>{y.key==="Enter"&&!y.shiftKey&&(y.preventDefault(),K())}),U(),Ht(),loadServerHistory()}function we(e,t){document.getElementById(`set-${e}-provider`).value=t.provider;const n=document.getElementById(`set-${e}-model`);t.model&&(n.innerHTML=`<option value="${t.model}">${t.model}</option>`,n.value=t.model,n.disabled=!1),document.getElementById(`set-${e}-url`).value=t.url,document.getElementById(`set-${e}-key`).value=t.apiKey,ke(e,t.provider)}function _e(e){var t,n,i,o;return{provider:((t=document.getElementById(`set-${e}-provider`))==null?void 0:t.value)||"custom",model:((n=document.getElementById(`set-${e}-model`))==null?void 0:n.value)||"",url:((i=document.getElementById(`set-${e}-url`))==null?void 0:i.value)||"",apiKey:((o=document.getElementById(`set-${e}-key`))==null?void 0:o.value)||""}}function ke(e,t){const n=document.getElementById(`set-${e}-key-row`),i=document.getElementById(`set-${e}-url-row`);t==="tina4"?(n&&(n.style.display="none"),i&&(i.style.display="none")):(n&&(n.style.display="block"),i&&(i.style.display="block"))}function $e(e){const t=document.getElementById(`set-${e}-provider`);t==null||t.addEventListener("change",()=>{let n;t.value==="tina4"&&G[e]?n=G[e]:n=ae[t.value]||ae.tina4;const i=document.getElementById(`set-${e}-model`);i.innerHTML=n.model?`<option value="${n.model}">${n.model}</option>`:'<option value="">-- connect first --</option>',i.value=n.model,document.getElementById(`set-${e}-url`).value=n.url,ke(e,t.value)}),ke(e,(t==null?void 0:t.value)||"custom")}async function Ee(e){var d,a,m;const t=((d=document.getElementById(`set-${e}-provider`))==null?void 0:d.value)||"custom";let n=((a=document.getElementById(`set-${e}-url`))==null?void 0:a.value)||"";const i=((m=document.getElementById(`set-${e}-key`))==null?void 0:m.value)||"",o=document.getElementById(`set-${e}-model`),s=document.getElementById(`set-${e}-result`);t==="tina4"&&G[e]&&(n=G[e].url),s&&(s.textContent="Connecting...",s.style.color="var(--muted)");try{let u=[];const w=n.replace(/\/(v1|api)\/.*$/,"").replace(/\/+$/,"");if(t==="tina4"){try{u=((await(await fetch(`${w}/api/tags`)).json()).models||[]).map($=>$.name||$.model)}catch{}if(!u.length)try{u=((await(await fetch(`${w}/v1/models`)).json()).data||[]).map($=>$.id)}catch{}}else if(t==="custom"){try{u=((await(await fetch(`${w}/api/tags`)).json()).models||[]).map($=>$.name||$.model)}catch{}if(!u.length)try{u=((await(await fetch(`${w}/v1/models`)).json()).data||[]).map($=>$.id)}catch{}}else if(t==="anthropic")u=["claude-sonnet-4-20250514","claude-opus-4-20250514","claude-haiku-4-20250514","claude-3-5-sonnet-20241022"];else if(t==="openai"){const y=n.replace(/\/v1\/.*$/,"");u=((await(await fetch(`${y}/v1/models`,{headers:i?{Authorization:`Bearer ${i}`}:{}})).json()).data||[]).map(x=>x.id).filter(x=>x.startsWith("gpt"))}if(u.length===0){s&&(s.innerHTML='<span style="color:var(--warn)">No models found</span>');return}const S=o.value;o.innerHTML=u.map(y=>`<option value="${y}">${y}</option>`).join(""),u.includes(S)&&(o.value=S),o.disabled=!1,s&&(s.innerHTML=`<span style="color:var(--success)">&#10003; ${u.length} models available</span>`)}catch{s&&(s.innerHTML='<span style="color:var(--danger)">&#10007; Connection failed</span>')}}function Ot(){var t,n,i;const e=document.getElementById("chat-modal-overlay");e&&(e.style.display="flex",we("thinking",T.thinking),we("vision",T.vision),we("imageGen",T.imageGen),$e("thinking"),$e("vision"),$e("imageGen"),(t=document.getElementById("set-thinking-connect"))==null||t.addEventListener("click",()=>Ee("thinking")),(n=document.getElementById("set-vision-connect"))==null||n.addEventListener("click",()=>Ee("vision")),(i=document.getElementById("set-imageGen-connect"))==null||i.addEventListener("click",()=>Ee("imageGen")))}function Se(){const e=document.getElementById("chat-modal-overlay");e&&(e.style.display="none")}function Rt(){qt({thinking:_e("thinking"),vision:_e("vision"),imageGen:_e("imageGen")}),Se()}function U(){const e=document.getElementById("chat-summary");if(!e)return;const t=Q.length?Q.map(o=>`<div style="margin-bottom:4px;font-size:0.65rem;line-height:1.3">
      <span style="color:var(--muted)">${c(o.time)}</span>
      <span style="color:var(--info);font-size:0.6rem">${c(o.agent)}</span>
      <div>${c(o.text)}</div>
    </div>`).join(""):'<div class="text-muted" style="font-size:0.65rem">No activity yet</div>',n=H==="Idle"?"var(--muted)":H==="Thinking..."?"var(--info)":"var(--success)",i=o=>o.model?'<span style="color:var(--success)">&#9679;</span>':'<span style="color:var(--muted)">&#9675;</span>';e.innerHTML=`
    <div style="margin-bottom:0.5rem;font-size:0.7rem">
      <span style="color:${n}">&#9679;</span> ${c(H)}
    </div>
    <div style="font-size:0.65rem;line-height:1.8">
      ${i(T.thinking)} T: ${c(T.thinking.model||"—")}<br>
      ${i(T.vision)} V: ${c(T.vision.model||"—")}<br>
      ${i(T.imageGen)} I: ${c(T.imageGen.model||"—")}
    </div>
    ${le.length?`
      <div style="margin-bottom:0.75rem">
        <div class="text-muted" style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Files Changed</div>
        ${le.map(o=>`<div class="text-mono" style="font-size:0.65rem;color:var(--success);margin-bottom:2px">${c(o)}</div>`).join("")}
      </div>
    `:""}
    <div>
      <div class="text-muted" style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Activity</div>
      ${t}
    </div>
  `}let de=0;function B(e,t){var s,d;const n=document.getElementById("chat-messages");if(!n)return;const i=`msg-${++de}`,o=document.createElement("div");if(o.className=`chat-msg chat-${t}`,o.id=i,o.innerHTML=`
    <div class="chat-msg-content">${e}</div>
    <div class="chat-msg-actions" style="display:flex;gap:4px;margin-top:4px;opacity:0.4">
      <button class="btn btn-sm" style="font-size:0.6rem;padding:1px 6px" onclick="window.__copyMsg('${i}')" title="Copy">Copy</button>
      <button class="btn btn-sm" style="font-size:0.6rem;padding:1px 6px" onclick="window.__replyMsg('${i}')" title="Reply">Reply</button>
      <button class="btn btn-sm btn-primary" style="font-size:0.6rem;padding:1px 6px;display:none" onclick="window.__submitAnswers('${i}')" title="Submit answers" data-submit-btn>Submit Answers</button>
    </div>
  `,o.addEventListener("mouseenter",()=>{const a=o.querySelector(".chat-msg-actions");a&&(a.style.opacity="1")}),o.addEventListener("mouseleave",()=>{const a=o.querySelector(".chat-msg-actions");a&&(a.style.opacity="0.4")}),o.querySelector(".chat-answer-input")){const a=o.querySelector("[data-submit-btn]");a&&(a.style.display="inline-block")}if(t==="bot"){const m=(((s=o.querySelector(".chat-msg-content"))==null?void 0:s.textContent)||"").trim().endsWith("?"),u=o.querySelector(".chat-answer-input");if(m&&!u){const w=document.createElement("div");w.style.cssText="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap",w.className="chat-quick-replies",w.innerHTML=`
        <button class="btn btn-sm" style="font-size:0.65rem;padding:2px 8px" onclick="window.__quickReply('Yes')">Yes</button>
        <button class="btn btn-sm" style="font-size:0.65rem;padding:2px 8px" onclick="window.__quickReply('No')">No</button>
        <button class="btn btn-sm" style="font-size:0.65rem;padding:2px 8px" onclick="window.__quickReply('You decide')">You decide</button>
        <button class="btn btn-sm" style="font-size:0.65rem;padding:2px 8px" onclick="window.__quickReply('Skip')">Skip</button>
        <button class="btn btn-sm" style="font-size:0.65rem;padding:2px 8px" onclick="window.__quickReply('Just build it')">Just build it</button>
      `,(d=o.querySelector(".chat-msg-content"))==null||d.appendChild(w)}}n.prepend(o),At()}function Nt(e){const t=document.getElementById(e);if(!t)return;const n=t.querySelectorAll(".chat-answer-input"),i=[];if(n.forEach(d=>{const a=d.dataset.q||"?",m=d.value.trim();m&&(i.push(`${a}. ${m}`),d.disabled=!0,d.style.opacity="0.6")}),!i.length)return;const o=document.getElementById("chat-input");o&&(o.value=i.join(`
`),K());const s=t.querySelector("[data-submit-btn]");s&&(s.style.display="none")}function Dt(e,t){const n=e.parentElement;if(!n)return;const i=n.querySelector(".chat-answer-input");i&&(i.value=t,i.disabled=!0,i.style.opacity="0.5"),n.querySelectorAll("button").forEach(s=>s.remove());const o=document.createElement("span");o.style.cssText="font-size:0.65rem;padding:2px 8px;border-radius:3px;background:var(--info);color:white",o.textContent=t,n.appendChild(o)}window.__quickAnswer=Dt,window.__submitAnswers=Nt;function Ft(e){const t=document.querySelector(`#${e} .chat-msg-content`);t&&navigator.clipboard.writeText(t.textContent||"").then(()=>{const n=document.querySelector(`#${e} .chat-msg-actions button`);if(n){const i=n.textContent;n.textContent="Copied!",setTimeout(()=>{n.textContent=i},1e3)}})}function Gt(e){const t=document.querySelector(`#${e} .chat-msg-content`);if(!t)return;const n=(t.textContent||"").substring(0,100),i=document.getElementById("chat-input");i&&(i.value=`> ${n}${n.length>=100?"...":""}

`,i.focus(),i.setSelectionRange(i.value.length,i.value.length))}function Wt(e){var i,o;const t=e.closest(".chat-checklist-item");if(!t||(i=t.nextElementSibling)!=null&&i.classList.contains("chat-comment-box"))return;const n=document.createElement("div");n.className="chat-comment-box",n.style.cssText="padding-left:1.8rem;margin:0.15rem 0;display:flex;gap:4px",n.innerHTML=`
    <input type="text" class="input" placeholder="Your comment..." style="flex:1;font-size:0.7rem;padding:2px 6px;height:24px">
    <button class="btn btn-sm" style="font-size:0.6rem;padding:1px 6px;height:24px" onclick="window.__submitComment(this)">Add</button>
  `,t.after(n),(o=n.querySelector("input"))==null||o.focus()}function Jt(e){var s;const t=e.closest(".chat-comment-box");if(!t)return;const n=t.querySelector("input"),i=(s=n==null?void 0:n.value)==null?void 0:s.trim();if(!i)return;const o=document.createElement("div");o.style.cssText="padding-left:1.8rem;margin:0.1rem 0;font-size:0.7rem;color:var(--info);font-style:italic",o.textContent=`↳ ${i}`,t.replaceWith(o)}function De(){const e=[],t=[],n=[];return document.querySelectorAll(".chat-checklist-item").forEach(i=>{var a,m;const o=i.querySelector("input[type=checkbox]"),s=((a=i.querySelector("label"))==null?void 0:a.textContent)||"";o!=null&&o.checked?e.push(s):t.push(s);const d=i.nextElementSibling;if(d&&!d.classList.contains("chat-checklist-item")&&!d.classList.contains("chat-comment-box")){const u=((m=d.textContent)==null?void 0:m.replace("↳ ",""))||"";u&&n.push(`${s}: ${u}`)}}),{accepted:e,rejected:t,comments:n}}let ce=!1;function Te(){const e=document.getElementById("chat-thoughts-panel");e&&(ce=!ce,e.style.display=ce?"block":"none",ce&&Fe())}async function Fe(){const e=document.getElementById("thoughts-list");if(e)try{const i=(await(await fetch("/__dev/api/thoughts")).json()||[]).filter(s=>!s.dismissed),o=document.getElementById("thoughts-dot");if(o&&(o.style.display=i.length?"inline":"none"),!i.length){e.innerHTML='<div class="text-muted text-sm" style="text-align:center;padding:2rem 0">All clear. No observations.</div>';return}e.innerHTML=i.map(s=>`
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:0.375rem;padding:0.5rem;margin-bottom:0.5rem;font-size:0.75rem">
        <div style="line-height:1.4">${c(s.message)}</div>
        <div style="display:flex;gap:4px;margin-top:0.375rem">
          ${(s.actions||[]).map(d=>d.action==="dismiss"?`<button class="btn btn-sm" style="font-size:0.6rem" onclick="window.__dismissThought('${c(s.id)}')">Dismiss</button>`:`<button class="btn btn-sm btn-primary" style="font-size:0.6rem" onclick="window.__actOnThought('${c(s.id)}','${c(d.action)}')">${c(d.label)}</button>`).join("")}
        </div>
      </div>
    `).join("")}catch{e.innerHTML='<div class="text-muted text-sm" style="text-align:center;padding:1rem">Agent not connected</div>'}}async function Ge(e){await fetch("/__dev/api/thoughts/dismiss",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:e})}).catch(()=>{}),Fe()}function Ut(e,t){Ge(e),Te()}setInterval(async()=>{try{const n=(await(await fetch("/__dev/api/thoughts")).json()||[]).filter(o=>!o.dismissed),i=document.getElementById("thoughts-dot");i&&(i.style.display=n.length?"inline":"none")}catch{}},6e4),window.__dismissThought=Ge,window.__actOnThought=Ut,window.__commentOnItem=Wt,window.__submitComment=Jt,window.__getChecklist=De;function Vt(e){document.querySelectorAll(".chat-quick-replies").forEach(n=>n.remove());const t=document.getElementById("chat-input");t&&(t.value=e,K())}window.__quickReply=Vt,window.__copyMsg=Ft,window.__replyMsg=Gt,window.__clearChat=jt;const Q=[];function me(e){const t=document.getElementById("chat-status-bar"),n=document.getElementById("chat-status-text");t&&(t.style.display="flex"),n&&(n.textContent=e)}function We(){const e=document.getElementById("chat-status-bar");e&&(e.style.display="none")}function ue(e,t){const n=new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});Q.unshift({time:n,text:e,agent:t}),Q.length>50&&(Q.length=50),U()}async function K(){var i;const e=document.getElementById("chat-input"),t=(i=e==null?void 0:e.value)==null?void 0:i.trim();if(!t)return;if(e.value="",B(c(t),"user"),D.length){const o=D.map(s=>s.name).join(", ");B(`<span class="text-sm text-muted">Attached: ${c(o)}</span>`,"user")}H="Thinking...",me("Analyzing request..."),ue("Analyzing request...","supervisor");const n={message:t,settings:{thinking:T.thinking,vision:T.vision,imageGen:T.imageGen}};D.length&&(n.files=D.map(o=>({name:o.name,data:o.data})));try{const o=await fetch("/__dev/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(n)});if(!o.ok||!o.body){const m=o.status===0?"Agent not running. Start: tina4 agent":`Error: ${o.status}`;B(`<span style="color:var(--danger)">${m}</span>`,"bot"),H="Error",U();return}const s=o.body.getReader(),d=new TextDecoder;let a="";for(;;){const{done:m,value:u}=await s.read();if(m)break;a+=d.decode(u,{stream:!0});const w=a.split(`
`);a=w.pop()||"";let S="";for(const y of w)if(y.startsWith("event: "))S=y.slice(7).trim();else if(y.startsWith("data: ")){const E=y.slice(6);try{const $=JSON.parse(E);Ie(S,$)}catch{}}}D.length=0,Me()}catch{B('<span style="color:var(--danger)">Connection failed</span>',"bot"),H="Error",U()}}function Ie(e,t){switch(e){case"status":H=t.text||"Working...",me(`${t.agent||"supervisor"}: ${t.text||"Working..."}`),ue(t.text||"",t.agent||"supervisor");break;case"message":{const n=t.content||"",i=t.agent||"supervisor";let o=Je(n);i!=="supervisor"&&(o=`<span class="badge" style="font-size:0.6rem;margin-right:4px">${c(i)}</span>`+o),t.files_changed&&t.files_changed.length>0&&(o+='<div style="margin-top:0.5rem;padding:0.5rem;background:var(--bg);border-radius:0.375rem;border:1px solid var(--border)">',o+='<div class="text-sm" style="color:var(--success);font-weight:600;margin-bottom:0.25rem">Files changed:</div>',t.files_changed.forEach(s=>{o+=`<div class="text-sm text-mono">${c(s)}</div>`,le.includes(s)||le.push(s)}),o+="</div>"),B(o,"bot");break}case"plan":{let n="";t.content&&(n+=Je(t.content)),t.approve&&(n+=`
          <div style="padding:0.5rem;background:var(--surface);border:1px solid var(--info);border-radius:0.375rem;margin-top:0.75rem">
            <div class="text-sm text-muted" style="margin-bottom:0.5rem">Uncheck items you don't want. Click + to add comments.</div>
            <div class="flex gap-sm" style="flex-wrap:wrap">
              <button class="btn btn-sm btn-primary" onclick="window.__approvePlan('${c(t.file||"")}')">Approve & Build</button>
              <button class="btn btn-sm" onclick="window.__submitFeedback()">Give Feedback</button>
              <button class="btn btn-sm" onclick="window.__keepPlan('${c(t.file||"")}')">Later</button>
              <button class="btn btn-sm" onclick="this.closest('.chat-msg').remove()">Dismiss</button>
            </div>
          </div>
        `),t.agent&&t.agent!=="supervisor"&&(n=`<span class="badge" style="font-size:0.6rem;margin-right:4px">${c(t.agent)}</span>`+n),B(n,"bot");break}case"error":We(),B(`<span style="color:var(--danger)">${c(t.message||"Unknown error")}</span>`,"bot"),H="Error",U();break;case"plan_failed":{const n=t.completed||0,i=t.total||0,o=t.failed_step||0,s=`
        <div style="padding:0.5rem;background:var(--surface);border:1px solid var(--warn);border-radius:0.375rem;margin-top:0.25rem">
          <div class="text-sm" style="margin-bottom:0.5rem">${n} of ${i} steps completed. Failed at step ${o}.</div>
          <div class="flex gap-sm">
            <button class="btn btn-sm btn-primary" onclick="window.__resumePlan('${c(t.file||"")}')">Resume</button>
            <button class="btn btn-sm" onclick="this.closest('.chat-msg').remove()">Dismiss</button>
          </div>
        </div>
      `;B(s,"bot");break}case"done":H="Done",We(),ue("Done","supervisor"),setTimeout(()=>{H="Idle",U()},3e3);break}}async function Yt(e){B(`<span style="color:var(--success)">Plan approved — let's build it!</span>`,"user"),H="Executing plan...",ue("Plan approved — building...","supervisor"),me("Building...");const t={plan_file:e,settings:{thinking:T.thinking,vision:T.vision,imageGen:T.imageGen}};try{const n=await fetch("/__dev/api/execute",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!n.ok||!n.body)return;const i=n.body.getReader(),o=new TextDecoder;let s="";for(;;){const{done:d,value:a}=await i.read();if(d)break;s+=o.decode(a,{stream:!0});const m=s.split(`
`);s=m.pop()||"";let u="";for(const w of m)if(w.startsWith("event: "))u=w.slice(7).trim();else if(w.startsWith("data: "))try{Ie(u,JSON.parse(w.slice(6)))}catch{}}}catch{B('<span style="color:var(--danger)">Plan execution failed</span>',"bot")}}function Kt(e){B(`<span style="color:var(--muted)">Plan saved for later: ${c(e)}</span>`,"bot")}function Qt(){const{accepted:e,rejected:t,comments:n}=De();let i=`Here's my feedback on the proposal:

`;e.length&&(i+=`**Keep these:**
`+e.map(s=>`- ${s}`).join(`
`)+`

`),t.length&&(i+=`**Remove these:**
`+t.map(s=>`- ${s}`).join(`
`)+`

`),n.length&&(i+=`**Comments:**
`+n.map(s=>`- ${s}`).join(`
`)+`

`),!t.length&&!n.length&&(i+="Everything looks good. "),i+="Please revise the plan based on this feedback.";const o=document.getElementById("chat-input");o&&(o.value=i,K())}async function Xt(e){B('<span style="color:var(--info)">Resuming plan...</span>',"user"),H="Resuming...",me("Resuming...");const t={plan_file:e,resume:!0,settings:{thinking:T.thinking,vision:T.vision,imageGen:T.imageGen}};try{const n=await fetch("/__dev/api/execute",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!n.ok||!n.body)return;const i=n.body.getReader(),o=new TextDecoder;let s="";for(;;){const{done:d,value:a}=await i.read();if(d)break;s+=o.decode(a,{stream:!0});const m=s.split(`
`);s=m.pop()||"";let u="";for(const w of m)if(w.startsWith("event: "))u=w.slice(7).trim();else if(w.startsWith("data: "))try{Ie(u,JSON.parse(w.slice(6)))}catch{}}}catch{B('<span style="color:var(--danger)">Resume failed</span>',"bot")}}window.__resumePlan=Xt,window.__submitFeedback=Qt,window.__approvePlan=Yt,window.__keepPlan=Kt;async function Zt(){try{const e=await q("/chat/undo","POST");B(`<span style="color:var(--warn)">${c(e.message||"Undo complete")}</span>`,"bot")}catch{B('<span style="color:var(--warn)">Nothing to undo</span>',"bot")}}const D=[];function en(){const e=document.getElementById("chat-file-input");e!=null&&e.files&&(document.getElementById("chat-attachments"),Array.from(e.files).forEach(t=>{const n=new FileReader;n.onload=()=>{D.push({name:t.name,data:n.result}),Me()},n.readAsDataURL(t)}),e.value="")}function Me(){const e=document.getElementById("chat-attachments");if(e){if(!D.length){e.style.display="none";return}e.style.display="flex",e.style.cssText+="gap:0.375rem;flex-wrap:wrap;margin-bottom:0.375rem;font-size:0.75rem",e.innerHTML=D.map((t,n)=>`<span style="background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:2px 8px;display:inline-flex;align-items:center;gap:4px">
      ${c(t.name)} <span style="cursor:pointer;color:var(--danger)" onclick="window.__removeFile(${n})">&times;</span>
    </span>`).join("")}}function tn(e){D.splice(e,1),Me()}let X=!1,P=null;function nn(){const e=document.getElementById("chat-mic-btn"),t=window.SpeechRecognition||window.webkitSpeechRecognition;if(!t){B('<span style="color:var(--warn)">Speech recognition not supported in this browser</span>',"bot");return}if(X&&P){P.stop(),X=!1,e&&(e.textContent="Mic",e.style.background="");return}P=new t,P.continuous=!1,P.interimResults=!1,P.lang="en-US",P.onresult=n=>{const i=n.results[0][0].transcript,o=document.getElementById("chat-input");o&&(o.value=(o.value?o.value+" ":"")+i)},P.onend=()=>{X=!1,e&&(e.textContent="Mic",e.style.background="")},P.onerror=()=>{X=!1,e&&(e.textContent="Mic",e.style.background="")},P.start(),X=!0,e&&(e.textContent="Stop",e.style.background="var(--danger)")}window.__removeFile=tn;function Je(e){let t=e.replace(/\\n/g,`
`);const n=[];t=t.replace(/```(\w*)\n([\s\S]*?)```/g,(d,a,m)=>{const u=n.length;return n.push(`<pre style="background:var(--bg);padding:0.75rem;border-radius:0.375rem;overflow-x:auto;margin:0.5rem 0;font-size:0.75rem;border:1px solid var(--border)"><code>${m}</code></pre>`),`\0CODE${u}\0`});const i=t.split(`
`),o=[];for(const d of i){const a=d.trim();if(a.startsWith("\0CODE")){o.push(a);continue}if(a.startsWith("### ")){o.push(`<div style="font-weight:700;font-size:0.8rem;margin:0.75rem 0 0.25rem;color:var(--info)">${a.slice(4)}</div>`);continue}if(a.startsWith("## ")){o.push(`<div style="font-weight:700;font-size:0.9rem;margin:0.75rem 0 0.25rem">${a.slice(3)}</div>`);continue}if(a.startsWith("# ")){o.push(`<div style="font-weight:700;font-size:1rem;margin:0.75rem 0 0.25rem">${a.slice(2)}</div>`);continue}if(a==="---"||a==="***"){o.push('<hr style="border:none;border-top:1px solid var(--border);margin:0.5rem 0">');continue}const m=a.match(/^(\d+)[.)]\s+(.+)/);if(m){if(m[2].trim().endsWith("?")){const w=`q-${de}-${m[1]}`;o.push(`<div style="margin:0.3rem 0;padding-left:0.5rem">
          <div style="margin-bottom:4px"><span style="color:var(--info);font-weight:600;margin-right:0.4rem">${m[1]}.</span>${Z(m[2])}</div>
          <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">
            <input type="text" class="input chat-answer-input" id="${w}" data-q="${m[1]}" placeholder="Your answer..." style="font-size:0.75rem;padding:4px 8px;flex:1;max-width:350px">
            <button class="btn btn-sm" style="font-size:0.6rem;padding:2px 6px" onclick="window.__quickAnswer(this,'Yes')">Yes</button>
            <button class="btn btn-sm" style="font-size:0.6rem;padding:2px 6px" onclick="window.__quickAnswer(this,'No')">No</button>
            <button class="btn btn-sm" style="font-size:0.6rem;padding:2px 6px" onclick="window.__quickAnswer(this,'Later')">Later</button>
            <button class="btn btn-sm" style="font-size:0.6rem;padding:2px 6px" onclick="window.__quickAnswer(this,'Skip')">Skip</button>
          </div>
        </div>`)}else o.push(`<div style="margin:0.15rem 0;padding-left:1.5rem"><span style="color:var(--info);font-weight:600;margin-right:0.4rem">${m[1]}.</span>${Z(m[2])}</div>`);continue}if(a.startsWith("- ")){const u=`chk-${de}-${o.length}`,w=a.slice(2);o.push(`<div style="margin:0.15rem 0;padding-left:0.5rem;display:flex;align-items:flex-start;gap:6px" class="chat-checklist-item">
        <input type="checkbox" id="${u}" checked style="margin-top:3px;cursor:pointer;accent-color:var(--success)">
        <label for="${u}" style="flex:1;cursor:pointer">${Z(w)}</label>
        <button class="btn btn-sm" style="font-size:0.55rem;padding:1px 4px;opacity:0.5;flex-shrink:0" onclick="window.__commentOnItem(this)" title="Add comment">+</button>
      </div>`);continue}if(a.startsWith("> ")){o.push(`<div style="border-left:3px solid var(--info);padding-left:0.75rem;margin:0.3rem 0;color:var(--muted);font-style:italic">${Z(a.slice(2))}</div>`);continue}if(a===""){o.push('<div style="height:0.4rem"></div>');continue}o.push(`<div style="margin:0.1rem 0">${Z(a)}</div>`)}let s=o.join("");return n.forEach((d,a)=>{s=s.replace(`\0CODE${a}\0`,d)}),s}function Z(e){return e.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\*(.+?)\*/g,"<em>$1</em>").replace(/`([^`]+)`/g,'<code style="background:var(--bg);padding:0.1rem 0.3rem;border-radius:0.2rem;font-size:0.8em;border:1px solid var(--border)">$1</code>')}function on(e){const t=document.getElementById("chat-input");t&&(t.value=e,t.focus(),t.scrollTop=t.scrollHeight)}window.__sendChat=K,window.__undoChat=Zt,window.__prefillChat=on;const Ue=document.createElement("style");Ue.textContent=ct,document.head.appendChild(Ue);const Ve=lt();dt(Ve);const Ce=[{id:"routes",label:"Routes",render:ut},{id:"database",label:"Database",render:pt},{id:"errors",label:"Errors",render:kt},{id:"metrics",label:"Metrics",render:Ct},{id:"system",label:"System",render:Tt}],Ye={id:"chat",label:"Code With Me",render:Pt};let pe=localStorage.getItem("tina4_cwm_unlocked")==="true",ge=pe?[Ye,...Ce]:[...Ce],ee=pe?"chat":"routes";function sn(){const e=document.getElementById("app");if(!e)return;e.innerHTML=`
    <div class="dev-admin">
      <div class="dev-header">
        <h1><span>Tina4</span> Dev Admin</h1>
        <div style="display:flex;align-items:center;gap:0.75rem">
          <span class="text-sm text-muted" id="version-label" style="cursor:default;user-select:none">${Ve.name} &bull; v3.10.70</span>
          <button class="btn btn-sm" onclick="window.__closeDevAdmin()" title="Close Dev Admin" style="font-size:14px;width:28px;height:28px;padding:0;line-height:1">&times;</button>
        </div>
      </div>
      <div class="dev-tabs" id="tab-bar"></div>
      <div class="dev-content" id="tab-content"></div>
    </div>
  `;const t=document.getElementById("tab-bar");t.innerHTML=ge.map(n=>`<button class="dev-tab ${n.id===ee?"active":""}" data-tab="${n.id}" onclick="window.__switchTab('${n.id}')">${n.label}</button>`).join(""),Le(ee)}function Le(e){ee=e,document.querySelectorAll(".dev-tab").forEach(o=>{o.classList.toggle("active",o.dataset.tab===e)});const t=document.getElementById("tab-content");if(!t)return;const n=document.createElement("div");n.className="dev-panel active",t.innerHTML="",t.appendChild(n);const i=ge.find(o=>o.id===e);i&&i.render(n)}function an(){if(window.parent!==window)try{const e=window.parent.document.getElementById("tina4-dev-panel");e&&e.remove()}catch{document.body.style.display="none"}}window.__closeDevAdmin=an,window.__switchTab=Le,sn();let Be=0,ze=null;(Ke=document.getElementById("version-label"))==null||Ke.addEventListener("click",()=>{if(!pe&&(Be++,ze&&clearTimeout(ze),ze=setTimeout(()=>{Be=0},2e3),Be>=5)){pe=!0,localStorage.setItem("tina4_cwm_unlocked","true"),ge=[Ye,...Ce],ee="chat";const e=document.getElementById("tab-bar");e&&(e.innerHTML=ge.map(t=>`<button class="dev-tab ${t.id===ee?"active":""}" data-tab="${t.id}" onclick="window.__switchTab('${t.id}')">${t.label}</button>`).join("")),Le("chat")}})})();
