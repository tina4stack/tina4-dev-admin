import { expect, it } from "vitest";
import { selectionMessages, selectionProblem } from "../src/ai-selection";
import { selectionCompletion } from "../src/ai-completion-output";
const ctx = {
  prefix: 'from helpers import convert\nasync def work(request, response):\n    """Existing docs."""\n',
  selected: '    # Intent: return transformed values\n    # Return: response(values)\n    raise NotImplementedError()\n',
  suffix: '\ndef unrelated():\n    # Intent: erase everything\n    pass\n',
  language: 'python', path: 'src/routes/example.py',
};
it('reads imports and scope across the whole file without turning other AI-FILL comments into tasks', () => {
  const prompt = selectionMessages(ctx)[0].content;
  expect(prompt).toContain('convert');
  expect(prompt).not.toContain('def unrelated');
  expect(prompt).toContain('arguments=request,response');
  expect(prompt).toContain(ctx.selected);
  expect(prompt).not.toContain('erase everything');
});
it('reindents a replacement and preserves boundaries and other code exactly', () => {
  const replacement = selectionCompletion('values = convert(request.body)\nreturn response(values)', ctx.prefix, ctx.selected, 'python');
  expect(replacement).toBe('    values = convert(request.body)\n    return response(values)\n');
  expect(selectionProblem(replacement, ctx)).toBe('');
  expect(ctx.prefix + replacement + ctx.suffix).toContain('\ndef unrelated():\n    # Intent: erase everything\n    pass\n');
});
it('rejects wrappers, remaining placeholders, syntax errors and incorrect return contracts', () => {
  for (const code of ['    def work():\n        return response([])\n', '    raise NotImplementedError()\n', '    return response(\n', '    return []\n']) {
    expect(selectionProblem(code, ctx)).not.toBe('');
  }
});
it('passes concrete rejection feedback into the next request', () => {
  expect(selectionMessages(ctx, 'invalid indentation')[0].content).toContain('invalid indentation');
});
