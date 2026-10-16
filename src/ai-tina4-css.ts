import pageDesign from './skills/page-design.md?raw';
import { contrastRatio } from './preview-layout';
import { parse } from 'postcss-scss';
import { assertContentPreserved } from './ai-content-preservation';

export type UtilityCatalog=Record<string,Record<string,string>>;
export interface UtilityChange { selector:string; add:string[]; remove?:string[]; }
export function utilityCatalog(css:string):UtilityCatalog {
  const result:UtilityCatalog={};
  parse(css).walkRules(rule=>{
    const conditional=rule.parent?.type!=='root';
    if(conditional && !(rule.parent?.type==='atrule' && rule.parent.name==='media')) return;
    for(const selector of rule.selectors) {
      const match=selector.match(/^\.([a-zA-Z][\w-]*)$/);
      if(!match)continue;
      const declarations:Record<string,string>={};
      // Conditional classes exist, but their declarations are not unconditional
      // colour/layout evidence. The live viewport verifies their actual effect.
      if(!conditional)rule.nodes.forEach(node=>{if(node.type==='decl')declarations[node.prop]=node.value;});
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
/** HTML vocabulary, grounded in this project's installed stylesheet. */
export function htmlComponentMap(catalog:UtilityCatalog):string {
 const components:[string,string[],string][]=[
  ['Card / panel',['card','card-body','card-header','card-footer'],'Use card as parent; card-header, one card-body and card-footer are separate children. Never put card and card-body on the same element or nest card-body within card-body. Cards group individual items, not the entire page.'],
  ['Button / call to action',['btn','btn-primary','btn-secondary','btn-outline-primary'],'Use button for actions, a for navigation; include base and variant.'],
  ['Page / section / columns',['container','container-fluid','row','col','col-12','col-md-6','col-md-4'],'Use a responsive container, row and columns.'],
  ['Navigation',['navbar','navbar-brand','nav','nav-link'],'Use semantic nav and real destinations.'],
  ['Form / field',['form-label','form-control','form-select','form-check','form-check-input'],'Associate labels with fields; choose the correct input type.'],
  ['Table',['table','table-striped','table-bordered','table-responsive'],'Use table, thead, tbody and scoped th; wrapper for overflow.'],
  ['Notice / status',['alert','alert-info','alert-success','alert-warning','alert-danger','badge'],'Use text and an appropriate semantic role, not colour alone.'],
  ['Image',['img-fluid','rounded'],'Use real supplied URLs, descriptive alt text and responsive dimensions.'],
  ['Spacing / alignment',['p-3','p-4','mb-3','gap-3','d-flex','align-items-center','justify-content-between','text-center'],'Choose only installed utilities appropriate to the request.']
 ];
 return 'HTML component mapping (not Python/backend guidance):\n| User asks for | Installed Tina4CSS classes | Composition |\n|---|---|---|\n'+components.map(([term,names,usage])=>`| ${term} | ${names.filter(n=>n in catalog).join(', ') || 'No mapped class installed; use semantic HTML and scoped SCSS'} | ${usage} |`).join('\n')+'\nNever invent a class from this vocabulary. The installed catalog is authoritative. Do not load Bootstrap separately. Keep the requested edit local.';
}

export function tina4CssGuidance(catalog:UtilityCatalog):string {
  const colours=Object.fromEntries(Object.entries(catalog).filter(([name])=>/^(text|bg)-/.test(name)));
  return `${pageDesign}\n${htmlComponentMap(catalog)}\nUse Bootstrap-style HTML built with the installed Tina4CSS framework by default. Structure layouts with container, row and col-* classes; compose cards with card and card-body, and buttons with btn plus an installed variant. Use the installed spacing and typography utilities. Bootstrap-style means Tina4CSS class conventions: do not load Bootstrap separately or assume unsupported Bootstrap classes exist. Its semantic theme roles are primary, secondary, success, danger, warning, info, light and dark. Choose suitable existing roles for the user's requested style; there is no style-name-to-palette mapping in the harness.
Compatible text/background pairs (ratio >= 4.5; apply explicit text utilities to children that override inherited text): ${JSON.stringify(Object.entries(colours).filter(([name])=>name.startsWith('bg-')).map(([name,props])=>({background:name,text:Object.entries(colours).filter(([text,p])=>text.startsWith('text-') && (contrastRatio(p.color||'',props['background-color']||'')||0)>=4.5).map(([text])=>text)})))}
Installed colour utilities and actual values: ${JSON.stringify(colours)}
Available framework classes: ${Object.keys(catalog).join(' ')}
Use grid, spacing, typography, component and colour utilities before custom SCSS. Compose controls with their base component class and variant; a colour utility alone does not supply component styling. Check layout classes against the installed catalog rather than assuming utilities from another CSS framework exist. Preserve custom semantic classes. Do not invent utility names or runtime theme variables: Tina4CSS theme variables are compile-time SCSS variables, and changing an unrelated variable cannot recolour its prebuilt CSS. Custom scoped SCSS is only for requirements absent from these utilities. Do not recreate resets, global typography or a parallel component system.`;
}

/** Keep page generation focused; the full catalog remains available for styling edits. */
export function pageCssGuidance(catalog:UtilityCatalog):string {
 const names=Object.keys(catalog).filter(name=>/^(container|row|col(?:-.*)?|card(?:-.*)?|btn(?:-.*)?|form-control|d-(?:flex|grid|block|none)|flex-(?:column|wrap)|align-items-center|justify-content-(?:between|center)|text-(?:start|center|primary|secondary|light|dark)|bg-(?:primary|secondary|light|dark)|[mp][trblxy]?-[0-5]|gap-[0-5]|rounded|shadow|w-100)$/.test(name));
 const buttonColours=Object.entries(catalog).filter(([name,props])=>name.startsWith('btn-') && props['background-color']).map(([name,props])=>({variant:name,background:props['background-color'],readableTextUtilities:Object.entries(catalog).filter(([text,p])=>text.startsWith('text-') && (contrastRatio(p.color||'',props['background-color'])||0)>=4.5).map(([text])=>text)}));
 return `${pageDesign}\n${htmlComponentMap(catalog)}\nInstalled button backgrounds and compatible text utilities: ${JSON.stringify(buttonColours)}. Choose readable text explicitly when the default variant text has insufficient contrast.\nThe base template already loads Tina4CSS. Generate Bootstrap-style HTML: use container > row > col-* for grids, card/card-body for cards, btn plus a variant for buttons, and spacing and typography utilities. Use only classes present in the installed list below; do not load Bootstrap separately. Prefer these utilities over custom layout classes or CSS. Use these installed classes for layout and styling: ${names.join(' ')}. Compose component base and variant classes. Do not import assets or include CSS in the content fragment. Custom scoped SCSS is a separate stage. Use contrasting text and backgrounds.`;
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
    for(const name of [...change.add,...change.remove||[]]) if(typeof name!=='string' || !catalog[name])throw new Error(`Unknown Tina4CSS utility ${name}. This class does not exist. Remove it from add. Use an existing utility only if it expresses the requested effect; otherwise put the CSS property/value in styles for the existing SCSS file and remove any conflicting existing utility. Do not invent a replacement class.`);
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

/** Catch misspellings of installed utilities without banning custom semantic classes. */
/** Correct only unambiguous generated utility spelling; retain known project names. */
export function normalizeUtilitySpelling(source:string,catalog:UtilityCatalog,existingSource=''):string {
 return source.replace(/(\bclass\s*=\s*)(["'])([\s\S]*?)\2/gi,(attribute,prefix,quote,value)=>{
  if(/[{}]/.test(value))return attribute;
  return prefix+quote+value.replace(/\S+/g,(name:string)=>{
   const normalized=name.replace(/_/g,'-');
   return !catalog[name] && !existingSource.includes(name) && catalog[normalized] ? normalized : name;
  })+quote;
 });
}
export function validateUtilitySpelling(source:string,catalog:UtilityCatalog):void {
 const document=new DOMParser().parseFromString(source,'text/html');
 const errors=new Set<string>();
 for(const element of document.querySelectorAll('[class]'))for(const name of element.classList){
  if(catalog[name] || /[{}]/.test(name))continue;
  const normalized=name.replace(/_/g,'-');
  if(normalized!==name && catalog[normalized])errors.add(`${name} is not installed; the installed utility is ${normalized}`);
 }
 if(errors.size)throw new Error([...errors].join('; ')+'. Preserve exact installed class names.');
}
