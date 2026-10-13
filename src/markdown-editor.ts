import Editor from '@toast-ui/editor';
import css from '@toast-ui/editor/dist/toastui-editor.css?inline';
import darkCss from '@toast-ui/editor/dist/theme/toastui-editor-dark.css?inline';

/** One Markdown document, two editing modes. No telemetry or remote assets. */
export function mountMarkdownEditor(parent: HTMLElement, value: string, change: (value: string) => void, save: () => void): () => void {
  ensureMarkdownStyles();
  const wrapper=document.createElement('div');wrapper.className='t4-markdown-document';
  const toolbar=document.createElement('div');toolbar.style.cssText='display:flex;justify-content:flex-end;padding:6px;gap:8px';
  const toggle=document.createElement('button');toggle.className='btn btn-sm';toggle.textContent='<>';toggle.title='Edit Markdown source';toggle.setAttribute('aria-label','Edit Markdown source');
  const saveButton=document.createElement('button');saveButton.className='btn btn-sm';saveButton.textContent='Save';saveButton.onclick=save;
  toolbar.append(toggle,saveButton);
  const host=document.createElement('div');host.style.cssText='flex:1;min-height:0;overflow:hidden';
  wrapper.append(toolbar,host);parent.append(wrapper);
  const editor=new Editor({el:host,height:'100%',initialEditType:'wysiwyg',initialValue:value,hideModeSwitch:true,usageStatistics:false,theme:'dark',autofocus:false,events:{change:()=>change(editor.getMarkdown())}});
  let source=false;
  toggle.onclick=()=>{source=!source;editor.changeMode(source?'markdown':'wysiwyg');toggle.textContent=source?'Document':'<>';toggle.title=source?'Edit document':'Edit Markdown source';toggle.setAttribute('aria-label',toggle.title);};
  const keydown=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();save();}};
  wrapper.addEventListener('keydown',keydown);
  return ()=>{editor.destroy();wrapper.remove();};
}

function ensureMarkdownStyles(): void {
  if (!document.getElementById('markdown-editor-css')) {
    const style=document.createElement('style'); style.id='markdown-editor-css';
    style.textContent=css+'\n'+darkCss+'\n.t4-markdown-document{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0}.t4-markdown-document .toastui-editor-defaultUI{border:0}.t4-markdown-document .toastui-editor-contents{font-size:16px}.t4-markdown-document .toastui-editor-main{background:#1e1e2e}';
    document.head.append(style);
  }
}

const chatViewers=new WeakMap<HTMLElement,ReturnType<typeof Editor.factory>>();

export function renderChatMarkdown(element: HTMLElement, content: string): void {
  ensureMarkdownStyles();
  const existing=chatViewers.get(element);
  if(existing){existing.setMarkdown(content);return;}
  element.replaceChildren();
  element.style.whiteSpace="normal";
  element.classList.add("toastui-editor-dark");
  chatViewers.set(element,Editor.factory({el:element,viewer:true,initialValue:content,usageStatistics:false,theme:"dark"}));
}
