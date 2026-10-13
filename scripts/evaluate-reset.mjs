// Real backend/model regression for a removed, unfinished scaffold.
import {build} from 'esbuild';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const backend=process.env.TINA4_BACKEND || 'http://127.0.0.1:7150';
const nativeFetch=fetch;
globalThis.fetch=(url,options)=>nativeFetch(typeof url==='string'&&url.startsWith('/')?new URL(url,backend):url,options);
const dir=await mkdtemp(join(tmpdir(),'tina4-reset-check-'));
try {
 await build({entryPoints:[resolve('src/ai-agent.ts')],outfile:join(dir,'agent.mjs'),bundle:true,platform:'node',format:'esm'});
 const {runAgent,createAgentSession}=await import(pathToFileURL(join(dir,'agent.mjs')));
 const session=createAgentSession();
 Object.assign(session,{conversation:[{role:'user',content:'OLD_REMOVED_BUILD'}],brief:'old bio website',plan:{kind:'page',name:'removed_reset_fixture',title:'Old about',goal:'Old task'},planSaved:true,scaffoldFiles:['src/templates/pages/removed_reset_fixture.twig','src/routes/removed_reset_fixture.py'],verified:false});
 const tools=[],phases=[];
 const result=await runAgent({session,task:'build me a landing page',model:'empero-ai/Qwen3.8-2B-Distill',think:true,signal:AbortSignal.timeout(120000),authorizeTool:async()=>false,onEvent:event=>{if(event.type==='tool_start')tools.push(event.tool);if(event.type==='phase')phases.push(event.text);}});
 const passed=result.stopped==='clarification'&&!session.scaffoldFiles&&!session.planSaved&&!session.conversation.some(m=>m.content.includes('OLD_REMOVED_BUILD'))&&!tools.includes('scaffold')&&!tools.includes('file_write');
 const report={passed,result,phases,tools};
 await writeFile('/tmp/tina4-reset-evaluation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 if(!passed)process.exitCode=1;
} finally {await rm(dir,{recursive:true,force:true});}
