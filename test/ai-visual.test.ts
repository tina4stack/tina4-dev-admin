import {expect,it} from 'vitest';
import {visualReview} from '../src/ai-visual';
it('accepts a bounded visual verdict and concrete defects',()=>{
 expect(visualReview('{"ok":false,"summary":"Overlap","issues":[{"description":"Heading overlaps"}]}').issues).toEqual(['Heading overlaps']);
 expect(visualReview('{"ok":true,"summary":"Readable layout","issues":[]}').ok).toBe(true);
 expect(visualReview('```json\n{"ok":false,"summary":"Overlapping titles","issues":["Header overlaps hero"]}\n```').issues).toEqual(['Header overlaps hero']);
});
it('does not turn malformed, contradictory or incomplete reviews into success',()=>{
 for(const text of ['looks fine','{"ok":true}', '{"ok":false,"summary":"bad","issues":[]}']) expect(()=>visualReview(text)).toThrow();
});

it("retains defects when the model contradicts its success flag",()=>{
 expect(visualReview('{"ok":true,"summary":"fine","issues":["clipped"]}').ok).toBe(false);
});
