import {it,expect} from 'vitest';
import {runtimeClock} from '../src/ai-clock';
it('uses the current local calendar year, time and named timezone',()=>{
 const value=runtimeClock(new Date('2026-12-31T23:30:00Z'),'Africa/Johannesburg');
 expect(value).toContain('2027');expect(value).toContain('01:30:00');expect(value).toContain('Africa/Johannesburg');expect(value).toContain('UTC 2026-12-31T23:30:00.000Z');
 expect(value).toContain('Preserve historical dates');
});
