import {expect,it} from 'vitest';
import {canInspectEditBaseline,canVerifyBuild,createAgentSession,carriedRequirements,pageNameFromContext,presentationForRoute} from '../src/ai-agent';
it('keeps visual repair requirements on the page that was changed',()=>{
 const state=createAgentSession();state.presentationPage='about';state.presentationImplementation='Make heading black';
 expect(presentationForRoute(state,'/about?capture=1')).toBe('Make heading black');
 expect(presentationForRoute(state,'/')).toBeUndefined();
});
it('recovers the home page after reload including preview query and fragment',()=>{
 expect(pageNameFromContext('/')).toBe('index');
 expect(pageNameFromContext('/?_t4_capture=123#hours')).toBe('index');
 expect(pageNameFromContext('/about#team')).toBe('about');
 expect(pageNameFromContext(undefined,'Open file: src/templates/pages/contact.twig')).toBe('contact');
});
it('does not inspect a starter or an unfinished scaffold as an edit baseline',()=>{
 const state=createAgentSession();
 expect(canInspectEditBaseline(state)).toBe(false);
 state.activePage={name:'example',files:['src/templates/pages/example.twig']};
 expect(canInspectEditBaseline(state)).toBe(true);
 state.scaffoldFiles=[...state.activePage.files];state.verified=false;
 expect(canInspectEditBaseline(state)).toBe(false);
 state.verified=true;expect(canInspectEditBaseline(state)).toBe(true);
});
it('preserves build failures and pending approval instead of starting visual repair',()=>{
 for(const stopped of ['error','clarification','approval_required','step_limit'] as const)
  expect(canVerifyBuild({answer:'Original cause',steps:3,stopped},2)).toBe(false);
 expect(canVerifyBuild({answer:'Built',steps:3,stopped:'final_answer'},2)).toBe(true);
 expect(canVerifyBuild({answer:'Explained',steps:3,stopped:'final_answer'},0)).toBe(false);
});

it('carries the original requirements through a short follow-up without importing preview issues',()=>{
 const state=createAgentSession();state.brief='Business website';
 state.conversation=[{role:'user',content:'Use the uploaded profile and its images with Tina4CSS.'}];
 state.visualContext='Reviewer suggested adding pricing';
 const context=carriedRequirements(state,'Make the heading smaller');
 expect(context).toContain('uploaded profile and its images');
 expect(context).toContain('Make the heading smaller');
 expect(context).toContain('takes precedence');
 expect(context).not.toContain('adding pricing');
});

it('does not turn repeated requests into cumulative work',()=>{
 const state=createAgentSession();
 state.conversation=[{role:'user',content:'Add a process section.'},{role:'user',content:'Add a process section.'}];
 const context=carriedRequirements(state,'Create an About page.');
 expect(context.match(/Add a process section\./g)).toHaveLength(1);
 expect(context.indexOf('Create an About page.')).toBeLessThan(context.indexOf('Add a process section.'));
 expect(context).toContain('NOT an execution backlog');
});
