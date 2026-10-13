import {expect,it} from 'vitest';
import {numericAssertion} from '../src/ai-numeric-assertion';
it('computes numeric expectations with precedence without executable code',()=>{
 expect(numericAssertion('2 + 3 =')).toBe(5);
 expect(numericAssertion('9 + 4.5')).toBe(13.5);
 expect(numericAssertion('(12 - 3) * 2')).toBe(18);
 expect(numericAssertion('-3 + .5')).toBe(-2.5);
 expect(numericAssertion('7 / 8')).toBe(.875);
 expect(numericAssertion('6 × 7')).toBe(42);
 expect(numericAssertion('8 ÷ 2 − 1')).toBe(3);
 for(const invalid of ['2+3=7','2==3','alert(1)','process.exit()','1/0','1 +','1;2','(2',''])expect(()=>numericAssertion(invalid)).toThrow();
});
