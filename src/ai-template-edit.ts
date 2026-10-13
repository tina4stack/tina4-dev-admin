import {htmlLanguage} from '@codemirror/lang-html';

/** Expose a template content slot without delegating its inheritance/control shell. */
export function templateContent(source:string):{from:number;to:number;html:string}|null {
 const match=/{%\s*block\s+content\s*%}([\s\S]*?){%\s*endblock(?:\s+content)?\s*%}/.exec(source);
 if(!match || /{%\s*block\b/.test(match[1]))return null;
 const from=match.index+match[0].indexOf('%}')+2;
 return {from,to:from+match[1].length,html:match[1]};
}
export function replaceTemplateContent(source:string,html:string):string {
 const slot=templateContent(source);if(!slot)throw new Error('No unambiguous template content slot.');
 if(/```|<\/?(?:html|head|body)\b/i.test(html))throw new Error('Return the HTML fragment only, without document wrappers or fences.');
 const tokens=(s:string)=>s.match(/{[{%][\s\S]*?[%}]}/g)||[];
 const before=tokens(slot.html),after=tokens(html);
 if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('Preserve existing Twig expressions and control tags exactly; do not add or remove template directives.');
 for(const heading of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi))if(/<h[1-6]\b/i.test(heading[2]))throw new Error('Headings cannot contain other headings. Use one heading element for each title.');
 let invalid=false;
 const markup=html.replace(/{[{%][\s\S]*?[%}]}/g,token=>' '.repeat(token.length));
 htmlLanguage.parser.parse(markup).iterate({enter(node){if(node.type.isError)invalid=true;
 if(node.name==='Element'){const open=node.node.getChild('OpenTag'),close=node.node.getChild('CloseTag');if(open && !close){const name=html.slice(open.from,open.to).match(/^<([\w-]+)/)?.[1]?.toLowerCase();if(name && !['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'].includes(name))invalid=true;}}}});
 if(invalid)throw new Error('HTML fragment has unbalanced or invalid tags. Return the complete fragment with matching closing tags.');
 if(!html.trim())throw new Error('Content must not be empty.');
 return source.slice(0,slot.from)+'\n'+html.trim()+'\n'+source.slice(slot.to);
}
