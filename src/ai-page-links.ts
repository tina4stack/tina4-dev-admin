/** Reject invented local navigation before a generated page is saved. */
export interface NavigationRequirement {label:string;href:string|null;}
export function navigationRequirements(value:any):NavigationRequirement[]|undefined {
 const links=Array.isArray(value)?value:value?.links;
 if(Array.isArray(links)&&links.every((link:any)=>typeof link?.label==='string'&&link.label.trim()&&(link.href===null||typeof link.href==='string')))return links;
}
export function validateNavigationRequirements(source:string,requirements:NavigationRequirement[],pageRoute:string):void {
 const document=new DOMParser().parseFromString(source,'text/html');
 const normalize=(text:string)=>text.replace(/\s+/g,' ').trim().toLocaleLowerCase();
 for(const requirement of requirements){
  const anchors=[...document.querySelectorAll('a[href]')].filter(el=>normalize(el.textContent||el.getAttribute('aria-label')||'')===normalize(requirement.label));
  if(!anchors.length)throw new Error(`The requested navigation label ${JSON.stringify(requirement.label)} must be an actual a element with href, not plain text or a non-navigating button.`);
  const expected=requirement.href && new URL(requirement.href,'https://project.invalid'+pageRoute).href;
  if(!anchors.some(el=>{const href=el.getAttribute('href')!.trim();return href && href!=='#' && (!expected || new URL(href,'https://project.invalid'+pageRoute).href===expected);} ))throw new Error(`The link ${JSON.stringify(requirement.label)} does not point to ${requirement.href || 'a meaningful destination'}.`);
 }
}
export function validatePageLinks(source:string,routes:string[],pageRoute:string,beforeSource=''):void {
 const document=new DOMParser().parseFromString(source,'text/html');
 const before=new DOMParser().parseFromString(beforeSource,'text/html');
 const oldLinks=new Set([...before.querySelectorAll('a[href]')].map(el=>el.getAttribute('href')!.trim()));
 const known=new Set([...routes.filter(route=>!/^\/(?:__|health(?:\/|$))/.test(route)),pageRoute].map(route=>route.replace(/\/$/,'')||'/'));
 const problems:string[]=[];
 for(const link of document.querySelectorAll('a[href]')) {
  const href=link.getAttribute('href')!.trim();
  if(oldLinks.has(href) && (!href.startsWith('#') || !before.getElementById(href.slice(1))))continue;
  if(!href || href==='#'){problems.push('Navigation needs a real destination, not an empty placeholder.');continue;}
  if(/[{}]/.test(href) || /^(?:https?:|mailto:|tel:)/i.test(href))continue;
  if(/^(?:javascript|data):/i.test(href)){problems.push('Unsafe navigation scheme.');continue;}
  const url=new URL(href,'https://project.invalid'+pageRoute);
  if(url.origin!=='https://project.invalid')continue;
  const path=url.pathname.replace(/\/$/,'')||'/';
  if(!known.has(path))problems.push(`Navigation target ${url.pathname} has no known page route.`);
  if(path===(pageRoute.replace(/\/$/,'')||'/') && url.hash && !document.getElementById(decodeURIComponent(url.hash.slice(1))))problems.push(`In-page destination ${url.hash} does not exist.`);
 }
 if(problems.length) {
  const anchors=[...document.querySelectorAll('[id]')].map(el=>'#'+el.id);
  throw new Error([...new Set(problems)].join(' ')+' Available destinations: '+JSON.stringify([...known,...anchors])+'. Correct every invalid href. For a section already on this page, give that section an id and link to #id. Do not invent pages or remove requested content.');
 }
}
