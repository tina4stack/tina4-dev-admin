import { streamChat } from './ai-gateway';
import { jsonObjects } from './ai-agent';

export type PreviewIntent = { action:'continue' } | { action:'preview'|'test'; route:string } | { action:'question'; question:string };
export function parsePreviewIntent(text:string, routes:string[]):PreviewIntent {
  for(const raw of jsonObjects(text)) {
    const value=JSON.parse(raw);
    if(value.action==='continue') return {action:'continue'};
    if(value.action==='question' && typeof value.question==='string' && value.question.trim()) return {action:'question',question:value.question};
    if(['preview','test'].includes(value.action) && typeof value.route==='string' && routes.includes(value.route) && value.route.startsWith('/') && !value.route.startsWith('//') && !value.route.startsWith('/__') && !/[{}]/.test(value.route)) return {action:value.action,route:value.route};
  }
  throw new Error('Could not resolve a safe preview destination. Please specify the page URL.');
}
export async function previewIntent(task:string,routes:string[],currentRoute:string|undefined,model:string,signal?:AbortSignal):Promise<PreviewIntent> {
  let text='';
  await streamChat({model,think:true,options:{num_predict:500,temperature:0},messages:[{
    role:'system',content:'Classify the requested operation, not which route they mention. Build and direct edit requests MUST return {"action":"continue"}, even if they name an existing page. Viewing requests return preview. Requests to exercise or test existing interactive controls return test, with the exact existing route. Test requests may include repairing failed checks. Output JSON only.'
  },{role:'user',content:`Examples of operations (not project routes):
"Change the title on /products" => {"action":"continue"}
"Fix the layout" => {"action":"continue"}
"Why does this overlap?" => {"action":"continue"}
"Open /products" => {"action":"preview","route":"/products"} (only if /products is available)
Latest request: ${JSON.stringify(task)}
Available GET routes: ${JSON.stringify(routes)}
Current preview: ${currentRoute || '/'}
If the user asks to show, open, load, visit or preview an existing page, return action "preview" and route (an exact available route). If that destination is missing or ambiguous, return action "question" and a short question. If the request primarily asks to test or exercise existing interactive behaviour, return action "test" and the exact available route. Otherwise if the request asks to edit, build, fix, or explain, return action "continue". A request to show an existing page is navigation, never an edit. Do not choose a route for a non-navigation request.`}]},{signal,onContent:token=>{text+=token;}});
  try {return parsePreviewIntent(text,routes);} catch {return {action:"question",question:`Which existing page should I open? Available routes: ${routes.join(", ") || "none"}.`};}
}
