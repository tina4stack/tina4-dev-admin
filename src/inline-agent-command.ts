/** A command occupies its own line. Other uses of >>> remain normal code. */
export function inlineAgentCommand(line:string):string|null {
 const match=line.match(/^\s*>>>\s*(.*?)\s*$/);
 return match?.[1] || null;
}
