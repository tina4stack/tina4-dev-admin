import {build} from 'esbuild';
import postcss from 'postcss';
import {mkdtemp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root='/tmp/tina4-harness-evaluation', backend='http://127.0.0.1:7150';
const name='eval_repair_1345_2',template=`src/templates/pages/${name}.twig`,style=`src/scss/${name}.scss`;
const original=Object.fromEntries(await Promise.all([template,style].map(async p=>[p,await readFile(join(root,p),'utf8')])));
const baseline={...original,[style]:original[style].replace('#fff0f5','#ffffff')};
const beforePlans=new Set(await readdir(join(root,'plan')));
const native=fetch;globalThis.fetch=(url,options)=>native(typeof url==='string'&&url.startsWith('/')?new URL(url,backend):url,options);
const dir=await mkdtemp(join(tmpdir(),'tina4-write-eval-'));const report=[];
const declarations=s=>{const out={};postcss.parse(s).walkDecls(d=>{let p=d.parent,parents=[];while(p&&p.type!=='root'){parents.unshift(p.selector||`@${p.name} ${p.params}`);p=p.parent;}let stem=parents.join('>')+'|'+d.prop,k=stem,i=0;while(k in out)k=stem+'|'+(++i);out[k]=d.value;});return out;};
try{
 await build({entryPoints:[resolve('src/ai-agent.ts')],outfile:join(dir,'agent.mjs'),bundle:true,platform:'node',format:'esm'});
 const {runAgent,createAgentSession}=await import(pathToFileURL(join(dir,'agent.mjs')));
 for(const [label,model,port] of [[process.env.TINA4_LABEL||'gemma',process.env.TINA4_MODEL||'mlx-community/gemma-4-e4b-it-4bit',Number(process.env.TINA4_PORT||11438)]]){
 globalThis.TINA4_AI_GATEWAY=`http://127.0.0.1:${port}`;
 for(const [kind,task,history] of [
 ['heading','Change the main heading to Riverside Cycle Studio. Keep everything else unchanged.',[]],
 ['lavender','Set the page background to pale lavender #f3efff. Leave other styles unchanged.',[]],
 ['followup','A light shade, please.',[{role:'user',content:'Make the background pink.'},{role:'assistant',content:'Which shade of pink?'}]]]){
 if(process.env.TINA4_CASE && process.env.TINA4_CASE!==kind)continue;
 for(const [p,s] of Object.entries(baseline))await writeFile(join(root,p),s);
 await fetch(`${backend}/${name}`);await new Promise(r=>setTimeout(r,1500));await fetch(`${backend}/css/${name}.css`);
 const session=createAgentSession();session.activePage={name,files:[template,style]};session.conversation=history;
 const tools=[];const start=Date.now();let result;
 try{result=await runAgent({session,model,task,signal:AbortSignal.timeout(120000),authorizeTool:async()=>true,onEvent:e=>{if(e.type==='tool_start')tools.push({name:e.tool,args:e.args});}});}catch(e){result={stopped:'error',answer:String(e)};}
 const after=Object.fromEntries(await Promise.all([template,style].map(async p=>[p,await readFile(join(root,p),'utf8')])));
 const page=await fetch(`${backend}/${name}`),html=await page.text(),css=await(await fetch(`${backend}/css/${name}.css`)).text();
 let preserved=false,requested=false,changes=[];
 try{const a=declarations(baseline[style]),b=declarations(after[style]);changes=[...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>a[k]!==b[k]).map(k=>({key:k,before:a[k],after:b[k]}));
 if(kind==='heading'){preserved=after[style]===baseline[style]&&after[template]===baseline[template].replace('Northstar Bicycle Repairs','Riverside Cycle Studio');requested=html.includes('<h1>Riverside Cycle Studio</h1>');}
 else{preserved=after[template]===baseline[template]&&changes.length===1&&changes[0].key==='body|background-color';const color=b['body|background-color'];requested=kind==='lavender'?color==='#f3efff':/^#[a-f0-9]{6}$/i.test(color)&&(()=>{const [r,g,bl]=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));return r>=230&&g>=175&&bl>=190&&r>g&&bl>=g;})();requested=requested&&css.toLowerCase().includes(color.toLowerCase());}}
 catch(e){changes.push({parseError:String(e)});}
 const row={label,kind,task,seconds:(Date.now()-start)/1000,result,tools,changes,preserved,requested,httpStatus:page.status,passed:result.stopped==='final_answer'&&preserved&&requested&&page.ok&&!tools.some(t=>t.name==='scaffold')};report.push(row);await writeFile(process.env.TINA4_REPORT || '/tmp/tina4-gemma-writes-final.json',JSON.stringify(report,null,2));console.log(JSON.stringify(row));
 }
 }
}finally{
 for(const [p,s] of Object.entries(original))await writeFile(join(root,p),s);
 for(const p of await readdir(join(root,'plan')))if(!beforePlans.has(p))await rm(join(root,'plan',p),{recursive:true,force:true});
 await rm(dir,{recursive:true,force:true});
}
console.log(`${report.filter(r=>r.passed).length}/${report.length} passed`);
