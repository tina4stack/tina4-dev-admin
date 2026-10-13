import {it,expect} from 'vitest';
import {replaceTemplateContent} from '../src/ai-template-edit';
it('edits HTML while preserving the template shell and expressions',()=>{
 const source='{% extends "base.twig" %}\n{% block content %}<p>{{ title }}</p>{% endblock %}';
 expect(replaceTemplateContent(source,'<section><h1>{{ title }}</h1><p>Useful copy</p></section>')).toBe('{% extends "base.twig" %}\n{% block content %}\n<section><h1>{{ title }}</h1><p>Useful copy</p></section>\n{% endblock %}');
 expect(()=>replaceTemplateContent(source,'<section><h1>{{ title }}</h1>')).toThrow(/HTML/);
 expect(()=>replaceTemplateContent(source,'<h1><h2>{{ title }}</h2></h1>')).toThrow(/Headings/);
 expect(()=>replaceTemplateContent(source,'<p>Lost expression</p>')).toThrow(/Twig/);
 expect(()=>replaceTemplateContent(source,'{% endblock %}')).toThrow(/Twig/);
});
