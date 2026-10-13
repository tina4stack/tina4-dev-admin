import {it,expect} from 'vitest';
import {PreviewBrowser,validateInteractionTests,runInteractionTests,interactionMatches} from '../src/preview-browser';

it('operates actual DOM controls and verifies observed results',async()=>{
 document.body.innerHTML='<button>Advance</button><output id="count">0</output><input aria-label="Title"><p id="echo"></p>';
 document.querySelector('button')!.onclick=()=>{document.querySelector('output')!.value=String(Number(document.querySelector('output')!.value)+1);};
 document.querySelector('input')!.oninput=e=>{document.querySelector('#echo')!.textContent=(e.target as HTMLInputElement).value;};
 const browser=new PreviewBrowser(()=>document);
 const snapshot=browser.snapshot();
 const ref=(name:string)=>snapshot.elements.find(e=>e.name===name)!.ref;
 const output=snapshot.elements.find(e=>e.tag==='output')!.ref;
 const echo=snapshot.elements.find(e=>e.id==='echo')!.ref;
 const tests=validateInteractionTests({tests:[
  {name:'Advance counter',steps:[{action:'click',ref:ref('Advance')}],expect:{ref:output,equals:'1'}},
  {name:'Enter title',steps:[{action:'fill',ref:ref('Title'),value:'Hello'}],expect:{ref:echo,equals:'Hello'}}
 ]},snapshot);
 const results=await runInteractionTests(browser,tests);
 expect(results.every(r=>r.passed)).toBe(true);
 expect(results.map(r=>r.actual)).toEqual(['1','Hello']);
 expect(results[0].trace).toEqual([{action:'click',control:'Advance',before:'0',after:'1'}]);
 const failed=await runInteractionTests(browser,[{name:'Wrong expectation',steps:[],expect:{ref:output,equals:'2'}}]);
 expect(failed[0].passed).toBe(false);
 expect(failed[0].actual).toBe('1');
});

it('rejects arbitrary execution, unknown references, stale and disabled controls',async()=>{
 document.body.innerHTML='<button disabled>No</button><button hidden>Hidden</button><output>Ready</output>';
 const browser=new PreviewBrowser(()=>document);const snapshot=browser.snapshot();
 expect(snapshot.elements.some(e=>e.name==='Hidden')).toBe(false);
 expect(()=>validateInteractionTests({tests:[{name:'Unsafe',steps:[{action:'evaluate',script:'alert(1)'}],expect:{ref:'x',equals:'yes'}}]},snapshot)).toThrow();
 expect(()=>validateInteractionTests({tests:[]},snapshot)).toThrow();
 await expect(browser.perform({action:'click',ref:snapshot.elements[0].ref})).rejects.toThrow(/disabled/i);
 const ref=snapshot.elements[0].ref;document.querySelector('button')!.remove();
 await expect(browser.perform({action:'click',ref})).rejects.toThrow(/stale/i);
});

