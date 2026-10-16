/** Browser dictation with a silence boundary; no recording is stored by the app. */
export function mountVoiceInput(button:HTMLButtonElement,input:HTMLTextAreaElement,status:HTMLElement,send:()=>Promise<void>):()=>void {
 const Recognition=(window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
 let enabled=false,recognition:any=null,timer:ReturnType<typeof setTimeout>|undefined,waiting=false;
 let base='',finalText='',interim='';
 const clear=()=>{if(timer)clearTimeout(timer);timer=undefined;};
 const paint=()=>{button.setAttribute('aria-pressed',String(enabled));button.title=enabled?'Stop live microphone':'Start live microphone (browser speech service)';button.setAttribute('aria-label',enabled?'Stop live microphone':'Start live microphone');};
 const stop=()=>{enabled=false;clear();const current=recognition;recognition=null;current?.abort();paint();};
 const submit=async()=>{
  clear();if(!enabled||waiting)return;
  if(!(finalText+interim).trim())return;
  waiting=true;const current=recognition;recognition=null;current?.abort();
  status.textContent='Sending voice prompt…';
  try{await send();}catch{status.textContent='Voice prompt could not be sent. Your text is available to retry.';stop();}
  finally{waiting=false;if(enabled)start();}
 };
 const boundary=()=>{clear();timer=setTimeout(()=>void submit(),1500);};
 const start=()=>{
  if(!enabled||waiting||recognition)return;
  base=input.value.trim();finalText='';interim='';
  const current=new Recognition();recognition=current;
  current.lang=navigator.language || 'en-US';current.continuous=true;current.interimResults=true;
  current.onstart=()=>{if(recognition===current)status.textContent='Listening · sends after 1.5 seconds of silence';};
  current.onresult=(event:any)=>{
   if(recognition!==current)return;
   finalText='';interim='';
   for(let i=0;i<event.results.length;i++){
    const text=event.results[i][0].transcript;
    if(event.results[i].isFinal)finalText+=text+' ';else interim+=text+' ';
   }
   input.value=[base,(finalText+interim).trim()].filter(Boolean).join(' ');
   input.dispatchEvent(new Event('input',{bubbles:true}));boundary();
  };
  current.onspeechstart=clear;
  current.onspeechend=boundary;
  current.onerror=(event:any)=>{
   if(recognition!==current)return;
   if(event.error==='no-speech'){status.textContent='No speech heard. Click the mic to try again.';}
   else status.textContent=event.error==='not-allowed'||event.error==='service-not-allowed'?'Microphone access was denied. Allow it in your browser to use voice.':event.error==='network'?'The browser speech service is unavailable. You can still type your prompt.':'Voice input stopped. Check your microphone and try again.';
   stop();
  };
  current.onend=()=>{
   if(recognition!==current)return;recognition=null;
   if(enabled&&(finalText+interim).trim())boundary();
   else if(enabled){status.textContent='Microphone stopped. Click to listen again.';stop();}
  };
  try{current.start();}catch{status.textContent='Voice input is unavailable in this browser.';stop();}
 };
 button.onclick=()=>{
  if(enabled){stop();status.textContent='Microphone off';return;}
  if(!Recognition){status.textContent='Live voice is not supported in this browser. Use browser/OS dictation or open split in a browser with speech recognition.';return;}
  enabled=true;paint();start();
 };
 // Editing or sending manually ends dictation, avoiding late results overwriting input.
 input.addEventListener('keydown',stop);
 const manualButtons=['assistant-send','assistant-reset'].map(id=>document.getElementById(id));
 for(const control of manualButtons)control?.addEventListener('click',stop,true);
 const hide=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',hide);
 paint();
 return ()=>{stop();for(const control of manualButtons)control?.removeEventListener('click',stop,true);input.removeEventListener('keydown',stop);document.removeEventListener('visibilitychange',hide);};
}
