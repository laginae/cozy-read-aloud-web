import test from 'node:test';
import assert from 'node:assert/strict';
import { ReaderPlayer } from '../src/player.js';
const tick=()=>new Promise(r=>setImmediate(r));
const response=()=>new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'audio/mpeg'}});
function fixture(prefetch=false,fetcher=async()=>response()) {
 const settings={engine:'openrouter',key:'public-test-placeholder',consent:true,model:'example/model',onlineVoice:'example',speed:1,volume:1,prefetch};
 const audios=[];
 class Audio {
  constructor(){audios.push(this);this.currentTime=0;this.duration=10;}
  play(){this.onplaying?.();return Promise.resolve();}
  pause(){this.onpause?.();} removeAttribute(){} load(){}
 }
 const p=new ReaderPlayer({settings,AudioClass:Audio,speech:{cancel(){},pause(){}},fetcher});
 p.load(['First public sentence.','Second public sentence.','Third public sentence.'].map(text=>({text})));
 return {p,audios,settings};
}
test('prefetch is off by default, limited to the next scoped item and reused',async()=>{
 for(const enabled of [false,true]){
  let calls=0;const {p}=fixture(enabled,async()=>{calls++;return response();});
  p.items=p.items.slice(0,2);
  await p.start();await tick();assert.equal(calls,enabled?2:1);
  const old=p.audio;old.onended();old.onended();await tick();
  assert.equal(p.index,1);assert.equal(calls,2);
  if(enabled)assert.equal(p.timings.snapshot().counts.prefetchUsed,1);
  p.stop();p.clearCache();
 }
});
test('two-request ceiling survives rapid jumps, cancelled requests and ignored abort signals',async()=>{
 const pending=[];let active=0,peak=0;
 const {p,audios}=fixture(true,()=>new Promise(resolve=>{
  active++;peak=Math.max(peak,active);pending.push(()=>{active--;resolve(response());});
 }));
 const first=p.start();await tick();pending.shift()();await first;await tick();
 const second=p.start(2);await tick();const third=p.start(0);await tick();
 assert.equal(peak,2);
 while(pending.length){pending.shift()();await tick();}
 await second;await third;await tick();
 assert.equal(p.index,0);assert.equal(peak,2);
 assert.equal(audios.length,2);
 p.stop();p.clearCache();
});
test('changed authorization and hidden pages cannot accept late audio or send new work',async()=>{
 let finish,calls=0;
 const {p,settings,audios}=fixture(true,()=>{calls++;return new Promise(r=>finish=r);});
 const started=p.start();await tick();settings.consent=false;finish(response());await started;
 assert.equal(audios.length,0);assert.equal(p.cache.size,0);
 p.setHidden(true);await p.start();p.resume();assert.equal(calls,1);
 p.stop();p.clearCache();
});

test('failed prefetch is not silently retried on advance; explicit play can retry',async()=>{
 let calls=0;
 const {p}=fixture(true,async()=>{calls++;return calls===2?new Response('',{status:400}):response();});
 p.items=p.items.slice(0,2);
 await p.start();await tick();assert.equal(calls,2);
 p.audio.onended();await tick();assert.equal(calls,2);assert.equal(p.status,'error');
 await p.start(1);await tick();assert.equal(calls,3);assert.equal(p.status,'playing');
 p.stop();p.clearCache();
});
test('100 seeded transition sequences keep pause, stop, jump and stale event ownership',async()=>{
 let seed=73,actions=0;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
 for(let run=0;run<100;run++){
  const {p,audios,settings}=fixture(run%2===0);
  await p.start();await tick();
  for(let step=0;step<20;step++){
   actions++;
   const old=p.audio,oldEnd=old?.onended,choice=Math.floor(random()*7);
   if(choice===0){p.pause();old?.onplaying?.();assert.equal(p.status,'paused');p.resume();await tick();}
   else if(choice===1){p.jump(Math.floor(random()*p.items.length));await tick();const index=p.index;oldEnd?.();assert.equal(p.index,index);}
   else if(choice===2){p.stop();oldEnd?.();old?.onplaying?.();assert.equal(p.status,'idle');await p.start(Math.floor(random()*p.items.length));}
   else if(choice===3){p.setHidden(true);p.resume();assert.notEqual(p.status,'playing');p.setHidden(false);p.resume();await tick();}
   else if(choice===4){old?.onpause?.();if(old)assert.equal(p.status,'paused');p.resume();await tick();}
   else if(choice===5){p.setSpeed([1,1.75,2][run%3]);if(p.audio)assert.equal(p.audio.playbackRate,settings.speed);}
   else if(oldEnd){const index=p.index;oldEnd();oldEnd();await tick();assert.ok(p.index===index+1 || p.status==='complete');}
   if(['ready','complete','idle'].includes(p.status)){await p.start(0);await tick();}
  }
  p.stop();for(const a of audios){a.onended?.();a.onplaying?.();}assert.equal(p.status,'idle');
  const report=JSON.stringify(p.timings.snapshot());assert.doesNotMatch(report,/public sentence|placeholder|example\/model/);p.clearCache();
 }
 assert.equal(actions,2000);
});