it('compares numeric quantities without weakening text assertions',()=>{
 expect(interactionMatches('2',{ref:'r',equals:'2.0',mode:'number'})).toBe(true);
 expect(interactionMatches('3',{ref:'r',equals:'2',mode:'number'})).toBe(false);
 expect(interactionMatches('Error',{ref:'r',equals:'0',mode:'number'})).toBe(false);
 expect(interactionMatches('',{ref:'r',equals:'0',mode:'number'})).toBe(false);
 expect(interactionMatches('2',{ref:'r',equals:'2.0',mode:'text'})).toBe(false);
});
it('accepts an observed unique ID without allowing invented selectors',()=>{
 document.body.innerHTML='<button id="advance">Advance</button><output id="count">0</output>';
 const snapshot=new PreviewBrowser(()=>document).snapshot();
 const plan={tests:[{name:'Advance',steps:[{action:'click',ref:'advance'}],expect:{ref:'count',equals:'1'}}]};
 const tests=validateInteractionTests(plan,snapshot);
 expect(tests[0].steps[0].ref).toBe(snapshot.elements[0].ref);
 expect(tests[0].expect.ref).toBe(snapshot.elements[1].ref);
 expect(plan.tests[0].steps[0].ref).toBe('advance');
 expect(()=>validateInteractionTests({tests:[{...plan.tests[0],steps:[{action:'click',ref:'#invented'}]}]},snapshot)).toThrow();
});
it('lowers compact clicks and calculates formula expectations',()=>{
 document.body.innerHTML='<button id="advance">Advance</button><output id="count">0</output>';
 const snapshot=new PreviewBrowser(()=>document).snapshot();
 const tests=validateInteractionTests({tests:[{name:'Advance',steps:['Advance'],expect:{ref:'count',mode:'number',formula:'2 + 3',equals:'5'}}]},snapshot);
 expect(tests[0].steps).toEqual([{action:'click',ref:snapshot.elements[0].ref}]);
 expect(tests[0].expect.equals).toBe('5');
 expect(()=>validateInteractionTests({tests:[{name:'Bad formula',steps:['Advance'],expect:{ref:'count',mode:'number',formula:'reset'}}]},snapshot)).toThrow('Bad formula');
});
it('rejects filling read-only output during planning, before any action runs',()=>{
 document.body.innerHTML='<input id="result" aria-label="Result" readonly value="0"><button>Advance</button>';
 const snapshot=new PreviewBrowser(()=>document).snapshot();
 expect(snapshot.elements[0].actions).toEqual([]);
 expect(()=>validateInteractionTests({tests:[{name:'Bypass',steps:[{action:'fill',ref:'result',value:'7'}],expect:{ref:'result',equals:'7'}}]},snapshot)).toThrow('does not support fill');
});
it('normalizes equivalent target fields and rejects conflicting targets',()=>{
 document.body.innerHTML='<button id="one">One</button><button id="two">Two</button><output id="result">0</output>';
 const snapshot=new PreviewBrowser(()=>document).snapshot();
 const plan={tests:[{name:'One',steps:[{action:'click',target:'one'}],expect:{ref:'result',equals:'1'}}]};
 expect(validateInteractionTests(plan,snapshot)[0].steps[0].ref).toBe(snapshot.elements[0].ref);
 expect(()=>validateInteractionTests({tests:[{...plan.tests[0],steps:[{action:'click',target:'one',ref:'two'}]}]},snapshot)).toThrow('Conflicting');
});
it('normalizes target-only clicks but does not infer arbitrary operations',()=>{
 document.body.innerHTML='<button id="advance">Advance</button><output id="result">0</output>';
 const snapshot=new PreviewBrowser(()=>document).snapshot();
 const test={name:'Advance',steps:[{target:'advance'}],expect:{ref:'result',equals:'1'}};
 expect(validateInteractionTests({tests:[test]},snapshot)[0].steps[0]).toMatchObject({action:'click',ref:snapshot.elements[0].ref});
 expect(()=>validateInteractionTests({tests:[{...test,steps:[{target:'advance',script:'run()'}]}]},snapshot)).toThrow();
});

it('rejects a formula that contradicts a proposed expected value',()=>{
 document.body.innerHTML='<button id="go">Go</button><output id="result">0</output>';
 const snapshot=new PreviewBrowser(()=>document).snapshot();
 expect(()=>validateInteractionTests({tests:[{name:'Wrong arithmetic',steps:['go'],expect:{ref:'result',mode:'number',formula:'7 * 8',equals:'54'}}]},snapshot)).toThrow('contradicts');
});

it('captures click-time browser diagnostics and restores instrumentation',async()=>{
 document.body.innerHTML='<button>Save</button><output>Ready</output>';
 const original=window.console.error;
 document.querySelector('button')!.onclick=()=>{
  window.console.error('request failed');
  window.dispatchEvent(new ErrorEvent('error',{message:'handler failed',filename:'page.js',lineno:12}));
 };
 const browser=new PreviewBrowser(()=>document), snapshot=browser.snapshot();
 const results=await runInteractionTests(browser,[{name:'Save',steps:[{action:'click',ref:snapshot.elements.find(e=>e.tag==='button')!.ref}],expect:{ref:snapshot.elements.find(e=>e.tag==='output')!.ref,equals:'Ready'}}]);
 expect(results[0].passed).toBe(false);
 expect(results[0].diagnostics).toEqual(expect.arrayContaining([
  expect.objectContaining({kind:'console.error',message:'request failed',step:'click Save',fatal:false}),
  expect.objectContaining({kind:'error',message:expect.stringContaining('handler failed'),fatal:true})
 ]));
 expect(window.console.error).toBe(original);
 const capture=browser.captureDiagnostics();
 const event=new Event('unhandledrejection');Object.defineProperty(event,'reason',{value:new Error('async failure')});window.dispatchEvent(event);
 expect(capture.entries[0]).toMatchObject({kind:'unhandledrejection',fatal:true});
 capture.stop();window.dispatchEvent(new ErrorEvent('error',{message:'later'}));
 expect(capture.entries).toHaveLength(1);
});

it('resolves action labels within actionable controls and rejects ambiguous buttons',()=>{
 document.body.innerHTML='<output id="display">1</output><button id="one">1</button><button id="reset">Clear</button><button id="other-reset">Clear</button>';
 const snapshot=new PreviewBrowser(()=>document).snapshot();
 const plan=(ref:string)=>({tests:[{name:'Use control',steps:[ref],expect:{ref:'display',equals:'1'}}]});
 expect(validateInteractionTests(plan('1'),snapshot)[0].steps[0].ref).toBe(snapshot.elements.find(e=>e.id==='one')!.ref);
 expect(()=>validateInteractionTests(plan('Clear'),snapshot)).toThrow('reset, other-reset');
 expect(validateInteractionTests(plan('reset'),snapshot)).toHaveLength(1);
});
