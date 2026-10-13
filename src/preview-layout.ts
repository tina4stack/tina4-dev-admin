/** Contrast for opaque computed RGB colours; unknown/composited colours are left to vision. */
export function contrastRatio(foreground:string,background:string):number|null {
  const rgb=(value:string)=>{const hex=value.match(/^#([a-f0-9]{3}|[a-f0-9]{6})$/i);if(hex){const h=hex[1].length===3?[...hex[1]].map(c=>c+c).join(''):hex[1];return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));}const m=value.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/);return m && (m[4]===undefined || Number(m[4])===1) ? m.slice(1,4).map(Number) : null;};
  const a=rgb(foreground),b=rgb(background);if(!a || !b)return null;
  const luminance=(c:number[])=>c.map(v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0);
  const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
/** Rendered evidence, independent of route names, copy or model predictions. */
export function previewLayout(doc: Document, win: Window): {measurements:string; layoutIssues:string[]; content:string[]; contrastSelectors:string[]} {
  const selector=(el:Element)=>el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+[...el.classList].map(c=>'.'+c).join('');
  const layout=(el:Element)=>{
    const s=win.getComputedStyle(el),r=el.getBoundingClientRect();
    return {element:selector(el),x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height),color:s.color,background:s.backgroundColor,display:s.display,position:s.position,margin:s.margin,padding:s.padding,transform:s.transform,fontSize:s.fontSize,lineHeight:s.lineHeight,overflow:s.overflow};
  };
  const visible=(el:Element)=>{
    for(let p:Element|null=el;p;p=p.parentElement){const s=win.getComputedStyle(p);if(s.visibility==='hidden'||s.visibility==='collapse'||s.display==='none'||Number(s.opacity)===0||s.contentVisibility==='hidden')return false;}
    return true;
  };
  const boxes: {text:string;selector:string;x:number;y:number;width:number;height:number;node:Node}[]=[];
  const content:string[]=[];
  const walker=doc.createTreeWalker(doc.body,4); // SHOW_TEXT also works across iframe realms.
  let node:Node|null;
  while((node=walker.nextNode())) {
    const parent=node.parentElement,text=node.textContent?.replace(/\s+/g,' ').trim();
    if(!parent || !text || parent.closest('script,style,noscript,#tina4-dev-toolbar') || !visible(parent)) continue;
    const range=doc.createRange();range.selectNodeContents(node);
    const rects=Array.from(range.getClientRects()).filter(r=>r.width>=1&&r.height>=1);
    // Include below-the-fold content: scrolling is not deletion. Hidden/zero-size text is absent.
    const readable=rects.some(r=>{
      let left=r.left,right=r.right,top=r.top,bottom=r.bottom;
      for(let el:Element|null=parent;el;el=el.parentElement){
        const s=win.getComputedStyle(el),bounds=el.getBoundingClientRect();
        if(/hidden|clip|scroll|auto/.test(s.overflowX)){left=Math.max(left,bounds.left);right=Math.min(right,bounds.right);}
        if(/hidden|clip|scroll|auto/.test(s.overflowY)){top=Math.max(top,bounds.top);bottom=Math.min(bottom,bounds.bottom);}
      }
      return right>Math.max(0,left) && left<win.innerWidth && bottom>Math.max(0,top);
    });
    if(readable)content.push(parent.tagName.toLowerCase()+':'+text);
    for(const rect of rects) {
      if(boxes.length>=250||rect.bottom<=0||rect.top>=win.innerHeight||rect.right<=0||rect.left>=win.innerWidth)continue;
      boxes.push({text:text.slice(0,160),selector:selector(parent),x:rect.x,y:rect.y,width:rect.width,height:rect.height,node});
    }
  }
  const contrastSelectors:string[]=[];
  const layoutIssues:string[]=[],affected=new Set<Element>();
  for(const element of new Set(boxes.map(box=>box.node.parentElement!))) {
    let background:string|undefined,unsupported=false;
    for(let el:Element|null=element;el;el=el.parentElement){
      const style=win.getComputedStyle(el);
      if(Number(style.opacity)<1 || style.backgroundImage && style.backgroundImage!=='none' || style.filter && style.filter!=='none'){unsupported=true;break;}
      const colour=style.backgroundColor;
      if(!background && colour && colour!=='transparent' && !/^rgba\([^)]*,\s*0\s*\)$/.test(colour))background=colour;
    }
    if(unsupported || !background)continue;
    const style=win.getComputedStyle(element),ratio=contrastRatio(style.color,background);
    const large=parseFloat(style.fontSize)>=24 || parseFloat(style.fontSize)>=18.66 && Number(style.fontWeight)>=700;
    const minimum=large?3:4.5;
    if(ratio!==null && ratio<minimum){contrastSelectors.push(selector(element));affected.add(element);layoutIssues.push(`Low text contrast: ${selector(element)} foreground ${style.color} on ${background} has ratio ${ratio.toFixed(2)}:1 (minimum ${minimum}:1). Change colour utilities or scoped styling; preserve the text and links.`);}
  }
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++) {
    const a=boxes[i],b=boxes[j];if(a.node===b.node)continue;
    const width=Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x);
    const height=Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y);
    if(width>4 && height>Math.min(a.height,b.height)*0.35) {
      layoutIssues.push(`Rendered text overlaps: ${a.selector} ${JSON.stringify(a.text)} and ${b.selector} ${JSON.stringify(b.text)} near (${Math.round(Math.max(a.x,b.x))}, ${Math.round(Math.max(a.y,b.y))}). These are separate elements; retain their content.`);
      for(const box of [a,b]){let el=box.node.parentElement;for(let n=0;el&&n<4;n++,el=el.parentElement)affected.add(el);}
    }
  }
  return {content,contrastSelectors:[...new Set(contrastSelectors)],measurements:JSON.stringify({viewport:{width:win.innerWidth,height:win.innerHeight},bodyBackground:win.getComputedStyle(doc.body).backgroundColor,affectedLayout:[...affected].slice(0,24).map(layout),visibleLayout:[...new Set(boxes.flatMap(b=>[b.node.parentElement,b.node.parentElement?.parentElement]).filter((e):e is HTMLElement=>!!e))].slice(0,32).map(layout),text:boxes.slice(0,70).map(({node,...box})=>box)}),layoutIssues:[...new Set(layoutIssues)].slice(0,10)};
}
