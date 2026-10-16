import {it,expect} from 'vitest';
import {replaceTemplateContent,validateTemplateHtml} from '../src/ai-template-edit';
it('edits HTML while preserving the template shell and expressions',()=>{
 const source='{% extends "base.twig" %}\n{% block content %}<p>{{ title }}</p>{% endblock %}';
 expect(replaceTemplateContent(source,'<section><h1>{{ title }}</h1><p>Useful copy</p></section>')).toBe('{% extends "base.twig" %}\n{% block content %}\n<section><h1>{{ title }}</h1><p>Useful copy</p></section>\n{% endblock %}');
 expect(()=>replaceTemplateContent(source,'<section><h1>{{ title }}</h1>')).toThrow(/HTML/);
 expect(()=>replaceTemplateContent(source,'<h1><h2>{{ title }}</h2></h1>')).toThrow(/Headings/);
 expect(()=>replaceTemplateContent(source,'<p>Lost expression</p>')).toThrow(/Twig/);
 expect(()=>replaceTemplateContent(source,'{% endblock %}')).toThrow(/Twig/);
});

it('rejects nested list items and mismatched wrappers before browser recovery',()=>{
 const source='{% block content %}<p>Hello</p>{% endblock %}';
 expect(()=>replaceTemplateContent(source,'<ul><li><li>Item</li></li></ul>')).toThrow();
 expect(()=>replaceTemplateContent(source,'<section><div>Text</section>')).toThrow();
 expect(replaceTemplateContent(source,'<ul><li>Item<ul><li>Child</li></ul></li></ul>')).toContain('Child');
});

it('rejects orphan closing tags that the parser recovers as named nodes',()=>{
 expect(()=>validateTemplateHtml('<p>Intro</p>Intro</p>')).toThrow('invalid tags');
});

it('explains block content nested in a paragraph',()=>{
 expect(()=>validateTemplateHtml('<p class="card-body"><h3>Title</h3><p>Words</p></p>')).toThrow(/Paragraphs contain inline text only/);
});

it('does not mistake JavaScript string contents for rendered paragraph nesting',()=>{
 expect(()=>validateTemplateHtml('<script>const example = "<p><div>example</div></p>";</script>')).not.toThrow();
});
