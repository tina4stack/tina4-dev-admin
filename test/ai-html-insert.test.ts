import {expect,it} from 'vitest';
import {applyExactEdits} from '../src/ai-followup';
import {addedContentFocus} from '../src/ai-html-insert';
const source='{% extends "base.twig" %}\n{% block content %}<section id="intro"><p>Keep {{ name }}</p></section><section id="details"><h2>Details</h2></section>{% endblock %}';
it('focuses new content added through exact replacement and ignores unchanged content',()=>{
 expect(addedContentFocus(source,source.replace('{% endblock %}','<section id="extra"><p>New</p></section>{% endblock %}'))).toBe('[id="extra"]');
 expect(addedContentFocus(source,source)).toBeUndefined();
});
it('focuses an unnamed addition from its actual changed source range',()=>{
 const after=source.replace('{% endblock %}','<div class="card"><h3>New</h3><p>Added copy</p></div>{% endblock %}');
 const selector=addedContentFocus(source,after)!;
 const doc=new DOMParser().parseFromString(after,'text/html');
 expect(doc.querySelector(selector)?.textContent).toBe('NewAdded copy');
});
it('inserts beside a selected section without copying or changing existing source',()=>{
 const result=applyExactEdits({'page.twig':source},[{path:'page.twig',selector:'#details',position:'after',new:'<article>New content</article>'}]);
 expect(result['page.twig']).toBe(source.replace('</section>{% endblock %}','</section><article>New content</article>{% endblock %}'));
});
it('inserts inside a selected container and preserves template expressions',()=>{
 const result=applyExactEdits({'page.twig':source},[{path:'page.twig',selector:'#intro',position:'append',new:'<p>More</p>'}]);
 expect(result['page.twig']).toContain('<p>Keep {{ name }}</p><p>More</p></section>');
});
it('rejects ambiguous selectors and non-HTML targets',()=>{
 expect(()=>applyExactEdits({'page.twig':source},[{path:'page.twig',selector:'section',position:'after',new:'<p>More</p>'}])).toThrow(/exactly one/);
 expect(()=>applyExactEdits({'route.py':'print(1)'},[{path:'route.py',selector:'body',position:'append',new:'print(2)'}])).toThrow(/only available/);
});
it('resolves numbered targets from the current source without selector guessing',async()=>{
 const {htmlInsertionTargets}=await import('../src/ai-html-insert');
 const target=htmlInsertionTargets(source).find(item=>item.element==='section#details')!.target;
 const result=applyExactEdits({'page.twig':source},[{path:'page.twig',target,position:'after',new:'<aside>New</aside>'}]);
 expect(result['page.twig']).toContain('</section><aside>New</aside>{% endblock %}');
 expect(()=>applyExactEdits({'page.twig':source},[{path:'page.twig',target:999,position:'after',new:'<aside>New</aside>'}])).toThrow(/numbered target/);
});
it('excludes inherited template asset blocks from insertion targets',async()=>{
 const {htmlInsertionTargets}=await import('../src/ai-html-insert');
 const template=source+'{% block stylesheets %}<link href="/css/page.css">{% endblock %}';
 expect(htmlInsertionTargets(template).some(item=>item.element.startsWith('link'))).toBe(false);
 expect(()=>applyExactEdits({'page.twig':template},[{path:'page.twig',selector:'link',position:'after',new:'<p>New</p>'}])).toThrow(/matched 0/);
});
it('offers structural containers and locates the region inserted beside them',async()=>{
 const {htmlInsertionTargets,htmlInsertionFocus}=await import('../src/ai-html-insert');
 const targets=htmlInsertionTargets(source);
 expect(targets.some(item=>item.element==='p')).toBe(false);
 const details=targets.find(item=>item.element==='section#details')!;
 expect(htmlInsertionFocus(source,details.target,'after')).toBe('[id="details"] + *');
});
it('changes only targeted attributes and preserves template content',async()=>{
 const {htmlAttributeTargets}=await import('../src/ai-html-insert');
 const input=source.replace('<h2>Details</h2>','<a href="/" class="btn" title="{{ name }}">Details</a>');
 const target=htmlAttributeTargets(input).find(el=>el.element==='a')!.target;
 const result=applyExactEdits({'page.twig':input},[{path:'page.twig',target,attributes:{href:'#intro','aria-label':'Read & learn'}}]);
 expect(result['page.twig']).toBe(input.replace('href="/"','href="#intro"').replace('title="{{ name }}">','title="{{ name }}" aria-label="Read &amp; learn">'));
 expect(()=>applyExactEdits({'page.twig':input},[{path:'page.twig',target,attributes:{onclick:'alert(1)'}}])).toThrow(/event handlers/);
 expect(()=>applyExactEdits({'page.twig':input},[{path:'page.twig',target,attributes:{text:'Changed words'}}])).toThrow(/Visible words/);
});
it('replaces visible plain text without changing its tag or neighbouring content',async()=>{
 const {htmlAttributeTargets}=await import('../src/ai-html-insert');
 const target=htmlAttributeTargets(source).find(el=>el.element==='h2')!.target;
 const result=applyExactEdits({'page.twig':source},[{path:'page.twig',target,text:'Better & clearer <words>'}]);
 expect(result['page.twig']).toBe(source.replace('>Details</h2>','>Better &amp; clearer &lt;words&gt;</h2>'));
 const section=htmlAttributeTargets(source).find(el=>el.element==='section')!.target;
 expect(()=>applyExactEdits({'page.twig':source},[{path:'page.twig',target:section,text:'Discard children'}])).toThrow(/nested markup/);
});
it('shares source target identifiers across insertion, text and attribute operations',async()=>{
 const {htmlAttributeTargets,htmlInsertionTargets}=await import('../src/ai-html-insert');
 const structural=htmlInsertionTargets(source).find(el=>el.element==='section#details')!;
 expect(htmlAttributeTargets(source).find(el=>el.attributes.id==='details')!.target).toBe(structural.target);
 const heading=htmlAttributeTargets(source).find(el=>el.element==='h2')!.target;
 const result=applyExactEdits({'page.twig':source},[{path:'page.twig',target:heading,position:'after',new:'<p>Added</p>'}]);
 expect(result['page.twig']).toContain('<h2>Details</h2><p>Added</p>');
});
