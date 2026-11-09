(()=>{'use strict';
const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d'),work=$('work-canvas').getContext('2d');
let game=ShopSave.read()||new ShopGame.Game();
const images={},keys=new Map(),guests=new Map(),spawns=[[160,286],[336,216],[450,280]],queueSlots=[{x:374,y:182},{x:374,y:230},{x:374,y:278}];
const players=['A','B','C'].map((skin,i)=>Object.assign(new ShopEngine.Player(),{skin,x:spawns[i][0],y:spawns[i][1]}));
let player=players[0],loaded=false,last=0,arrival=null,mode=null,panelClock=0,viewCustomer=null,selectedSlot=null,quoteToken=null,speed=1;
let online=false,saveClock=0,workStation='prep',displayAction=null,displaySlot=0,displayMove=null,displayToken=null,priceItemId=null,priceToken=null,priceOptions=null,selectedWorkItemId=null,pendingWork=null;
const workActions=['begin','screw','wipe','replace','rotate','fit','test','cancel','pass'];
let solo=false;
function startSolo(){
 if(online)return;
 if(solo){$('network-modal').hidden=true;return}
 solo=true;
 document.body.classList.add('solo-shop');
 for(const job of Object.values(game.jobs))if(job)job.owner=null;
 game.counterOwner=null;
 player=players[0];
 $('network-modal').hidden=true;
 saveLocal();updatePanel();
}
function visitTask(task){
 if(!task.id)return;
 if(mode)close();
 if(task.id==='day'){act('nextday');updatePanel();return}
 if(task.id==='supply'){open('supply');return}
 const previous=game.busyStation(player.skin);
 if(previous&&task.id!==(previous==='prep'?'repair':'repair-b'))act('pass',{station:previous});
 if(task.id==='display'){
  displaySlot=Math.max(0,game.display.indexOf(null));
  priceItemId=game.ready[0]?.id??null;displayToken=null;
 }
 selectedWorkItemId=task.item??null;
 goStation(task.id);
}
$('shift-next').onclick=()=>visitTask(game.soloTask());
$('goal-open').onclick=()=>{showLobbyPane('goal');$('network-modal').hidden=false};
$('approve-expansion').onclick=()=>{act('upgrade',{kind:'expansion'});updatePanel()};
$('solo-start').onclick=startSolo;
$('solo-follow').onclick=()=>{
 const r=currentRepair();
 if(r?.stage==='handoff'){
  const id=r.item.id;
  if(!act('pass',{station:'prep',transfer:true,itemId:id}))return;
  const job=game.getJob('finish');
  const target=job?.repair.item||game.prepared.find(v=>v.id===id&&game.partStatus(v).available);
  visitTask(target?{id:'repair-b',item:target.id}:game.soloTask());
 }else visitTask({id:'display'});
};
function nextQueuedRepair(){
 return workStation==='prep'?game.pending[0]:game.prepared.find(item=>game.partStatus(item).available);
}
$('relay-menu').onclick=()=>{const people=$('relay-people');people.hidden=!people.hidden;$('relay-menu').setAttribute('aria-expanded',String(!people.hidden))};
for(const b of document.querySelectorAll('[data-relay]'))b.onclick=()=>{
 const r=currentRepair();if(!r)return;
 act('pass',{station:workStation,itemId:r.item.id,to:b.dataset.relay});
 $('relay-people').hidden=true;$('relay-menu').setAttribute('aria-expanded','false');updatePanel();
};
$('relay-next').onclick=()=>{
 const r=currentRepair();
 if(r?.stage==='handoff')act('pass',{station:workStation,itemId:r.item.id,transfer:true,continueQueue:true});
 else if(!r&&nextQueuedRepair()){selectedWorkItemId=nextQueuedRepair().id;stationAction(workStation==='prep'?'repair':'repair-b')}
 updatePanel();
};
const currentRepair=()=>game.getJob(workStation)?.repair||null;const currentOwner=()=>game.getJob(workStation)?.owner||null;
const room=new ShopRoom({state:()=>game,snapshot:data=>{game=ShopGame.Game.restore(data)},pose:()=>({x:player.x,y:player.y,dir:player.dir,walking:player.walking}),status:text=>{$('network-status').textContent=text;if(online)$('save-status').textContent=text},members:applyMembers,action:applyRemote,receipt:r=>{if(cartPending===r.id){cartPending=null;if(r.accepted)cart.clear();put('cart-result',r.message);renderCart()}if(!r.accepted){say(r.message||'작업 요청을 확인해 주세요.');if(pendingWork&&!currentRepair()){pendingWork=null;open('picker')}}updatePanel()}});
function say(t){$('status').textContent=t}
function near(id){const p=ShopEngine.stations.find(s=>s.id===id).point;return Math.hypot(player.x-p.x,player.y-p.y)<(id==='counter'?2:10)}
function stop(){arrival=null;keys.clear();player.path=[];player.walking=false}
function close(){if(mode==='counter')act('release');mode=null;$('camera').hidden=true;$('modal-close').blur?.();canvas.focus?.()}
function open(next){stop();mode=next;$('camera').dataset.mode=next;$('camera').dataset.touchPane=({counter:'offer',work:'work',display:'price'})[next]||'work';$('camera').hidden=false;$('counter-view').hidden=next!=='counter';$('work-view').hidden=next!=='work';$('supply-view').hidden=next!=='supply';$('work-picker').hidden=next!=='picker';$('display-view').hidden=next!=='display';$('modal-close').focus?.();updatePanel()}
function occupied(id){if(id==='counter')return game.counterOwner&&game.counterOwner!==player.skin;if(id==='repair'||id==='repair-b'){const j=game.getJob(id==='repair'?'prep':'finish');return j?.owner&&j.owner!==player.skin}return false}
function stationAction(id){if(id==='counter'){player.dir='front';act('counter');if(!online&&game.counterOwner!==player.skin)return;open('counter')}else if(id==='repair'||id==='repair-b'){workStation=id==='repair'?'prep':'finish';const job=game.getJob(workStation);if(!job&&selectedWorkItemId===null){open('picker');return}if(online)pendingWork={station:workStation,itemId:selectedWorkItemId??job?.repair.item.id,at:Date.now()};const began=act('begin',{station:workStation,...(selectedWorkItemId!==null?{itemId:selectedWorkItemId}:{})});selectedWorkItemId=null;if(began||online)open('work')}else if(id==='display'){if(displayAction==='organize')act('exhibit',{organize:true});displayAction=null;displayMove=null;open('display')}else if(id==='entrance')act('claim');updatePanel()}
function goStation(id){if(document.body.dataset.page!=='map')document.querySelector('#game-nav [data-page=map]').click();if(online&&(!room.running||!room.healthy)){say('세 명이 준비하고 영업을 시작해 주세요.');return}if(occupied(id)){say('다른 고양이가 '+(id==='counter'?'카운터':'작업대')+'를 사용 중이에요.');return}if(near(id)){stationAction(id);return}const s=ShopEngine.stations.find(s=>s.id===id);if(player.setTarget(s.point)){keys.clear();arrival=s;say(s.label+'으로 이동 중이에요. 도착하면 작업 화면을 열어요.')}else say('이동할 수 있는 경로가 없어요.')}
function goTo(to){if(mode||online&&(!room.running||!room.healthy))return;const s=ShopEngine.stationAt(to.x,to.y);if(s&&s.id!=='door'){goStation(s.id);return}stop();if(player.setTarget(s?s.point:to)){arrival=s||null;say('선택한 곳으로 이동하고 있어요.')}else say('가구가 놓인 곳이에요. 빈 바닥을 선택해주세요.')}
function transact(slot=selectedSlot){const c=game.customers[0],q=c&&game.quote(c.id,slot);if(!c||c.id!==viewCustomer||!q)return;act('serve',{id:c.id,slot,price:q.price});updatePanel()}
$('serve').onclick=()=>goStation('counter');$('repair').onclick=()=>{selectedWorkItemId=null;goStation('repair')};$('repair-b').onclick=()=>{selectedWorkItemId=null;goStation('repair-b')};$('exhibit').onclick=()=>{displayAction=null;goStation('display')};$('organize').onclick=()=>{displayAction='organize';goStation('display')};$('receive').onclick=()=>goStation('entrance');$('supply').onclick=()=>open('supply');
$('modal-close').onclick=close;$('accept').onclick=()=>transact();$('decline').onclick=()=>{act('dismiss',{id:viewCustomer});updatePanel()};
for(let i=0;i<6;i++)$('sell'+i).onclick=()=>{selectedSlot=i;quoteToken=null;updatePanel()};
$('trade-sale-select').onchange=e=>{selectedSlot=Number(e.target.value);quoteToken=null;updatePanel()};
$('offer-price').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('propose').onclick()}});
$('propose').onclick=()=>{const offer=Number($('offer-price').value);if(!Number.isSafeInteger(offer)||offer<1){put('deal-range','금액은 1원 이상의 정수로 입력해 주세요.');return}act('negotiate',{id:viewCustomer,slot:selectedSlot,offer});updatePanel()};
for(const [id,delta]of [['offer-less',-5],['offer-more',5]])$(id).onclick=()=>{$('offer-price').value=Math.min(Number.MAX_SAFE_INTEGER,Math.max(1,Number($('offer-price').value)+delta))};
for(let i=0;i<3;i++)$('screw'+i).onclick=()=>{if(near(workStation==='prep'?'repair':'repair-b'))act('screw',{index:i});updatePanel()};
$('replace').onclick=()=>{if(near(workStation==='prep'?'repair':'repair-b'))act('replace');updatePanel()};$('test').onclick=()=>{if(near(workStation==='prep'?'repair':'repair-b'))act('test');updatePanel()};
$('cancel-repair').onclick=()=>{act('cancel');close();updatePanel()};
const cart=new Map();
let cartPending=null,cartSignature='';
function changeCart(part,delta){
 if(cartPending)return;
 const count=Math.max(0,Math.min(99,(cart.get(part)||0)+delta));
 if(count)cart.set(part,count);else cart.delete(part);
 put('cart-result','');renderCart();
}
function renderCart(){
 const signature=JSON.stringify([...cart])+Boolean(cartPending);
 if(signature!==cartSignature){
  cartSignature=signature;
  const list=$('cart-lines');list.textContent='';
  for(const [part,n] of cart){
   const remove=document.createElement('button');remove.type='button';
   remove.textContent=ShopGame.parts[part].name+' '+n*3+'개 −';
   remove.setAttribute('aria-label',ShopGame.parts[part].name+' 3개 빼기');
   remove.disabled=!!cartPending;remove.onclick=()=>changeCart(part,-1);list.append(remove);
  }
  for(const key of Object.keys(ShopGame.parts)){
   const n=cart.get(key)||0,button=$('order-'+key);
   button.textContent=n?'✓ '+n*3+'개 · 추가':'＋ 담기';
   button.disabled=!!cartPending;
  }
 }
 const total=[...cart].reduce((sum,[part,n])=>sum+ShopGame.parts[part].price*n,0);
 put('cart-total',[...cart.values()].reduce((a,b)=>a+b,0)*3+'개 · '+total+'원 / 보유 '+game.money+'원');
 $('cart-confirm').disabled=!cart.size||!!cartPending||total>game.money||game.closed||online&&!room.healthy;
}
for(const part of Object.keys(ShopGame.parts))$('order-'+part).onclick=()=>changeCart(part,1);
$('cart-confirm').onclick=async()=>{
 if($('cart-confirm').disabled||cartPending)return;
 const payload={cart:Object.fromEntries(cart)};
 if(online){
  cartPending='sending';renderCart();
  try{cartPending=await room.enqueue('order',payload);put('cart-result','결제 확인 중')}
  catch(e){cartPending=null;put('cart-result',e.message)}
 }else{
  if(act('order',payload))cart.clear();
  put('cart-result',game.notice);
 }
 renderCart();
};

