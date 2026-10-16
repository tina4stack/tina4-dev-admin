import {it,expect} from 'vitest';
import {acceptanceRequirements,validateEditAcceptance,AcceptanceFormatError} from '../src/ai-edit-acceptance';
it('cannot summarize away part of a multi-action request',()=>{
 expect(()=>acceptanceRequirements('Add details and connect the button.',{requirements:['Add details']})).toThrow('omitted');
 expect(acceptanceRequirements('Add details and connect the button.',{requirements:['Add details','and connect the button.']})).toEqual(['Add details','and connect the button.']);
});
it('restores omitted sentence punctuation directly from the original request',()=>{
 expect(acceptanceRequirements('Add details. Keep the content.',{requirements:['Add details','Keep the content']})).toEqual(['Add details.','Keep the content.']);
 expect(()=>acceptanceRequirements('Add details and a link.',{requirements:['Add details']})).toThrow('omitted');
});
const requirements=['Add details','Connect the button'];
const files={'page.twig':'<p id="details">Details</p><a href="#details">Go</a>'};
const check=(requirement:number,quote:string)=>({requirement,satisfied:true,evidence:[{path:'page.twig',quote}]});
it('requires a separate check for every obligation',()=>{
 expect(()=>validateEditAcceptance(requirements,{satisfies:true,checks:[check(0,'Details')]},files)).toThrow('Missing');
});
it('distinguishes malformed review output from an actual unmet requirement',()=>{
 expect(()=>validateEditAcceptance(requirements,{checks:[]},files)).toThrow(AcceptanceFormatError);
 try {validateEditAcceptance(requirements,{checks:[{requirement:0,satisfied:false,correction:'Implement the missing detail'}]},files);throw new Error('expected rejection');}
 catch(error){expect(error).not.toBeInstanceOf(AcceptanceFormatError);expect(String(error)).toContain('missing detail');}
});
it('rejects partial completion and invented evidence',()=>{
 expect(()=>validateEditAcceptance(requirements,{checks:[check(0,'Details'),{requirement:1,satisfied:false,correction:'Change href'}]},files)).toThrow('Change href');
 expect(()=>validateEditAcceptance(requirements,{checks:[check(0,'Details'),check(1,'href="/missing"')]},files)).toThrow('Unsupported');
});
it('accepts complete source-grounded checks',()=>{
 expect(()=>validateEditAcceptance(requirements,{checks:[check(0,'<p id="details">Details</p>'),check(1,'href="#details"')]},files)).not.toThrow();
});
it('accepts real numbered source lines and rejects fabricated line numbers',()=>{
 const review={checks:requirements.map((_,requirement)=>({requirement,satisfied:true,evidence:[{path:'page.twig',line:1}]}))};
 expect(()=>validateEditAcceptance(requirements,review,files)).not.toThrow();
 review.checks[0].evidence[0].line=99;
 expect(()=>validateEditAcceptance(requirements,review,files)).toThrow('Unsupported');
});

it('restores a comma boundary without dropping a conjunction',()=>{
 expect(acceptanceRequirements('Improve spacing, and change the heading.',{requirements:['Improve spacing','and change the heading.']})).toEqual(['Improve spacing,','and change the heading.']);
 expect(()=>acceptanceRequirements('Improve spacing, and change the heading.',{requirements:['Improve spacing','change the heading.']})).toThrow();
});
