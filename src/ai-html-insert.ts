import {templateContent} from './ai-template-edit';
import {htmlLanguage} from '@codemirror/lang-html';

function sourceElements(source:string) {
 const marker='data-tina4-insert-target';
 if(source.includes(marker))throw new Error('Source contains a reserved insertion marker.');
 const markup=source.replace(/{[{%][\s\S]*?[%}]}/g,token=>' '.repeat(token.length));
 const ranges:{from:number;to:number;openEnd:number;closeStart?:number}[]=[];
 htmlLanguage.parser.parse(markup).iterate({enter(node){
  if(node.name!=='Element')return;
  const open=node.node.getChild('OpenTag') || node.node.getChild('SelfClosingTag');
  if(open)ranges.push({from:node.from,to:node.to,openEnd:open.to,closeStart:node.node.getChild('CloseTag')?.from});
 }});
 let tagged=source;
 for(let i=ranges.length-1;i>=0;i--){
  const start=ranges[i].from,name=source.slice(start).match(/^<[\w:-]+/);
  if(name){const at=start+name[0].length;tagged=tagged.slice(0,at)+` ${marker}="${i}"`+tagged.slice(at);}
 }
 const document=new DOMParser().parseFromString(tagged,'text/html');
 const slot=templateContent(source);
 const elements=[...document.querySelectorAll(`[${marker}]`)].filter(el=>{
  if(el.closest('script,style,head'))return false;
  const range=ranges[Number(el.getAttribute(marker))];
  return !slot || range.from>=slot.from && range.to<=slot.to;
 });
 const structural=elements.filter(el=>el.id || /^(SECTION|ARTICLE|MAIN|HEADER|FOOTER|NAV|ASIDE)$/.test(el.tagName));
 return {marker,ranges,document,elements,targets:structural.length ? structural : elements};
}
/** Numbered structural targets avoid requiring the model to reconstruct selector syntax. */
export function htmlInsertionTargets(source:string):{target:number;element:string;text:string;selector?:string}[] {
 const {document,targets,marker}=sourceElements(source);
 return targets.map(el=>{
  const target=Number(el.getAttribute(marker));
  const element=el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(el.className?'.'+String(el.className).trim().replace(/\s+/g,'.'):'');
  const selector=el.id ? `[id=${JSON.stringify(el.id)}]` : element;
  let unique=false;try{unique=document.querySelectorAll(selector).length===1;}catch{}
  return {target,element,text:el.textContent?.replace(/\s+/g,' ').trim().slice(0,90)||'',...(unique?{selector}:{})};
 });
}
export function htmlInsertionFocus(source:string,target:number|string,position:string):string|undefined {
 const selector=typeof target==='string' ? target : htmlInsertionTargets(source).find(item=>item.target===target)?.selector;
 if(!selector)return undefined;
 return position==='after' ? `${selector} + *` : position==='before' ? `*:has(+ ${selector})` : `${selector} > ${position==='prepend'?':first-child':':last-child'}`;
}
/** Locate newly added named content even when the model used an exact replacement. */
export function addedContentFocus(before:string,after:string):string|undefined {
 const oldIds=new Set(sourceElements(before).elements.map(el=>el.id).filter(Boolean));
 const {elements,document,marker,ranges}=sourceElements(after);
 for(const el of elements){
  if(!el.id || oldIds.has(el.id))continue;
  const selector=`[id=${JSON.stringify(el.id)}]`;
  if(document.querySelectorAll(selector).length===1)return selector;
 }
 if(before===after)return undefined;
 let start=0,end=after.length,oldEnd=before.length;
 while(start<before.length && start<after.length && before[start]===after[start])start++;
 while(end>start && oldEnd>start && after[end-1]===before[oldEnd-1]){end--;oldEnd--;}
 const containing=elements.filter(el=>{const range=ranges[Number(el.getAttribute(marker))];return range.from<=start && range.to>=end;});
 const target=containing.sort((a,b)=>{const x=ranges[Number(a.getAttribute(marker))],y=ranges[Number(b.getAttribute(marker))];return (x.to-x.from)-(y.to-y.from);})[0];
 if(!target)return undefined;
 const parts:string[]=[];
 for(let el:Element|null=target;el && el.tagName!=='BODY';el=el.parentElement){
  const siblings=el.parentElement ? [...el.parentElement.children].filter(item=>item.tagName===el!.tagName) : [el];
  parts.unshift(`${el.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(el)+1})`);
  const selector=parts.join(' > ');
  if(document.querySelectorAll(selector).length===1)return selector;
 }
 return undefined;
}
/** Resolve an actual target to original source offsets; never serialize or rewrite the page. */
export function htmlInsertionPoint(source:string,target:string|number,position:string):number {
 if(!['before','after','prepend','append'].includes(position))throw new Error('Insertion position must be before, after, prepend or append.');
 const {marker,ranges,document,elements,targets}=sourceElements(source);
 let matched:Element[];
 if(typeof target==='number')matched=Number.isInteger(target) ? elements.filter(el=>Number(el.getAttribute(marker))===target) : [];
 else {try{matched=[...document.querySelectorAll(target)].filter(el=>elements.includes(el));}catch{throw new Error('Invalid insertion selector.');}}
 if(matched.length!==1) {
  throw new Error(`Insertion target ${target} must match exactly one source element; matched ${matched.length}. Choose a numbered target from ${JSON.stringify(htmlInsertionTargets(source))}. Do not invent a target or convert an id into a class.`);
 }
 if(['HTML','HEAD','BODY'].includes(matched[0].tagName) && ['before','after'].includes(position))throw new Error('Insert content inside the document body, not beside the document shell.');
 const range=ranges[Number(matched[0].getAttribute(marker))];
 if(position==='before')return range.from;
 if(position==='after')return range.to;
 if(range.closeStart===undefined)throw new Error('Cannot insert children into a void or unclosed element.');
 return position==='prepend' ? range.openEnd : range.closeStart;
}

