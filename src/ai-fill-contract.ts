export interface FillContract {task?:string;use?:string;returns?:string;ground?:string;given?:string;name?:string}
export function fillContract(source:string):FillContract {
 const result:FillContract={};
 const marker=source.match(/(?:\{#|#|\/\/|<!--|--)\s*tina4:edit\s+([^\n]*?)(?:#\}|-->|$)/m);
 if(marker)result.task=marker[1].trim();const keys:Record<string,keyof FillContract>={Intent:'task',Use:'use',Return:'returns',Ground:'ground',Given:'given'};
 for(const line of source.split('\n')) {
  const name=line.match(/AI-FILL:\s*([\w.-]+)/);if(name)result.name=name[1];
  const match=line.match(/^\s*(?:#|\/\/|<!--)\s*(Intent|Use|Return|Ground|Given):\s*(.*?)\s*(?:-->)?$/);
  if(match)result[keys[match[1]]]=match[2];
 }
 return result;
}
export function fillInstructions(contract:FillContract):string {
 const parts=['Implement only the selected block. Replace its placeholder with working statements; preserve all code outside the selection.'];
 if(contract.task)parts.push('TASK: '+contract.task);
 if(contract.given)parts.push('INPUTS / PRECONDITIONS: '+contract.given);
 if(contract.use)parts.push('API AND IMPORT REQUIREMENTS: '+contract.use+'. Reuse existing imports; if the specified import is missing, add a local import inside this replacement. Alternatives separated by “or” are choices, not cumulative requirements.');
 if(contract.returns)parts.push('REQUIRED RETURN SHAPE: '+contract.returns);
 if(contract.ground)parts.push('FRAMEWORK CONTEXT HINT: '+contract.ground+'. Use the supplied Tina4 guidance and explicit API contract directly. Do not search or insert this hint as application code.');
 parts.push('Output executable source only. No Markdown, repeated instructions, placeholder raises or unrelated declarations.');
 return parts.join('\n');
}
export function fillRange(source:string,position:number):{from:number;to:number}|null {
 const starts=[...source.matchAll(/^[ \t]*#[ \t]*[^\n]*AI-FILL:[^\n]*$/gm)];
 for(const match of starts) {
  const from=source.lastIndexOf('\n',match.index!-1)+1;
  const after=match.index!+match[0].length;
  const end=source.slice(after).match(/^[ \t]*#[ \t]*[─━-]{5,}[ \t]*$/m);
  if(!end)continue;
  const to=after+end.index!+end[0].length;
  if(position>=from && position<=to)return {from,to};
 }
 return null;
}
