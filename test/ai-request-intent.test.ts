import {expect,it} from 'vitest';
import {parseRequestIntent} from '../src/ai-request-intent';
import {templateCompletionProblem} from '../src/ai-completion-output';
it('accepts only the finite intent contract',()=>{
 expect(parseRequestIntent('{"intent":"answer"}')).toBe('answer');
 expect(parseRequestIntent('```json\n{"intent":"change"}\n```')).toBe('change');
 expect(parseRequestIntent('{"intent":"execute"}')).toBe(null);
 expect(parseRequestIntent('I will edit it')).toBe(null);
});
it('blocks document and inheritance restarts inside existing template blocks',()=>{
 const prefix='{% extends "base.twig" %}\n{% block content %}<section>';
 for(const code of ['<!doctype html><html><head></head><body></body></html>','{% extends "base.twig" %}','{% block content %}Hello{% endblock %}'])expect(templateCompletionProblem(code,prefix,'','</section>{% endblock %}','html')).not.toBe('');
 expect(templateCompletionProblem('<header><h1>Welcome</h1></header>',prefix,'','</section>{% endblock %}','html')).toBe('');
 expect(templateCompletionProblem('<html><body></body></html>','','','','html')).toBe('');
 expect(templateCompletionProblem('value="<body>"','x=1','','','python')).toBe('');
});

it('prioritizes explicit requested modifications over an inspection label',()=>{
 expect(parseRequestIntent('{"modifiesArtifact":true,"intent":"inspect"}')).toBe('change');
});
