import {expect,it} from 'vitest';
import {contrastRatio} from '../src/preview-layout';
it('measures dark/light contrast and rejects pale text on bright backgrounds',()=>{
 expect(contrastRatio('rgb(0, 0, 0)','rgb(255, 255, 255)')).toBe(21);
 expect(contrastRatio('rgb(255, 255, 255)','rgb(255, 193, 7)')).toBeLessThan(3);
 expect(contrastRatio('rgb(33, 37, 41)','rgb(255, 193, 7)')).toBeGreaterThan(4.5);
 expect(contrastRatio('rgb(40, 167, 69)','rgb(255, 255, 255)')).toBe(contrastRatio('rgb(255, 255, 255)','rgb(40, 167, 69)'));
});
it('does not guess contrast for transparent or unknown paint',()=>{
 expect(contrastRatio('rgba(255, 255, 255, 0.5)','rgb(0, 0, 0)')).toBeNull();
 expect(contrastRatio('currentColor','transparent')).toBeNull();
});

it('composites translucent surfaces over their actual opaque ancestors',async()=>{
 const {compositeBackground}=await import('../src/preview-layout');
 expect(compositeBackground(['rgb(255, 255, 255)','rgba(0, 0, 0, 0.03)','rgba(0, 0, 0, 0)'])).toBe('rgb(247, 247, 247)');
 expect(compositeBackground(['rgba(0, 0, 0, 0.03)'])).toBeUndefined();
});

it('includes the changed region and descendants in review measurements',async()=>{
 const {previewLayout}=await import('../src/preview-layout');
 document.body.innerHTML='<section id="old"></section><section id="new"><div class="card"><img src="/images/sample.png"></div></section>';
 const evidence=JSON.parse(previewLayout(document,window,'#new').measurements);
 expect(evidence.focusedLayout.map((item:any)=>item.element)).toEqual(['section#new','div.card','img']);
 document.body.innerHTML='';
});
