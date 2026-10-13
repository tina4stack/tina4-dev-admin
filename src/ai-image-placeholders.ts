/** Missing assets must render as labelled placeholders, not broken image URLs. */
export async function groundCompletionImages(code:string,verify:(src:string)=>Promise<boolean>):Promise<string> {
 const images=[...code.matchAll(/<img\b[^>]*>/gi)];
 for(const match of images){
  const doc=new DOMParser().parseFromString(match[0],'text/html');const img=doc.querySelector('img');if(!img)continue;
  const src=img.getAttribute('src')||'';
  if(src && await verify(src))continue;
  const escape=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
  const label=escape(img.getAttribute('alt')||'Image placeholder');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}" viewBox="0 0 640 360" width="640" height="360"><title>${label}</title><rect width="640" height="360" fill="#e9ecef"/><text x="320" y="180" text-anchor="middle" dominant-baseline="middle" fill="#495057" font-size="24">Image placeholder</text></svg>`;
  code=code.replace(match[0],svg);
 }
 return code;
}
