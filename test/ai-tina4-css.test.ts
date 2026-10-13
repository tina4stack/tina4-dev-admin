import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { utilityCatalog, utilityContrastIssues, normalizeUtilityEdits, applyUtilityChanges, templateSelectors, tina4CssGuidance } from '../src/ai-tina4-css';
const catalog=utilityCatalog(readFileSync('../tina4-css/dist/tina4.min.css','utf8'));
it('reads actual installed Tina4CSS roles and utilities',()=>{
 expect(catalog['text-warning'].color).toBeTruthy();expect(catalog.container).toBeTruthy();
 expect(tina4CssGuidance(catalog)).toContain('compile-time SCSS variables');
});
it('changes classes without serializing Twig or deleting text, links or semantic classes',()=>{
 const source='{% extends "base.twig" %}\n{% block content %}<section class="page bg-light"><h1>{{ title }}</h1><a class="logo text-primary" href="/">Name</a></section>{% endblock %}';
 const result=applyUtilityChanges(source,[{selector:'.page',add:['bg-dark','text-light']},{selector:'a.logo',add:['text-warning']}],catalog);
 expect(result).toBe('{% extends "base.twig" %}\n{% block content %}<section class="page bg-dark text-light"><h1>{{ title }}</h1><a class="logo text-warning" href="/">Name</a></section>{% endblock %}');
 expect(templateSelectors(source)).toContain('a.logo.text-primary');
});
it('rejects invented classes, missing targets, and dynamic class rewrites',()=>{
 expect(()=>applyUtilityChanges('<h1>Keep</h1>',[{selector:'h1',add:['text-invented']}],catalog)).toThrow(/Unknown/);
 expect(()=>applyUtilityChanges('<h1>Keep</h1>',[{selector:'.missing',add:['text-warning']}],catalog)).toThrow(/does not match/);
 expect(()=>applyUtilityChanges('<h1 class="{{ theme }}">Keep</h1>',[{selector:'h1',add:['text-warning']}],catalog)).toThrow(/Dynamic/);
});
it('retains component classes when applying a text colour utility',()=>{
 expect(applyUtilityChanges('<button class="btn btn-primary">Save</button>',[{selector:'button',add:['text-light']}],catalog)).toContain('class="btn btn-primary text-light"');
});

it('normalizes metadata outside actionable edits and unambiguous template paths',()=>{
 expect(normalizeUtilityEdits({edits:[{selector:'.page',add:['bg-dark']},{remove:[],reason:'Design explanation'}]},['page.twig'])).toEqual([{path:'page.twig',selector:'.page',add:['bg-dark'],remove:[]}]);
 expect(()=>normalizeUtilityEdits({edits:[{selector:'.page',add:['bg-dark']}]},['a.twig','b.twig'])).toThrow();
 expect(()=>normalizeUtilityEdits({edits:[{remove:['text-light'],reason:'Must not silently discard'}]},['page.twig'])).toThrow();
});

it('ignores unchanged elements while preserving real additions and removals',()=>{
 const edits=normalizeUtilityEdits({edits:[{selector:'p',add:[],remove:[]},{selector:'h1',add:['text-light']},{selector:'a',add:[],remove:['text-danger']}]},['page.twig']);
 expect(edits).toHaveLength(2);
 expect(applyUtilityChanges('<h1>Title</h1><a class="logo text-danger" href="/">Home</a>',edits,catalog)).toBe('<h1 class="text-light">Title</h1><a class="logo" href="/">Home</a>');
});

it('detects inherited and overridden low-contrast utility colours without rewriting source',()=>{
 const source='<nav class="bg-warning text-dark"><a class="text-white" href="/">Keep link</a></nav>';
 expect(utilityContrastIssues(source,catalog)).toHaveLength(1);
 const fixed=applyUtilityChanges(source,[{selector:'a',add:['text-dark']}],catalog);
 expect(utilityContrastIssues(fixed,catalog)).toEqual([]);
 expect(fixed).toContain('href="/">Keep link</a>');
 expect(tina4CssGuidance(catalog)).toContain('Compatible text/background pairs');
});
