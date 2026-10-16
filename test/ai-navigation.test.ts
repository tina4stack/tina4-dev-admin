import {expect,it} from 'vitest';
import {parsePreviewIntent} from '../src/ai-navigation';
it('resolves an available page and keeps non-navigation requests separate',()=>{
 expect(parsePreviewIntent('```json\n{"action":"preview","route":"/journal"}\n```',['/journal'])).toEqual({action:'preview',route:'/journal'});
 expect(parsePreviewIntent('{"action":"continue"}',[])).toEqual({action:'continue'});
 expect(parsePreviewIntent('{"action":"question","question":"Which page?"}',[])).toEqual({action:'question',question:'Which page?'});
});
it('rejects invented, external, internal and unresolved parameter routes',()=>{
 for(const route of ['/missing','//example.com','/__dev','/posts/{id}']) expect(()=>parsePreviewIntent(JSON.stringify({action:'preview',route}),route==='/missing'?['/journal']:[route])).toThrow();
 expect(()=>parsePreviewIntent('I opened the page',[])).toThrow();
});

it('resolves interaction tests only against available project routes',()=>{
 expect(parsePreviewIntent('{"action":"test","route":"/counter"}',['/counter'])).toEqual({action:'test',route:'/counter'});
 expect(()=>parsePreviewIntent('{"action":"test","route":"/__dev"}',['/__dev'])).toThrow();
});

it('skips malformed objects before a valid operation without inventing navigation',()=>{
 expect(parsePreviewIntent('{action: "preview"} {"action":"continue"}',[])).toEqual({action:'continue'});
 expect(()=>parsePreviewIntent('{action:"continue"}',[])).toThrow();
});
