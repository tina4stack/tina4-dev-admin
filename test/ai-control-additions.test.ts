import {it,expect} from 'vitest';
import {validateControlAdditions} from '../src/ai-control-additions';
it('accepts only missing controls without replacing or duplicating existing ones',()=>{
 const source='<button id="save">Save</button>';
 expect(()=>validateControlAdditions(source,'<button>Cancel</button>',['Cancel'])).not.toThrow();
 expect(()=>validateControlAdditions(source,'<button>Save</button>',['Cancel'])).toThrow('repeat');
 expect(()=>validateControlAdditions(source,'<button>Archive</button>',['Cancel'])).toThrow('exactly');
 expect(()=>validateControlAdditions(source,'<button>Cancel</button><script>alert(1)</script>',['Cancel'])).toThrow('scripts');
 expect(()=>validateControlAdditions(source,'<button id="save">Cancel</button>',['Cancel'])).toThrow('unique');
});
