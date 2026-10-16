/** Shared, non-interactive image tooltip: never intercepts dragging or opening. */
let preview:HTMLDivElement|undefined;
let timer:ReturnType<typeof setTimeout>|undefined;
let anchor:HTMLElement|undefined;
let listening=false;

export function hideImageHover():void {
 clearTimeout(timer);timer=undefined;anchor=undefined;
 preview?.remove();preview=undefined;
}

export function showImageHover(target:HTMLElement):void {
 hideImageHover();
 const path=target.dataset.path;
 if(!path || !/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(path))return;
 anchor=target;
 if(!listening){
  listening=true;
  window.addEventListener('scroll',hideImageHover,true);
  window.addEventListener('resize',hideImageHover);
  window.addEventListener('blur',hideImageHover);
  document.addEventListener('dragstart',hideImageHover,true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hideImageHover();});
 }
 timer=setTimeout(()=>{
  if(anchor!==target || !target.isConnected)return;
  const box=document.createElement('div');preview=box;
  box.className='editor-image-hover';box.setAttribute('role','tooltip');
  Object.assign(box.style,{position:'fixed',zIndex:'10000',pointerEvents:'none',width:'220px',maxWidth:'calc(100vw - 16px)',padding:'8px',boxSizing:'border-box',border:'1px solid var(--border, #475569)',borderRadius:'6px',background:'var(--surface, #1e293b)',color:'var(--text, #e2e8f0)',boxShadow:'0 6px 24px #0006',fontSize:'12px',lineHeight:'1.4'});
  const img=document.createElement('img');
  img.alt=path.split('/').pop() || 'Image preview';
  Object.assign(img.style,{display:'block',width:'100%',height:'150px',objectFit:'contain',background:'repeating-conic-gradient(#ffffff12 0% 25%, transparent 0% 50%) 50% / 16px 16px',marginBottom:'6px'});
  const name=document.createElement('div');name.textContent=img.alt;name.style.overflowWrap='anywhere';
  const dimensions=document.createElement('div');dimensions.textContent='Loading…';dimensions.style.opacity='0.7';
  box.append(img,name,dimensions);document.body.append(box);
  const place=()=>{
   if(preview!==box || !target.isConnected)return;
   const rect=target.getBoundingClientRect();
   const x=rect.right+8+box.offsetWidth<=window.innerWidth-8 ? rect.right+8 : rect.left-box.offsetWidth-8;
   box.style.left=Math.max(8,Math.min(x,window.innerWidth-box.offsetWidth-8))+'px';
   box.style.top=Math.max(8,Math.min(rect.top,window.innerHeight-box.offsetHeight-8))+'px';
  };
  img.onload=()=>{if(preview===box){dimensions.textContent=`${img.naturalWidth} × ${img.naturalHeight}`;place();}};
  img.onerror=()=>{if(preview===box){img.style.display='none';dimensions.textContent='Preview unavailable';place();}};
  img.src='/__dev/api/file/raw?path='+encodeURIComponent(path);
  place();
 },200);
}
