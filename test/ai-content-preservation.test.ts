import {it,expect} from 'vitest';
import {assertContentPreserved,missingRenderedContent} from '../src/ai-content-preservation';
it('preserves duplicate content and semantics during structural layout repairs',()=>{
 const before='<nav><a href="/">Journal</a></nav><h1>Journal</h1><p>{{ intro }}</p>';
 expect(()=>assertContentPreserved(before,'<header><nav><a href="/">Journal</a></nav></header><main><h1>Journal</h1><p>{{ intro }}</p></main>')).not.toThrow();
 for(const after of [before.replace('<h1>Journal</h1>',''),before.replace('<h1>Journal</h1>','<span>Journal</span>'),before.replace('{{ intro }}',''),before.replace('href="/"','href="/other"'),before.replace('<h1>','><h1>')])expect(()=>assertContentPreserved(before,after)).toThrow(/preserve/);
});
it('detects content hidden or deleted in rendered repairs, including duplicates',()=>{
 expect(missingRenderedContent(['a:Journal','h1:Journal','p:Intro'],['a:Journal','p:Intro'])).toEqual(['h1:Journal']);
 expect(missingRenderedContent(['p:Same','p:Same'],['p:Same'])).toEqual(['p:Same']);
 expect(missingRenderedContent(['h1:Title','p:Intro'],['p:Intro','h1:Title'])).toEqual([]);
});

it('allows functional additions without counting scripts as visible content',()=>{
 const before='<button id="go">Go</button><p>Keep this content</p>';
 expect(()=>assertContentPreserved(before,before+'<button>Reset</button><script>let state=0;</script>',true)).not.toThrow();
 expect(()=>assertContentPreserved(before,'<button>Reset</button><script>Go Keep this content</script>',true)).toThrow();
 expect(()=>assertContentPreserved(before,before+'<button>Reset</button>')).toThrow();
});
