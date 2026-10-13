import { EditorView } from "@codemirror/view";

/** Only GET routes can be opened by a browser preview. */
export function previewRoutes(source: string): string[] {
  return [...new Set([...source.matchAll(/(?:@get|\bRoute::get|\brouter\.get)\s*\(\s*["'](\/[^"']*)["']/g)].map(match => match[1]))];
}

export function codeMenu(complete: (view: EditorView) => void, preview: (url: string) => void) {
  return EditorView.domEventHandlers({contextmenu(event, view) {
    event.preventDefault();
    document.querySelector('.editor-code-menu')?.remove();
    // A right click does not consistently move CodeMirror's caret. Keep a
    // highlighted replacement, otherwise target the location actually clicked.
    if(view.state.selection.main.empty) {
      const pos=view.posAtCoords({x:event.clientX,y:event.clientY});
      if(pos!==null) view.dispatch({selection:{anchor:pos}});
    }
    const selected = view.state.selection;
    const documentAtOpen = view.state.doc;
    const menu = document.createElement('div');
    menu.className = 'editor-ctx-menu editor-code-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Code actions');
    menu.style.cssText = 'position:fixed;z-index:300;min-width:220px';
    const dismiss = () => { menu.remove(); document.removeEventListener('mousedown', outside, true); document.removeEventListener('keydown', keyboard, true); };
    const outside = (e: Event) => { if (!menu.contains(e.target as Node)) dismiss(); };
    const keyboard = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); dismiss(); view.focus(); } };
    const item = (label: string, action: () => void) => {
      const button = document.createElement('button');
      button.className = 'ctx-item'; button.setAttribute('role', 'menuitem'); button.textContent = label;
      button.style.cssText='display:block;width:100%;background:transparent;border:0;color:inherit;text-align:left';
      button.onclick = () => { dismiss(); action(); };
      menu.append(button);
    };
    item(view.state.selection.main.empty ? 'Suggest code at cursor' : 'Autocomplete selected block', () => { view.focus(); if (view.state.doc !== documentAtOpen) return; view.dispatch({selection: selected}); complete(view); });
    for (const route of previewRoutes(view.state.doc.toString())) item(`Preview GET ${route}`, () => {
      let cancelled = false;
      const url = route.replace(/\{([^}]+)\}|<([^>]+)>|:([A-Za-z_]\w*)/g, (_all, brace, angle, colon) => {
        const value = prompt(`Value for ${brace || angle || colon}:`);
        if (value === null || !value.trim()) cancelled = true;
        return encodeURIComponent(value || '');
      });
      if (!cancelled) preview(url);
    });
    document.body.append(menu);
    menu.style.left = Math.max(0,Math.min(event.clientX,innerWidth-menu.offsetWidth-8))+'px';
    menu.style.top = Math.max(0,Math.min(event.clientY,innerHeight-menu.offsetHeight-8))+'px';
    document.addEventListener('mousedown', outside, true);
    document.addEventListener('keydown', keyboard, true);
    return true;
  }});
}
