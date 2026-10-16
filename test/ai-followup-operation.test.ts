import {expect,it,vi} from 'vitest';
import {classifyFollowupOperation} from '../src/ai-followup-operation';
it('confirms that appearance routing covers the whole request',async()=>{
 const request=vi.fn().mockResolvedValueOnce('{"operation":"appearance"}').mockResolvedValueOnce('{"contentChange":true}');
 expect(await classifyFollowupOperation('Improve layout and rewrite the introduction',request)).toBe('content');
 expect(request).toHaveBeenCalledTimes(2);
});
it('keeps confirmed styling operations and other routes',async()=>{
 const request=vi.fn().mockResolvedValueOnce('{"operation":"appearance"}').mockResolvedValueOnce('{"contentChange":false}');
 expect(await classifyFollowupOperation('Increase the spacing',request)).toBe('appearance');
 expect(await classifyFollowupOperation('Create another page',async()=>'{"operation":"creation"}')).toBe('creation');
});
