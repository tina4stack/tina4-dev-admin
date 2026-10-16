// Live model evaluation, no fixture writes and no mocked model responses.
import {build} from 'esbuild';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const dir=await mkdtemp(join(tmpdir(),'tina4-intent-'));
const report=[];
const cases=[
 ['Explain what this page does. Do not change files.','answer'],
 ['What do you know about the uploaded company profile?','answer'],
 ['Add a page for the existing Services link.','change'],
 ['Make the background a light pink.','change'],
 ['Add a process diagram below this heading.','change'],
 ['Use the image I uploaded in the hero.','change'],
 ['Show me the contact page.','navigate'],
 ['Check whether the headings overlap.','inspect'],
 ['Check the home page and fix any unreadable text. Keep the content and image.','change'],
 ['Review the layout and correct any overlap.','change'],
 ['Click the buttons and verify the results.','test'],
 ['Build a calculator and check its results.','change'],
 ['All the basics.','change',{task:'Build a calculator',question:'Which operations should it support?'}],
 ['A light shade.','change',{task:'Change the background to pink',question:'What shade?'}],
 ['Actually, explain the ORM instead.','answer',{task:'Build a calculator',question:'Which operations?'}],
];
try{
 await build({entryPoints:[resolve('src/ai-request-intent.ts')],outfile:join(dir,'intent.mjs'),bundle:true,platform:'node',format:'esm'});
 const {classifyRequest}=await import(pathToFileURL(join(dir,'intent.mjs')));
 for(const [task,expected,pending] of cases){
  const began=Date.now();let actual,error;
  try{actual=await classifyRequest(task,[],process.env.TINA4_MODEL||'local',AbortSignal.timeout(60000),pending);}catch(e){error=String(e);}
  const item={task,expected,actual,error,passed:actual===expected,seconds:(Date.now()-began)/1000};
  report.push(item);console.log(JSON.stringify(item));
  await writeFile('/tmp/tina4-intent-results.json',JSON.stringify(report,null,2));
 }
}finally{await rm(dir,{recursive:true,force:true});}
console.log(`${report.filter(r=>r.passed).length}/${report.length} passed`);
if(report.some(r=>!r.passed))process.exitCode=1;
