import {it,expect} from 'vitest';
import {groundCompletionImages} from '../src/ai-image-placeholders';
it('replaces an unavailable image with an accessible self-contained placeholder',async()=>{
 const result=await groundCompletionImages('<section><img src="/missing.png" alt="A & B"><p>Keep me</p></section>',async()=>false);
 const doc=new DOMParser().parseFromString(result,'text/html');
 expect(doc.querySelector('img')).toBeNull();
 expect(doc.querySelector('svg')?.getAttribute('aria-label')).toBe('A & B');
 expect(doc.querySelector('svg title')?.textContent).toBe('A & B');
 expect(doc.querySelector('p')?.textContent).toBe('Keep me');
});
it('preserves an image when its asset is verified',async()=>{
 const source='<img src="/existing.svg" alt="Existing">';
 expect(await groundCompletionImages(source,async()=>true)).toBe(source);
});
