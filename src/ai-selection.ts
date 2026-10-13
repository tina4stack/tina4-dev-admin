import { pythonLanguage } from "@codemirror/lang-python";
import type { ChatMessage } from "./ai-gateway";

export interface SelectionContext {
  prefix: string; selected: string; suffix: string; language: string; path: string | null;
}

/** Read the entire Python document for dependencies and the enclosing scope.
 * Other AI-FILL bodies are not tasks. The full source is still used by the
 * syntax validator and duplicate guard before offering any replacement. */
export function selectionMessages(ctx: SelectionContext, feedback = ""): ChatMessage[] {
  const source = ctx.prefix + ctx.selected + ctx.suffix;
  const imports: string[] = [], scopes: string[] = [];
  if (ctx.language === "python") {
    pythonLanguage.parser.parse(source).iterate({ enter(node) {
      if (node.name === "ImportStatement" && (node.to <= ctx.prefix.length || node.from >= ctx.prefix.length + ctx.selected.length)) imports.push(source.slice(node.from, node.to));
      if (node.name === "FunctionDefinition" || node.name === "ClassDefinition") {
        if (node.from < ctx.prefix.length && node.to >= ctx.prefix.length) {
          const params = node.node.getChild("ParamList");
          if (params) scopes.push(`function body, arguments=${source.slice(params.from + 1, params.to - 1).replace(/\s/g, "")}`);
        }
      }
    }});
  }
  const context = ctx.language === "python"
    ? `Read-only context: language=${ctx.language}, scope=${scopes.join("; ") || "module"}, existing imports=${imports.map(line => line.replace(/^from (\S+) import /, "$1 ").replace(/^import /, "").replace(/,/g, "")).join("; ")}.`
    : `Read-only code before selection:\n${ctx.prefix}\nRead-only code after selection:\n${ctx.suffix}`;
  // A framework idiom, not a task-specific answer. Names and behavior always
  // come from the selection. No route name or prompt wording is dispatched on.
  const example = ctx.language === "python" && /\bORM\b|src\.orm\./i.test(ctx.selected)
    ? `Tina4 Python example:\n    from src.orm.Product import Product\n    rows = Product.all()\n    return response({"records": [r.to_dict() for r in rows]})\n\n`
    : "";
  return [{role: "user", content: `${context}\n${example}Implement this selected block in the same ${ctx.language === "python" ? "Tina4" : ctx.language} style. Output replacement statements only.\n${ctx.selected}${feedback ? `\nPrevious completion was rejected: ${feedback}. Correct that problem.` : ""}`}];
}

/** Validate the reconstructed file and the selected contract, without executing it. */
export function selectionProblem(code: string, ctx: SelectionContext): string {
  if (!code.trim()) return "No complete source code was returned";
  if (/raise\s+NotImplementedError/.test(ctx.selected) && /raise\s+NotImplementedError|^\s*pass\s*$/m.test(code)) return "The placeholder must be implemented";
  if (ctx.language !== "python") return "";
  if (!/^\s*(?:async\s+)?(?:def|class)\s/m.test(ctx.selected) && /^\s*(?:@|(?:async\s+)?(?:def|class)\s)/m.test(code)) return "Return only statements inside the selected block, not declarations or decorators";
  let invalid = false;
  pythonLanguage.parser.parse(ctx.prefix + code + ctx.suffix).iterate({enter(node) { if (node.type.isError) invalid = true; }});
  if (invalid) return "The replacement produces invalid Python syntax or indentation";
  const requiredCall = ctx.selected.match(/#\s*Return:\s*([\w.]+)\(/)?.[1];
  if (requiredCall && !code.includes(`return ${requiredCall}(`)) return `The Return contract requires return ${requiredCall}(...)`;
  return "";
}
