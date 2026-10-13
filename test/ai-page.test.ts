import { describe, expect, it } from "vitest";
import { completeStylesheet, preparePageEdit, validatePageScript, javascriptTokens } from "../src/ai-page";

const scaffold = '{% extends "base.twig" %}\n{% block title %}Contact{% endblock %}\n{% block content %}<h1>Contact</h1>{% endblock %}';

describe("model content applied to Tina4 scaffolds", () => {
  it("extracts a closed HTML fence without rendering Markdown or surrounding prose", () => {
    const result = preparePageEdit(scaffold, 'Here is the page:\n```html\n<h1>My Portfolio</h1><p>My work.</p>\n```\nDone.', "portfolio");
    expect(result.content).toContain('<h1>My Portfolio</h1>');
    expect(result.content).not.toMatch(/```|Here is the page|Done\./);
  });
  it("rejects an unclosed HTML fence instead of writing truncated output", () => {
    expect(() => preparePageEdit(scaffold, '```html\n<h1>My Portfolio</h1><p>My work.</p>', "portfolio")).toThrow();
  });
  it("rejects multiple or nested code blocks and prose mixed with raw HTML", () => {
    for (const output of [
      '```html\n<h1>My Portfolio</h1>\n```\n```css\nh1 {color:red}\n```',
      '```html\n```html\n<h1>My Portfolio</h1>\n```',
      'Here is the page: <h1>My Portfolio</h1><p>My work.</p>',
    ]) expect(() => preparePageEdit(scaffold, output, "portfolio")).toThrow();
  });
  it("preserves template inheritance and title while filling the content slot", () => {
    const result = preparePageEdit(scaffold, '<h1>Talk to us</h1><a href="mailto:hello@example.test">Email</a>', "contact");
    expect(result.content).toContain('{% extends "base.twig" %}');
    expect(result.content).toContain("{% block title %}Contact{% endblock %}");
    expect(result.content).toContain('href="mailto:hello@example.test"');
    expect(result.content).toContain('href="/css/contact.css"');
  });
  it("extracts a full document's body and moves all inline CSS to the stylesheet", () => {
    const result = preparePageEdit(scaffold, '<html><head><style>h1 { color: purple; }</style></head><body><h1 style="margin: 0">Talk to us</h1><p>Send us a message.</p></body></html>', "contact");
    expect(result.content).not.toMatch(/<html|<head|<body|<style|style=/);
    expect(result.styles.join("\n")).toContain("h1 { color: purple; }");
    expect(result.styles.join("\n")).toContain(".contact-element-0 { margin: 0 }");
    expect(result.content).toContain('class="contact-element-0"');
  });
  it("preserves existing stylesheet blocks without creating duplicate blocks", () => {
    const result = preparePageEdit(scaffold+'{% block stylesheets %}<link href="/css/shared.css">{% endblock %}', '<h1>Talk to us</h1><p>Send us a message.</p>', "contact");
    expect(result.content.match(/block stylesheets/g)).toHaveLength(1);
    expect(result.content).toContain("/css/shared.css");
  });
  it("rejects unsupported scaffold structure and model-written Twig directives", () => {
    expect(() => preparePageEdit("custom layout", "<h1>Contact</h1>", "contact")).toThrow();
    expect(() => preparePageEdit(scaffold, '{% extends "other.twig" %}', "contact")).toThrow();
  });
});

describe("stylesheet completeness", () => {
  it("accepts complete rules and ignores braces in strings and comments", () => {
    expect(completeStylesheet('h1::after { content: "}"; } /* { */')).toBe(true);
    expect(completeStylesheet('@media (max-width: 600px) { h1 { font-size: 2rem; } }')).toBe(true);
  });
  it("rejects truncated model output and unclosed fences", () => {
    expect(completeStylesheet('h1 { color: red;')).toBe(false);
    expect(completeStylesheet('```css\nh1 { color: red; }')).toBe(false);
    expect(completeStylesheet('h1 { color: red; } }')).toBe(false);
  });
});

it('extracts page behaviour into an asset without losing it or replacing the scaffold',()=>{
 const result=preparePageEdit(scaffold,'<h1>Counter</h1><button id="next">Advance</button><script>document.querySelector("#next").addEventListener("click", () => { document.title = "Changed"; });</script>','counter');
 expect(result.scripts).toHaveLength(1);
 expect(result.scripts[0]).toContain('addEventListener');
 expect(result.content).toContain('src="/js/counter.js"');
 expect(result.content).not.toContain('document.title');
 expect(()=>preparePageEdit(scaffold,'<h1>Counter</h1><script>const broken = ;</script>','counter')).toThrow();
});

it('rejects broken JavaScript independently of HTML validation',()=>{
 expect(()=>validatePageScript('const broken = ;')).toThrow('syntax');
 expect(()=>validatePageScript('const total = 1 + 2;')).not.toThrow();
});

it('detects actual JavaScript changes rather than comments',()=>{
 expect(javascriptTokens('const value = 1; // old')).toBe(javascriptTokens('/* new */ const value=1;'));
 expect(javascriptTokens('const value = 1;')).not.toBe(javascriptTokens('const value = 2;'));
});
