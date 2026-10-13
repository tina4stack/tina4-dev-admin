import html2canvas from "html2canvas";
import {previewLayout} from "./preview-layout";

export interface PreviewCapture { image: string; route: string; width: number; height: number; measurements?: string; layoutIssues?: string[]; content?: string[]; contrastSelectors?:string[]; }

/** Capture the page at its device viewport, excluding the development toolbar.
 * Same-origin DOM rendering stays local; no screen-sharing permission is needed. */
async function captureOnce(frame: HTMLIFrameElement, route?: string): Promise<PreviewCapture> {
  const current=new URL(frame.contentWindow!.location.href);
  if(current.origin!==location.origin) throw new Error("Preview capture requires a same-origin page.");
  if(route) {
    const target=new URL(route,location.origin);
    if(target.origin!==location.origin || target.pathname.startsWith('/__dev')) throw new Error("Invalid preview route.");
    await new Promise<void>((resolve,reject)=>{
      const timeout=setTimeout(()=>{cleanup();reject(new Error("Preview reload timed out."));},15000);
      const loaded=()=>{cleanup();resolve();};
      const cleanup=()=>{clearTimeout(timeout);frame.removeEventListener('load',loaded);};
      frame.addEventListener('load',loaded);
      target.searchParams.set('_t4_capture',String(Date.now()));
      frame.src=target.href;
    });
  }
  if(route && new URL(frame.contentWindow!.location.href).pathname!==new URL(route,location.origin).pathname) throw new Error("Preview navigated away from the requested route.");
  const doc=frame.contentDocument, win=frame.contentWindow;
  if(!doc || !win || !doc.body) throw new Error("Preview is unavailable.");
  await Promise.race([doc.fonts.ready,new Promise(resolve=>setTimeout(resolve,2500))]);
  await Promise.all([...doc.images].map(image=>image.complete ? Promise.resolve() : Promise.race([image.decode().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,2500))])));
  await new Promise(resolve=>setTimeout(resolve,200));
  const width=win.innerWidth,height=win.innerHeight;
  if(width<1 || height<1) throw new Error("Show the preview panel before running visual checks.");
  const {measurements,layoutIssues,content,contrastSelectors}=previewLayout(doc,win);
  const canvas=await html2canvas(doc.documentElement,{
    width,height,windowWidth:width,windowHeight:height,x:win.scrollX,y:win.scrollY,
    scale:Math.min(1,1280/Math.max(width,height)),useCORS:true,allowTaint:false,
    imageTimeout:3000,logging:false,
    ignoreElements:element=>element.id==='tina4-dev-toolbar',
  });
  if(frame.contentDocument!==doc || !doc.defaultView) throw new Error("Preview changed during capture.");
  const url=new URL(win.location.href);url.searchParams.delete('_t4_capture');
  if(route && url.pathname!==new URL(route,location.origin).pathname) throw new Error('Preview route changed during capture.');
  return {image:canvas.toDataURL('image/png').split(',')[1],route:url.pathname+url.search,width,height,measurements,layoutIssues,content,contrastSelectors};
}

/** Dev reload may replace the iframe document during font/image or canvas work. Reacquire
 * the document on bounded retries; never return pixels from a detached/stale document. */
export async function capturePreview(frame: HTMLIFrameElement, route?:string): Promise<PreviewCapture> {
  for(let attempt=0;attempt<3;attempt++) {
    try { return await captureOnce(frame, route); }
    catch(error) {
      if(attempt===2) throw error;
      await new Promise(resolve=>setTimeout(resolve,500));
    }
  }
  throw new Error('Preview did not settle after reload.');
}
