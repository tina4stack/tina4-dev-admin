import { expect, it } from 'vitest';
import { applyStyleChoices } from '../src/ai-style-edits';
it('changes only named declarations and retains SCSS variables, comments and unrelated rules',()=>{
 const source='$ink: navy;\n// Keep this\n.hero { color: $ink; padding: 1rem; }\nfooter { color: gray; }';
 const result=applyStyleChoices(source,[{selector:'.hero',property:'color',value:'#123456'},{selector:'footer',property:'background-color',value:'gold'}]);
 expect(result).toContain('$ink: navy;');expect(result).toContain('// Keep this');
 expect(result).toContain('.hero { color: #123456; padding: 1rem; }');
 expect(result).toContain('color: gray;');expect(result).toContain('background-color: gold');
 expect(source).toContain('color: $ink');
});
it('rejects invented selectors, ambiguous declarations and injected source',()=>{
 const source='.hero { color: navy; }';
 for(const choice of [{selector:'.missing',property:'color',value:'red'},{selector:'.hero',property:'color',value:'red; display: none'},{selector:'.hero',property:'color',value:'red; } body {display: none'}])
 expect(()=>applyStyleChoices(source,[choice])).toThrow();
 expect(()=>applyStyleChoices('.hero {color:red;color:blue}',[{selector:'.hero',property:'color',value:'green'}])).toThrow(/Ambiguous/);
});

it('applies a grouped choice to separate existing rules without touching other selectors',()=>{
 expect(applyStyleChoices('.title { color: red; } .brand { color: blue; } p { color: black; }',[{selector:'.title, .brand',property:'color',value:'gold'}])).toBe('.title { color: gold; } .brand { color: gold; } p { color: black; }');
});
it('resolves a tag only when one existing scoped rule matches it',()=>{
 expect(applyStyleChoices('.hero p { color: gray; }',[{selector:'p',property:'color',value:'navy'}])).toBe('.hero p { color: navy; }');
 expect(()=>applyStyleChoices('.hero p {color:gray} .footer p {color:gray}',[{selector:'p',property:'color',value:'navy'}])).toThrow();
});
