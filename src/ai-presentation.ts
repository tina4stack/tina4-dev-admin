import {list} from "postcss";
import {applyStyleChoices} from './ai-style-edits';
import {applyUtilityChanges,normalizeUtilityEdits,templateSelectors,utilityContrastIssues,type UtilityCatalog} from './ai-tina4-css';

/** Compile model-selected class/declaration operations; never accept a template rewrite here. */
export function applyPresentationProposal(value:any,files:Record<string,string>,catalog:UtilityCatalog,contrastTargets:string[]=[]):Record<string,string> {
 const templates=Object.keys(files).filter(path=>/\.(twig|html)$/.test(path));
 const updated:Record<string,string>={};
 const markup=new DOMParser().parseFromString(templates.map(path=>files[path]).join("\n"),"text/html");
 const foreground:string[]=[],background:string[]=[];
 for(const edit of value?.edits || []) {
  const properties=[...edit.add||[],...edit.remove||[]].flatMap((name:string)=>Object.keys(catalog[name] || {}));
  if(properties.includes('color')) foreground.push(edit.selector);
  if(properties.some(p=>p.startsWith('background'))) background.push(edit.selector);
 }
 for(const change of value?.styles || []) {
  if(change.property==='color') foreground.push(...(Array.isArray(change.selector) ? change.selector : [change.selector]));
  if(change.property?.startsWith('background')) background.push(change.selector);
 }
 if(contrastTargets.length && foreground.length && !background.length) {
  for(const target of contrastTargets) {
   const affected=[...markup.body.querySelectorAll(target)];
   if(affected.length && affected.some(element=>!foreground.some(selector=>typeof selector==='string' && element.matches(selector))))
    throw new Error(`Foreground repair must target the affected text element ${target} directly. A parent color cannot override a child's own color. Choose a selector matching that element; preserve its content and link.`);
  }
 }

 if(value?.edits?.length){
  const edits=normalizeUtilityEdits(value,templates);
  for(const path of new Set(edits.map(e=>e.path))){
   const source=applyUtilityChanges(files[path],edits.filter(e=>e.path===path),catalog);
   const issues=utilityContrastIssues(source,catalog);if(issues.length)throw new Error(issues.join('\n'));
   if(source!==files[path])updated[path]=source;
  }
 }
 if(value?.styles!==undefined){
  if(!Array.isArray(value.styles))throw new Error('styles must be an array.');
  const allowed=[...new Set(['body',...templates.flatMap(path=>templateSelectors(files[path]))])];
  const document=new DOMParser().parseFromString(templates.map(path=>files[path]).join("\n"),"text/html");
  for(const change of value.styles.flatMap((item:any)=>Array.isArray(item?.selector) ? item.selector.map((selector:unknown)=>({...item,selector})) : [item])){
   if(!change || typeof change.path!=='string' || !change.path.endsWith('.scss') || !(change.path in files))throw new Error('Use an existing SCSS path.');
   if(![change.selector,change.property,change.value].every(v=>typeof v==='string' && v.trim()))throw new Error('Style operations need selector, property and value.');
   if(typeof CSS!=='undefined' && !CSS.supports(change.property,change.value))throw new Error(`Browser rejects ${change.property}: ${change.value}. Choose a valid concrete CSS value (for example a valid colour literal), not a descriptive phrase.`);
   for(const selector of list.comma(change.selector)) {
    try {if(document.body.querySelector(selector) && !allowed.includes(selector)) allowed.push(selector);} catch {throw new Error('Invalid style selector.');}
   }
   updated[change.path]=applyStyleChoices(updated[change.path]??files[change.path],[change],allowed);
  }
 }
 for(const path of Object.keys(updated))if(updated[path]===files[path])delete updated[path];
 if(!Object.keys(updated).length)throw new Error('No changes were proposed.');
 return updated;
}
