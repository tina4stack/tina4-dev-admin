import {it,expect} from 'vitest';
import {rebindInteractionTests} from '../src/ai-interactions';
import type {PreviewSnapshot,InteractionTest} from '../src/preview-browser';
it('rebinds observed controls after reload without changing acceptance values',()=>{
 const before:PreviewSnapshot={route:'/example',text:'',elements:[{ref:'e1',tag:'button',id:'advance',name:'Advance',value:'Advance',disabled:false},{ref:'e2',tag:'output',id:'result',name:'0',value:'0',disabled:false}]};
 const after:PreviewSnapshot={...before,elements:before.elements.map((e,i)=>({...e,ref:`e${i+7}`,value:'changed'}))};
 const tests:InteractionTest[]=[{name:'Advance',steps:[{action:'click',ref:'e1'}],expect:{ref:'e2',equals:'1'}}];
 expect(rebindInteractionTests(tests,before,after)).toEqual([{name:'Advance',steps:[{action:'click',ref:'e7'}],expect:{ref:'e8',equals:'1'}}]);
 expect(tests[0].expect).toEqual({ref:'e2',equals:'1'});
 expect(()=>rebindInteractionTests(tests,before,{...after,elements:[]})).toThrow('uniquely resolve');
 expect(()=>rebindInteractionTests(tests,before,{...after,elements:[...after.elements,...after.elements]})).toThrow('uniquely resolve');
});
