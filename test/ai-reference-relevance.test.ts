import {expect,it} from 'vitest';
import {referenceRelevant,referenceDecisionValid} from '../src/ai-agent';
it('rejects a fabricated reference quote and unsupported use flag',()=>{
 expect(referenceRelevant(JSON.stringify({use:true,sameSubject:false,explicitReferencePhrase:'Attached company profile'}),'Build a photography portfolio.')).toBe(false);
 expect(referenceRelevant('{"use":true}','Build a portfolio.')).toBe(false);
});
it('accepts an explicit source reference or a matching subject',()=>{
 expect(referenceRelevant(JSON.stringify({use:true,sameSubject:false,explicitReferencePhrase:'the profile'}),'Build our site from the profile.')).toBe(true);
 expect(referenceRelevant('{"use":true,"sameSubject":true,"subjectEvidence":"existing company page","explicitReferencePhrase":""}','Improve the existing company page.')).toBe(true);
});
it('rejects copying a long task as alleged reference evidence',()=>{
 const task='Build a fresh landing page with three cards and a process section.';
 expect(referenceRelevant(JSON.stringify({use:true,sameSubject:false,explicitReferencePhrase:task}),task)).toBe(false);
});

it('requires current-artifact evidence for a claimed subject match',()=>{
 expect(referenceRelevant('{"use":true,"sameSubject":true,"subjectEvidence":"Unrelated Corp"}', 'Add a card.', '<h1>Daylight</h1>')).toBe(false);
 expect(referenceRelevant('{"use":true,"sameSubject":true,"subjectEvidence":"Daylight"}', 'Add a card.', '<h1>Daylight</h1>')).toBe(true);
});

it('does not silently treat incomplete reference classifications as irrelevant',()=>{
 expect(referenceDecisionValid('{"sameSubject":true,"subjectEvidence":"the profile","explicitReferencePhrase":"the profile"}')).toBe(false);
 expect(referenceDecisionValid('{"use":true,"sameSubject":true,"subjectEvidence":"the profile","explicitReferencePhrase":"the profile"}')).toBe(true);
});
it('grounds the compact reference decision in its declared source',()=>{
 expect(referenceRelevant('{"use":true,"source":"request","evidence":"the profile"}','Use the profile.')).toBe(true);
 expect(referenceRelevant('{"use":true,"source":"page","evidence":"Example Corp"}','Fix button contrast.','<h1>Example Corp</h1>')).toBe(true);
 expect(referenceRelevant('{"use":true,"source":"request","evidence":"Example Corp"}','Fix button contrast.','<h1>Example Corp</h1>')).toBe(false);
 expect(referenceDecisionValid('{"use":false,"source":"none","evidence":""}')).toBe(true);
});
