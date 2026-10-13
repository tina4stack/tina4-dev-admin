import { expect, it } from "vitest";
import { trimSuffixOverlap, completionCode, repeatsExistingCode, selectionCompletion } from "../src/ai-completion-output";

it("preserves selection boundaries and avoids doubling the existing indentation", () => {
  const prefix = "def work():\n    ";
  const selected = '# Intent: return 42\n    raise NotImplementedError()\n';
  const replacement = selectionCompletion('    return 42', prefix, selected);
  expect(prefix + replacement + '\ndef next():\n    pass').toBe('def work():\n    return 42\n\ndef next():\n    pass');
});

it("keeps multiline replacements intact", () => {
  expect(selectionCompletion('    return 42', 'def work():', '\n    pass')).toBe('\n    return 42');
  expect(selectionCompletion('    value = 42\n\n    return value', 'def work():\n', '    pass'))
    .toBe('    value = 42\n\n    return value');
});

it("leaves wrappers for scope validation and rejects unchanged stubs", () => {
  expect(selectionCompletion('def generated():\n    return 42', 'def existing():\n', '    raise NotImplementedError()', 'python')).toContain('def generated():');
  expect(selectionCompletion('def generated():\n    raise NotImplementedError()', 'def existing():\n', '    raise NotImplementedError()', 'python')).toBe('');
  expect(completionCode('[Complete, runnable solution with docstring and type hints]')).toBe('');
});

it("unwraps code without language labels or surrounding explanation", () => {
  expect(completionCode('Here is the code:\n```html\n  <section>Portfolio</section>\n```\nExplanation: a section.')).toBe('  <section>Portfolio</section>');
});

it("preserves raw code indentation and meaningful backticks", () => {
  expect(completionCode('  return `Hello ${name}`;\n')).toBe('  return `Hello ${name}`;');
});

it("rejects partial, nested and multiple fences", () => {
  for (const value of ['```html\n<section>Portfolio</section>', '```html\n```html\n<section></section>\n```', '```js\na()\n```\n```js\nb()\n```', '```']) {
    expect(completionCode(value)).toBe('');
  }
});

it("rejects fences attached to code or escaped inside a suggestion", () => {
  for (const value of ['<h1>Hello World!</h1>```html', '<section>```html\nHello</section>', '<h1>Hello</h1>\\`\\`\\`html', 'return 1;~~~python']) {
    expect(completionCode(value)).toBe('');
  }
});

it("rejects explanatory text and model control tokens", () => {
  expect(completionCode('Sure, here is your code.')).toBe('');
  expect(completionCode('<think>consider this</think>return 1;')).toBe('');
  expect(completionCode('return 1;<|fim_suffix|>')).toBe('');
});

it("rejects repeated imports even when they are far above the cursor", () => {
  const prefix = 'from tina4_python.core.router import get, template\n' + '\n# existing code'.repeat(80);
  expect(repeatsExistingCode('from tina4_python.core.router import get, template', prefix, '')).toBe(true);
});

it("rejects echoed page blocks and code already after the cursor", () => {
  expect(repeatsExistingCode('<section>\n<h1>Portfolio</h1>\n</section>', '<section>\n<h1>Portfolio</h1>\n</section>', '')).toBe(true);
  expect(repeatsExistingCode('return response(data)', '', '\n  return response(data)')).toBe(true);
});

it("allows new code and repeated short expressions", () => {
  expect(repeatsExistingCode('return None', 'if missing:\n    return None\n', '')).toBe(false);
  expect(repeatsExistingCode('from tina4_python.orm import ORM', 'from tina4_python.core.router import get', '')).toBe(false);
});


it("removes only a complete trailing suffix overlap from cursor suggestions", () => {
  expect(trimSuffixOverlap('<h1>Welcome</h1>\n<a href="/contact">Contact us</a>\n  </section>\n{% endblock %}', '\n</section>\n{% endblock %}\n')).toBe('<h1>Welcome</h1>\n<a href="/contact">Contact us</a>');
  expect(trimSuffixOverlap('return value', '\nreturn other')).toBe('return value');
  expect(trimSuffixOverlap('</section>', '\n</section>')).toBe('');
});
