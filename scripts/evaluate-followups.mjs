import {build} from 'esbuild';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'tina4-followup-'));
const cases=[
 ["Make the project cards readable on phones, and replace the generic project titles and descriptions with useful illustrative examples. Keep all three projects, the image placeholders and my contact details.","content"],
 ['Fix the unreadable button text. Keep the content and images.','appearance'],
 ['Make Explore Our Work jump to the services section. Keep everything else.','content'],
 ['Make the background light pink.','appearance'],
 ['Add a small card below the FAQ. Keep existing content.','content'],
 ['Change the heading to Welcome aboard.','content'],
 ['Make the headings smaller.','appearance'],
 ['Give the cards more breathing room.','appearance'],
 ['Add an About page and link to it from Read more.','creation'],
 ['Explain what this page does.','inspection'],
 ['Use my uploaded image in the hero.','content'],
 ['Keep the wording and fix the overlap.','appearance'],
 ['Make the contact button open an email to hello@example.com.','content'],
 ['Change the phone number to 0123456789.','content'],
 ['Make this layout work on a phone. Keep the copy.','appearance'],
 ['Add a three-step process section with useful copy.','content'],
 ['Build a new pricing page.','creation'],
 ['Check the preview without changing it.','inspection'],
 ['Rename the button and make it blue.','content'],
 ['Add an About page for the bakery and a Read our story link next to View Opening Hours on the home page. Keep the existing content.','creation'],
 ['Add a View opening hours button below the welcome text that jumps to Visit Us. Keep the existing content.','content'],
 ['Add our contact details from the profile and make Get In Touch go there. Keep the existing content.','content'],
];
const report=[];
try{
 await build({entryPoints:[resolve('src/ai-followup-operation.ts'),resolve('src/ai-gateway.ts')],outdir:dir,bundle:true,platform:'node',format:'esm'});
 const {classifyFollowupOperation}=await import(pathToFileURL(join(dir,'ai-followup-operation.js')));
 const {streamChat}=await import(pathToFileURL(join(dir,'ai-gateway.js')));
 for(const [task,expected] of cases){
  let actual,error;const began=Date.now();
  try{actual=await classifyFollowupOperation(task,async(prompt,limit,think,system,projectGuidance)=>{let out='';await streamChat({model:'local',projectGuidance,think,options:{num_predict:limit,temperature:0},messages:[{role:'system',content:system},{role:'user',content:prompt}]},{signal:AbortSignal.timeout(60000),onContent:t=>out+=t});return out;});}catch(e){error=String(e);}
  const result={task,expected,actual,error,passed:expected===actual,seconds:(Date.now()-began)/1000};report.push(result);console.log(JSON.stringify(result));await writeFile('/tmp/tina4-followup-results.json',JSON.stringify(report,null,2));
 }
}finally{await rm(dir,{recursive:true,force:true});}
console.log(`${report.filter(r=>r.passed).length}/${report.length} passed`);
if(report.some(r=>!r.passed))process.exitCode=1;
