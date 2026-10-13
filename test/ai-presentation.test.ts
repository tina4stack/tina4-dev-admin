import {expect,it} from 'vitest';
import {applyPresentationProposal} from '../src/ai-presentation';
const files={'page.twig':'<section class="page"><h1>Keep me</h1><a href="#about">Read</a></section>','page.scss':'.page a {color: navy;}'};
it('adds model-chosen background declarations without rewriting markup or unrelated styles',()=>{
 const result=applyPresentationProposal({edits:[],styles:[{path:'page.scss',selector:'body',property:'background-color',value:'#fbe4ed'}]},files,{});
 expect(Object.keys(result)).toEqual(['page.scss']);expect(result['page.scss']).toContain('.page a {color: navy;}');expect(result['page.scss']).toContain('background-color: #fbe4ed');
});
it('supports other new visible selectors and rejects unavailable paths, selectors and injected declarations',()=>{
 expect(applyPresentationProposal({styles:[{path:'page.scss',selector:'section.page',property:'padding',value:'2rem'}]},files,{})['page.scss']).toContain('padding: 2rem');
 for(const change of [{path:'other.scss',selector:'body',property:'color',value:'red'},{path:'page.scss',selector:'.absent',property:'color',value:'red'},{path:'page.scss',selector:'body',property:'color',value:'red; display: none'}])expect(()=>applyPresentationProposal({styles:[change]},files,{})).toThrow();
});

it('expands model selector lists into independently validated declaration edits',()=>{
 const files={'page.twig':'<h1>Keep title</h1><p>Keep words</p><a href="/">Home</a>','page.scss':'/*! utilities */'};
 const result=applyPresentationProposal({styles:[{path:'page.scss',selector:['p','a'],property:'color',value:'#212529'}]},files,{});
 expect(result['page.scss']).toContain('p');
 expect(result['page.scss']).toContain('a');
 expect(result['page.twig']).toBeUndefined();
 expect(()=>applyPresentationProposal({styles:[{path:'page.scss',selector:['missing'],property:'color',value:'#212529'}]},files,{})).toThrow();
});

it('accepts new scoped selectors only when they match actual page elements',()=>{
 const files={'page.twig':'<section class="details"><h1>Title</h1><p>Words</p><a href="/">Home</a></section>','page.scss':'/*! utilities */'};
 const result=applyPresentationProposal({styles:[{path:'page.scss',selector:'.details p, .details a',property:'color',value:'#212529'}]},files,{});
 expect(result['page.scss']).toContain('.details p');
 expect(result['page.scss']).toContain('.details a');
 expect(result['page.twig']).toBeUndefined();
 expect(()=>applyPresentationProposal({styles:[{path:'page.scss',selector:'.absent a',property:'color',value:'#212529'}]},files,{})).toThrow();
});

it('rejects parent-only foreground repairs for measured child text defects',()=>{
 const files={'page.twig':'<section class="detail"><a href="/">Home</a></section>','page.scss':'/*! utilities */'};
 const proposal=(selector:string)=>({styles:[{path:'page.scss',selector,property:'color',value:'#212529'}]});
 expect(()=>applyPresentationProposal(proposal('.detail'),files,{},['a'])).toThrow(/directly/);
 expect(applyPresentationProposal(proposal('.detail a'),files,{},['a'])['page.scss']).toContain('.detail a');
});