$('nextday').onclick=()=>{act('nextday');updatePanel()};$('speed').onchange=e=>{speed=Number(e.target.value)||1};
function put(id,text){if($(id).textContent!==text)$(id).textContent=text}
function updatePanel(){
 const c=game.campaign;
 for(const id of ['shift-gauge','contract-gauge']){const gauge=$(id);gauge.max=c.target;gauge.value=Math.min(c.sales,c.target);gauge.setAttribute('aria-label','주간 매출 '+c.sales+' / '+c.target+'원')}
 put('solo-summary',game.day+'일차 · 보유 '+game.money+'원 · 주간 매출 '+c.sales+'원');
 const phase=c.permit?'확장 준비 완료':c.level?'주간 납품':'첫 별관';
 put('shift-total',c.permit?phase:phase+' · '+c.sales+'/'+c.target+'원');
 put('goal-days',c.permit?'원할 때 승인서를 사용하세요.':Math.max(0,c.start+7-game.day)+'일 남음');
 put('solo-start',game.elapsed>1||game.sold?'내 상점 이어하기':'혼자 영업 시작');
 $('approve-expansion').hidden=!c.permit;
 $('approve-expansion').disabled=online&&(!room.running||!room.healthy);
 $('shift-next').hidden=!solo||online;
 if(solo&&!online){const task=game.soloTask();put('shift-next',task.label);$('shift-next').disabled=!task.id||!!arrival}
 put('lobby-contract',game.campaignSummary());
 if(online)$('solo-start').disabled=true;
 $('visit-annex').hidden=!game.campaign.level;
 if($('annex-room').open)updateAnnex();if(pendingWork){if(game.getJob(pendingWork.station)?.repair.item.id===pendingWork.itemId)pendingWork=null;else if(Date.now()-pendingWork.at>12000){pendingWork=null;if(mode==='work')open('picker');say('인수를 확인하지 못했어요. 목록과 연결 상태를 확인하고 다시 선택해 주세요.')}}const hour=Math.floor(game.time),minute=Math.min(59,Math.floor((game.time-hour)*60));put('shop-hud',game.day+'일차 · '+String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0')+' · '+game.period+' · '+game.money+'원');
 put('rail-hud',$('shop-hud').textContent);
 put('queue','응대 손님 '+game.customers.length+' / 1명 · 수리 전 '+game.pending.length+'개 · 수리 완료 '+game.ready.length+'개 · 진열 '+game.display.filter(Boolean).length+'/'+game.capacity);put('customer',game.customers[0]?'맨 앞 손님 · '+(game.customers[0].type==='buy'?'진열품 구매':'고장품 매각'):'손님을 기다리고 있어요');
 put('stock',Object.entries(ShopGame.parts).map(([p,v])=>v.name+' '+game.stock[p]+'개').join(' · '));put('deliveries',game.deliveries.filter(d=>d.state!=='claimed').map(d=>ShopGame.parts[d.part].name+' '+(d.state==='arrived'?'입구 도착':Math.ceil(d.eta)+'초 후 도착')).join(' / ')||'배송 중인 부품 없음');
 put('inventory',game.display.map((v,i)=>(i+1)+'번 '+(v?v.name:'빈 칸')).join(' · '));$('nextday').hidden=!game.closed;
 if(mode==='counter'){
 const c=game.customers[0],available=!!c&&c.arrived&&!game.closed&&game.counterOwner===player.skin;
 if(viewCustomer!==c?.id){selectedSlot=null;quoteToken=null}viewCustomer=c?.id||null;
 if(c?.type==='buy'&&!game.display[selectedSlot])selectedSlot=game.display.findIndex(Boolean);
 const q=c&&game.quote(c.id,selectedSlot);$('portrait').hidden=!c;if(c)$('portrait').src=window.GAME_ASSETS['portrait-'+c.species];
 $('counter-bg').style.filter=game.time>=19?'brightness(.55) saturate(.8)':game.time>=16?'sepia(.22) brightness(.9)':'none';
 const reaction=q?.reaction||'neutral';$('reaction').dataset.mood=reaction;put('reaction',q?.state==='agreed'?'가격에 동의':reaction==='negative'?'내 제안 거절 · 손님 역제안':'거래 제안');$('trade-kind').hidden=!c;put('trade-kind',c?.type==='repair'?'고장품 매입':'복원품 판매');
 put('counter-name',c?c.name+' · '+({dog:'강아지',rabbit:'토끼',mouse:'생쥐',parrot:'앵무새',snake:'뱀'})[c.species]:'오늘도 수고했어요');
 put('dialogue',game.closed?'영업이 마감됐어요.':!c?(game.lastDeparture&&game.elapsed-game.lastDeparture.at<40?game.lastDeparture.reason:'아직 손님이 없네요. 잠시 기다려볼까요?'):!c.arrived?'손님이 앞자리로 이동하고 있어요…':q?.response|| (c.species==='snake'?'“이 물건의 주인은 묻지 마시오. '+(q?.price||0)+'원이면 넘기지. 감정은 당신 몫이오.”':c.type==='repair'?'“'+({pot:'손잡이가 깨졌어요. 이 주전자',clock:'바늘이 멈췄어요. 이 시계',box:'멜로디가 끊겨요. 이 음악상자',radio:'소리가 잘 안 나요. 이 라디오'}[c.item.kind]||('손볼 곳이 있는 '+c.item.name))+', '+(q?.price||0)+'원에 사 주실래요?”':'“진열된 물건을 사고 싶어요. 어떤 걸 보여주시겠어요?”'));
 $('trade-sale-select').hidden=c?.type!=='buy';const saleToken=JSON.stringify(game.display.map(x=>x?[x.id,x.askingPrice||x.price]:null));if($('trade-sale-select').dataset.token!==saleToken){$('trade-sale-select').dataset.token=saleToken;$('trade-sale-select').textContent='';game.display.forEach((x,i)=>{if(!x)return;const option=document.createElement('option');option.value=i;option.textContent=(i+1)+'번 '+x.name+' · '+(x.askingPrice||x.price)+'원';$('trade-sale-select').append(option)})}$('trade-sale-select').value=selectedSlot??'';
 $('accept').hidden=!q;$('accept').disabled=!available||q?.state==='priced-out';put('accept',q?.state==='priced-out'?'가격 조정 필요':q?q.price+'원에 '+(c.type==='repair'?'매입 확정':'판매 확정'):'거래 확정');$('decline').disabled=!available;
 for(let i=0;i<6;i++){const b=$('sell'+i),v=game.display[i];b.hidden=c?.type!=='buy'||i>=game.capacity;b.disabled=!available||!v;b.textContent=v?(i===selectedSlot?'선택: ':'')+v.name+' · '+(v.askingPrice||v.price)+'원':'빈 진열칸';b.setAttribute('aria-pressed',String(i===selectedSlot))}
 $('bargain').hidden=!q;
 if(q){put('deal-item',q.item.name+' · '+(c.type==='repair'?'고장품 매입':'수리 완료품 판매'));put('deal-reference',c.type==='repair'?'물품의 상태와 부품비를 확인하고 제안해 주세요.':'검사를 마친 진열품입니다.');put('deal-price','손님 '+(q.state==='agreed'?'합의가':'현재 제안')+' '+q.price+'원');put('deal-range','금액 자유 제안 · 흥정 '+q.rounds+'/'+q.maxRounds+'회 · 보유 '+game.money+'원');
 const token=c.id+':'+q.key;if(token!==quoteToken){$('offer-price').value=c.type==='buy'?q.listPrice:q.price;quoteToken=token}$('offer-price').min=q.min;$('offer-price').removeAttribute('max');
 const disabled=!available||q.rounds>=q.maxRounds;for(const id of ['offer-price','propose','offer-less','offer-more'])$(id).disabled=disabled;
 }
 }
 if(mode==='display')updateDisplay();
 if(mode==='supply')renderCart();
 if(mode==='picker')updatePicker();
 if(mode==='work'){
 const r=currentRepair(),mine=r&&currentOwner()===player.skin,stage=r?.stage;
 put('work-title',(workStation==='prep'?'A공정 · ':'B공정 · ')+(r?'#'+r.item.id+' '+r.item.name+' · '+(currentOwner()?currentOwner()+' 담당':'인수 대기'):(workshop.result()?(workStation==='prep'?'중간 보관함 전달 완료':'복원 완료'):(pendingWork?'물품 인수 확인 중':'물품 인수 대기'))));
 const closeup= document.body.classList.contains('game-layout') && matchMedia('(orientation:landscape)').matches;
 const mobileGuide={inspect:'오른쪽에서 점검할 부위를 누르세요.',clean:'오른쪽에서 세척할 부위를 누르세요.',screws:'오른쪽 나사 풀기 버튼을 네 번 누르세요.',assemble:r?.item.process==='surface'?'오른쪽에서 복원할 부위를 선택하세요.':'각도를 맞춘 뒤 맞춰 끼우기를 누르세요.',replace:'오른쪽에서 재료를 고른 뒤 장착을 누르세요.',test:'오른쪽에서 최종 검사 시작을 누르세요.'};
 put('work-instruction',r?(workshop.instruction(r)):!workshop.result()?'목록에서 물건을 선택하고 인수 상태를 확인해 주세요.':workStation==='prep'?'B 담당자가 인수할 수 있어요. A 담당자는 다음 물건을 시작해 주세요.':'C 담당자가 완료품을 진열하면 판매할 수 있어요.');
 put('work-side-instruction',r?.stage==='replace'?'필요 부품: '+ShopGame.parts[r.item.part].name+(closeup?' · 재료를 표시된 곳으로 끌어 주세요.':' · 물건의 표시 위치로 끌어 놓으세요.'):r?.stage==='assemble'&&r.item.process!=='surface'?'부품 '+(r.fitted+1)+'/3 · 현재 '+r.angle*90+'° / 목표 '+r.targets[r.fitted]*90+'° · 방향을 맞춰 조립하세요.':'');
 const phase=!r?(workshop.result()?4:0):workStation==='prep'?(stage==='inspect'?0:stage==='handoff'?3:1):(stage==='replace'?0:stage==='assemble'?1:stage==='test'?2:3);const labels=workStation==='prep'?['손상 점검','분해·세척','인계 준비','B 대기함 전달']:['부품 교체','조립·복원','최종 검사','C 진열 대기'];
 for(const [i,b]of [...document.querySelectorAll('#work-steps li')].entries()){b.textContent=labels[i];b.className=i<phase?'done':i===phase?'current':'';b.setAttribute('aria-current',i===phase?'step':'false')}
 for(const id of['screw0','screw1','screw2','replace','test','wipe-item','rotate-part','fit-part'])$(id).hidden=true;
 const next=nextQueuedRepair(),handoff=mine&&stage==='handoff';
 $('solo-follow').hidden=!solo||online||!(handoff||!r&&game.ready.length&&game.display.includes(null));
 put('solo-follow',handoff?'직접 복원 →':'진열대로 →');
 $('relay-menu').hidden=solo&&!online||!mine||handoff;
 if(solo&&!online||!mine||handoff){$('relay-people').hidden=true;$('relay-menu').setAttribute('aria-expanded','false')}
 for(const b of document.querySelectorAll('[data-relay]')){
  const who=b.dataset.relay;
  b.hidden=who===player.skin;
  b.disabled=game.closed||!!game.busyStation(who)||game.counterOwner===who||online&&(!room.healthy||!room.members.some(m=>'ABC'[m.slot]===who&&Date.now()-Date.parse(m.last_seen)<20000));
 }
 $('relay-next').hidden=solo&&!online&&handoff||!handoff&&(!!r||!next);
 $('relay-next').disabled=game.closed||!!pendingWork||online&&!room.healthy;
 put('relay-next',handoff?(next&&game.prepared.length<5?'B로 넘기고 다음 물건 →':'B로 넘기기 →'):'다음 물건 →');
 $('cancel-repair').hidden=!mine;$('pass-repair').hidden=!mine;
 $('work-progress').value=!r?(workshop.result()?1:0):stage==='testing'?.75+Math.min(1,(3-r.testLeft)/3)*.25:phase*.25;
 paintWork(r);
 }
 expansionPanel();put('modal-notice',mode==='counter'?'':game.notice)
}
const rabbitClean=new Image();rabbitClean.src='assets/rabbit-clean.png';
const tradeRoom=document.createElement('canvas');tradeRoom.width=512;tradeRoom.height=342;
const itemAtlas=new Image();
const itemArtReady=new Promise((resolve,reject)=>{
 itemAtlas.onload=resolve;
 itemAtlas.onerror=()=>{
   itemAtlas.onload=resolve;
   itemAtlas.onerror=()=>reject(Error('수리 물품 그림을 불러오지 못했어요. 다시 열어 주세요.'));
   itemAtlas.src=window.SHOP_ITEM_BACKUP;
 };
 itemAtlas.src='assets/antiques-atlas.png';
});
function drawAntique(c,v,state,x,y,w,h){
 if(!v||!itemAtlas.complete||!itemAtlas.naturalWidth)return;
 const index=ShopGame.catalog.findIndex(i=>i.kind===v.kind);if(index<0)return;
 const cw=itemAtlas.naturalWidth/4,ch=itemAtlas.naturalHeight/6,row=(index<4?0:3)+({broken:0,open:1,restored:2}[state]??0);
 const ratio=Math.min(1,300/w);x+=w*(1-ratio)/2;y+=h*(1-ratio)/2;w*=ratio;h*=ratio;c.save();c.imageSmoothingEnabled=false;c.drawImage(itemAtlas,index%4*cw,row*ch,cw,ch,x,y,w,h);c.restore();
}
function drawTradeScene(c,customer,item){const bg=images['counter-scene'];c.clearRect(0,0,1008,568);if(!bg)return;c.imageSmoothingEnabled=false;c.drawImage(bg,0,0,1008,568);const night=Math.max(0,Math.min(1,(game.time-17)/3));if(night){c.fillStyle='rgba(23,23,44,'+(night*.12)+')';c.fillRect(0,0,1008,568);c.save();c.beginPath();for(const rect of [[643,63,80,74],[734,63,80,74],[643,149,80,90],[734,149,80,90]])c.rect(...rect);c.clip();c.fillStyle='rgba(16,29,55,'+(night*.85)+')';c.fillRect(630,50,205,205);c.restore()}const portrait=customer&&images['portrait-'+customer.species];if(portrait){const h=340,w=portrait.naturalWidth/portrait.naturalHeight*h;c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(portrait,650,126,w,h)}c.imageSmoothingEnabled=false;c.drawImage(bg,0,454,1008,114,0,454,1008,114);if(item)ShopItemArt.surface(c,itemAtlas,item,customer.type==='buy'?'restored':'broken',490,493,300,280)}
function drawItem(c,v,x,y,scale=1){ShopWorldItems.draw(c,images['world-items'],v,x/2,y/2,2,scale<1)}
const workshop=new ShopWorkshop({station:()=>workStation,canvas:$('work-canvas'),repair:currentRepair,pending:()=>!!pendingWork,stock:()=>game.stock,findResult:(station,id)=>{const list=station==='prep'?[...game.prepared,...(game.getJob('finish')?[game.getJob('finish').repair.item]:[])]:[...game.ready,...game.display.filter(Boolean)];return list.find(x=>x.id===id)||null},visible:()=>mode==='work',canWork:()=>!!currentRepair()&&currentOwner()===player.skin&&(!online||room.running&&room.healthy),send:(type,p)=>{if(solo&&!online&&type==='pass'&&p.transfer){$('solo-follow').click();return true}return act(type,p)},announce:text=>{put('work-instruction',text);put('modal-notice',text)},draw:drawAntique});
function paintWork(r){workshop.render(r)}
function tag(x,y,text){ctx.font='18px "Noto Sans CJK KR", "Malgun Gothic", sans-serif';ctx.textAlign='center';const w=Math.max(70,ctx.measureText(text).width+16);ctx.fillStyle='#30242de6';ctx.fillRect(x-w/2,y-20,w,27);ctx.fillStyle='#ffedbf';ctx.fillText(text,x,y)}
function paintPlayer(p){const x=Math.round(p.x)*2,y=Math.round(p.y)*2;ctx.fillStyle='#30242d40';ctx.beginPath();ctx.ellipse(x,y,12,3,0,0,Math.PI*2);ctx.fill();ctx.drawImage(images[p.skin+'-'+p.dir+'-'+p.frame()],x-40,y-100,80,108);if(p===player){ctx.strokeStyle='#e8d18d';ctx.beginPath();ctx.ellipse(x,y+1,14,4,0,0,Math.PI*2);ctx.stroke()}}
function paintGuest(g){
 if(g.species==='snake'){
  const snake=images['portrait-snake'];
  if(snake)ctx.drawImage(snake,g.x*2-36,g.y*2-74+Math.round(Math.sin(g.phase*6)*2),72,74);
  return;
 }
 const base=g.leaving?0:2,col=base+(g.walking&&Math.floor(g.phase*2)%2?1:0),idle=images['npc-'+g.species+'-'+base],pose=images['npc-'+g.species+'-'+col];
 const x=Math.round(g.x)*2-36,y=Math.round(g.y)*2-96,head={dog:25,rabbit:31,mouse:25,parrot:23}[g.species];
 ctx.fillStyle='#30242d40';ctx.beginPath();ctx.ellipse(g.x*2,g.y*2,13,3,0,0,Math.PI*2);ctx.fill();
 // Shared head pixels stay fixed during a walk; only the lower body changes pose.
 if(g.species==='rabbit'&&!g.leaving&&rabbitClean.complete&&rabbitClean.naturalWidth){ctx.drawImage(rabbitClean,297,163,492,1088,x+12,y+4,48,92)}else{
 ctx.drawImage(pose,0,head,36,48-head,x,y+head*2,72,(48-head)*2);
 const trim=g.species==='mouse'?8:0;ctx.drawImage(idle,0,trim,36,head-trim,x,y+trim*2,72,(head-trim)*2);
 }
}
const paintErrors=new Set();function reportPaintError(error){const key=error?.message||String(error);if(!paintErrors.has(key)){paintErrors.add(key);console.error('장면 표시 오류:',error)}}
function draw(){ctx.clearRect(0,0,1024,684);ctx.imageSmoothingEnabled=false;ctx.drawImage(images.room,0,0,1024,684);
 // Each furniture silhouette has its own exact depth; side clearance keeps sprites out of its edge.
 const furniture=[['table',258],['repair',260],['plant',307],['crates',242],['post-left',342],['post-right',342]],layers=(solo&&!online?[player]:players).map(p=>({depth:p.y,paint:()=>{
  // Only feet behind the rear edge of the desk are occluded. The bell and
  // the counter bitmap can never paint over a walking character's torso.
  if(p.x>=335&&p.x<=492&&p.y<=123){ctx.save();ctx.beginPath();ctx.rect(0,0,1024,236);ctx.clip();paintPlayer(p);ctx.restore()}
  else paintPlayer(p)
 }}));
 for(const[n,d]of furniture)layers.push({depth:d,paint:()=>{ctx.drawImage(images['foreground-'+n],0,0,1024,684);if(n==='table')ShopWorldItems.table(ctx,images.room,game.capacity,2)}});
 for(const guest of guests.values())layers.push({depth:guest.y,paint:()=>paintGuest(guest)});
 layers.push({depth:259,paint:()=>game.display.forEach((v,i)=>{if(v){const cols=game.capacity>4?3:2;drawItem(ctx,v,((cols===3?200:210)+i%cols*(cols===3?36:54))*2,(190+Math.floor(i/cols)*38)*2,cols===3?.8:1)}})});layers.sort((a,b)=>a.depth-b.depth).forEach(l=>{try{l.paint()}catch(e){reportPaintError(e)}});
 const t=game.time;ShopLighting.paint(ctx,t);
 // Clock hands are driven by the same simulation clock as customers and deliveries.
 ctx.save();ctx.translate(596,68);ctx.fillStyle='#e3c69e';ctx.beginPath();ctx.arc(0,0,23,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#644636';ctx.lineWidth=2;for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.beginPath();ctx.moveTo(Math.sin(a)*20,-Math.cos(a)*20);ctx.lineTo(Math.sin(a)*23,-Math.cos(a)*23);ctx.stroke()}for(const[a,l]of[[t*Math.PI/6,12],[(t%1)*Math.PI*2,18]]){ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.sin(a)*l,-Math.cos(a)*l);ctx.stroke()}ctx.restore();
 if(game.deliveries.some(d=>d.state==='arrived')){ctx.fillStyle='#c49c65';ctx.fillRect(802,607,32,26);ctx.strokeStyle='#46303a';ctx.lineWidth=3;ctx.strokeRect(802,607,32,26);ctx.fillStyle='#ead6ad';ctx.fillRect(816,608,5,24)}
 if(game.counterOwner)tag(824,190,game.counterOwner+' · 카운터 사용 중');for(const ping of game.pings){const p=players.find(x=>x.skin===ping.skin);if(p)tag(p.x*2,p.y*2-112,ping.symbol)}put('direction',({front:'정면',back:'뒷면',left:'왼쪽',right:'오른쪽'})[player.dir]+' · '+(player.walking?'걷는 중':'쉬는 중'))}
function moveGuests(dt){for(const[id,g]of guests)if(!game.customers.some(c=>c.id===id)){if(!g.leaving){g.leaving=true;g.setTarget({x:340,y:282});g.exitStage=0}g.update(dt);if(!g.path.length){if(!g.exitStage){g.setTarget({x:409,y:336});g.exitStage=1}else guests.delete(id)}}
 game.customers.forEach((c,i)=>{let g=guests.get(c.id);if(!g){if(players.some(p=>(online||!solo||p===player)&&Math.hypot(p.x-409,p.y-336)<30)||[...guests.values()].some(p=>Math.hypot(p.x-409,p.y-336)<32)){c.arrived=false;return}g=Object.assign(new ShopEngine.Player(),{x:409,y:336,name:c.name,species:c.species,dir:'back',slot:-1,speed:88});guests.set(c.id,g)}if(g.slot!==i){g.setTarget(queueSlots[i]);g.slot=i;c.arrived=false}const old={x:g.x,y:g.y,phase:g.phase,path:g.path.slice()};g.update(dt);const blocked=[...guests.values()].some(other=>other!==g&&!other.leaving&&Math.hypot(g.x-other.x,g.y-other.y)<32&&Math.hypot(old.x-other.x,old.y-other.y)>=Math.hypot(g.x-other.x,g.y-other.y));if(blocked){Object.assign(g,old);g.walking=false}g.dir='back';c.arrived=i===0&&!g.path.length&&Math.hypot(g.x-queueSlots[0].x,g.y-queueSlots[0].y)<2})}
let lastFocus;
function trackPlayer(){const focus=Math.round(player.y-20)/342;if(focus!==lastFocus){canvas.style.setProperty('--focus',focus);lastFocus=focus}}
function tick(t){const dt=last?Math.min(.1,(t-last)/1000):0;last=t;const previous=game.notice;if((!online&&$('network-modal').hidden)||room.canSimulate())game.tick(dt*(online?1:speed));moveGuests(online&&!room.running?0:dt);players.forEach(p=>{if(!online||p===player)p.update(dt,p===player&&!mode&&(!online||room.running&&room.healthy)?[...keys.values()].at(-1):null)});saveClock+=dt;if(!online&&saveClock>4){saveClock=0;saveLocal()}if(arrival&&!player.path.length){const s=arrival;arrival=null;player.dir=s.face;if(s.id==='door')say(s.label+'에 도착했어요.');else stationAction(s.id)}if(game.notice!==previous)say(game.notice);if(game.closed&&(mode==='work'||mode==='counter'))close();panelClock+=dt;if(panelClock>.1){updatePanel();panelClock=0}trackPlayer();draw();requestAnimationFrame(tick)}
canvas.addEventListener('pointerdown',e=>{if(!loaded||mode)return;const r=canvas.getBoundingClientRect();goTo({x:(e.clientX-r.left)*512/r.width,y:(e.clientY-r.top)*342/r.height})});
document.body.dataset.ops='actions';
for(const button of document.querySelectorAll('button[data-ops]'))button.onclick=()=>{
 document.body.dataset.ops=button.dataset.ops;
 for(const tab of document.querySelectorAll('button[data-ops]'))tab.setAttribute('aria-pressed',String(tab===button));
};
const keyboard={ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right',ArrowUp:'back',w:'back',W:'back',ArrowDown:'front',s:'front',S:'front'};
window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;
 if(!$('network-modal').hidden)return;
 if(e.key==='Escape'){
  if(mode)close();else if(document.body.dataset.page!=='map')document.querySelector('#game-nav [data-page=map]').click();
  return;
 }
 if(document.body.dataset.page!=='map'||!loaded||mode||/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)||!keyboard[e.key])return;e.preventDefault();arrival=null;keys.delete(e.code);keys.set(e.code,keyboard[e.key])});window.addEventListener('keyup',e=>keys.delete(e.code));
