import {javascriptLanguage} from "@codemirror/lang-javascript";
/** Fill a generated page's content slot without replacing its framework shell.
 * Models may emit either a fragment or a whole document. CSS is transferred to
 * the page's SCSS asset; it never remains inline in the Twig template. */
export function preparePageEdit(scaffold: string, generated: string, name: string): {content: string; styles: string[]; scripts:string[]} {
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(name)) throw new Error("Invalid page name.");
  const block = /(\{%\s*block content\s*%\})[\s\S]*?(\{%\s*endblock\s*%\})/;
  if (!block.test(scaffold)) throw new Error("The scaffold has no recognised content block; its structure was preserved.");
  // Validate the original model output here, before the HTML parser can turn
  // Markdown wrappers or truncated fences into visible page text.
  const fences = [...generated.matchAll(/^[ \t]*(`{3,}|~{3,})([^\r\n]*)\r?$/gm)];
  if (fences.length) {
    const [open, close] = fences;
    if (fences.length !== 2 || !/^(?:html)?\s*$/i.test(open[2]) || close[2].trim() || close[1] !== open[1]) {
      throw new Error("Return one complete HTML code block with a closing fence. Do not nest code blocks.");
    }
    generated = generated.slice(open.index! + open[0].length, close.index).trim();
  }
  generated = generated.trim();
  if (!generated.startsWith("<") || !generated.endsWith(">")) {
    throw new Error("Return only complete HTML, without Markdown or explanation text.");
  }
  if (/\{%/.test(generated)) throw new Error("Return HTML content only. Twig structure is already supplied by the scaffold.");
  const document = new DOMParser().parseFromString(generated, "text/html");
  const styles = [...document.querySelectorAll("style")].map(node => node.textContent || "");
  const scripts=[...document.querySelectorAll('script')].map(node=>{
    if(node.src)throw new Error('Use self-contained page behaviour; external script URLs are not accepted here.');
    const source=node.textContent || '';
    validatePageScript(source);
    return source.trim();
  }).filter(Boolean);
  document.querySelectorAll("style,script,link,meta,title").forEach(node => node.remove());
  const scope = name.replace(/_/g, "-");
  document.body.querySelectorAll<HTMLElement>("[style]").forEach((node, index) => {
    const className = `${scope}-element-${index}`;
    styles.push(`.${className} { ${node.getAttribute("style")} }`);
    node.classList.add(className);
    node.removeAttribute("style");
  });
  const fragment = document.body.innerHTML.trim();
  if (fragment.length < 30 || !document.body.querySelector("h1,h2,p,form,section,article,div")) throw new Error("Return complete semantic HTML content, not a placeholder.");
  let content = scaffold.replace(block, (_, start, end) => `${start}\n<section class="${scope}">\n${fragment}\n</section>\n${end}`);
  const stylesheet = `<link rel="stylesheet" href="/css/${name}.css">`;
  if (/\{%\s*block stylesheets\s*%\}/.test(content)) {
    content = content.replace(/(\{%\s*block stylesheets\s*%\})/, `$1\n${stylesheet}`);
  } else content += `\n{% block stylesheets %}\n${stylesheet}\n{% endblock %}\n`;
  if(scripts.length) content=content.replace(block, (_whole,start,end)=>{
    const body=content.match(block)![0].slice(start.length,-end.length);
    return `${start}${body}<script type="module" src="/js/${name}.js"></script>\n${end}`;
  });
  return {content, styles, scripts};
}

/** Reject truncated or fenced output before writing a stylesheet. */
export function completeStylesheet(source: string): boolean {
  if (source.includes("```")) return false;
  const tokens = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, "");
  let depth = 0;
  for (const char of tokens) {
    if (char === "{") depth++;
    if (char === "}" && --depth < 0) return false;
  }
  return depth === 0 && tokens.includes("{") && tokens.trim().endsWith("}");
}

/** Parse without executing generated source. Behaviour is tested in the real preview. */
export function validatePageScript(source:string):void {
 if(!source.trim() || /```|<\/?script\b/.test(source))throw new Error('Return complete JavaScript source without Markdown or script tags.');
 let invalid=false;javascriptLanguage.parser.parse(source).iterate({enter:node=>{if(node.type.isError)invalid=true;}});
 if(invalid)throw new Error('Generated JavaScript has syntax errors. Return complete valid code.');
 if(/\beval\s*\(|\bnew\s+Function\s*\(/.test(source))throw new Error('Implement behaviour explicitly; do not execute user input as JavaScript.');
}

export function javascriptTokens(source:string):string {
 const tokens:string[]=[];
 javascriptLanguage.parser.parse(source).iterate({enter:node=>{if(!node.node.firstChild && !/Comment/.test(node.name))tokens.push(source.slice(node.from,node.to));}});
 return JSON.stringify(tokens);
}
