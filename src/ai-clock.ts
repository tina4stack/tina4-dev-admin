/** Fresh runtime facts, never a year copied from a training example. */
export function runtimeClock(now=new Date(),timeZone=Intl.DateTimeFormat().resolvedOptions().timeZone):string {
  const local=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(now);
  const year=new Intl.DateTimeFormat('en',{timeZone,year:'numeric'}).format(now);
  return `Application clock: ${local} (${timeZone}); UTC ${now.toISOString()}. Current local year: ${year}. Use these facts for current dates and generated copyright years. Do not copy stale example years. Preserve historical dates or explicitly requested dates; do not silently rewrite existing dates unrelated to the task.`;
}
