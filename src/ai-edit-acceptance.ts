/** Preserve the complete user request when splitting it into review obligations. */
export function acceptanceRequirements(request:string,value:any):string[]{
 const clauses=value?.requirements;
 if(!Array.isArray(clauses)||!clauses.length||!clauses.every((r:unknown)=>typeof r==='string'&&r.trim()))throw new Error('Return exact request clauses.');
 let cursor=0;
 const original:string[]=[];
 for(let index=0;index<clauses.length;index++){
  const start=cursor,clause=clauses[index].trim();
  while(/\s/.test(request[cursor]||'') && cursor<request.length)cursor++;
  for(let offset=0;offset<clause.length;offset++){
   if(/\s/.test(clause[offset])){while(cursor<request.length&&/\s/.test(request[cursor]))cursor++;continue;}
   if(request[cursor]!==clause[offset])throw new Error('The checklist omitted or rewrote part of the request. Copy its original words in order.');
   cursor++;
  }
  // Preserve omitted sentence separators from the original, never from the model.
  const next=clauses[index+1]?.trim()[0];
  while(cursor<request.length && (/\s/.test(request[cursor]) || /[,.!?;]/.test(request[cursor]) && request[cursor]!==next))cursor++;
  original.push(request.slice(start,cursor).trim());
 }
 if(request.slice(cursor).trim())throw new Error('The checklist omitted or rewrote part of the request. Copy its original words in order.');
 return original;
}
/** A source review must account for every resolved obligation, with literal evidence. */
export class AcceptanceFormatError extends Error {}
export function validateEditAcceptance(requirements:string[],review:any,files:Record<string,string>):void {
 if(!Array.isArray(review?.checks))throw new AcceptanceFormatError('Review must check every requirement separately.');
 for(let index=0;index<requirements.length;index++){
  const matches=review.checks.filter((check:any)=>check?.requirement===index);
  if(matches.length!==1)throw new AcceptanceFormatError(`Missing or duplicate review of requirement ${index}: ${requirements[index]}`);
  const check=matches[0];
  if(typeof check.satisfied!=='boolean')throw new AcceptanceFormatError(`Missing boolean verdict for: ${requirements[index]}`);
  if(check.satisfied!==true)throw new Error(`Unmet requirement: ${requirements[index]}. ${check.correction || check.reason || 'Implement this part of the request.'}`);
  if(!Array.isArray(check.evidence)||!check.evidence.length)throw new AcceptanceFormatError(`Missing source evidence for: ${requirements[index]}`);
  for(const evidence of check.evidence){
   if(typeof evidence?.path==='string' && Number.isInteger(evidence.line) && evidence.line>0 && files[evidence.path]!==undefined && evidence.line<=files[evidence.path].split('\n').length)continue;
   if(typeof evidence?.path!=='string'||typeof evidence.quote!=='string'||!evidence.quote.trim()||!files[evidence.path]?.includes(evidence.quote))
    throw new AcceptanceFormatError(`Unsupported source evidence for: ${requirements[index]}`);
  }
 }
}
