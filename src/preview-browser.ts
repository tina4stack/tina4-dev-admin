import {numericAssertion} from './ai-numeric-assertion';
/** A small, observable browser surface for the agent. No arbitrary JavaScript actions. */
export interface PreviewElement {ref:string;tag:string;id:string;name:string;value:string;disabled:boolean;actions?:string[];}
export interface PreviewSnapshot {route:string;elements:PreviewElement[];text:string;}
export type PreviewAction={action:'click';ref:string}|{action:'fill';ref:string;value:string};
export interface InteractionTest {name:string;steps:PreviewAction[];expect:{ref:string;equals:string;mode?:'text'|'number';formula?:string};}
export interface InteractionResult {name:string;passed:boolean;expected:string;actual:string;error?:string;diagnostics?:BrowserDiagnostic[];trace?:{action:string;control:string;before:string;after:string}[];}
export interface BrowserDiagnostic {kind:string;message:string;step:string;fatal:boolean;}
const text=(value:unknown)=>String(value??'').replace(/\s+/g,' ').trim();

export class PreviewBrowser {
 private document?:Document;
 private scriptPolicy='';
 private refs=new Map<string,Element>();
 private ids=new WeakMap<Element,string>();
 constructor(private getDocument:()=>Document){}
 private current():Document {
  const doc=this.getDocument();
  if(doc.location?.pathname.startsWith('/__dev'))throw new Error('Interaction checks cannot operate the developer dashboard.');
  if(doc!==this.document){this.document=doc;this.refs.clear();this.ids=new WeakMap();}
  return doc;
 }
 private visible(element:Element):boolean {
  for(let el:Element|null=element;el;el=el.parentElement){
   const style=el.ownerDocument.defaultView?.getComputedStyle(el);
   if(el.hasAttribute('hidden') || el.getAttribute('aria-hidden')==='true' || style?.display==='none' || style?.visibility==='hidden')return false;
  }
  return !element.closest('#tina4-dev-toolbar,script,style,noscript');
 }
 private value(element:Element):string {return text('value' in element ? element.value : element.textContent);}
 snapshot():PreviewSnapshot {
  const doc=this.current();const elements:PreviewElement[]=[];
  for(const element of doc.querySelectorAll('button,input,select,textarea,output,a[href],[role="button"],[role="status"],[aria-live],[id]')) {
   if(!this.visible(element) || elements.length>=160)continue;
   let ref=this.ids.get(element);
   if(!ref){ref=`e${this.refs.size+1}`;this.ids.set(element,ref);this.refs.set(ref,element);}
   const labels='labels' in element ? [...(element.labels as NodeListOf<HTMLLabelElement> || [])].map(label=>label.textContent).join(' ') : '';
   const actions=[];
   if(element.matches('button,input[type="button"],input[type="submit"],input[type="checkbox"],input[type="radio"],a[href],[role="button"]'))actions.push('click');
   if(element.matches('input:not([type="file"]):not([type="password"]),textarea,select') && !element.hasAttribute('readonly'))actions.push('fill');
   elements.push({ref,actions,tag:element.tagName.toLowerCase(),id:element.id,name:text(element.getAttribute('aria-label') || labels || element.getAttribute('placeholder') || element.textContent).slice(0,240),value:this.value(element).slice(0,500),disabled:element.hasAttribute('disabled') || element.getAttribute('aria-disabled')==='true'});
  }
  return {route:doc.location?.pathname || '/',elements,text:text(doc.body.textContent).slice(0,5000)};
 }
 /** Capture only the preview window during this case; always restore listeners and console. */
 captureDiagnostics() {
  const win=this.current().defaultView!;
  const entries:BrowserDiagnostic[]=[];let step='before actions';
  const add=(kind:string,message:unknown,fatal=false)=>{if(entries.length<30)entries.push({kind,message:String(message).slice(0,2000),step,fatal});};
  if(this.scriptPolicy && /nonce-|sha(?:256|384|512)-/.test(this.scriptPolicy)){for(const script of this.current().querySelectorAll('script:not([src])'))if(script.textContent?.trim() && !(script as HTMLScriptElement).nonce)add('script-policy',`Inline script has no request nonce. Check whether it is permitted by Content-Security-Policy: ${this.scriptPolicy}`);}
  const onError=(event:ErrorEvent)=>add('error',`${event.message} (${event.filename}:${event.lineno}:${event.colno})`,true);
  const onRejection=(event:PromiseRejectionEvent)=>add('unhandledrejection',event.reason?.stack || event.reason,true);
  const original=win.console.error;
  const wrapped=(...args:unknown[])=>{add('console.error',args.map(arg=>arg instanceof Error ? arg.stack || arg.message : String(arg)).join(' '));original.apply(win.console,args);};
  win.addEventListener('error',onError);win.addEventListener('unhandledrejection',onRejection);win.console.error=wrapped;
  return {entries,setStep:(value:string)=>{step=value;},stop:()=>{win.removeEventListener('error',onError);win.removeEventListener('unhandledrejection',onRejection);if(win.console.error===wrapped)win.console.error=original;}};
 }
 async reset():Promise<void> {
  const old=this.current();old.defaultView!.location.reload();
  for(let attempt=0;attempt<100;attempt++){
   await new Promise(resolve=>setTimeout(resolve,50));
   try {const current=this.getDocument();if(current!==old && current.readyState==='complete'){this.snapshot();try{const response=await fetch(current.location.href,{method:'HEAD'});this.scriptPolicy=response.headers.get('Content-Security-Policy')||'';}catch{this.scriptPolicy='';}return;}} catch {/* Navigation can briefly detach the document. */}
  }
  throw new Error('Preview did not reload before the independent test.');
 }
 private target(ref:string):Element {
  const doc=this.current(),element=this.refs.get(ref);
  if(!element || element.ownerDocument!==doc || !element.isConnected)throw new Error(`Unknown or stale preview reference ${ref}. Inspect the current page again.`);
  if(!this.visible(element))throw new Error(`Preview target ${ref} is hidden.`);
  return element;
 }
 label(ref:string):string {const element=this.target(ref);return text(element.getAttribute('aria-label') || element.textContent || element.id || ref);}
 reveal(ref:string):void {(this.target(ref) as HTMLElement).scrollIntoView({block:'nearest'});}
 read(ref:string):string{return this.value(this.target(ref));}
 async perform(action:PreviewAction):Promise<void> {
  const element=this.target(action.ref) as HTMLElement;
  if(element.hasAttribute('disabled') || element.getAttribute('aria-disabled')==='true')throw new Error('Preview control is disabled.');
  if(action.action==='click') {
   if(!element.matches('button,input[type="button"],input[type="submit"],input[type="checkbox"],input[type="radio"],a[href],[role="button"]'))throw new Error('Target is not a clickable control.');
   const destination=element.getAttribute('href') || (element as HTMLButtonElement).form?.action;
   if(destination){const url=new URL(destination,element.ownerDocument.URL);if(url.origin!==new URL(element.ownerDocument.URL).origin || url.pathname.startsWith('/__dev'))throw new Error('Interaction checks stay on project pages.');}
   element.scrollIntoView({block:'nearest'});
   element.click();
  } else if(action.action==='fill') {
   if(!element.matches('input:not([type="file"]):not([type="password"]),textarea,select') || element.hasAttribute('readonly'))throw new Error('Target is not an editable field.');
   (element as HTMLInputElement).value=action.value;
   const EventType=element.ownerDocument.defaultView!.Event;
   element.dispatchEvent(new EventType('input',{bubbles:true}));element.dispatchEvent(new EventType('change',{bubbles:true}));
  } else throw new Error('Unsupported preview action.');
  await new Promise(resolve=>setTimeout(resolve,100));
 }
}

