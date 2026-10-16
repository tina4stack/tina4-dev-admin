import { expect, it } from "vitest";
import { applyExactEdits, parseEditProposal, editBrief, editRetry, creationScope, partitionedCreationScope } from "../src/ai-followup";
it('partitions creation without inventing or dropping requirements',()=>{
 const task='Create a team page and link it from home. Keep the content.';
 const clauses=[{text:'Create a team page',scope:'new'},{text:'and link it from home.',scope:'existing'},{text:'Keep the content.',scope:'both'}];
 expect(partitionedCreationScope(task,{clauses})).toEqual({create:'Create a team page Keep the content.',existing:'and link it from home. Keep the content.'});
 expect(()=>partitionedCreationScope(task,{clauses:[{text:'Create a team page with staff biographies.',scope:'new'}]})).toThrow('omitted or rewrote');
});

it("changes only the requested existing text and preserves other styles", () => {
  const files={"src/scss/page.scss":"body { background: white; color: black; }"};
  expect(applyExactEdits(files,[{path:"src/scss/page.scss",old:"background: white",new:"background: #fff0f5"}]))
    .toEqual({"src/scss/page.scss":"body { background: #fff0f5; color: black; }"});
  expect(files["src/scss/page.scss"]).toContain("background: white");
});

it("rejects unknown files, ambiguous text and model fences before writing", () => {
  const files={"page.scss":"red red"};
  for (const edit of [
    {path:"other.scss",old:"red",new:"blue"},
    {path:"page.scss",old:"red",new:"blue"},
    {path:"page.scss",old:"red red",new:"```css"},
  ]) expect(()=>applyExactEdits(files,[edit])).toThrow();
});


it("normalizes a single edit without changing its exact source text", () => {
  const edit={action:"edit",path:"page.scss",old:'content: "old";',new:'content: "new";'};
  const proposal=parseEditProposal(JSON.stringify(edit));
  expect(applyExactEdits({"page.scss":'body { content: "old"; }'},proposal.edits)).toEqual({"page.scss":'body { content: "new"; }'});
});

it("rejects malformed JSON and validates normalized edits before applying", () => {
  expect(()=>parseEditProposal('{"action":"edit",')).toThrow();
  const files={"page.scss":"red"};
  const response=JSON.stringify({action:"edit",path:"unknown.scss",old:"red",new:"blue"});
  expect(()=>applyExactEdits(files,parseEditProposal(response).edits)).toThrow();
  expect(files["page.scss"]).toBe("red");
});


it("anchors line edits to the snapshot even when identical lines repeat", () => {
  const files={"page.scss":"a {\n color: red;\n}\nb {\n color: red;\n}\n"};
  const result=applyExactEdits(files,[{path:"page.scss",start_line:5,end_line:5,new:" color: navy;"}]);
  expect(result["page.scss"]).toBe("a {\n color: red;\n}\nb {\n color: navy;\n}\n");
});

it("rejects invalid and overlapping ranges without mutating the input", () => {
  const files={"page.scss":"one\ntwo\nthree"};
  for(const [start_line,end_line] of [[0,1],[2,1],[1,4]])
    expect(()=>applyExactEdits(files,[{path:"page.scss",start_line,end_line,new:"changed"}])).toThrow();
  expect(()=>applyExactEdits(files,[{path:"page.scss",start_line:1,end_line:2,new:"a"},{path:"page.scss",start_line:2,end_line:3,new:"b"}])).toThrow();
  expect(files["page.scss"]).toBe("one\ntwo\nthree");
});

it("applies multiple disjoint ranges against original offsets", () => {
  expect(applyExactEdits({"a":"one\ntwo\nthree"},[{path:"a",start_line:1,end_line:1,new:"a\nb"},{path:"a",start_line:3,end_line:3,new:"c"}])).toEqual({"a":"a\nb\ntwo\nc"});
});

it("rejects newly introduced inline styling in Twig",()=>{
 expect(()=>applyExactEdits({"page.twig":"<section>Hi</section>"},[{path:"page.twig",old:"<section>",new:'<section style="color:red">'}])).toThrow(/SCSS/);
});

it("rejects an edit that leaves an unmatched stylesheet brace",()=>{
 const files={"page.scss":".hero { margin: 0; }\n.hero h1 { color: navy; }"};
 expect(()=>applyExactEdits(files,[{path:"page.scss",old:".hero h1 {",new:""}])).toThrow(/stylesheet/);
});

it("rejects hiding a layout defect by emptying a heading",()=>{
 const files={"page.twig":"<h1>My journal</h1><p>Keep this</p>"};
 expect(()=>applyExactEdits(files,[{path:"page.twig",old:"<h1>My journal</h1>",new:"<h1></h1>"}])).toThrow(/empty heading/);
 expect(applyExactEdits(files,[{path:"page.twig",old:"My journal",new:"My notebook"}])["page.twig"]).toContain("My notebook");
});

it('normalizes unambiguous replacement aliases while keeping exact-match checks',()=>{
 const proposal=parseEditProposal(JSON.stringify({action:'edit',edits:[{path:'page.scss',old_string:'color: red',new_string:'color: blue'}]}));
 expect(applyExactEdits({'page.scss':'p { color: red; }'},proposal.edits)['page.scss']).toBe('p { color: blue; }');
 expect(()=>parseEditProposal(JSON.stringify({action:'edit',edits:[{path:'page.scss',old:'red',new:'blue',new_string:'green'}]}))).toThrow(/Conflicting/);
});


