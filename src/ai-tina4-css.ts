import { contrastRatio } from './preview-layout';
import { parse } from 'postcss-scss';
import { assertContentPreserved } from './ai-content-preservation';

export type UtilityCatalog=Record<string,Record<string,string>>;
export interface UtilityChange { selector:string; add:string[]; remove?:string[]; }
export function utilityCatalog(css:string):UtilityCatalog {
  const result:UtilityCatalog={};
  parse(css).walkRules(rule=>{
    if(rule.parent?.type!=='root') return;
    for(const selector of rule.selectors) {
      const match=selector.match(/^\.([a-zA-Z][\w-]*)$/);
      if(!match)continue;
      const declarations:Record<string,string>={};
      rule.nodes.forEach(node=>{if(node.type==='decl')declarations[node.prop]=node.value;});
      result[match[1]]={...result[match[1]],...declarations};
    }
  });
  return result;
}
export async function loadTina4Css():Promise<UtilityCatalog|null> {
  const response=await fetch('/css/tina4.min.css');
  if(!response.ok || !(response.headers.get('content-type')||'').includes('css'))return null;
  const catalog=utilityCatalog(await response.text());
  return catalog.container && catalog['text-primary'] && catalog['bg-primary'] ? catalog : null;
}
export function tina4CssGuidance(catalog:UtilityCatalog):string {
  const colours=Object.fromEntries(Object.entries(catalog).filter(([name])=>/^(text|bg)-/.test(name)));
  return `Use the installed Tina4CSS framework by default. Its semantic theme roles are primary, secondary, success, danger, warning, info, light and dark. Choose suitable existing roles for the user's requested style; there is no style-name-to-palette mapping in the harness.
Compatible text/background pairs (ratio >= 4.5; apply explicit text utilities to children that override inherited text): ${JSON.stringify(Object.entries(colours).filter(([name])=>name.startsWith('bg-')).map(([name,props])=>({background:name,text:Object.entries(colours).filter(([text,p])=>text.startsWith('text-') && (contrastRatio(p.color||'',props['background-color']||'')||0)>=4.5).map(([text])=>text)})))}
Installed colour utilities and actual values: ${JSON.stringify(colours)}
Available framework classes: ${Object.keys(catalog).join(' ')}
Use grid, spacing, typography, component and colour utilities before custom SCSS. Compose controls with their base component class and variant; a colour utility alone does not supply component styling. Check layout classes against the installed catalog rather than assuming utilities from another CSS framework exist. Preserve custom semantic classes. Do not invent utility names or runtime theme variables: Tina4CSS theme variables are compile-time SCSS variables, and changing an unrelated variable cannot recolour its prebuilt CSS. Custom scoped SCSS is only for requirements absent from these utilities. Do not recreate resets, global typography or a parallel component system.`;
}