export function validateInteractionTests(value:any,snapshot:PreviewSnapshot):InteractionTest[] {
 if(!Array.isArray(value?.tests) || !value.tests.length || value.tests.length>12)throw new Error('Return between one and twelve interaction tests.');
 value=structuredClone(value);
 const refs=new Set(snapshot.elements.map(e=>e.ref));let count=0;
 const resolve=(ref:unknown,action?:string)=>{
  if(typeof ref!=='string')return ref;
  const wrapped=ref.match(/^(?:target|ref)\s*=\s*["']([^"']+)["']$/);const key=wrapped ? wrapped[1] : ref;
  if(refs.has(key))return key;
  const candidates=snapshot.elements.filter(element=>!action || element.actions?.includes(action));
  const exact=snapshot.elements.filter(element=>element.id && element.id===key);
  if(exact.length===1)return exact[0].ref;
  const matches=candidates.filter(element=>element.name===key);
  if(matches.length>1)throw new Error(`Ambiguous observed target ${JSON.stringify(key)}. Use a unique target ID: ${matches.map(element=>element.id || element.ref).join(', ')}.`);
  if(!matches.length)throw new Error(`Unknown observed target ${JSON.stringify(key)}. Use a target ID from the observed controls.`);
  return matches[0].ref;
 };
 for(const test of value.tests){if(Array.isArray(test.steps))test.steps=test.steps.map((step:unknown)=>typeof step==='string'?{action:'click',ref:step}:step);if(Array.isArray(test.steps))for(const step of test.steps)if(step && typeof step==='object'){if(step.action===undefined && Object.keys(step).every(key=>['ref','target'].includes(key)))step.action='click';if(step.ref!==undefined && step.target!==undefined && resolve(step.ref)!==resolve(step.target))throw new Error('Conflicting action targets.');step.ref=resolve(step.ref ?? step.target,step.action);}if(test.expect)test.expect.ref=resolve(test.expect.ref);}

 for(const test of value.tests){
  if(typeof test.name!=='string' || !test.name.trim() || !Array.isArray(test.steps) || !test.steps.length || test.steps.length>40)throw new Error('Each test needs a name and one to forty actions.');
  count+=test.steps.length;
  for(const step of test.steps){
   if(!['click','fill'].includes(step.action) || !refs.has(step.ref) || step.action==='fill' && typeof step.value!=='string')throw new Error('Use only click/fill actions and observed element references.');
   const target=snapshot.elements.find(element=>element.ref===step.ref)!;
   if(target.disabled || !target.actions?.includes(step.action))throw new Error(`Control ${JSON.stringify(target.name)} does not support ${step.action}. Choose from its observed actions: ${JSON.stringify(target.actions||[])}.`);
  }
  if(test.expect?.formula!==undefined){if(test.expect.mode!=='number')throw new Error('A formula requires number mode.');try {const derived=String(numericAssertion(test.expect.formula));if(test.expect.equals!==undefined && !interactionMatches(derived,test.expect))throw new Error('Formula contradicts the proposed expected value.');test.expect.equals=derived;} catch(error){throw new Error(`Test ${JSON.stringify(test.name)} has invalid formula ${JSON.stringify(test.expect.formula)}. Use arithmetic or a numeric literal, never descriptive words. ${String(error)}`);}}
  if(typeof test.expect?.equals==='number' && Number.isFinite(test.expect.equals))test.expect.equals=String(test.expect.equals);
  if(test.expect?.mode!==undefined && !['text','number'].includes(test.expect.mode))throw new Error('Assertion mode must be text or number.');
  if(test.expect?.mode==='number' && (!String(test.expect.equals).trim() || !Number.isFinite(Number(test.expect.equals))))throw new Error('Numeric assertions require a finite expected number.');
  if(!refs.has(test.expect?.ref) || typeof test.expect?.equals!=='string')throw new Error('Every test needs an observed output ref and an independently predicted exact string in equals.');
 }
 if(count>160)throw new Error('Interaction test action budget exceeded.');
 return value.tests;
}