for(const b of document.querySelectorAll('[data-move]')){const release=()=>keys.delete('touch');b.addEventListener('pointerdown',e=>{if(!loaded||mode)return;e.preventDefault();b.setPointerCapture(e.pointerId);arrival=null;keys.set('touch',b.dataset.move)});b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release)}
window.addEventListener('blur',stop);document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden)stop()});for(const b of document.querySelectorAll('[data-character]'))b.onclick=()=>{if(online)return;close();stop();player=players.find(p=>p.skin===b.dataset.character);for(const c of document.querySelectorAll('[data-character]'))c.setAttribute('aria-pressed',String(c===b));say(player.skin+' 고양이를 선택했어요.')};
$('reset').onclick=()=>{if(online){say('온라인에서는 자신의 캐릭터만 이동할 수 있어요.');return}close();stop();players.forEach((p,i)=>{p.x=spawns[i][0];p.y=spawns[i][1];p.path=[];p.dir='front';p.walking=false});say('캐릭터 위치를 초기화했어요. 영업 상태는 유지됩니다.')};
function saveLocal(){if(online)return;const ok=ShopSave.write(game);$('save-status').textContent=ok?'오프라인 · '+new Date().toLocaleTimeString('ko-KR')+' 저장':'저장 공간을 확인해 주세요. 저장 파일을 받을 수 있어요.'}
function applyRemote(skin,type,p,members){
 if(p._pipeline!==1)return game.fail('세 명 모두 최신 버전으로 새로고침해 주세요.');
 const needs={counter:'counter',serve:'counter',negotiate:'counter',dismiss:'counter',exhibit:p.commission?null:'display',claim:'entrance'},station=workActions.includes(type)?(p.station==='finish'?'repair-b':'repair'):needs[type];
 if(station){const member=members.find(m=>'ABC'[m.slot]===skin),point=ShopEngine.stations.find(s=>s.id===station).point;if(!member||Math.hypot(member.x-point.x,member.y-point.y)>25)return game.fail('해당 작업 위치에 도착한 뒤 시도해 주세요.')}
 return game.action(skin,type,p);
}
let soundEnabled=false,audioContext=null;function tone(){if(!soundEnabled)return;try{audioContext??=new(window.AudioContext||window.webkitAudioContext)();audioContext.resume();const o=audioContext.createOscillator(),gain=audioContext.createGain();o.type='sine';o.frequency.setValueAtTime(620,audioContext.currentTime);o.frequency.exponentialRampToValueAtTime(920,audioContext.currentTime+.06);gain.gain.setValueAtTime(.035,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.12);o.connect(gain);gain.connect(audioContext.destination);o.start();o.stop(audioContext.currentTime+.13)}catch{}}
function act(type,p={}){if(workActions.includes(type))p={...p,station:p.station||workStation};tone();if(online){room.enqueue(type,p).catch(e=>say(e.message));return false}const result=game.action(player.skin,type,p);say(game.notice);saveLocal();return result}
let memberInitialized=false,lastRunning=false;
function applyMembers(members,slot,isHost,running){
 const selected=players[slot];if(!memberInitialized){player=selected;memberInitialized=true;const me=members.find(m=>m.slot===slot);if(me){player.x=me.x;player.y=me.y}player.path=[];keys.clear()}
 for(const m of members){const p=players[m.slot];if(p!==player){p.x=m.x;p.y=m.y;p.dir=m.dir;p.walking=m.walking;p.phase=(p.phase+.12)%1}}
 for(const b of document.querySelectorAll('[data-character]')){b.disabled=true;b.setAttribute('aria-pressed',String(b.dataset.character===player.skin))}
 $('ready-room').disabled=running||!!members.find(m=>m.slot===slot)?.ready;$('speed').disabled=true;$('save-now').disabled=true;$('restore-save').disabled=true;$('backup-save').disabled=true;$('create-room').disabled=true;$('join-room').disabled=true;$('connect-server').disabled=true;$('start-room').disabled=!isHost||running||members.length!==3||members.some(m=>!m.ready);
 const list=$('room-members');list.textContent='';for(let i=0;i<3;i++){const m=members.find(m=>m.slot===i),row=document.createElement('p');row.textContent='ABC'[i]+' · '+(m?m.name+' · '+(Date.now()-Date.parse(m.last_seen)>20000?'접속 끊김':m.ready?'준비 완료':'준비 중'):'동료를 기다리는 중');list.append(row)}
 put('network-close',running?'가게로 돌아가기':'대기실 접기');if(running&&!lastRunning)$('network-modal').hidden=true;lastRunning=running;
}
function displayAct(p){if(!near('display')){say('진열대 앞에 도착한 뒤 작업해 주세요.');return}act('exhibit',p);displayToken=null;updatePanel()}
function displayAllowed(){return !game.closed&&!game.busyStation(player.skin)&&(!online||room.running&&room.healthy)}
function chooseDisplaySlot(i){if(displayMove){displayAct({fromSlot:displayMove.slot,itemId:displayMove.id,slot:i,targetId:game.display[i]?.id??null});displayMove=null}displaySlot=i;displayToken=null;updateDisplay()}
function updateDisplay(){
 if(displaySlot>=game.capacity)displaySlot=0;const selected=game.display[displaySlot],allowed=displayAllowed(),empty=game.display.filter(x=>!x).length;
 updatePriceForm(allowed,selected);
 put('display-summary','진열 '+game.display.filter(Boolean).length+' / '+game.capacity+'칸 · 완료품 보관 '+game.ready.length+'개 · 빈칸 '+empty+'개');
 put('display-detail',selected?(displaySlot+1)+'번 칸 · #'+selected.id+' '+selected.name+' · 상태 '+selected.condition+'/100 · 판매가 '+(selected.askingPrice||selected.price)+'원 / 기준가 '+selected.price+'원 · B 담당 '+(selected.finishedBy||'이전 작업자'):(displaySlot+1)+'번 칸 · 빈 진열칸 · 아래 완료품을 선택해 주세요.');
 put('display-prompt',!allowed?'수리 공정을 맡고 있거나 영업·연결을 확인 중이에요. 공정을 내려놓고 영업 중에 진열해 주세요.':displayMove?'옮길 칸을 누르세요. 물건이 있는 칸을 누르면 서로 자리를 바꿉니다.':selected?'이 물건은 카운터에서 판매할 수 있어요. 다른 완료품은 빈칸을 선택해 진열하세요.':'아래 완료품의 「이 칸에 진열」 버튼을 누르세요.');
 $('display-withdraw').disabled=!allowed||!selected;$('display-move').disabled=!allowed||!selected;$('display-move').textContent=displayMove?'위치 옮기기 취소':'선택 진열품 위치 옮기기';$('display-auto').disabled=!allowed||!empty||!game.ready.some(x=>Number.isSafeInteger(x.askingPrice));$('display-sort').disabled=!allowed||!game.ready.length;
 const token=JSON.stringify([displaySlot,displayMove,priceItemId,game.display,game.ready,allowed,itemAtlas.complete&&itemAtlas.naturalWidth>0]);if(token===displayToken)return;
 const scene=$('display-room').getContext('2d'),table=tradeRoom.getContext('2d');table.imageSmoothingEnabled=false;if(images.room){table.drawImage(images.room,0,0,512,342);ShopWorldItems.table(table,images.room,game.capacity);const cols=game.capacity>4?3:2;game.display.forEach((v,i)=>{if(v){try{ShopWorldItems.draw(table,images['world-items'],v,(cols===3?200:210)+i%cols*(cols===3?36:54),190+Math.floor(i/cols)*38,1,cols===3)}catch(e){reportPaintError(e)}}});scene.imageSmoothingEnabled=false;scene.drawImage(tradeRoom,150,125,180,145,0,0,760,612);}const shelf=$('display-slots');shelf.textContent='';shelf.className='display-cabinet '+(game.capacity>4?'expanded':'');
 for(let i=0;i<game.capacity;i++){const item=game.display[i],b=document.createElement('button');b.className='display-slot'+(displaySlot===i?' selected':'');b.type='button';b.disabled=!allowed;b.setAttribute('aria-pressed',String(displaySlot===i));b.setAttribute('aria-label',(i+1)+'번 진열칸 · '+(item?'#'+item.id+' '+item.name+' · 판매가 '+(item.askingPrice||item.price)+'원':'빈칸'));const tag=document.createElement('span');tag.className='display-label';tag.textContent=(i+1)+'번 · '+(item?item.name:'빈칸');const price=document.createElement('strong');price.textContent=item?(item.askingPrice||item.price)+'원':'';b.append(tag,price);b.onclick=()=>chooseDisplaySlot(i);shelf.append(b)}
 const ready=$('display-ready');ready.textContent='';if(!game.ready.length){const text=document.createElement('p');text.textContent='B공정의 최종 검사가 끝나면 완료품이 이곳에 들어와요.';ready.append(text)}
 for(const item of game.ready){const b=document.createElement('button');b.className='ready-price-slot'+(priceItemId===item.id?' selected':'');b.type='button';const image=document.createElement('canvas');image.width=128;image.height=128;drawAntique(image.getContext('2d'),item,'restored',0,0,128,128);const text=document.createElement('span');text.textContent='#'+item.id+' '+item.name+' · '+(item.askingPrice?item.askingPrice+'원':'가격 미설정');b.append(image,text);b.onclick=()=>{priceItemId=item.id;priceToken=null;displayToken=null;updateDisplay()};ready.append(b)}
 displayToken=token;
}
function updatePriceForm(allowed,selected){const items=[...game.ready,...game.display.filter(Boolean)];if(!items.some(x=>x.id===priceItemId))priceItemId=selected?.id??items[0]?.id??null;const item=items.find(x=>x.id===priceItemId),options=JSON.stringify(items.map(x=>[x.id,x.name,game.ready.includes(x)]));if(priceOptions!==options){priceOptions=options;const select=$('display-price-item');select.textContent='';for(const x of items){const option=document.createElement('option');option.value=x.id;option.textContent=(game.ready.includes(x)?'보관 · ':'진열 · ')+'#'+x.id+' '+x.name;select.append(option)}}$('display-price-item').value=priceItemId??'';const token=item?item.id+':'+(item.askingPrice??'unset'):'none';if(priceToken!==token){priceToken=token;$('display-price-input').value=item?(item.askingPrice||item.price):''}const range=item&&game.sellingRange(item);if(range){$('display-price-input').min=range.min;$('display-price-input').removeAttribute('max');put('display-price-range','기준가 '+item.price+'원 · 판매가 자유 설정 · 너무 비싸면 손님이 거절해요.')}else put('display-price-range','완료품이 들어오면 판매가를 정할 수 있어요.');put('display-price-state',item?(item.askingPrice?'저장된 판매가 '+item.askingPrice+'원':'판매가 미설정 · 금액을 입력하고 저장해 주세요.'):'선택할 물품이 없어요.');$('display-price-save').disabled=!allowed||!item;$('display-price-input').disabled=!allowed||!item;$('display-price-place').textContent=item&&!game.ready.includes(item)?'이미 진열 중인 물품입니다':'저장한 가격으로 선택 칸에 진열';$('display-price-place').disabled=!allowed||!item||!game.ready.includes(item)||!Number.isSafeInteger(item.askingPrice)||!!selected;}
$('display-price-item').onchange=e=>{priceItemId=Number(e.target.value);priceToken=null;displayToken=null;updateDisplay()};
$('display-price-save').onclick=()=>{const input=$('display-price-input');if(!Number.isSafeInteger(Number(input.value))||Number(input.value)<1){put('display-price-state','판매가는 1원 이상의 정수로 입력해 주세요.');return}displayAct({priceOnly:true,itemId:priceItemId,askingPrice:Number(input.value)})};
$('display-price-place').onclick=()=>displayAct({itemId:priceItemId,slot:displaySlot});
$('display-withdraw').onclick=()=>{const item=game.display[displaySlot];if(item)displayAct({withdraw:displaySlot,itemId:item.id});displayMove=null};
$('display-move').onclick=()=>{const item=game.display[displaySlot];displayMove=displayMove?null:item?{slot:displaySlot,id:item.id}:null;displayToken=null;updateDisplay()};
$('display-auto').onclick=()=>{displayMove=null;displayAct({all:true})};$('display-sort').onclick=()=>{displayMove=null;displayAct({organize:true})};
let catalogToken=null;
const queueTokens=new Map();
function itemCard(item,station,state,selectable=true){
 const card=document.createElement('article');card.className='stock-card';const thumb=document.createElement('canvas');thumb.width=180;thumb.height=180;thumb.setAttribute('aria-label',item.name+' '+({broken:'고장 상태',open:'분해 완료',restored:'복원 완료'})[state]);drawAntique(thumb.getContext('2d'),item,state,0,0,180,180);
 const title=document.createElement('strong');title.textContent='#'+item.id+' '+item.name;const text=document.createElement('p'),part=game.partStatus(item);text.textContent=(state==='broken'?'현재 상태 '+item.condition+'/100':state==='open'?'A 완료 · '+(item.preparedBy==='전날 작업'?'시작 재고 / 전날 준비':(item.preparedBy||'이전 작업자')+' 담당'):'최종 검사 통과')+' · 기준가 '+item.price+'원';
 const fault=document.createElement('p');fault.textContent='매입 시 손상: '+item.fault;const mat=document.createElement('p');mat.className=part.available?'parts-ready':'parts-short';mat.textContent='필요 '+part.name+' '+part.need+'개 / 재고 '+part.count+'개'+(part.arrived?' · 택배 '+part.arrived+'개 도착':part.shipping?' · '+part.shipping+'개 배송 중':'')+(part.available?' · 준비됨':' · 부족');card.append(thumb,title,text,fault);if(state!=='restored')card.append(mat);
 if(station&&selectable){const button=document.createElement('button'),busy=game.busyStation(player.skin),occupied=game.getJob(station),blocked=!!occupied||!!(busy&&busy!==station)||game.counterOwner===player.skin||station==='finish'&&!part.available||online&&(!room.running||!room.healthy);button.textContent=occupied?'공정 작업 중':station==='finish'&&!part.available?'부품 수령 후 인수':station==='prep'?'이 물건 A공정 시작':'이 물건 B공정 인수';button.disabled=blocked;button.onclick=()=>{selectedWorkItemId=item.id;goStation(station==='prep'?'repair':'repair-b')};card.append(button)}
 return card;
}
function renderQueue(id,items,station,state){const token=JSON.stringify([items.map(x=>[x.id,x.condition,x.preparedBy]),game.stock,game.deliveries.map(x=>[x.part,x.state]),game.getJob('prep')?.owner,game.getJob('finish')?.owner,game.counterOwner,player.skin,itemAtlas.complete&&itemAtlas.naturalWidth>0,online&&room.healthy]);if(queueTokens.get(id)===token)return;queueTokens.set(id,token);const node=$(id);node.textContent='';node.className='queue-gallery';if(!items.length){const p=document.createElement('p');p.textContent=station==='finish'?'A공정 완료품을 기다리고 있어요.':'보관 중인 물건이 없어요.';node.append(p)}else for(const item of items)node.append(itemCard(item,station,state))}
function oldUpdatePicker(){put('picker-title',workStation==='prep'?'A공정 · 점검할 물건 선택':'B공정 · 전달받은 물건 선택');put('picker-hint',workStation==='prep'?'물건의 모습과 필요한 부품 재고를 확인하고 선택하세요.':'물건 번호·A 담당 기록과 부품 재고를 확인해 인수하세요. 부품이 부족하면 먼저 주문·수령해야 합니다.');renderQueue('picker-items',workStation==='prep'?game.pending:game.prepared,workStation,workStation==='prep'?'broken':'open')}
function materialStatus(){const r=currentRepair(),el=$('work-material-status');if(mode!=='work'||!r){el.hidden=true;return}el.hidden=false;const part=game.partStatus(r.item);el.className='work-material-status '+(r.consumed||part.available?'parts-ready':'parts-short');el.textContent='#'+r.item.id+' '+r.item.name+' · '+(r.consumed?part.name+' 1개 사용 완료 · 중복 소모 없음':'필요 '+part.name+' 1개 / 공동 재고 '+part.count+'개 · '+(part.available?'교체 가능':part.arrived?'도착 택배 수령 필요':'재료 부족 · 주문·수령 필요'))}
$('picker-supply').onclick=()=>open('supply');
let warehouseTab='raw';const inventorySelection={warehouse:null,picker:null},inventoryTokens=new Map();
function inventoryEntries(tab){if(tab==='parts')return Object.entries(ShopGame.parts).map(([part,v])=>({key:part,part,name:v.name,count:game.stock[part]}));const station=tab==='raw'?'prep':tab==='prepared'?'finish':null,state=tab==='raw'?'broken':tab==='prepared'?'open':'restored',list=tab==='raw'?game.pending:tab==='prepared'?game.prepared:game.ready;const entries=list.map(item=>({key:String(item.id),item,name:item.name,station,state}));const job=station&&game.getJob(station);if(job)entries.unshift({key:String(job.repair.item.id),item:job.repair.item,name:job.repair.item.name,station,state,busy:true,owner:job.owner});return entries}
function renderInventory(prefix,entries){
 let selected=entries.find(x=>x.key===inventorySelection[prefix]);if(!selected&&entries.length){selected=entries[0];inventorySelection[prefix]=selected.key}if(!entries.length)inventorySelection[prefix]=null;
 const token=JSON.stringify([entries,inventorySelection[prefix],game.stock,game.deliveries.map(d=>[d.part,d.state,Math.ceil(d.eta)]),game.getJob('prep')?.owner,game.getJob('finish')?.owner,game.counterOwner,player.skin,game.closed,itemAtlas.complete&&itemAtlas.naturalWidth>0,ShopParts.ready(),online&&room.healthy]);if(inventoryTokens.get(prefix)===token)return;inventoryTokens.set(prefix,token);
 const grid=$(prefix==='warehouse'?'warehouse-grid':'picker-items'),detail=$(prefix==='warehouse'?'warehouse-detail':'picker-detail');grid.textContent='';detail.textContent='';grid.className='inventory-grid';
 for(let i=0;i<Math.max(8,entries.length);i++){const e=entries[i],button=document.createElement('button');button.type='button';button.className='inventory-slot'+(e&&e.key===selected?.key?' selected':'');button.disabled=!e;button.setAttribute('aria-label',e?e.name+(e.part?' · 재고 '+e.count+'개':' · #'+e.item.id+(e.busy?' · 작업 중':'')):'빈 보관칸 '+(i+1));button.setAttribute('aria-pressed',String(!!e&&e.key===selected?.key));const image=document.createElement('canvas');image.width=160;image.height=160;if(e){if(e.part)ShopParts.draw(image.getContext('2d'),e.part,12,12,136);else drawAntique(image.getContext('2d'),e.item,e.state,0,0,160,160);const name=document.createElement('span');name.textContent=e.name;const count=document.createElement('small');count.textContent=e.part?'×'+e.count:e.busy?(e.owner||'인수 대기')+' 작업 중':'#'+e.item.id;button.append(image,name,count);button.onclick=()=>{inventorySelection[prefix]=e.key;inventoryTokens.delete(prefix);renderInventory(prefix,entries)}}else{button.textContent='·';button.classList.add('empty')}grid.append(button)}
 if(!selected){const text=document.createElement('p');text.textContent='이 보관함은 비어 있어요. 다른 분류를 선택해 주세요.';detail.append(text);return}
 const image=document.createElement('canvas');image.width=320;image.height=240;const title=document.createElement('h3');title.textContent=selected.name;const desc=document.createElement('p'),extra=document.createElement('p'),action=document.createElement('button');action.type='button';
 if(selected.part){const part=selected.part,deliveries=game.deliveries.filter(d=>d.part===part&&d.state!=='claimed');ShopParts.draw(image.getContext('2d'),part,50,10,220);desc.textContent='공동 재고 '+game.stock[part]+'개 · 주문 3개 / '+ShopGame.parts[part].price+'원';extra.textContent=deliveries.map(d=>d.state==='arrived'?'입구 도착 · 수령 필요':Math.ceil(d.eta)+'초 뒤 도착').join(' / ')||'배송 중인 부품 없음';extra.textContent+=' · 사용 품목: '+ShopParts.compatible(part).join(', ');action.textContent='주문서에 3개 담기';action.disabled=game.closed||online&&(!room.running||!room.healthy);action.onclick=()=>{changeCart(part,1);open('supply')}}
 else{const item=selected.item,part=game.partStatus(item);drawAntique(image.getContext('2d'),item,selected.state,40,0,240,240);desc.textContent='#'+item.id+' · '+(selected.state==='restored'?'최종 검사 통과':'상태 '+item.condition+'/100')+' · 기준가 '+item.price+'원';extra.textContent=selected.state==='restored'?'C가 진열 테이블에 놓으면 판매할 수 있어요.':item.fault+' / 필요 '+part.name+' 1개 · 재고 '+part.count+'개'+(part.arrived?' · 도착 택배 수령 필요':'');action.textContent=selected.busy?'현재 공정 이어보기':selected.station==='prep'?'A공정으로 가져가기':selected.station==='finish'?'B공정 인수':'C · 진열 테이블로 이동';const busy=game.busyStation(player.skin);action.disabled=game.closed||!!(selected.owner&&selected.owner!==player.skin)||!!(selected.station&&busy&&busy!==selected.station)||!!(selected.station==='finish'&&!selected.busy&&!part.available)||online&&(!room.running||!room.healthy);action.onclick=()=>{if(selected.station){selectedWorkItemId=selected.busy?null:item.id;goStation(selected.station==='prep'?'repair':'repair-b')}else goStation('display')}}
 detail.append(image,title,desc,extra,action);
}
for(const button of document.querySelectorAll('[data-store]'))button.onclick=()=>{warehouseTab=button.dataset.store;inventoryTokens.delete('warehouse');flowPanel()};
function updatePicker(){put('picker-title',workStation==='prep'?'점검할 물품 선택':'B공정 인수 물품');put('picker-hint','보관칸을 눌러 상태와 부품을 확인한 뒤 가져가세요.');renderInventory('picker',inventoryEntries(workStation==='prep'?'raw':'prepared').filter(e=>!e.busy))}
function flowPanel(){
 for(const button of document.querySelectorAll('[data-store]')){const entries=inventoryEntries(button.dataset.store);button.setAttribute('aria-selected',String(button.dataset.store===warehouseTab));button.textContent=({raw:'매입품',prepared:'분해 완료',ready:'복원 완료',parts:'부품'})[button.dataset.store]+' '+entries.length}
 renderInventory('warehouse',inventoryEntries(warehouseTab));put('warehouse-total','물품 '+(game.pending.length+game.prepared.length+game.ready.length+(game.getJob('prep')?1:0)+(game.getJob('finish')?1:0))+'개 · 부품 '+Object.values(game.stock).reduce((n,x)=>n+x,0)+'개');
 const a=game.getJob('prep'),b=game.getJob('finish');put('warehouse-work','A: '+(a?a.repair.item.name+' · '+(a.owner||'인수 대기'):'비어 있음')+' / B: '+(b?b.repair.item.name+' · '+(b.owner||'인수 대기'):'비어 있음')+' / C: '+(game.counterOwner?'응대 중':'응대 가능'));
 put('flow-history',game.flowLog.slice(0,8).map(x=>x.day+'일차 '+x.text).join(' / ')||'물품 인계 기록이 여기에 표시됩니다.');
}
let partCatalogReady=false;
function expansionPanel(){flowPanel();materialStatus();if(!partCatalogReady&&ShopParts.ready()){partCatalogReady=true;for(const part of ShopParts.order){const card=$('order-'+part).parentElement,image=document.createElement('canvas');image.width=160;image.height=160;image.style.cssText='width:90px;height:90px;margin:auto;image-rendering:auto';ShopParts.draw(image.getContext('2d'),part,8,8,144);card.querySelector('span')?.replaceWith(image);const usage=document.createElement('p');usage.textContent='사용: '+ShopParts.compatible(part).join(', ');card.append(usage)}}
 put('growth-status',game.campaignSummary()+' · 판매 '+game.xp+'건 · '+['동네 수리점','복원 공방','골동품 전문점'][game.tier]+' · 해금 '+ShopGame.catalog.filter(x=>x.tier<=game.tier).length+'/8종 · 진열 보관 '+game.capacity+'칸');
 const labels={tools:'복원 장비 · 검사 속도·품질 향상',marketing:'동네 홍보 · 방문 간격 단축',shop:'진열 보관 +2칸'};for(const kind of Object.keys(labels)){const n=game.upgrades[kind],max=kind==='shop'?1:2,b=$('upgrade-'+kind);b.textContent=labels[kind]+' / '+n+'단계 · '+(n>=max?'완료':ShopGame.Game.upgradeCost(game,kind)+'원');b.disabled=kind==='shop'&&!game.campaign.level||n>=max||online&&(!room.running||!room.healthy)}
 if(mode==='counter'){const c=game.customers[0],v=c?.type==='buy'?game.display[selectedSlot]:c?.item,ic=$('item-view').getContext('2d');ic.clearRect(0,0,1008,568);drawTradeScene(ic,c,v);if(v){const partCost=Math.ceil(ShopGame.parts[v.part].price/3),current=Math.round(v.price*(v.condition/100)*.45),q=c&&game.quote(c.id,selectedSlot);put('value-current',c.type==='buy'?v.price+'원':current+'원');put('value-restored',v.price+'원');put('value-cost',c.type==='buy'?'수리 완료':partCost+'원');put('value-margin',c.type==='repair'?'수리 후 예상 차익 '+(v.price-(q?.price||0)-partCost)+'원 · 기준가 판매 시, 부품비만 반영':'최종 검사 통과 · 실제 판매가는 흥정에 따라 달라져요.');put('item-condition',v.name+' · '+(c.type==='buy'?'복원 완료':'상태 '+v.condition+'/100'));put('item-fault',c.type==='buy'?'수리와 최종 검사를 마친 진열품입니다.':v.fault);if(v.unverified){
 put('value-current','미감정');put('value-restored','감정 후 공개');
 put('value-margin',game.campaign.level>=2?(v.periodMark?'각인 양식이 제작 연대와 맞아요. 정밀 검사 전에는 단정하기 어려워요.':'각인 양식이 낯설어요. 정밀 검사 전에는 단정하기 어려워요.'):'밀매품 · 복원 후 진위와 판매 가치가 정해져요.');
 put('item-fault','출처 미상의 물건이에요. '+v.fault);
 }put('customer-personality',(c.personality?.name||'손님')+' · '+(c.personality?.line||''))}else{put('value-current','—');put('value-restored','—');put('value-cost','—');put('value-margin','');put('item-condition','거래할 물건을 기다리고 있어요.');put('item-fault','');put('customer-personality','')}}
 const token=game.tier+':'+game.xp+':'+JSON.stringify(game.upgrades)+':'+itemAtlas.complete;
 if(catalogToken!==token&&itemAtlas.complete&&itemAtlas.naturalWidth){catalogToken=token;const catalog=$('item-catalog');catalog.textContent='';for(const def of ShopGame.catalog){const card=document.createElement('article');card.className='catalog-card'+(def.tier>game.tier?' locked':'');const c=document.createElement('canvas');c.width=180;c.height=180;drawAntique(c.getContext('2d'),def,'restored',0,0,180,180);const title=document.createElement('strong');title.textContent=def.name;const caption=document.createElement('p');caption.textContent=def.tier>game.tier?(def.tier===1?'판매 2건 후 해금':'판매 5건 후 해금'):'기준가 '+def.price+'원';card.append(c,title,caption);catalog.append(card)}}
 put('ledger',game.ledger.slice(0,8).map(x=>x.day+'일차 '+x.item+' '+(x.amount>0?'+':'')+x.amount+'원').join(' / ')||'거래 기록이 여기에 쌓입니다.');
}