// Work on source tag offsets, never serialize Twig through the HTML parser.
function templateElements(source:string) {
  const marker='data-tina4-style-target';
  if(source.includes(marker))throw new Error('Template contains reserved style marker.');
  const tags=[...source.matchAll(/<([a-zA-Z][\w:-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*>/g)];
  let tagged=source;
  for(let i=tags.length-1;i>=0;i--){const tag=tags[i];tagged=tagged.slice(0,tag.index!)+tag[0].replace(/^<[\w:-]+/,m=>`${m} ${marker}="${i}"`)+tagged.slice(tag.index!+tag[0].length);}
  return {tags,document:new DOMParser().parseFromString(tagged,'text/html'),marker};
}
export function templateSelectors(source:string):string[] {
  const {document,marker}=templateElements(source);
  return [...new Set([...document.querySelectorAll(`[${marker}]`)].map(el=>el.id ? `#${el.id}` : el.classList.length ? `${el.tagName.toLowerCase()}.${[...el.classList].filter(c=>/^[\w-]+$/.test(c)).join('.')}` : el.tagName.toLowerCase()))];
}
export function applyUtilityChanges(source:string,changes:UtilityChange[],catalog:UtilityCatalog):string {
  const {tags,document,marker}=templateElements(source);
  const updates=new Map<number,string[]>();
  for(const change of changes) {
    if(!change || typeof change.selector!=='string' || !Array.isArray(change.add) || (change.remove!==undefined && !Array.isArray(change.remove)))throw new Error('Each class change requires a selector and class arrays.');
    for(const name of [...change.add,...change.remove||[]]) if(typeof name!=='string' || !catalog[name])throw new Error(`Unknown Tina4CSS utility ${name}. Choose from the supplied catalog.`);
    const elements=[...document.querySelectorAll(change.selector)].filter(el=>el.hasAttribute(marker));
    if(!elements.length)throw new Error(`Selector ${change.selector} does not match the page source. Use a selector from the supplied markup.`);
    for(const element of elements) {
      const index=Number(element.getAttribute(marker));
      const attr=tags[index][0].match(/\bclass\s*=\s*("[^"]*"|'[^']*')/i);
      if(attr && /\{[{%#]|<|>/.test(attr[0]))throw new Error('Dynamic class attributes require an exact source edit; preserve the Twig expression.');
      let classes=updates.get(index) || (element.getAttribute('class')||'').split(/\s+/).filter(Boolean);
      const properties=new Set(change.add.flatMap(name=>Object.keys(catalog[name])));
      classes=classes.filter(name=>!(change.remove||[]).includes(name) && !(catalog[name] && /^(text-|bg-|[mp][trblsexy]?-|d-|fw-|fs-|gap-)/.test(name) && Object.keys(catalog[name]).some(prop=>properties.has(prop))));
      updates.set(index,[...new Set([...classes,...change.add])]);
    }
  }
  let result=source;
  for(const [index,classes] of [...updates].sort(([a],[b])=>b-a)) {
    const tag=tags[index];const attribute=`class="${classes.join(' ')}"`;
    const next=/\bclass\s*=/i.test(tag[0]) ? tag[0].replace(/\bclass\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i,attribute) : tag[0].replace(/\s*\/?>$/,end=>` ${attribute}${end}`);
    result=result.slice(0,tag.index!)+next+result.slice(tag.index!+tag[0].length);
  }
  assertContentPreserved(source,result);
  return result;
}

/** Normalize envelope variations only when the target is unambiguous. Metadata is not an edit. */
export function normalizeUtilityEdits(value:any,paths:string[]):Array<UtilityChange & {path:string}> {
  if(!Array.isArray(value?.edits))throw new Error('Return an edits array.');
  const edits:Array<UtilityChange & {path:string}>=[];
  for(const item of value.edits) {
    if(!item || typeof item!=='object')throw new Error('Every edit must be an object.');
    const metadata=Object.keys(item).every(key=>['reason','remove'].includes(key)) && (!item.remove || Array.isArray(item.remove) && !item.remove.length);
    if(metadata)continue;
    const path=item.path ?? value.path ?? (paths.length===1 ? paths[0] : undefined);
    if(!paths.includes(path))throw new Error(`Choose an existing template path: ${paths.join(', ')}`);
    if(typeof item.selector!=='string' || !Array.isArray(item.add) || (item.remove!==undefined && !Array.isArray(item.remove)))throw new Error('Each edit needs a selector and class arrays.');
    if(!item.add.length && !item.remove?.length)continue;
    edits.push({...item,path,remove:item.remove ?? []});
  }
  if(!edits.length)throw new Error('No actionable utility changes were returned.');
  return edits;
}

/** Check known utility pairs on text-bearing elements; unknown theme paint stays with rendered review. */
export function utilityContrastIssues(source:string,catalog:UtilityCatalog):string[] {
 const {document,marker}=templateElements(source);const issues:string[]=[];
 for(const element of document.querySelectorAll(`[${marker}]`)) {
  if(![...element.childNodes].some(n=>n.nodeType===3 && n.textContent?.trim()))continue;
  let color:string|undefined,background:string|undefined;
  for(let el:Element|null=element;el;el=el.parentElement)for(const name of el.classList){const rule=catalog[name];if(!rule)continue;color ||= rule.color;background ||= rule['background-color'];}
  const ratio=color && background ? contrastRatio(color,background):null;
  if(ratio!==null && ratio<4.5)issues.push(`${element.tagName.toLowerCase()}.${[...element.classList].join('.')} has ${color} on ${background}, contrast ${ratio.toFixed(2)}:1. Use a compatible explicit text/background pair; preserve content.`);
 }
 return issues;
}
