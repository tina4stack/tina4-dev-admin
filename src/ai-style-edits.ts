import { parse, stringify } from 'postcss-scss';
import { list, type Rule, type Declaration } from 'postcss';

export interface StyleChoice { selector: string; property: string; value: string; purpose?: string; }

/** Apply an explicit visual brief through SCSS syntax, never guessed line ranges. */
export function applyStyleChoices(source: string, choices: StyleChoice[], allowedNewSelectors: string[] = []): string {
  const root=parse(source);
  for(const original of choices) {
  for(const selector of list.comma(original.selector)) {
    const choice={...original,selector};
    if(!/^(--[\w-]+|[a-z][a-z-]*)$/.test(choice.property)) throw new Error('Invalid style property.');
    // Parse the value independently: reject injected declarations, rules and directives.
    const probe=parse(`a { ${choice.property}: ${choice.value}; }`);
    const probeRule=probe.nodes[0] as Rule;
    if(probe.nodes.length!==1 || probeRule.type!=='rule' || probeRule.nodes?.length!==1 || probeRule.nodes[0].type!=='decl') throw new Error('Style value must contain exactly one declaration.');
    const declaration=probeRule.nodes[0] as Declaration;
    const matches:Rule[]=[];
    root.walkRules(rule=>{
      // Only unambiguous top-level rules; complex/nested edits use the existing exact edit path.
      if(rule.parent===root && rule.selector.trim()===choice.selector.trim()) matches.push(rule);
    });
    if(!matches.length && /^[a-z][\w-]*$/i.test(choice.selector)) {
      root.walkRules(rule=>{
        if(rule.parent===root && rule.selector.trim().endsWith(` ${choice.selector}`) && !rule.selector.includes(',')) matches.push(rule);
      });
    }
    if(!matches.length && allowedNewSelectors.includes(choice.selector)){
      const added=parse(`${choice.selector} {}`).nodes[0];
      if(added.type!=='rule' || parse(`${choice.selector} {}`).nodes.length!==1)throw new Error('Invalid selector.');
      root.append(added);matches.push(added as Rule);
    }
    if(matches.length!==1) throw new Error(`Style selector ${choice.selector} must match one existing top-level rule.`);
    const rule=matches[0];
    const existing=rule.nodes.filter(node=>node.type==='decl' && node.prop===choice.property) as Declaration[];
    if(existing.length>1) throw new Error(`Ambiguous declaration ${choice.selector} ${choice.property}.`);
    if(existing.length) {existing[0].value=declaration.value;existing[0].important=declaration.important;}
    else rule.append(declaration.clone());
  }
  }
  return root.toString(stringify);
}

export function styleSelectors(source:string):string[] {
 const root=parse(source); const selectors:string[]=[];
 root.walkRules(rule=>{if(rule.parent===root) selectors.push(rule.selector);});
 return selectors;
}
