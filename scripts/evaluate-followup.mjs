import {build} from 'esbuild';
import postcss from 'postcss';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const backend=process.env.TINA4_BACKEND || 'http://127.0.0.1:7150';
const name=process.env.TINA4_PAGE || 'eval_i_2';
const originalFetch=fetch;
globalThis.fetch=(url,options)=>originalFetch(typeof url==='string'&&url.startsWith('/')?new URL(url,backend):url,options);
const dir=await mkdtemp(join(tmpdir(),'tina4-followup-'));
try {
 await build({entryPoints:[resolve('src/ai-agent.ts')],outfile:join(dir,'agent.mjs'),bundle:true,platform:'node',format:'esm'});
 const {runAgent,createAgentSession}=await import(pathToFileURL(join(dir,'agent.mjs')));
 const read=async path=>(await (await fetch('/__dev/api/mcp/call',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'file_read',arguments:{path}})})).json()).result;
 const template=`src/templates/pages/${name}.twig`, style=`src/scss/${name}.scss`;
 const before={template:await read(template),style:await read(style)};
 const session=createAgentSession(); session.activePage={name,files:[template,style]};
 session.conversation=[{role:'user',content:'This is my portfolio page.'},{role:'assistant',content:`Built /${name}.`},{role:'user',content:'I want a pink background'},{role:'assistant',content:'What shade of pink?'}];
 const tools=[];
 const result=await runAgent({session,task:process.env.TINA4_EDIT_TASK || 'Light shade',model:'empero-ai/Qwen3.8-2B-Distill',think:true,authorizeTool:async()=>true,onEvent:e=>{if(e.type==='content') process.stdout.write(e.text || ''); if(e.type==='tool_start'){tools.push({name:e.tool,args:e.args}); console.log(e.tool,e.args?.path||'');}}});
 const after={template:await read(template),style:await read(style)};
 const compiled=await (await fetch(`/css/${name}.css`)).text();
 const added=after.style.split('\n').filter(line=>!before.style.split('\n').includes(line));
 const expected=process.env.TINA4_EXPECT_CSS;
 const requestedStyle=expected ? new RegExp(expected,'i').test(compiled) : added.some(line=>/background/.test(line)&&[...line.matchAll(/#([0-9a-f]{6})\b/gi)].some(match=>{
   const [r,g,b]=[0,2,4].map(i=>parseInt(match[1].slice(i,i+2),16));
   return r>=230 && g>=175 && b>=190 && r>g && b>g && compiled.toLowerCase().includes(match[0].toLowerCase());
 }));
 const declarations=source=>{
  const values={};
  postcss.parse(source).walkDecls(decl=>{
   const parents=[];let parent=decl.parent;
   while(parent&&parent.type!=='root'){parents.unshift(parent.selector||`@${parent.name} ${parent.params}`);parent=parent.parent;}
   const stem=parents.join(' > ')+'|'+decl.prop;let key=stem,index=0;
   while(key in values) key=stem+'|'+(++index);
   values[key]=decl.value;
  });return values;
 };
 const oldValues=declarations(before.style),newValues=declarations(after.style);
 const expectedProperty=process.env.TINA4_EXPECT_PROPERTY || 'background(?:-color)?';
 const allowed=new RegExp('\\|'+expectedProperty+'(?:\\|[0-9]+)?$');
 const unrelatedStylesPreserved=Object.entries(oldValues).every(([key,value])=>key in newValues&&(allowed.test(key)||newValues[key]===value));
 const report={result,tools,requestedStyle,unrelatedStylesPreserved,added,unchangedTemplate:before.template===after.template,before:before.style,after:after.style};
 await writeFile('/tmp/tina4-followup-evaluation.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({result,unchangedTemplate:report.unchangedTemplate,changedStyles:before.style!==after.style,requestedStyle,unrelatedStylesPreserved,scaffoldCalls:tools.filter(t=>t.name==='scaffold').length}));
 if(!unrelatedStylesPreserved||!requestedStyle||result.stopped!=='final_answer'||tools.some(t=>t.name==='scaffold')||before.template!==after.template||before.style===after.style) process.exitCode=1;
} finally {await rm(dir,{recursive:true,force:true});}
