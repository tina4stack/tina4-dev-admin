/** Verify literal same-origin image sources before a generated template is saved. */
export function validateRequiredImages(source:string,available:string[],minimum:number):void {
 if(minimum<=0)return;
 const doc=new DOMParser().parseFromString(source,'text/html');
 const used=new Set([...doc.querySelectorAll('img[src]')].map(el=>el.getAttribute('src')!).filter(src=>available.includes(src)));
 if(used.size<minimum)throw new Error(`The agreed request requires at least ${minimum} supplied image(s), but the HTML uses ${used.size}. Add img elements using suitable exact URLs from ${JSON.stringify(available)}. Keep the other requested content.`);
}
export async function validatePageImages(source:string,signal?:AbortSignal,beforeSource=""):Promise<void> {
 const document=new DOMParser().parseFromString(source,'text/html');
 const previous=new DOMParser().parseFromString(beforeSource,'text/html');
 const existing=new Set([...previous.querySelectorAll('img[src]')].map(image=>image.getAttribute('src')!.trim()));
 const missing:string[]=[];
 const urls=[...new Set([...document.querySelectorAll('img[src]')].map(image=>image.getAttribute('src')!.trim()))];
 for(const src of urls){
  if(existing.has(src))continue;
  if(/[{}]/.test(src) || src.startsWith('data:'))continue;
  if(!src){missing.push('(empty image source)');continue;}
  const url=new URL(src,window.location.origin+'/');
  if(url.origin!==window.location.origin)continue;
  const response=await fetch(url,{method:'HEAD',signal,cache:'no-store'});
  if(!response.ok || !(response.headers.get('content-type')||'').startsWith('image/'))missing.push(src);
 }
 if(missing.length)throw new Error(`Image assets do not exist or are not images: ${missing.join(', ')}. Use actual supplied public image URLs. Do not invent filenames. If no suitable image is supplied, use an inline SVG illustration or a deliberate styled placeholder without a broken img source. Preserve requested content.`);
}
