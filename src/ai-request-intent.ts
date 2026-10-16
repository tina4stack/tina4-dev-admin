import {streamChat} from './ai-gateway';
export type RequestIntent='answer'|'inspect'|'navigate'|'change'|'test';
export function parseRequestIntent(raw:string):RequestIntent|null {
 const normalized=raw.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,'');
 try {const value=JSON.parse(normalized);if(value.modifiesArtifact===true)return 'change';return ['answer','inspect','navigate','change','test'].includes(value.intent) ? value.intent : null;}catch{return null;}
}
/** No preview, file content, or historical plan instructions can confer write intent. */
export async function classifyRequest(task:string,previousUserRequests:string[],model:string,signal?:AbortSignal,pending?:{task:string;question:string}):Promise<RequestIntent|null> {
 for(let attempt=0;attempt<2;attempt++) {
  let raw='';
  await streamChat({model,think:false,options:{num_predict:120,temperature:0},messages:[
   {role:'system',content:'Classify the main action requested by the user. First decide whether the user authorizes any modification to the artifact, including conditional repairs. Return only JSON {"modifiesArtifact":boolean,"intent":"change"}. Set modifiesArtifact true for any requested modification, even when inspection comes first. Choose intent from: change (create/build/edit/fix content or code), answer (knowledge/explanation/discussion), inspect (report visible issues without fixing), navigate (show/open a page), test (run checks without a requested build). Interacting with existing controls to check their output is test, even though clicking changes browser state. It is not a source-code change. Only an explicit request to create or modify the artifact is change. When inspection or testing includes authorization to fix discovered problems, the main action is change. Inspect and test are read-only categories only when no repair or modification is requested. When a build includes checking the result, the main action is change. Documents and previews are supporting context; their presence does not decide the action. Do not perform the task. If a clarification is pending, interpret a short answer or delegated choice as continuing that original action. An explicit new topic or cancellation takes precedence. If genuinely unclear without a pending clarification, use answer.'},
   {role:'user',content:`Pending clarification: ${JSON.stringify(pending || null)}\nEarlier requests, only to resolve references: ${JSON.stringify(previousUserRequests.slice(-2))}\nLATEST USER REQUEST TO CLASSIFY:\n${task}\nClassify that main action, not its subject matter or supporting steps.`}
  ]},{signal,onContent:text=>{raw+=text;}});
  console.debug("Request classification",raw);
  const intent=parseRequestIntent(raw);if(intent)return intent;
 }
 return null;
}
