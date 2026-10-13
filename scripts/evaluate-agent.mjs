// Exercise the actual browser agent against the local gateway and project MCP.
// Defaults to read-only intake checks. TINA4_EVAL_BUILD=1 explicitly enables
// approved build tests against a separate local test backend.
// Usage: node scripts/evaluate-agent.mjs [reference-image-path]
import { Window } from "happy-dom";
globalThis.DOMParser = new Window().DOMParser;
import { build } from "esbuild";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const backend = process.env.TINA4_BACKEND || "http://127.0.0.1:7146";
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, options) => nativeFetch(
  typeof url === "string" && url.startsWith("/") ? new URL(url, backend) : url,
  options,
);
const temporary = await mkdtemp(join(tmpdir(), "tina4-agent-eval-"));
const report = [];
try {
  const output = join(temporary, "agent.mjs");
  await build({ entryPoints: [resolve("src/ai-agent.ts")], outfile: output, bundle: true, platform: "node", format: "esm" });
  const { runAgent, createAgentSession } = await import(pathToFileURL(output).href);
  const cases = [{ task: "Make me a landing page" }, { task: "Build me a landing page" }];
  if (process.argv[2]) cases.push({ task: "Build me a landing page like this", images: [(await readFile(process.argv[2])).toString("base64")] });
  for (const [caseIndex, scenario] of cases.entries()) {
    if (process.env.TINA4_EVAL_CASE && Number(process.env.TINA4_EVAL_CASE) !== caseIndex + 1) continue;
    const session = createAgentSession();
    const started = performance.now();
    const record = { prompt: scenario.task, image: !!scenario.images, firstThinkingMs: null, firstContentMs: null, replies: {}, tools: [], blocked: [], result: null };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    console.log(`Running: ${scenario.task}`);
    try {
      record.result = await runAgent({
        ...scenario, session, model: "empero-ai/Qwen3.8-2B-Distill", think: true, signal: controller.signal,
        onEvent(event) {
          if (event.type === "content") record.replies[event.step] = (record.replies[event.step] || "") + event.text;
          const elapsed = Math.round(performance.now() - started);
          if (event.type === "thinking" && record.firstThinkingMs === null) record.firstThinkingMs = elapsed;
          if (event.type === "content" && record.firstContentMs === null) record.firstContentMs = elapsed;
          if (event.type === "tool_start") record.tools.push({ tool: event.tool, args: event.args });
          if (event.type === "blocked") record.blocked.push({ tool: event.tool, args: event.args });
        },
      });
      if (process.env.TINA4_EVAL_BUILD === "1" && record.result.stopped === "clarification") {
        if (backend === "http://127.0.0.1:7146" || !["127.0.0.1", "localhost"].includes(new URL(backend).hostname)) throw new Error("Build evaluation requires a separate test backend");
        clearTimeout(timeout);
        const buildTimeout = setTimeout(() => controller.abort(), 300000);
        try {
          record.followup = await runAgent({session, model:"empero-ai/Qwen3.8-2B-Distill", think:true, signal:controller.signal,
            task:`This is for Northstar bicycle repairs, aimed at local cyclists. Build a simple service page at /eval_${process.env.TINA4_EVAL_RUN || "run"}_${caseIndex+1} with headline, a short service description and a Book a repair link to mailto:hello@example.test. Use your judgment for wording and visual details; use the image's style if provided. No forms or extra sections. Proceed with that plan.`,
            authorizeTool:async (tool,args) => { console.log(`APPROVED ${tool.name} ${args.path || args.title || args.name || ""}`); return true; },
            onEvent(event) {
              if (event.type === "content") record.replies[`build_${event.step}`] = (record.replies[`build_${event.step}`] || "") + event.text;
              if (event.type === "tool_start") { record.tools.push({tool:event.tool,args:event.args}); console.log(`TOOL ${event.tool} ${event.args?.path || event.args?.name || ""}`); }
              if (event.type === "tool_result") console.log(`RESULT ${event.tool} ${(event.text || "").slice(0,150)}`);
            },
          });
          record.state = {brief:session.brief, planSaved:session.planSaved, changedFiles:session.changedFiles, verified:session.verified};
          const route=`/eval_${process.env.TINA4_EVAL_RUN || "run"}_${caseIndex+1}`;
          const page=await fetch(`${backend}${route}`);
          const html=await page.text();
          const css=await fetch(`${backend}/css${route}.css`);
          const cssText=await css.text();
          const file=await fetch(`${backend}/__dev/api/file?path=${encodeURIComponent(`src/templates/pages${route}.twig`)}`);
          const template=(await file.json()).content || "";
          const plans=await fetch(`${backend}/__dev/api/mcp/call`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"plan_current",arguments:{}})});
          const current=(await plans.json()).result;
          const names=record.tools.map(t=>t.tool);
          record.checks={
            clarificationFirst:record.result.stopped === "clarification" && record.result.answer.trim().length>10,
            completed:record.followup.stopped === "final_answer",
            planBeforeScaffold:names.indexOf("plan_create")>=0 && names.indexOf("plan_create")<names.indexOf("scaffold"),
            scaffoldBeforeEdits:names.indexOf("scaffold")>=0 && names.indexOf("scaffold")<names.indexOf("file_write"),
            tina4Template:template.includes('{% extends "base.twig" %}') && !/<style\b|\sstyle\s*=/i.test(template),
            renderedContent:page.status===200 && html.includes("Northstar") && html.includes("mailto:hello@example.test"),
            stylesheet:css.status===200 && (css.headers.get("content-type") || "").includes("css") && cssText.length>20,
            completedPlan:current?.progress?.total>0 && current.progress.done===current.progress.total,
          };
          if (Object.values(record.checks).some(value=>!value)) process.exitCode=1;
        } finally { clearTimeout(buildTimeout); }
      }
    } catch (error) {
      record.error = String(error);
    } finally { clearTimeout(timeout); }
    if (record.result?.stopped !== "clarification" || record.error) process.exitCode=1;
    record.elapsedMs = Math.round(performance.now() - started);
    report.push(record);
    console.log(JSON.stringify({...record, replies:undefined, tools:record.tools.map(t=>({tool:t.tool,path:t.args?.path,name:t.args?.name}))}));
    await writeFile("/tmp/tina4-agent-evaluation.json", JSON.stringify(report, null, 2));
  }
} finally { await rm(temporary, { recursive: true, force: true }); }
console.log("Report: /tmp/tina4-agent-evaluation.json");