export function interactionMatches(actual:string,expected:InteractionTest['expect']):boolean {
 if(expected.mode==='number')return !!actual.trim() && Number.isFinite(Number(actual)) && Math.abs(Number(actual)-Number(expected.equals))<=1e-10*Math.max(1,Math.abs(Number(expected.equals)));
 return actual===text(expected.equals);
}

export async function runInteractionTests(browser:PreviewBrowser,tests:InteractionTest[],signal?:AbortSignal,progress?:(message:string)=>void):Promise<InteractionResult[]> {
 const results:InteractionResult[]=[];
 for(const test of tests){
  let actual='';
  const trace:NonNullable<InteractionResult['trace']>=[];
  const diagnostics=browser.captureDiagnostics();
  try {
   for(const action of test.steps){signal?.throwIfAborted();const control=browser.label(action.ref),before=browser.read(test.expect.ref);diagnostics.setStep(`${action.action} ${control}`);progress?.(`${test.name}: ${action.action} ${control}`);await browser.perform(action);trace.push({action:action.action,control,before,after:browser.read(test.expect.ref)});}
   browser.reveal(test.expect.ref);
   for(let attempt=0;attempt<20;attempt++) {
    signal?.throwIfAborted();actual=browser.read(test.expect.ref);if(interactionMatches(actual,test.expect))break;
    await new Promise(resolve=>setTimeout(resolve,50));
   }
   results.push({name:test.name,passed:interactionMatches(actual,test.expect),expected:test.expect.equals,actual});
  } catch(error) {signal?.throwIfAborted();results.push({name:test.name,passed:false,expected:test.expect.equals,actual,error:String((error as Error).message)});}
  finally {diagnostics.stop();}
  const result=results.at(-1)!;result.trace=trace;
  if(diagnostics.entries.length)result.diagnostics=diagnostics.entries;
  if(diagnostics.entries.some(entry=>entry.fatal)){result.passed=false;result.error='Uncaught browser error during interaction.';}
  console.info("Interaction result",JSON.stringify(results.at(-1)));
  progress?.(`${results.at(-1)!.passed?'PASS':'FAIL'} ${test.name}: expected ${JSON.stringify(test.expect.equals)}, observed ${JSON.stringify(actual)}`);
 }
 return results;
}
