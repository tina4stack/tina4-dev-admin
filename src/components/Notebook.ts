import {api} from '../api';
import {mountNotebookMarkdown} from '../markdown-editor';
import notebookCss from './notebook.css?inline';
import runIcon from '../icons/jupyter/run.svg?raw';
import upIcon from '../icons/jupyter/move-up.svg?raw';
import downIcon from '../icons/jupyter/move-down.svg?raw';
import duplicateIcon from '../icons/jupyter/duplicate.svg?raw';
import aboveIcon from '../icons/jupyter/add-above.svg?raw';
import belowIcon from '../icons/jupyter/add-below.svg?raw';
import deleteIcon from '../icons/jupyter/delete.svg?raw';
import {EditorView,keymap,lineNumbers} from '@codemirror/view';
import {EditorState} from '@codemirror/state';
import {python} from '@codemirror/lang-python';
import {defaultKeymap,history,historyKeymap,indentWithTab} from '@codemirror/commands';
import {oneDark} from '@codemirror/theme-one-dark';
interface Cell {id:string;cell_type:'code'|'markdown';source:string[];metadata:Record<string,unknown>;execution_count:number|null;outputs:any[]}
let cells:Cell[]=[],host:HTMLElement|null=null,loaded=false,busy=false;
let markdownCleanup:(()=>void)[]=[];
let views:EditorView[]=[];let saveTimer:ReturnType<typeof setTimeout>|undefined;
// Keep the same kernel across reloads of this tab; separate tabs stay independent.
function notebookSession():string {
 const key='tina4:notebook-session:'+location.pathname;
 try {
  const existing=sessionStorage.getItem(key);
  if(existing && /^[a-zA-Z0-9-]{8,80}$/.test(existing))return existing;
  const created=crypto.randomUUID();sessionStorage.setItem(key,created);return created;
 } catch {return crypto.randomUUID();}
}
let writes=Promise.resolve();const session=notebookSession();let epoch='';let kernelRevision=0;
const path='.tina4/notebooks/notebook.ipynb';
const fresh=(type:Cell['cell_type']='code'):Cell=>({id:crypto.randomUUID(),cell_type:type,source:[''],metadata:{},execution_count:null,outputs:[]});
function button(text:string,action:()=>void):HTMLButtonElement {const b=document.createElement('button');b.type='button';b.className='btn btn-sm';b.textContent=text;b.onclick=action;return b;}
function iconButton(label:string,icon:string,action:()=>void){const b=button('',action);b.className='notebook-icon';b.innerHTML=icon;b.title=label;b.setAttribute('aria-label',label);b.disabled=busy;return b;}
function status(text:string){const label=host?.querySelector('[data-status]');if(label)label.textContent=text;}
function save(){
 if(saveTimer)clearTimeout(saveTimer);
 saveTimer=setTimeout(()=>{
  const content=JSON.stringify({nbformat:4,nbformat_minor:5,metadata:{kernelspec:{display_name:'Tina4 Python',language:'python',name:'python3'}},cells},null,2);
  writes=writes.catch(()=>{}).then(async()=>{await api('/file/save','POST',{path:'.tina4/notebooks/.gitignore',content:'*\n'});await api('/file/save','POST',{path,content});if(!busy)status('Saved · Tina4 Python');}).catch(e=>status('Save failed: '+e.message));
 },300);
}
function renderOutputs(cell:Cell,container:HTMLElement){
 container.replaceChildren();
 for(const output of cell.outputs){
  if(output.data?.['image/png']){const image=document.createElement('img');image.src='data:image/png;base64,'+output.data['image/png'];image.style.maxWidth='100%';container.append(image);}
  const text=output.text?.join('') || output.data?.['text/plain']?.join('') || output.traceback?.join('\n');
  if(text){const pre=document.createElement('pre');pre.textContent=text;pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';if(output.output_type==='error')pre.style.color='var(--danger, #f38ba8)';container.append(pre);}
 }
}
async function run(cell:Cell){
 if(busy || cell.cell_type==='markdown')return;
 const revision=kernelRevision;
 busy=true;status('Running cell…');render();
 try {
  const result=await api<any>('/notebook','POST',{session,code:cell.source.join('')});
  if(revision!==kernelRevision)return;
  if(epoch && epoch!==result.kernel)for(const other of cells)other.execution_count=null;
  epoch=result.kernel;cell.execution_count=result.count;cell.outputs=[];
  for(const key of ['stdout','stderr'])if(result[key])cell.outputs.push({output_type:'stream',name:key,text:[result[key]]});
  if(result.result!==null && result.result!==undefined)cell.outputs.push({output_type:'execute_result',execution_count:result.count,metadata:{},data:{'text/plain':[result.result],...(result.image?{'image/png':result.image}:{})}});
  if(result.error)cell.outputs.push({output_type:'error',ename:'CellError',evalue:result.error,traceback:[result.error]});
 } catch(error){if(revision!==kernelRevision)return;cell.outputs=[{output_type:'error',ename:'KernelError',evalue:String(error),traceback:[String((error as Error).message)]}];}
 finally{busy=false;render();save();}
}
async function reset(){try{await api('/notebook','POST',{session,action:busy?'interrupt':'reset'});kernelRevision++;epoch='';for(const cell of cells){cell.execution_count=null;cell.outputs=[];}render();save();status('Kernel restarted · Run cells to restore variables');}catch(e){status(String(e));}}
function render(){
 if(!host)return;views.forEach(v=>v.destroy());views=[];markdownCleanup.forEach(cleanup=>cleanup());markdownCleanup=[];host.replaceChildren();host.classList.add('notebook');
 const toolbar=document.createElement('div');toolbar.style.cssText='display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 10px;position:sticky;top:0;background:var(--surface,#1e1e2e);z-index:2';
 toolbar.append(button('+ Code',()=>{if(!busy){cells.push(fresh());render();save();}}),button('+ Markdown',()=>{if(!busy){cells.push(fresh('markdown'));render();save();}}),button('Run all',()=>{if(!busy)void(async()=>{for(const cell of cells){await run(cell);if(cell.outputs.some(o=>o.output_type==='error'))break;}})();}),button(busy?'Stop':'Restart kernel',()=>void reset()));
 const label=document.createElement('span');label.dataset.status='';label.setAttribute('role','status');label.textContent=busy?'Running…':'Tina4 Python · Shift+Enter runs a cell';toolbar.append(label);host.append(toolbar);
 cells.forEach((cell,index)=>{
  const card=document.createElement('section');card.className='notebook-cell';
  const heading=document.createElement('span');heading.className='notebook-prompt';heading.textContent=cell.cell_type==='code'?`[${cell.execution_count??' '}]:`:'';card.append(heading);
  const body=document.createElement('div');body.className='notebook-cell-body';card.append(body);
  const controls=document.createElement('div');controls.className='notebook-cell-tools';controls.setAttribute('role','toolbar');controls.setAttribute('aria-label','Cell actions');
  const insert=(offset:number,copy=false)=>{if(busy)return;const next=fresh(cell.cell_type);if(copy)next.source=[cell.source.join('')];cells.splice(index+offset,0,next);render();save();};
  if(cell.cell_type==='code')controls.append(iconButton('Run cell',runIcon,()=>void run(cell)));
  controls.append(iconButton('Duplicate cell',duplicateIcon,()=>insert(1,true)),iconButton('Move cell up',upIcon,()=>{if(index>0){[cells[index-1],cells[index]]=[cell,cells[index-1]];render();save();}}),iconButton('Move cell down',downIcon,()=>{if(index<cells.length-1){[cells[index],cells[index+1]]=[cells[index+1],cell];render();save();}}),iconButton('Insert cell above',aboveIcon,()=>insert(0)),iconButton('Insert cell below',belowIcon,()=>insert(1)),iconButton('Delete cell',deleteIcon,()=>{cells.splice(index,1);if(!cells.length)cells.push(fresh());render();save();}));body.append(controls);
  const editor=document.createElement('div');editor.className='notebook-cell-input';body.append(editor);
  const output=document.createElement('div');output.className='notebook-cell-output';body.append(output);
  host!.append(card);
  if(cell.cell_type==='markdown'){
   markdownCleanup.push(mountNotebookMarkdown(editor,cell.source.join(''),value=>{cell.source=[value];save();}));
   return;
  }
  const view=new EditorView({parent:editor,state:EditorState.create({doc:cell.source.join(''),extensions:[lineNumbers(),oneDark,history(),...(cell.cell_type==='code'?[python()]:[]),EditorView.editable.of(!busy),keymap.of([{key:'Shift-Enter',run:()=>{void run(cell);return true;}},...defaultKeymap,...historyKeymap,indentWithTab]),EditorView.updateListener.of(update=>{if(update.docChanged){cell.source=[update.state.doc.toString()];save();}}),EditorView.theme({'&':{fontSize:'14px'},'.cm-scroller':{overflow:'auto'}})]})});views.push(view);
  renderOutputs(cell,output);
 });
}
export async function mountNotebook(container:HTMLElement){
 if(!document.getElementById('notebook-css')){const style=document.createElement('style');style.id='notebook-css';style.textContent=notebookCss;document.head.append(style);}
 host=container;
 if(!loaded){
  try{const file=await api<{content:string}>(`/file?path=${encodeURIComponent(path)}`);const document=JSON.parse(file.content);if(document.nbformat!==4 || !Array.isArray(document.cells))throw new Error('Invalid notebook');cells=document.cells.map((cell:any)=>({...fresh(cell.cell_type==='markdown'?'markdown':'code'),...cell,source:Array.isArray(cell.source)?cell.source:[String(cell.source||'')]}));}
  catch(error){if(!String(error).includes('404')){host.textContent='Could not load notebook: '+String(error);return;}cells=[fresh()];}
  loaded=true;
 }
 render();
}
