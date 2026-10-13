import {it,expect} from 'vitest';
import {scriptFunctions,replaceScriptFunction,selectedScriptFunctions} from '../src/ai-script-functions';
it('replaces only the selected function while retaining state and event wiring',()=>{
 const source='let count=0;\nfunction advance(){count++;}\nfunction reset(){count=0;}\nbutton.onclick=advance;';
 expect(scriptFunctions(source).map(fn=>fn.name)).toEqual(['advance','reset']);
 const updated=replaceScriptFunction(source,'advance','function advance(){count+=2;}');
 expect(updated).toBe('let count=0;\nfunction advance(){count+=2;}\nfunction reset(){count=0;}\nbutton.onclick=advance;');
 expect(()=>replaceScriptFunction(source,'advance','function reset(){count=1;}')).toThrow();
 expect(()=>replaceScriptFunction(source,'advance','function advance(){}\ncount=4;')).toThrow();
 expect(()=>replaceScriptFunction(source,'missing','function missing(){}')).toThrow();
});

it('grounds object and array function selections in existing declarations',()=>{
 const source='function advance(){} function reset(){}';
 expect(selectedScriptFunctions('{"functions":["advance"]}',source)).toEqual(['advance']);
 expect(selectedScriptFunctions('```json\n["advance","reset"]\n```',source)).toEqual(['advance','reset']);
 expect(()=>selectedScriptFunctions('["invented"]',source)).toThrow();
 expect(()=>selectedScriptFunctions('Change advance',source)).toThrow();
 expect(()=>selectedScriptFunctions('[]',source)).toThrow();
});