it("keeps the resolved scope and content contract together for both stages",()=>{
 const brief=editBrief("Use an ocean-inspired palette with readable text.",true);
 expect(brief).toContain("Use an ocean-inspired palette with readable text.");
 expect(brief).toContain("Preserve all existing visible content");
 expect(brief).toContain("Do not require every element to change");
 expect(editBrief("Replace the heading",false)).not.toContain("Change presentation only");
});

it("retries the actual review failure with the unapplied proposal",()=>{
 const proposal={edits:[{path:"page.scss",old:"white",new:"blue"}]};
 const retry=editRetry("review","Text is unreadable against the proposed background",proposal);
 expect(retry).toContain("acceptance review");
 expect(retry).toContain("Text is unreadable");
 expect(retry).toContain(JSON.stringify(proposal));
 expect(retry).toContain("Do not merely reformat JSON");
 const source=editRetry("source","Existing text must match exactly once",undefined);
 expect(source).toContain("source validation");
 expect(source).toContain("Existing text must match exactly once");
 expect(source).not.toContain("failed acceptance review");
});


it("inherits an explicit batch path without overriding individual paths",()=>{
 const proposal=parseEditProposal(JSON.stringify({action:"edit",path:"page.scss",edits:[{old:"red",new:"blue"},{path:"other.scss",old:"pink",new:"green"}]}));
 expect(applyExactEdits({"page.scss":"p { color: red; }","other.scss":"p { color: pink; }"},proposal.edits)).toEqual({"page.scss":"p { color: blue; }","other.scss":"p { color: green; }"});
 expect(()=>applyExactEdits({"page.scss":"red"},parseEditProposal(JSON.stringify({action:"edit",edits:[{old:"red",new:"blue"}]})).edits)).toThrow(/Unknown edit path/);
});

it("retains distinct creation and existing-page obligations without prompt-specific names",()=>{
  for(const name of ["details","calculator","contact"]) {
    expect(creationScope({instruction:`Build ${name}`,existing_instruction:`Link current page to /${name}`}))
      .toEqual({create:`Build ${name}`,existing:`Link current page to /${name}`});
  }
  expect(creationScope({instruction:"Build a standalone page",existing_instruction:""}).existing).toBe("");
  expect(()=>creationScope({instruction:"Build a page"})).toThrow();
  expect(()=>creationScope({instruction:"",existing_instruction:"Update a link"})).toThrow();
});

it('rejects a replacement that removes a Twig closing block',()=>{
 const files={'page.twig':'{% block content %}<p>Hello</p>{% endblock %}'};
 expect(()=>applyExactEdits(files,[{path:'page.twig',old:'{% endblock %}',new:''}])).toThrow(/unclosed/);
 expect(applyExactEdits(files,[{path:'page.twig',old:'Hello',new:'Welcome'}])['page.twig']).toContain('Welcome');
});

import {behaviourSignature} from '../src/ai-followup';
it('rejects cosmetic-only functional repairs but detects event wiring and missing controls',()=>{
 const original='<button id="go" class="btn">Go</button>';
 expect(behaviourSignature('page.twig',original)).toBe(behaviourSignature('page.twig','<!-- note -->'+original.replace('btn','btn-light')));
 expect(behaviourSignature('page.twig',original)).not.toBe(behaviourSignature('page.twig',original+'<script>document.querySelector("#go").onclick=()=>advance();</script>'));
 expect(behaviourSignature('page.twig',original)).not.toBe(behaviourSignature('page.twig',original+'<button id="reset">Reset</button>'));
});

import {addPageBehaviour} from '../src/ai-followup';
it('adds runtime behaviour without replacing existing template content',()=>{
 const source='{% extends "base.twig" %}{% block content %}<button id="advance">Advance</button><output id="result">0</output>{% endblock %}';
 const addition='<script>document.querySelector("#advance").onclick=()=>{document.querySelector("#result").textContent="1";};</script>';
 const next=addPageBehaviour(source,addition);
 expect(next).toContain('<button id="advance">Advance</button><output id="result">0</output>');
 expect(next).toContain('<script nonce="{{ csp_nonce() }}">');
 expect(next).toContain('document.querySelector("#advance").onclick');
 expect(()=>addPageBehaviour(source,'<script>const = ;</script>')).toThrow();
 expect(()=>addPageBehaviour(source,'<button id="advance">Again</button>'+addition)).toThrow('duplicate');
 expect(()=>addPageBehaviour(source,'<p>Coming soon</p>')).toThrow('executable');
});

import {preparePageBehaviour} from '../src/ai-followup';
it('replaces a nonce-bearing page script without losing template content',()=>{
 const source='{% extends "base.twig" %}{% block content %}<button id="go">Go</button><script nonce="{{ csp_nonce() }}">let old=1;</script>{% endblock %}';
 const prepared=preparePageBehaviour(source)!;
 expect(prepared.script).toBe('let old=1;');
 expect(prepared.base).not.toContain('csp_nonce');
 const next=addPageBehaviour(prepared.base,'<script>let fixed=2;</script>');
 expect(next).toContain('<button id="go">Go</button>');
 expect(next).toContain('nonce="{{ csp_nonce() }}"');
 expect(next).not.toContain('let old');
});
