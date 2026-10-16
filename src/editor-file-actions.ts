/** Infer from folder conventions, then unambiguous neighbouring source files. */
export function inferFileName(name:string,folder:string,siblings:string[],root:string[]):string {
 name=name.trim();
 if(!name || name.includes('/') || name.includes('\\\\') || name==='.' || name==='..')throw new Error('Enter a filename, without a folder path.');
 if(name.startsWith('.') || name.includes('.'))return name;
 const parts=folder.replace(/\\\\/g,'/').split('/');
 let extension='';
 if(parts.includes('templates'))extension='twig';
 else if(parts.includes('scss'))extension='scss';
 else if(parts.includes('public') && parts.includes('css'))extension='css';
 else if(parts.includes('public') && parts.includes('js'))extension='js';
 else if(parts.includes('plan') || parts.includes('docs'))extension='md';
 else {
  const extensions=[...new Set(siblings.filter(n=>!n.startsWith('.')).map(n=>n.split('.').slice(1).pop()).filter(Boolean))];
  if(extensions.length===1)extension=extensions[0]!;
  else if(parts.some(p=>['routes','orm','models','app','services','middleware','tests','seeds'].includes(p))) {
   const backends=[['app.py','py'],['app.rb','rb'],['index.php','php'],['app.ts','ts'],['app.js','js']].filter(([marker])=>root.includes(marker));
   if(backends.length===1)extension=backends[0][1];
  }
 }
 return extension ? `${name}.${extension}` : name;
}
export const imageFolder=(path:string)=>/^src\/public\/images(?:\/|$)/.test(path);
