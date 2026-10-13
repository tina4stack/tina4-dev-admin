import {javascriptLanguage} from '@codemirror/lang-javascript';
import {validatePageScript} from './ai-page';

export function scriptFunctions(source:string):{name:string;from:number;to:number;source:string}[] {
 const found:{name:string;from:number;to:number;source:string}[]=[];
 javascriptLanguage.parser.parse(source).iterate({enter(node){
  if(node.name!=='FunctionDeclaration')return;
  const code=source.slice(node.from,node.to),name=code.match(/^(?:async\s+)?function\s*\*?\s*([\w$]+)/)?.[1];
  if(name)found.push({name,from:node.from,to:node.to,source:code});
 }});
 return found;
}
export function replaceScriptFunction(source:string,name:string,replacement:string):string {
 const matches=scriptFunctions(source).filter(fn=>fn.name===name);
 if(matches.length!==1)throw new Error('Choose one uniquely named existing function.');
 validatePageScript(replacement);
 const parsed=scriptFunctions(replacement);
 if(parsed.length!==1 || parsed[0].name!==name || replacement.slice(0,parsed[0].from).trim() || replacement.slice(parsed[0].to).trim())throw new Error('Return only the complete selected function with its original name.');
 const fn=matches[0],next=source.slice(0,fn.from)+replacement+source.slice(fn.to);
 validatePageScript(next);return next;
}

/** Accept a names array or the requested object, but never infer names from prose. */
export function selectedScriptFunctions(response:string,source:string):string[] {
 const text=response.trim().replace(/^```(?:json)?\s*\n/,'').replace(/\n```$/,'');
 const value=JSON.parse(text),names=Array.isArray(value)?value:value.functions;
 const functions=scriptFunctions(source);
 if(!Array.isArray(names) || !names.length || names.length>3 || !names.every(name=>typeof name==='string' && functions.filter(fn=>fn.name===name).length===1))throw new Error('Select one to three uniquely named existing functions.');
 return [...new Set<string>(names)];
}
