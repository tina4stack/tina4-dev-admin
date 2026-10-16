/** Validate model-authored additions against the observed missing controls. */
export function validateControlAdditions(before:string,addition:string,required:string[]):void {
 const parser=new DOMParser();
 const old=parser.parseFromString(before,'text/html');
 const next=parser.parseFromString(addition,'text/html');
 if(next.querySelector('script,style'))throw new Error('Return controls only, without scripts or styles.');
 const selector='button,input,select,textarea,a[href],[role="button"]';
 const label=(el:Element)=>(el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').trim();
 const controls=[...next.querySelectorAll(selector)];
 const labels=controls.map(label);
 if(!controls.length)throw new Error('Return actual missing controls.');
 const existing=new Set([...old.querySelectorAll(selector)].map(label));
 if(labels.some(value=>existing.has(value)))throw new Error('Do not repeat existing controls. Return only the missing controls.');
 if(new Set(labels).size!==labels.length)throw new Error('Do not duplicate added controls.');
 if(required.length && (required.some(value=>!labels.includes(value)) || labels.some(value=>!required.includes(value))))throw new Error(`Return exactly these missing control labels: ${JSON.stringify(required)}.`);
 const ids=controls.map(el=>el.id).filter(Boolean);
 if(new Set(ids).size!==ids.length || ids.some(id=>old.getElementById(id)))throw new Error('Added controls need unique IDs.');
}
