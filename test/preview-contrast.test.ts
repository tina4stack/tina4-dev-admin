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
