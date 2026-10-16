import {it,expect} from 'vitest';
import {fillContract,fillInstructions,fillRange} from '../src/ai-fill-contract';
import {selectionProblem} from '../src/ai-selection';
const block=`    # ─── AI-FILL: list_widgets ─────
    # Intent: return widgets
    # Use: Widget.all() or Widget.where(sql, params).to_paginate() (import Widget from src.orm.Widget)
    # Return: response({"records": [r.to_dict() for r in rows]})
    # Ground: tina4_context("list ORM records", "python")
    raise NotImplementedError()
    # ─────────────────────────────`;
it('turns each annotation into an explicit instruction without specialising a model or route',()=>{
 const c=fillContract(block);expect(c.task).toBe('return widgets');const prompt=fillInstructions(c);
 for(const heading of ['TASK:','API AND IMPORT REQUIREMENTS:','REQUIRED RETURN SHAPE:','FRAMEWORK CONTEXT HINT:'])expect(prompt).toContain(heading);
 expect(prompt).toContain('Widget.all()');expect(prompt).not.toContain('Car');
});
it('bounds the entire marked block without including neighbouring code',()=>{
 const before='async def example(request, response):\n';const after='\n\ndef other():\n    pass';
 const source=before+block+after;const range=fillRange(source,before.length+100)!;
 expect(source.slice(range.from,range.to)).toBe(block);expect(fillRange(source,source.length)).toBeNull();
});
it('rejects ignored API, return shape and placeholder contracts',()=>{
 const ctx={prefix:'async def example(request, response):\n',selected:block,suffix:'\n',language:'python',path:'example.py'};
 expect(selectionProblem('    return response({"records": []})\n',ctx)).toContain('specified API');
 expect(selectionProblem('    rows = Widget.all()\n    return response({"items": rows})\n',ctx)).toContain('records');
 expect(selectionProblem('    from src.orm.Widget import Widget\n    rows = Widget.all()\n    return response({"records": [r.to_dict() for r in rows]})\n',ctx)).toBe('');
});
