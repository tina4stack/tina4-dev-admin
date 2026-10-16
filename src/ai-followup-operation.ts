export type FollowupOperation='appearance'|'content'|'creation'|'inspection';
type Request=(prompt:string,limit?:number,think?:boolean,system?:string,projectGuidance?:boolean)=>Promise<string>;
/** Resolve every requested effect, then choose the workflow able to handle all of them. */
export async function classifyFollowupOperation(task:string,request:Request):Promise<FollowupOperation|undefined>{
 const output=await request(`User request: ${JSON.stringify(task)}
Choose the operation by what must change:
- appearance: colours, spacing, typography, contrast, overlap, clipping or arrangement of existing content; words and behaviour stay unchanged.
- content: add/remove/change words, elements, images or behaviour. Link destinations, clicking, scrolling to a section and control actions are behaviour.
- creation: build a separate page.
- inspection: explain or inspect without changing anything.
Preserving unrelated content is a constraint, not an operation. FIRST check whether any part requests a separate new page or route. If yes, choose creation, including requests that ALSO add links or change the current page; the creation workflow handles both scopes. A new section within the current page is content, not creation. Otherwise decide whether any change alters words, information or behaviour before considering styling. If so choose content, even when the request also changes colour or spacing. Appearance applies only when all words and behaviour stay the same.
First state the concrete requested effect in a short phrase, then classify it. Return only {"effect":"what changes or is inspected","operation":"appearance|content|creation|inspection"}.`,300,true,'Classify only the current user operation, independent of business subject. Return one JSON object with effect followed by operation.',false);
 const match=output.match(/"operation"\s*:\s*"(appearance|content|creation|inspection)"/);
 const operation=match?.[1] as FollowupOperation|undefined;
 if(operation!=='appearance')return operation;
 const check=await request(`Request: ${JSON.stringify(task)}
Does the user ask for different visible wording, adding/removing content sections or media, adding/removing controls, or changing navigation/functionality? Return {"contentChange":true} if ANY of those is requested; otherwise {"contentChange":false}. Changing CSS classes, layout, legibility, sizes or colours alone does not count. Preserving content means retaining the words, not retaining their visual appearance.`,200,true,'Check for requested content or behaviour changes. Return contentChange boolean. Styling changes alone are false.',false);
 const answer=check.match(/"contentChange"\s*:\s*(true|false)/);
 return answer?.[1]==='false' ? 'appearance' : 'content';
}
