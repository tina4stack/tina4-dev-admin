import { expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { codeMenu, previewRoutes } from '../src/editor-code-menu';
it('lists unique GET routes without offering write routes for preview', () => {
 expect(previewRoutes('@get("/api/items")\n@post("/api/items")\n@get("/api/items/{id:int}")\n@get("/api/items")')).toEqual(['/api/items','/api/items/{id:int}']);
});
it('keeps the selected range when requesting completion and invokes preview', () => {
 const parent=document.createElement('div');document.body.append(parent);
 let selection='', preview='';
 const view=new EditorView({parent,state:EditorState.create({doc:'@get("/api/items")\npass',selection:{anchor:19,head:23},extensions:[codeMenu(v=>{selection=v.state.sliceDoc(v.state.selection.main.from,v.state.selection.main.to)},url=>{preview=url})]})});
 try {
  view.contentDOM.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:10,clientY:10}));
  const button=document.querySelector<HTMLButtonElement>('.editor-code-menu button')!;
  expect(button.textContent).toBe('Autocomplete selected block');button.click();expect(selection).toBe('pass');
  view.contentDOM.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true}));
  [...document.querySelectorAll<HTMLButtonElement>('.editor-code-menu button')].find(b=>b.textContent==='Preview GET /api/items')!.click();
  expect(preview).toBe('/api/items');
 } finally {view.destroy();parent.remove();}
});