for(const[type,id]of[['wipe','wipe-item'],['rotate','rotate-part'],['fit','fit-part'],['pass','pass-repair']])$(id).onclick=()=>{act(type);if(type==='pass')close();updatePanel()};
for(const kind of['tools','marketing','shop'])$('upgrade-'+kind).onclick=()=>{act('upgrade',{kind});updatePanel()};
for(const b of document.querySelectorAll('[data-ping]'))b.onclick=()=>{act('ping',{symbol:b.dataset.ping});if(navigator.vibrate)navigator.vibrate(35)};
$('save-now').onclick=saveLocal;
$('sound-toggle').onclick=()=>{soundEnabled=!soundEnabled;$('sound-toggle').textContent=soundEnabled?'효과음 끄기':'효과음 켜기';tone()};
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});
$('backup-save').onclick=()=>{if(online)return;const blob=new Blob([JSON.stringify(game.snapshot(),null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='cozy-repair-day-'+game.day+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)};
$('restore-save').onchange=async e=>{if(online)return;try{const file=e.target.files[0];if(!file)return;if(file.size>200000)throw Error('저장 파일이 너무 큽니다.');const restored=ShopGame.Game.restore(JSON.parse(await file.text()));close();stop();game=restored;guests.clear();saveLocal();updatePanel();say('저장 파일을 불러왔어요.')}catch(err){say('불러오기 실패: '+err.message)}e.target.value=''};
function showLobbyPane(name){
 for(const pane of document.querySelectorAll('[data-lobby-pane]'))pane.hidden=pane.dataset.lobbyPane!==name;
 for(const button of document.querySelectorAll('[data-lobby]'))button.setAttribute('aria-pressed',String(button.dataset.lobby===name));
 if(name==='server')$('connection-details').open=true;
}
for(const button of document.querySelectorAll('[data-lobby]'))button.onclick=()=>showLobbyPane(button.dataset.lobby);
showLobbyPane('solo');
function updateAnnex(){
 const kind=game.commissionKind(),item=game.ready.find(v=>v.kind===kind && v.status==='restored');
 const done=game.campaign.deliveredDay===game.day,def=ShopGame.catalog.find(v=>v.kind===kind);
 put('annex-order',game.day+'일차 주문 · '+def.name+' 1개');
 put('annex-stock',done?'오늘 납품을 마쳤어요.':item?'완료품 #'+item.id+' · 납품가 '+Math.round(item.price*1.2)+'원':'완료품 보관함에 '+def.name+'를 준비해 주세요. 납품가는 기준가의 120%예요.');
 const button=$('annex-deliver');
 button.disabled=done||!item||game.closed||!!game.busyStation(player.skin)||game.counterOwner===player.skin||online&&(!room.running||!room.healthy);
 button.dataset.item=item?.id??'';button.dataset.day=game.day;
 const c=$('annex-object').getContext('2d');c.clearRect(0,0,320,200);
 if(itemAtlas.complete&&itemAtlas.naturalWidth)ShopItemArt.surface(c,itemAtlas,item||def,'restored',160,190,180,155);
}
$('visit-annex').onclick=()=>{updateAnnex();$('annex-room').showModal()};
$('annex-close').onclick=()=>$('annex-room').close();
$('annex-deliver').onclick=e=>{const b=e.currentTarget;b.disabled=true;act('exhibit',{commission:true,itemId:Number(b.dataset.item),day:Number(b.dataset.day)});updateAnnex()};
$('lobby-shortcut').onclick=()=>$('network-open').click();
$('network-open').onclick=()=>{$('network-modal').hidden=false;$('network-close').focus()};$('network-close').onclick=()=>{if(!online&&!solo)startSolo();else $('network-modal').hidden=true};
const config=window.SHOP_CONFIG||{};let remembered={};try{remembered=JSON.parse(localStorage.getItem('cozy-public-config')||'{}')}catch{}
$('supabase-url').value=config.supabaseUrl||remembered.url||'';$('supabase-key').value=config.supabaseAnonKey||remembered.key||'';$('room-code').value=localStorage.getItem('cozy-room-code')||'';
let connected=false,networkBusy=false;
async function networkTask(fn){if(networkBusy)return;networkBusy=true;try{await fn()}catch(e){$('network-status').textContent='확인 필요 · '+e.message}finally{networkBusy=false}}
async function ensureConnected(){if(connected)return;const url=$('supabase-url').value.trim().replace(/\/$/,''),key=$('supabase-key').value.trim();if(!url||!key){showLobbyPane('server');throw Error('기존 Project URL과 공개 키를 입력해 주세요.')}await room.connect(url,key);showLobbyPane('room');localStorage.setItem('cozy-public-config',JSON.stringify({url,key}));connected=true}
$('connect-server').onclick=()=>networkTask(ensureConnected);
$('create-room').onclick=()=>networkTask(async()=>{await ensureConnected();saveLocal();online=true;document.body.classList.remove('solo-shop');try{await room.create(game.snapshot(),$('player-name').value)}catch(e){online=false;document.body.classList.toggle('solo-shop',solo);throw e}$('network-status').textContent='방 '+room.room.code+' · 동료에게 코드를 알려 주세요.';});
$('join-room').onclick=()=>networkTask(async()=>{await ensureConnected();saveLocal();online=true;document.body.classList.remove('solo-shop');try{await room.join($('room-code').value,$('player-name').value)}catch(e){online=false;document.body.classList.toggle('solo-shop',solo);throw e}});
$('ready-room').onclick=()=>networkTask(async()=>{if(!room.room)throw Error('먼저 방을 만들거나 참가해 주세요.');await room.setReady(true)});
$('start-room').onclick=()=>networkTask(()=>room.start());
window.addEventListener('beforeunload',()=>{if(!online)ShopSave.write(game)});

Promise.all([itemArtReady,...Object.entries(window.GAME_ASSETS).map(([n,url])=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images[n]=im;resolve()};im.onerror=()=>reject(Error('이미지 로딩 실패: '+n));im.src=url}))]).then(()=>{loaded=true;$('counter-bg').src=window.GAME_ASSETS['counter-scene'];$('loading').hidden=true;say(game.notice);updatePanel();requestAnimationFrame(tick)}).catch(e=>{$('loading').textContent=e.message});
})();
