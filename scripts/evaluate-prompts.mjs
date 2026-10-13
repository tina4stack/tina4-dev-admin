// Real local gateway and an existing isolated project. No generated app files.
import {build} from 'esbuild';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const backend=process.env.TINA4_BACKEND||'http://127.0.0.1:7150';
if(process.env.TINA4_GATEWAY) globalThis.TINA4_AI_GATEWAY=process.env.TINA4_GATEWAY;
const model=process.env.TINA4_MODEL||'empero-ai/Qwen3.8-2B-Distill';
const reportPath=process.env.TINA4_REPORT||'/tmp/tina4-prompt-evaluation.json';
const nativeFetch=fetch;
globalThis.fetch=(url,options)=>nativeFetch(typeof url==='string'&&url.startsWith('/')?new URL(url,backend):url,options);
const dir=await mkdtemp(join(tmpdir(),'tina4-prompt-eval-'));
const report=[];
const check=async(name,fn)=>{const start=Date.now();try{const details=await fn();report.push({name,passed:details.passed,seconds:(Date.now()-start)/1000,...details});}catch(error){report.push({name,passed:false,seconds:(Date.now()-start)/1000,error:String(error)});}await writeFile(reportPath,JSON.stringify(report,null,2));console.log(JSON.stringify(report.at(-1)));};
try {
 await build({entryPoints:[resolve('src/ai-navigation.ts'),resolve('src/ai-agent.ts'),resolve('src/ai-followup.ts'),resolve('src/ai-visual.ts')],outdir:dir,bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'}});
 const {previewIntent}=await import(pathToFileURL(join(dir,'ai-navigation.mjs')));
 const {runAgent,createAgentSession}=await import(pathToFileURL(join(dir,'ai-agent.mjs')));
 const {parseEditProposal,applyExactEdits}=await import(pathToFileURL(join(dir,'ai-followup.mjs')));
 const {inspectPreview}=await import(pathToFileURL(join(dir,'ai-visual.mjs')));
 const cases=[['Let me see the journal','preview','/journal'],['Take me to the catalog','preview','/catalog'],['Change the title on the journal page','continue'],['Show a contact link in the header','continue'],['Why is the heading overlapping?','continue'],['Open the contact page','question']];
 for(const [task,action,route] of cases) await check(task,async()=>{const result=await previewIntent(task,['/journal','/catalog'],'/catalog',model,AbortSignal.timeout(90000));return {result,passed:result.action===action&&(!route||result.route===route)};});
 const name='eval_repair_1345_2';
 const paths=[`src/templates/pages/${name}.twig`,`src/scss/${name}.scss`];
 const read=async path=>{const data=await(await fetch('/__dev/api/mcp/call',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'file_read',arguments:{path}})})).json();if(!data.ok||typeof data.result!=='string'||data.result.startsWith('File not found:'))throw new Error('Fixture unavailable: '+path);return data.result;};
 const files=Object.fromEntries(await Promise.all(paths.map(async path=>[path,await read(path)])));
 for(const scenario of [
  {task:'Explain what this page currently contains. Do not change anything.',inspect:true},
  {task:'Change the main heading to Riverside Cycle Studio. Keep everything else unchanged.',target:paths[0],needle:'Riverside Cycle Studio',exactHeading:true},
  {task:'Set the page background to pale lavender #f3efff. Leave other styles unchanged.',target:paths[1],needle:'#f3efff'},
  {task:'A light shade, please.',history:[{role:'user',content:'Make the background pink.'},{role:'assistant',content:'Which shade of pink?'}],target:paths[1],needle:/#[a-f0-9]{6}/i},
 ]) await check(scenario.task,async()=>{
  const session=createAgentSession();session.activePage={name,files:paths};session.conversation=scenario.history||[];
  const chunks=new Map();const mutations=[];
  const result=await runAgent({session,model,task:scenario.task,signal:AbortSignal.timeout(120000),authorizeTool:async(tool)=>{mutations.push(tool.name);return false;},onEvent:event=>{if(event.type==='content')chunks.set(event.step,(chunks.get(event.step)||'')+event.text);}});
  if(scenario.inspect)return {result,mutations,passed:result.stopped==='final_answer'&&mutations.length===0&&result.answer.length<1000&&!/missing visual preview|no contact information/i.test(result.answer)};
  let updated={};for(const text of chunks.values()){try{const proposal=parseEditProposal(text);if(proposal.action==='edit')updated=applyExactEdits(files,proposal.edits);}catch{}}
  const source=updated[scenario.target]||'';
  const passed=result.stopped==='approval_required'&&Object.keys(updated).length===1&&(scenario.exactHeading ? source===files[scenario.target].replace('<h1>Northstar Bicycle Repairs</h1>','<h1>Riverside Cycle Studio</h1>') : typeof scenario.needle==='string'?source.includes(scenario.needle):scenario.needle.test(source));
  return {result,mutations,changedPaths:Object.keys(updated),updated,responses:[...chunks.values()],passed};
 });
 for(const fixture of [
  {name:'Readable mobile preview',path:'/tmp/tina4-auto-captured.png',ok:true},
  {name:'Overlapping blog headings',path:'/var/folders/ng/s__btvhd6q703hr6m9rl931h0000gn/T/codex-clipboard-e89eef9d-f618-4855-8518-4f05419025ae.png',ok:false},
 ]) await check(fixture.name,async()=>{const result=await inspectPreview({image:(await readFile(fixture.path)).toString('base64'),route:'/example',width:390,height:844},'Check for visible layout defects; do not redesign.',model,AbortSignal.timeout(90000));return {result,passed:result.ok===fixture.ok&&(fixture.ok||/overlap/i.test(JSON.stringify(result)))};});
 for(const path of paths)if(await read(path)!==files[path])throw new Error('Evaluation unexpectedly changed '+path);
}finally{await rm(dir,{recursive:true,force:true});}
console.log(`${report.filter(r=>r.passed).length}/${report.length} passed; ${reportPath}`);
if(report.some(r=>!r.passed))process.exitCode=1;