function attributeElements(source:string){
 const context=sourceElements(source);
 const targets=context.elements.filter(el=>el.id || (!el.children.length && !!el.textContent?.trim()) || /^(SECTION|ARTICLE|MAIN|HEADER|FOOTER|NAV|ASIDE|A|IMG|BUTTON|INPUT|SELECT|TEXTAREA|LABEL|H[1-6])$/.test(el.tagName));
 return {...context,targets};
}
export function htmlAttributeTargets(source:string){
 const {targets,marker}=attributeElements(source);
 return targets.map(el=>({target:Number(el.getAttribute(marker)),element:el.tagName.toLowerCase(),text:el.textContent?.replace(/\s+/g,' ').trim().slice(0,70)||'',attributes:Object.fromEntries([...el.attributes].filter(a=>a.name!==marker).map(a=>[a.name,a.value]))}));
}
export function htmlAttributePatch(source:string,target:number,attributes:Record<string,string|null>){
 const {targets,marker,ranges}=attributeElements(source);
 const el=Number.isInteger(target)?targets.find(el=>Number(el.getAttribute(marker))===target):undefined;
 if(!el)throw new Error('Choose an attribute target number from the supplied attribute catalog.');
 if(!attributes || Array.isArray(attributes) || typeof attributes!=='object' || !Object.keys(attributes).length)throw new Error('Supply a nonempty attributes object.');
 const range=ranges[Number(el.getAttribute(marker))];
 let opening=source.slice(range.from,range.openEnd);
 const masked=opening.replace(/{[{%][\s\S]*?[%}]}/g,t=>' '.repeat(t.length));
 const changes:{from:number;to:number;new:string}[]=[];let additions='';
 const attrs:{name:string;from:number;to:number}[]=[];
 htmlLanguage.parser.parse(masked).iterate({enter(node){if(node.name==='Attribute'){const name=node.node.getChild('AttributeName');if(name)attrs.push({name:opening.slice(name.from,name.to).toLowerCase(),from:node.from,to:node.to});}}});
 for(const [name,value] of Object.entries(attributes)){
  if(!/^[a-zA-Z][\w:-]*$/.test(name) || /^on/i.test(name) || ['style','srcdoc'].includes(name))throw new Error('Use ordinary HTML attributes; event handlers and inline styles are not attribute edits.');
  const standard=new Set('id class title role href src srcset sizes alt width height loading decoding fetchpriority target rel download hreflang type name value placeholder disabled readonly required checked selected multiple min max step minlength maxlength pattern autocomplete autofocus for form action method enctype accept rows cols wrap tabindex hidden inert lang dir contenteditable draggable spellcheck accesskey translate slot colspan rowspan scope headers datetime cite start reversed open controls autoplay loop muted poster preload'.split(' '));
  if(!standard.has(name.toLowerCase()) && !/^(data|aria)-[\w-]+$/.test(name) && !el.tagName.includes('-'))throw new Error(`Unsupported HTML attribute ${name}. Visible words are element content, not an attribute. For a heading or label use {path, target, text: "new visible words"} with text at the top level, not inside attributes.`);
  if(value!==null && typeof value!=='string')throw new Error('Attribute values must be strings or null for removal.');
  if(value && /^(href|src)$/i.test(name) && /^\s*(javascript|vbscript|data):/i.test(value))throw new Error('Unsafe attribute URL.');
  const encoded=value===null?'':`${name}="${value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')}"`;
  const matches=attrs.filter(a=>a.name===name.toLowerCase());
  if(matches.length>1)throw new Error('Source has duplicate attributes; repair its structure first.');
  if(matches.length)changes.push({...matches[0],new:encoded});
  else if(value!==null)additions+=' '+encoded;
 }
 const end=opening.search(/\/?>(\s*)$/);
 if(additions)changes.push({from:end,to:end,new:additions});
 for(const change of changes.sort((a,b)=>b.from-a.from))opening=opening.slice(0,change.from)+change.new+opening.slice(change.to);
 return {from:range.from,to:range.openEnd,new:opening};
}

export function htmlTextPatch(source:string,target:number,text:string){
 const {targets,marker,ranges}=attributeElements(source);
 const el=Number.isInteger(target)?targets.find(el=>Number(el.getAttribute(marker))===target):undefined;
 if(!el)throw new Error('Choose a text target from the attribute/text catalog.');
 const range=ranges[Number(el.getAttribute(marker))];
 if(el.children.length || range.closeStart===undefined || /{[{%]/.test(source.slice(range.openEnd,range.closeStart)))throw new Error('Text edits require a plain-text element without nested markup or template expressions. Use an exact source patch for structured content.');
 return {from:range.openEnd,to:range.closeStart,new:text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')};
}
