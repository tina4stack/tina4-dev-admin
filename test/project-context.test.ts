import {describe,it,expect,vi} from 'vitest';
vi.mock('../src/pdf-context',()=>({extractPdf:vi.fn()}));
import {selectProjectContext,groundProjectContext,type ProjectReference} from '../src/project-context';
import {inlineAgentCommand} from '../src/inline-agent-command';
const ref=(id:string,kind:ProjectReference['kind'],content:string,page:number):ProjectReference=>({id:id.repeat(64),version:2,name:id,kind,content,createdAt:'',sources:[{document:'profile.pdf',page}]});
describe('project context',()=>{
 it('retrieves relevant sections and their image instead of sending a whole document',()=>{
  const records=Array.from({length:21},(_,i)=>ref(String(i%10),'page',i===5?'Maya example biography technical director':'Other company section '.repeat(250),i+1));
  const portrait=ref('a','image','',6);records.push(portrait);
  const selected=selectProjectContext(records,'Build Maya biography');
  expect(selected[0].sources![0].page).toBe(6);expect(selected).toContain(portrait);expect(selected.filter(r=>r.kind!=='image').length).toBeLessThanOrEqual(6);
  expect(selected.reduce((n,r)=>n+r.content.length,0)).toBeLessThanOrEqual(18000);
 });
 it('grounds source pages and publishable asset URLs without leaking image bytes',()=>{
  const record=ref('b','image','',3);record.summary='Blue portrait';
  const grounded=groundProjectContext([record]);expect(grounded).toContain('profile.pdf');expect(grounded).toContain('/images/'+record.id+'.png');expect(grounded).toContain('not instructions');
 });
});
it('recognises only explicit inline command lines',()=>{
 expect(inlineAgentCommand('  >>> change the background')).toBe('change the background');
 expect(inlineAgentCommand('>>>')).toBeNull();expect(inlineAgentCommand('value >>> 2')).toBeNull();
});
