import {it,expect} from 'vitest';
import {validatePageLinks,validateNavigationRequirements} from '../src/ai-page-links';
it('does not accept visible text in place of requested navigation',()=>{
 const requirements=[{label:'Read our story',href:'/about'}];
 expect(()=>validateNavigationRequirements('<p>Read our story</p>',requirements,'/')).toThrow('actual a element');
 expect(()=>validateNavigationRequirements('<a href="/">Read our story</a>',requirements,'/')).toThrow('does not point');
 expect(()=>validateNavigationRequirements('<a href="/about">Read Our Story</a>',requirements,'/')).not.toThrow();
});
it('accepts existing routes and actual local sections',()=>{
 expect(()=>validatePageLinks('<a href="/about">About</a><a href="#process">Process</a><section id="process"></section>',['/about'],'/')).not.toThrow();
});
it('rejects invented routes and empty or missing anchors',()=>{
 for(const href of ['/missing','#','#missing','javascript:alert(1)'])expect(()=>validatePageLinks(`<a href="${href}">Go</a>`,[],'/')).toThrow();
});
it('reports all broken destinations in one repair and supplies actual anchors',()=>{
 expect(()=>validatePageLinks('<a href="/one">One</a><a href="/two">Two</a><section id="details"></section>',[],'/')).toThrow(/\/one.*\/two.*#details/);
});

it('does not offer framework diagnostics as business navigation destinations',()=>{
 expect(()=>validatePageLinks('<a href="/health">Contact us</a>',['/health','/__health','/'],'/')).toThrow(/no known page route/);
});
it('checks changed links without expanding scope to unchanged broken links',()=>{
 const before='<a href="/legacy">Old</a><a href="/">Go</a>';
 expect(()=>validatePageLinks('<a href="/legacy">Old</a><a href="#details">Go</a>',['/'],'/',before)).toThrow(/#details/);
 expect(()=>validatePageLinks('<a href="/legacy">Old</a><a href="#details">Go</a><section id="details"></section>',['/'],'/',before)).not.toThrow();
});

it('accepts an empty navigation list without dropping invalid link requirements',async()=>{
 const {navigationRequirements}=await import('../src/ai-page-links');
 expect(navigationRequirements([])).toEqual([]);
 expect(navigationRequirements({links:[]})).toEqual([]);
 expect(navigationRequirements([{label:'Details',href:null}])).toEqual([{label:'Details',href:null}]);
 expect(navigationRequirements([{label:'Details'}])).toBeUndefined();
 expect(navigationRequirements([null])).toBeUndefined();
});
