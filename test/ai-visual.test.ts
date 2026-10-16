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

it('recovers a valid verdict after malformed candidate data',()=>{
 expect(visualReview('{ok:true}\n{"ok":true,"summary":"Readable","issues":[]}').ok).toBe(true);
 expect(()=>visualReview('{"ok": true, summary: "bad", "issues": []}')).toThrow('usable visual review');
});

it('rejects empty findings instead of reporting an unexplained failure',()=>{
 expect(()=>visualReview('{"ok":false,"summary":"","issues":[" ",""]}')).toThrow();
 expect(()=>visualReview('{"ok":true,"summary":"","issues":[]}')).toThrow();
});

it('keeps partial-view uncertainty out of the repair loop',()=>{
 expect(visualReview('{"ok":true,"inconclusive":true,"summary":"Lower sections are outside this viewport","issues":[]}')).toEqual({ok:false,inconclusive:true,summary:'Lower sections are outside this viewport',issues:[]});
});
it('requires located evidence for automatic repair findings',()=>{
 expect(()=>visualReview('{"ok":false,"summary":"Incomplete","issues":["The requested change is not present"]}',true)).toThrow(/element/);
 expect(visualReview('{"ok":false,"summary":"Overlap","issues":[{"element":"hero title","observed":"covers the navigation label","expected":"separate readable labels"}]}',true).issues[0]).toContain('hero title');
 expect(visualReview('{"ok":false,"inconclusive":true,"summary":"Lower page not visible","issues":[]}',true).inconclusive).toBe(true);
});

it('rejects placeholder evidence instead of authorizing speculative repairs',()=>{
 expect(()=>visualReview('{"ok":false,"summary":"Missing","issues":[{"element":"N/A","observed":"Not present","expected":"requested card"}]}',true)).toThrow(/evidence/);
});
