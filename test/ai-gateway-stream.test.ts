// @vitest-environment node
import {createServer} from 'node:http';
import {expect,it,vi} from 'vitest';
vi.unstubAllGlobals(); // Exercise native fetch against real local HTTP sockets.
import {streamChat} from '../src/ai-gateway';
it('retries a disconnected real HTTP stream and exposes only the completed answer, including an unterminated final frame',async()=>{
 let calls=0;const received:string[]=[];
 const server=createServer((req,res)=>{req.resume();req.on('end',()=>{
  calls++;res.writeHead(200,{'Content-Type':'application/x-ndjson'});
  if(calls===1){res.write(JSON.stringify({message:{content:'discard me'}})+'\n');setTimeout(()=>res.destroy(),30);}
  else res.end(JSON.stringify({message:{content:'complete'},done:true}));
 });});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 (globalThis as any).TINA4_AI_GATEWAY=`http://127.0.0.1:${(server.address() as any).port}`;
 try{await streamChat({model:'transport-test',messages:[{role:'user',content:'test'}]}, {onContent:t=>received.push(t)});expect(calls).toBe(2);expect(received).toEqual(['complete']);}
 finally{delete (globalThis as any).TINA4_AI_GATEWAY;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
it('does not retry authentication failures',async()=>{
 let calls=0;const server=createServer((req,res)=>{calls++;req.resume();res.writeHead(401);res.end();});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 (globalThis as any).TINA4_AI_GATEWAY=`http://127.0.0.1:${(server.address() as any).port}`;
 try{await expect(streamChat({model:'test',messages:[]},{})).rejects.toMatchObject({status:401});expect(calls).toBe(1);}
 finally{delete (globalThis as any).TINA4_AI_GATEWAY;server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
