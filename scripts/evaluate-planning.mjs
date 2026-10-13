// Real local model + backend. Stops at the normal plan approval boundary.
import {build} from 'esbuild';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const backend=process.env.TINA4_BACKEND || 'http://127.0.0.1:7150';
const nativeFetch=fetch;
globalThis.fetch=(url,options)=>nativeFetch(typeof url==='string'&&url.startsWith('/')?new URL(url,backend):url,options);
const dir=await mkdtemp(join(tmpdir(),'tina4-plan-check-'));
const cases=[
 {task:'Create a landing page for Cedar plumbing services. Local homeowners should email bookings@cedar.test to book a visit. Use your judgment on wording and design.',kind:'page',name:'index'},
 {task:'Build a home page for my pottery studio, Clay House. Show a short introduction and link to mailto:hello@clay.test for workshop enquiries. Choose the rest.',kind:'page',name:'index'},
 {task:'Create a scheduled background service named inventory_sync that runs every minute and logs a heartbeat. No web page is required.',kind:'service',name:'inventory_sync'},
];
const report=[];
try {
 await build({entryPoints:[resolve('src/ai-agent.ts')],outfile:join(dir,'agent.mjs'),bundle:true,platform:'node',format:'esm'});
 const {runAgent,createAgentSession}=await import(pathToFileURL(join(dir,'agent.mjs')));
 for(const scenario of cases) {
  const session=createAgentSession();
  let plan;
  const decline=async()=>{plan=session.plan;return false;};
  let result=await runAgent({session,task:scenario.task,model:'empero-ai/Qwen3.8-2B-Distill',think:true,signal:AbortSignal.timeout(120000),authorizeTool:decline});
  if(result.stopped==='clarification') result=await runAgent({session,task:'Use only the supplied details. Omit any unspecified contact fields or sections. Proceed with the requested component.',model:'empero-ai/Qwen3.8-2B-Distill',think:true,signal:AbortSignal.timeout(120000),authorizeTool:decline});
  const passed=result.stopped==='approval_required'&&plan?.kind===scenario.kind&&plan?.name===scenario.name;
  report.push({scenario,result,plan,passed});
  console.log(JSON.stringify(report.at(-1)));
  if(!passed) process.exitCode=1;
 }
} finally { await writeFile('/tmp/tina4-planning-evaluation.json',JSON.stringify(report,null,2)); await rm(dir,{recursive:true,force:true}); }
