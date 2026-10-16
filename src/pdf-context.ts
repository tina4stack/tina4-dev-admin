import {getDocument,GlobalWorkerOptions,OPS} from 'pdfjs-dist';
GlobalWorkerOptions.workerSrc='/js/tina4-pdf/pdf.worker.min.mjs';
export interface PdfPageContext {page:number;text:string;preview:string;images:{content:string;width:number;height:number}[];warnings:string[]}
export async function extractPdf(file:File,onPage:(page:PdfPageContext,total:number)=>Promise<void>):Promise<void> {
 if(file.size>25*1024*1024)throw new Error('PDF limit is 25 MB. Split a larger document first.');
 const task=getDocument({data:new Uint8Array(await file.arrayBuffer()),cMapUrl:'/js/tina4-pdf/cmaps/',cMapPacked:true,standardFontDataUrl:'/js/tina4-pdf/standard_fonts/',wasmUrl:'/js/tina4-pdf/wasm/'});
 try {
  const doc=await task.promise;
  if(doc.numPages>100)throw new Error('PDF limit is 100 pages. Split a larger document first.');
  for(let number=1;number<=doc.numPages;number++) {
   const page=await doc.getPage(number);const text=await page.getTextContent();
   const content=text.items.map(item=>'str' in item ? item.str+(item.hasEOL?'\n':' ') : '').join('');
   const viewport=page.getViewport({scale:1});const canvas=document.createElement('canvas');
   const scaled=page.getViewport({scale:1200/Math.max(viewport.width,viewport.height)});
   canvas.width=Math.ceil(scaled.width);canvas.height=Math.ceil(scaled.height);
   await page.render({canvas,viewport:scaled}).promise;
   const preview=canvas.toDataURL('image/png').split(',')[1];
   const operators=await page.getOperatorList();const images:PdfPageContext['images']=[];const warnings:string[]=[];const seen=new Set<string>();
   for(let i=0;i<operators.fnArray.length;i++) {
    const op=operators.fnArray[i],args=operators.argsArray[i];
    if(op!==OPS.paintImageXObject && op!==OPS.paintInlineImageXObject && op!==OPS.paintImageXObjectRepeat)continue;
    try {
     const key=typeof args[0]==='string'?args[0]:String(i);if(seen.has(key))continue;seen.add(key);
     const raw=typeof args[0]==='string' ? await new Promise<any>(resolve=>(key.startsWith('g_')?page.commonObjs:page.objs).get(key,resolve)) : args[0];
     if(!raw || !raw.width || !raw.height)throw new Error('Image pixels unavailable');
     if(raw.width*raw.height>20000000)throw new Error('Image exceeds 20 megapixels');
     const out=document.createElement('canvas');out.width=raw.width;out.height=raw.height;const ctx=out.getContext('2d')!;
     if(raw.bitmap)ctx.drawImage(raw.bitmap,0,0);
     else {
      const rgba=new Uint8ClampedArray(raw.width*raw.height*4);const data=raw.data;
      for(let p=0;p<raw.width*raw.height;p++) {
       if(raw.kind===3){rgba.set(data.subarray(p*4,p*4+4),p*4);continue;}
       if(raw.kind===2){rgba[p*4]=data[p*3];rgba[p*4+1]=data[p*3+1];rgba[p*4+2]=data[p*3+2];}
       else if(raw.kind===1){const row=Math.floor(p/raw.width),col=p%raw.width,v=(data[row*Math.ceil(raw.width/8)+(col>>3)]>>(7-(col%8)))&1;rgba.fill(v?255:0,p*4,p*4+3);}
       else throw new Error('Unsupported embedded image format');
       rgba[p*4+3]=255;
      }
      ctx.putImageData(new ImageData(rgba,raw.width,raw.height),0,0);
     }
     images.push({content:out.toDataURL('image/png').split(',')[1],width:raw.width,height:raw.height});out.width=0;out.height=0;
    } catch(error) {warnings.push(`Embedded image: ${String((error as Error).message)}. Its appearance remains in the page preview.`);}
   }
   await onPage({page:number,text:content,preview,images,warnings},doc.numPages);
   canvas.width=0;canvas.height=0;page.cleanup();
  }
 } finally {await task.destroy();}
}
