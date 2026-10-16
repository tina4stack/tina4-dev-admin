/** Unwrap a completed model response before it becomes insertable ghost text.
 * Keep indentation: this is an insertion at a cursor, not a standalone file. */
export function completionCode(raw: string): string {
  const fences = [...raw.matchAll(/^[ \t]*(`{3,}|~{3,})([^\r\n]*)\r?$/gm)];
  if (fences.length) {
    const [open, close] = fences;
    if (fences.length !== 2 || !/^[\w#+.-]*\s*$/.test(open[2]) || close[2].trim() || open[1] !== close[1]) return "";
    // Remove only the fence's newline, not indentation belonging to code.
    raw = raw.slice(open.index! + open[0].length, close.index).replace(/^\r?\n/, "");
  }
  if (/^\s*\[(?:complete|insert|replace|your|provide|code|implementation)\b[^\]\n]*\]\s*$/i.test(raw)) return "";
  if (/<\/?think\b|<\|(?:fim_|im_|endoftext)/i.test(raw)) return "";
  // Unfenced conversational output must never be inserted as source code.
  if (/^\s*(?:Here(?:'s| is| are)\b|Sure\b|Certainly\b|Explanation\s*:|This (?:code|function|snippet)\b)/i.test(raw)) return "";
  // A model can attach its fence to code on the same line (e.g. </h1>```html).
  // Reject leftover fence runs anywhere, including escaped fence variants.
  if (/(?:`(?:\\?`){2,}|~{3,})/.test(raw)) return "";
  return raw.replace(/\s+$/g, "");
}

/** Suppress file restarts and echoed neighbouring blocks, not ordinary repeated
 * expressions (such as returning the same value from different branches). */
export function repeatsExistingCode(code: string, prefix: string, suffix: string): boolean {
  const lines = (value: string) => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const proposed = lines(code);
  const existing = lines(prefix + suffix);
  if (!proposed.length) return false;
  const declaration = /^(?:from\s+\S+\s+import\b|import\s|(?:export\s+)?(?:async\s+)?(?:def|function|class)\s|<\?php\b|<!doctype\b)/i;
  if (proposed.some(line => declaration.test(line) && existing.includes(line))) return true;
  const normal = proposed.join("\n");
  if (proposed.length >= 2 && existing.join("\n").includes(normal)) return true;
  // A repeated prefix of the existing suffix is not missing at the cursor.
  return normal.length >= 12 && lines(suffix).join("\n").startsWith(normal);
}

/** Keep replacement boundaries intact when a selection starts after indentation
 * or includes the newline before the following declaration. */
export function selectionCompletion(code: string, prefix: string, selected: string, language = ""): string {
  if (!code) return "";
  if (language === "python" && !/^\s*(?:async\s+)?def\s/m.test(selected) && /(?:async\s+)?def\s+\w+\([^\n]*\):[^]*$/.test(prefix)) {
    if (/raise\s+NotImplementedError/.test(selected) && /raise\s+NotImplementedError/.test(code)) return "";
  }
  const indent = prefix.slice(prefix.lastIndexOf("\n") + 1);
  if (language === "python") {
    const targetLines = ((/^[ \t]*$/.test(indent) ? indent : "") + selected).split("\n").filter(line => line.trim());
    const targetIndent = Math.min(...targetLines.map(line => line.match(/^[ \t]*/)![0].length));
    const lines = code.split("\n");
    const commonIndent = Math.min(...lines.filter(line => line.trim()).map(line => line.match(/^[ \t]*/)![0].length));
    code = lines.map(line => line.trim() ? " ".repeat(targetIndent) + line.slice(commonIndent) : "").join("\n");
  }
  if (/^[ \t]+$/.test(indent) && code.startsWith(indent)) code = code.slice(indent.length);
  if (selected.startsWith("\n") && !code.startsWith("\n")) code = "\n" + code;
  if (selected.endsWith("\n") && !code.endsWith("\n")) code += "\n";
  return code;
}


/** Remove an echoed trailing run of lines already immediately after the cursor.
 * Compare complete lines, never partial tokens or arbitrary matching snippets. */
export function trimSuffixOverlap(code: string, suffix: string): string {
  const proposed=code.split("\n");
  const after=suffix.split("\n").map(line=>line.trim()).filter(Boolean);
  const meaningful=proposed.map((line,index)=>({text:line.trim(),index})).filter(line=>line.text);
  for(let count=Math.min(meaningful.length,after.length);count>0;count--) {
    const tail=meaningful.slice(-count);
    if(tail.every((line,index)=>line.text===after[index]))
      return proposed.slice(0,tail[0].index).join("\n").replace(/\s+$/, "");
  }
  return code;
}

/** A template block is context, not permission to restart its document shell. */
export function templateCompletionProblem(code:string,prefix:string,selected:string,suffix:string,language:string):string {
  if(!/html|twig/i.test(language))return '';
  const clean=(source:string)=>source.replace(/<!--[\s\S]*?-->|\{#[\s\S]*?#\}/g,'');
  const outside=clean(prefix+suffix), replacement=clean(code), original=clean(selected);
  if(!outside.trim())return ''; // A whole-document selection or genuinely empty document.
  const shell=/<\/?(?:html|head|body)\b[^>]*>|<!doctype\b[^>]*>|\{%[-+]?\s*(?:extends|block|endblock)\b[\s\S]*?[-+]?%\}/gi;
  const key=(token:string)=>token.startsWith('{%')
    ? token.replace(/^\{%[-+]?\s*/,'').replace(/[-+]?%\}$/,'').trim().replace(/\s+/g,' ')
    : token.match(/^<\/?[\w!]+/)![0].toLowerCase();
  const counts=(source:string)=>{const result=new Map<string,number>();for(const token of source.match(shell)||[]) {const name=key(token);result.set(name,(result.get(name)||0)+1);}return result;};
  const allowed=counts(original);
  for(const [name,count] of counts(replacement)) {
    if(count>(allowed.get(name)||0))return 'Return only the fragment at this cursor/selection. The surrounding document and Twig blocks already exist: do not add html, head, body, doctype, extends, block or endblock wrappers. Preserve the surrounding source; semantic header/footer elements inside the content are allowed.';
  }
  return '';
}
