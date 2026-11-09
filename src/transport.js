/* Opt-in Supabase adapter. Nothing contacts a server before Connect is clicked. */
(()=>{'use strict';
const SDK='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.76.0/dist/umd/supabase.js';
let sdkPromise;
function sdk(){if(window.supabase?.createClient)return Promise.resolve();if(!sdkPromise)sdkPromise=new Promise((ok,no)=>{const s=document.createElement('script');s.src=SDK;const timer=setTimeout(()=>{sdkPromise=null;no(Error('연결 모듈 응답이 늦어요. 다시 연결해 주세요.'))},10000);s.onload=()=>{clearTimeout(timer);ok()};s.onerror=()=>{clearTimeout(timer);sdkPromise=null;no(Error('연결 모듈을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'))};document.head.append(s)});return sdkPromise}
class Room{
 constructor(hooks){this.hooks=hooks;this.client=null;this.room=null;this.members=[];this.slot=0;this.isHost=false;this.running=false;this.healthy=false;this.busy=false;this.revision=-1;this.ready=null;this.outbox=[];this.received=new Set();this.timer=null;this.channel=null;this.needsReload=false}
 async rpc(name,args){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8000);try{const {data,error}=await this.client.rpc(name,args).abortSignal(ctl.signal);if(error){let message=error.message||'서버 응답을 받지 못했어요.';if(/Could not find the function|PGRST202/i.test(message))message='추가 SQL이 아직 적용되지 않았어요. upgrade-v05.sql 실행 여부를 확인해 주세요.';throw Error(message);}return data}finally{clearTimeout(timer)}}
 async connect(url,key){if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url))throw Error('Supabase Project URL을 확인해 주세요.');if(key.startsWith('sb_secret_'))throw Error('공개 publishable/anon 키만 입력해 주세요.');try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role==='service_role')throw Error('SERVICE_ROLE_BLOCKED')}catch(e){if(e.message==='SERVICE_ROLE_BLOCKED')throw Error('service_role 키는 사용할 수 없어요. 공개 키를 입력해 주세요.')}
 await sdk();this.client=window.supabase.createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true},global:{fetch:async(input,init={})=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);try{return await fetch(input,{...init,signal:init.signal||controller.signal})}finally{clearTimeout(timer)}}}});let {data,error}=await this.client.auth.getSession();if(error)throw error;if(!data.session){const r=await this.client.auth.signInAnonymously();if(r.error)throw r.error;data={session:r.data.session}}this.uid=data.session.user.id;this.hooks.status('연결됨 · 방을 만들거나 코드를 입력해 주세요.');}
 async create(state,name){const r=await this.rpc('cr5_create',{p_state:state,p_name:name});await this.attach(r)}
 async join(code,name){const r=await this.rpc('cr5_join',{p_code:code,p_name:name});await this.attach(r)}
 async attach(room){if(!room.state.pipelineVersion){if(room.host_id!==this.uid)throw Error('방장이 먼저 0.5.2로 다시 접속해 공정 저장을 갱신해 주세요.');this.hooks.snapshot(room.state);const state=this.hooks.state().snapshot(),revision=await this.rpc('cr5_commit',{p_room:room.id,p_revision:room.revision,p_state:state,p_receipts:[]});room={...room,state,revision}}if(this.room&&this.room.id!==room.id)throw Error('새로고침 후 다른 방에 참가해 주세요.');this.room=room;this.revision=-1;this.hooks.status('방 '+room.code+' · 참여 확인 중');localStorage.setItem('cozy-room-code',room.code);this.channel=this.client.channel('cr5-room-'+room.id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'cr5_rooms',filter:'id=eq.'+room.id},()=>this.schedule());this.channel.subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')this.hooks.status('실시간 연결 재시도 중 · 저장 상태는 주기적으로 확인합니다.')});await this.pulse();this.timer=setInterval(()=>this.pulse(),750)}
 schedule(){if(!this.scheduled){this.scheduled=true;setTimeout(()=>{this.scheduled=false;this.pulse()},100)}}
 setReady(value){this.ready=value;return this.pulse()}
 async start(){if(!this.room)throw Error('먼저 방을 만들거나 참가해 주세요.');await this.rpc('cr5_start',{p_room:this.room.id});await this.pulse()}
 async enqueue(action,payload){if(!this.room||!this.running||!this.healthy)throw Error('게임 연결과 시작 상태를 확인해 주세요.');const id=crypto.randomUUID();this.outbox.push({id,action,payload:{...payload,_pipeline:1}});this.schedule();return id}
 canSimulate(){return !!this.room&&this.isHost&&this.running&&this.healthy&&!this.busy}
 async pulse(){if(this.busy||!this.room)return;this.busy=true;try{
  if(this.outbox.length)await this.rpc('cr5_sync',{p_room:this.room.id,p_pose:this.revision<0?{}:this.hooks.pose(),p_ready:null});
  for(const a of [...this.outbox]){await this.rpc('cr5_enqueue',{p_room:this.room.id,p_id:a.id,p_action:a.action,p_payload:a.payload});this.outbox=this.outbox.filter(x=>x.id!==a.id)}
  const bundle=await this.rpc('cr5_sync',{p_room:this.room.id,p_pose:this.revision<0?{}:this.hooks.pose(),p_ready:this.ready});this.ready=null;
  const previousHost=this.isHost,previousRevision=this.revision;this.isHost=bundle.room.host_id===this.uid;this.running=bundle.room.running;this.members=bundle.members;const me=this.members.find(m=>m.user_id===this.uid);if(!me)throw Error('참여 정보가 없어요.');this.slot=me.slot;
  if(this.needsReload||!this.isHost||!previousHost||previousRevision!==bundle.room.revision)this.hooks.snapshot(bundle.room.state);this.needsReload=false;
  this.revision=bundle.room.revision;this.room=bundle.room;this.hooks.members(this.members,this.slot,this.isHost,this.running);
  if(this.isHost&&this.running){
   const receipts=[];for(const a of bundle.actions){let accepted=false;try{accepted=this.hooks.action('ABC'[a.slot],a.action,a.payload,this.members)}catch{}receipts.push({id:a.id,accepted:!!accepted,message:this.hooks.state().notice})}
   // Release an offline player's work so another partner can continue it.
   const state=this.hooks.state();for(const field of['owner','counterOwner'])if(state[field]){const member=this.members.find(m=>'ABC'[m.slot]===state[field]);if(!member||Date.now()-Date.parse(member.last_seen)>20000)state[field]=null}
   if(state.jobs)for(const job of Object.values(state.jobs))if(job?.owner){const member=this.members.find(m=>'ABC'[m.slot]===job.owner);if(!member||Date.now()-Date.parse(member.last_seen)>20000)job.owner=null}
   this.revision=await this.rpc('cr5_commit',{p_room:this.room.id,p_revision:this.revision,p_state:state.snapshot(),p_receipts:receipts});
  }else if(!this.isHost){const host=this.members.find(m=>m.user_id===bundle.room.host_id);if(!host||Date.now()-Date.parse(host.last_seen)>20000)await this.rpc('cr5_takeover',{p_room:this.room.id})}
  for(const receipt of bundle.receipts)if(!this.received.has(receipt.id)){this.received.add(receipt.id);this.hooks.receipt(receipt);if(this.received.size>150)this.received.delete(this.received.values().next().value)}
  this.healthy=true;this.hooks.status('방 '+this.room.code+' · '+(this.running?'영업 중':'3명 준비 대기')+' · '+('ABC'[this.slot])+(this.isHost?' · 방장':''));
 }catch(e){this.needsReload=true;this.healthy=false;this.hooks.status('연결 대기 · 진행을 멈추고 재시도합니다. '+e.message)}finally{this.busy=false}}
 async disconnect(){clearInterval(this.timer);if(this.channel)await this.client.removeChannel(this.channel);this.room=null;this.healthy=false}
}
window.ShopRoom=Room;
})();
