import {expect,it} from 'vitest';
import {inferFileName,imageFolder} from '../src/editor-file-actions';
import {htmlComponentMap} from '../src/ai-tina4-css';
import {editMarkerGuidance} from '../src/edit-markers';
import {fillContract} from '../src/ai-fill-contract';
it('infers conventions and preserves explicit extensions',()=>{
 expect(inferFileName('about','src/templates/pages',[],[])).toBe('about.twig');
 expect(inferFileName('cars','src/routes',[],['app.py'])).toBe('cars.py');
 expect(inferFileName('main','src/scss',[],[])).toBe('main.scss');
 expect(inferFileName('readme.txt','docs',[],[])).toBe('readme.txt');
 expect(inferFileName('thing','other',['one.py','two.js'],[])).toBe('thing');
 expect(()=>inferFileName('../escape','src',[],[])).toThrow();
 expect(imageFolder('src/public/images/people')).toBe(true);
});
it('maps HTML terms only to installed classes',()=>{
 const table=htmlComponentMap({card:{},'card-body':{},'btn':{}});
 expect(table).toContain('Card / panel');expect(table).toContain('| card, card-body |');
 expect(table).not.toContain('card-footer,');
});
it('extracts edit markers as bounded local hints',()=>{
 const source='{# tina4:edit  page content goes here #}';
 expect(fillContract(source).task).toBe('page content goes here');
 expect(editMarkerGuidance({'index.twig':source})).toContain('smallest unique source span');
 expect(editMarkerGuidance({'route.py':'value = 1'})).toBe('');
});
