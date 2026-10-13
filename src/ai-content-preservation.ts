/** A layout repair may change structure, but must retain text, template expressions,
 * semantic elements and their destinations. Independent of model self-review. */
export function assertContentPreserved(before:string, after:string, allowAdditions=false):void {
  const visible=(source:string)=>source.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
  const text=(source:string)=>visible(source).replace(/<!--[\s\S]*?-->|\{#[\s\S]*?#\}/g,'').replace(/<[^>]*>|\{%[\s\S]*?%\}/g,' ').replace(/\s+/g,' ').trim();
  const semantics=(source:string)=>[...visible(source).matchAll(/<(h[1-6]|a|button|input|select|textarea|img|video|audio|iframe)\b([^>]*)>/gi)].map(m=>{
    const attrs=[...m[2].matchAll(/\b(href|src|alt|name|type|value|aria-label)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi)].map(a=>a[1].toLowerCase()+'='+a[2]).sort();
    return m[1].toLowerCase()+':'+attrs.join('|');
  }).sort();
  const oldText=text(before),newText=text(after);
  const previous=oldText.split(' ').filter(Boolean),current=newText.split(' ').filter(Boolean);
  let cursor=0;for(const word of current)if(word===previous[cursor])cursor++;
  const textPreserved=allowAdditions ? cursor===previous.length : oldText===newText;
  const semanticsPreserved=allowAdditions ? missingRenderedContent(semantics(before),semantics(after)).length===0 : JSON.stringify(semantics(before))===JSON.stringify(semantics(after));
  if(!textPreserved || !semanticsPreserved)
    throw new Error('Layout repair must preserve all existing text, template expressions, headings, controls and destinations. Fix layout rules instead of removing content.');
}

/** Multiset comparison preserves duplicate labels too. Only used for presentation repairs. */
export function missingRenderedContent(before:string[],after:string[]):string[] {
  const remaining=new Map<string,number>();
  for(const value of after)remaining.set(value,(remaining.get(value)||0)+1);
  const missing:string[]=[];
  for(const value of before){const count=remaining.get(value)||0;if(count)remaining.set(value,count-1);else missing.push(value);}
  return missing;
}
