import {expect,it,vi,afterEach} from 'vitest';
import {validatePageImages} from '../src/ai-page-assets';
afterEach(()=>vi.unstubAllGlobals());
it('checks literal local images and reports missing assets',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response('',{status:404}));vi.stubGlobal('fetch',fetch);
 await expect(validatePageImages('<img src="/images/missing.png">')).rejects.toThrow('/images/missing.png');
 expect(fetch).toHaveBeenCalledOnce();
});
it('accepts real image responses and leaves template expressions to rendering',async()=>{
 const fetch=vi.fn().mockResolvedValue(new Response('',{headers:{'content-type':'image/png'}}));vi.stubGlobal('fetch',fetch);
 await expect(validatePageImages('<img src="/images/actual.png"><img src="{{ image_url }}">')).resolves.toBeUndefined();
 expect(fetch).toHaveBeenCalledOnce();
});
it('does not expand a follow-up into repairing unchanged old assets',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 await expect(validatePageImages('<h1>New heading</h1><img src="/old.png">',undefined,'<h1>Old heading</h1><img src="/old.png">')).resolves.toBeUndefined();
 expect(fetch).not.toHaveBeenCalled();
});

it('checks the resolved supplied-image requirement against actual HTML',async()=>{
 const {validateRequiredImages}=await import('../src/ai-page-assets');
 expect(()=>validateRequiredImages('<p>Images mentioned here</p>',['/images/real.png'],1)).toThrow(/uses 0/);
 expect(()=>validateRequiredImages('<img src="/images/other.png">',['/images/real.png'],1)).toThrow();
 expect(()=>validateRequiredImages('<img src="/images/real.png">',['/images/real.png'],1)).not.toThrow();
 expect(()=>validateRequiredImages('<p>No image requested</p>',['/images/real.png'],0)).not.toThrow();
});
