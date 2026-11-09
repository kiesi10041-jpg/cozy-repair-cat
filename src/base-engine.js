(()=>{'use strict';
// Collision uses furniture floor footprints, not the full painted silhouette.
// Conservative visual footprints, with sprite half-width clearance at both sides.
const blocks=[[12,140,116,120,25],[183,157,109,101,14],[326,125,172,40,15],[465,104,35,33,0],[417,193,39,47,20],[456,218,37,22,20],[470,170,27,50,20],[14,266,36,41,20],[361,285,20,57,13],[437,285,20,57,13]];
const floorAt=(x,y)=>(x>=24&&x<=488&&y>=119&&y<=306)||(x>=292&&x<=480&&y>=104&&y<=129)||(x>=395&&x<=423&&y>=306&&y<=338);
const valid=(x,y)=>floorAt(x,y)&&!blocks.some(([a,b,w,h,pad=6])=>x>=a-pad&&x<=a+w+pad&&y>=b-2&&y<=b+h+8);
const stations=[
 {id:'display',label:'중앙 진열 테이블 앞',hit:[178,154,122,108],point:{x:238,y:268},face:'back'},
 {id:'counter',label:'카운터 안쪽',hit:[323,98,179,72],point:{x:410,y:122},face:'front'},
 {id:'repair-b',label:'B공정 · 작업대 오른쪽',hit:[145,176,29,75],point:{x:154,y:212},face:'left'},
 {id:'repair',label:'A공정 · 작업대 앞',hit:[12,138,113,123],point:{x:85,y:270},face:'back'},
 {id:'entrance',label:'입구 통로',hit:[381,284,55,58],point:{x:409,y:330},face:'front'},
 {id:'door',label:'왼쪽 문 앞',hit:[43,28,60,88],point:{x:75,y:126},face:'back'}
];
const stationAt=(x,y)=>stations.find(s=>{const[a,b,w,h]=s.hit;return x>=a&&x<=a+w&&y>=b&&y<=b+h});
function findPath(from,to){// A previous save may place a player in the old walkway under the bell.
 if(from.x>=311&&from.x<=500&&from.y>122&&from.y<137&&!valid(from.x,from.y)){
   const exit={x:Math.min(460,from.x),y:122},rest=findPath(exit,to);
   if(rest.length||Math.hypot(exit.x-to.x,exit.y-to.y)<1)return [exit,...rest];
 }
 const start=[Math.round(from.x/2),Math.round(from.y/2)],end=[Math.round(to.x/2),Math.round(to.y/2)];if(!valid(end[0]*2,end[1]*2))return[];
 const key=(x,y)=>y*256+x,queue=[start],seen=new Set([key(...start)]),prev=new Map();let found=false;
 for(let i=0;i<queue.length;i++){const c=queue[i];if(c[0]===end[0]&&c[1]===end[1]){found=true;break}for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const n=[c[0]+dx,c[1]+dy],k=key(...n);if(seen.has(k)||!valid(n[0]*2,n[1]*2))continue;seen.add(k);prev.set(k,c);queue.push(n)}}
 if(!found)return[];let n=end;const out=[];while(n[0]!==start[0]||n[1]!==start[1]){out.push({x:n[0]*2,y:n[1]*2});n=prev.get(key(...n))}return out.reverse();
}
class Player{constructor(){this.x=160;this.y=286;this.dir='front';this.phase=0;this.path=[];this.walking=false;this.speed=110}
 setTarget(to){const p=findPath(this,to);if(!p.length)return false;this.path=p;return true}
 update(dt,key){dt=Math.min(.15,Math.max(0,dt));this.walking=false;let budget=this.speed*dt;
 const move=(dx,dy)=>{const distance=Math.hypot(dx,dy);if(!distance)return;this.dir=Math.abs(dx)>=Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'front':'back');this.x+=dx;this.y+=dy;this.phase=(this.phase+distance/72)%1;this.walking=true};
 if(key){this.path=[];const v={left:[-1,0],right:[1,0],front:[0,1],back:[0,-1]}[key];if(v)while(budget>0){const step=Math.min(.5,budget);if(!valid(this.x+v[0]*step,this.y+v[1]*step))break;move(v[0]*step,v[1]*step);budget-=step}return}
 while(budget>0&&this.path.length){const t=this.path[0],dx=t.x-this.x,dy=t.y-this.y,d=Math.hypot(dx,dy),n=Math.min(budget,d);if(d>0)move(dx/d*n,dy/d*n);budget-=n;if(d<=n+.00001)this.path.shift();else break}
 }
 frame(){return this.walking?Math.min(7,Math.floor(this.phase*8)):({front:3,left:2,right:2,back:0})[this.dir]}
}
globalThis.ShopEngine={Player,valid,findPath,blocks,stations,stationAt};
})();

/* Domain state. Money, inventory and customer identity change atomically here. */
(()=>{'use strict';
const DAY_SECONDS=1440;
const parts={gear:{name:'톱니바퀴',price:40},spring:{name:'태엽',price:30},contact:{name:'전기 접점',price:50}};
const catalog=[{name:'탁상시계',price:180,kind:'clock',part:'gear'},{name:'작은 라디오',price:220,kind:'radio',part:'contact'},{name:'음악상자',price:200,kind:'box',part:'spring'},{name:'찻주전자',price:150,kind:'pot',part:'gear'}];
const species=['dog','rabbit','mouse','parrot'],names={dog:'두부',rabbit:'모모',mouse:'보리',parrot:'초록'};
class Game{
 constructor(random=Math.random){this.random=random;this.day=1;this.money=300;this.serial=0;this.visitCount=0;this.remaining=DAY_SECONDS;this.spawnIn=2;this.customers=[];this.pending=[];this.ready=[];this.display=Array(4).fill(null);this.repair=null;this.owner=null;this.sold=0;this.closed=false;this.stock={gear:2,spring:2,contact:2};this.deliveries=[];this.notice='첫 손님이 찾아오고 있어요. 카운터에서 인사해주세요.'}
 tick(dt){if(this.closed)return;dt=Math.max(0,dt);this.remaining=Math.max(0,this.remaining-dt);this.spawnIn-=dt;for(const d of this.deliveries)if(d.state==='shipping'){d.eta=Math.max(0,d.eta-dt);if(!d.eta){d.state='arrived';this.notice='입구에 부품 택배가 도착했어요. 입구에서 수령해주세요.'}}
 if(this.repair?.stage==='testing'){this.repair.testLeft-=dt;if(this.repair.testLeft<=1e-6){this.ready.push(this.repair.item);this.repair=null;this.owner=null;this.notice='작동 검사 통과! 수리 완료품을 진열대에 놓아주세요.'}}
 if(this.spawnIn<=0&&this.customers.length<1){const spawned=this.spawn();this.spawnIn=spawned?35+this.random()*15:1}
 if(!this.remaining){this.closed=true;if(this.repair){this.pending.unshift(this.repair.item);if(this.repair.consumed)this.stock[this.repair.item.part]++}this.repair=null;this.owner=null;this.notice='영업 마감! 미완료 수리품과 교체 부품은 돌려놓았어요.'}}
 spawn(force){if(this.customers.length>=3||this.closed)return false;const type=force||(this.display.some(Boolean)&&this.random()<.65?'buy':'repair'),s=species[this.visitCount++%4],item={...catalog[Math.floor(this.random()*catalog.length)],id:++this.serial};this.customers.push({id:++this.serial,type,species:s,name:names[s],item,arrived:false,rate:.9+this.random()*.2});this.notice=type==='buy'?'구매 손님이 들어왔어요.':'고장난 물건을 팔러 온 손님이 들어왔어요.';return true}
 quote(id,slot){const c=this.customers[0];if(!c||c.id!==id)return null;const item=c.type==='repair'?c.item:this.display[slot];if(!item)return null;const key=c.type+':'+item.id,initial=Math.round(item.price*(c.type==='repair'?.22:1)*c.rate),state=c.bargains?.[key];return {key,id,slot,item,side:c.type,initial,price:state?.price??initial,rounds:state?.rounds||0,state:state?.state||'open',response:state?.response||'',reaction:state?.reaction||'neutral',min:Math.max(1,Math.round(item.price*(c.type==='repair'?.1:.65))),max:Math.round(item.price*(c.type==='repair'?.4:1.45))}}
 negotiate(id,slot,offer){const c=this.customers[0],q=this.quote(id,slot);if(this.closed||!c?.arrived||!q)return this.fail('맨 앞 손님이 도착한 뒤 가격을 제안해주세요.');if(!Number.isSafeInteger(offer)||offer<q.min||offer>q.max)return this.fail(q.min+'~'+q.max+'원 안에서 가격을 제안해주세요.');if(q.rounds>=3||q.state==='agreed')return this.fail('추가 흥정은 끝났어요. 현재 가격으로 거래하거나 다음에 거래해주세요.');
 const round=q.rounds+1,threshold=c.type==='repair'?Math.round(q.initial*(.76+c.rate*.08)):Math.max(q.initial,Math.round(q.item.price*(1.05+(c.rate-.9)*.7))),accepted=c.type==='repair'?offer>=threshold:offer<=threshold;
 const price=accepted?offer:c.type==='repair'?Math.max(threshold,Math.round((q.price+offer)/2)):Math.min(threshold,Math.round((q.price+offer)/2));const response=accepted?'“좋아요. '+price+'원에 거래해요!”':round>=3?'“제 마지막 제안은 '+price+'원이에요.”':'“그 가격은 조금 어려워요. '+price+'원은 어떠세요?”';
 c.bargains??={};c.bargains[q.key]={price,rounds:round,state:accepted?'agreed':'counter',response};this.notice=response;return true}
 serve(id,slot,expectedPrice){if(this.closed)return this.fail('영업이 마감됐어요.');const c=this.customers[0],q=this.quote(id,slot);if(!c||c.id!==id||!c.arrived)return this.fail('맨 앞 손님이 카운터에 도착한 뒤 거래할 수 있어요.');if(!q)return this.fail('거래할 물건을 선택해주세요.');if(expectedPrice!==undefined&&expectedPrice!==q.price)return this.fail('거래 가격이 바뀌었어요. 현재 제안을 확인해주세요.');const price=q.price;
 if(c.type==='repair'){if(this.pending.length>=6)return this.fail('수리 대기함이 가득 찼어요.');if(this.money<price)return this.fail('물품 매입 자금이 부족해요.');this.money-=price;this.pending.push(c.item);this.notice=c.item.name+' 매입 −'+price+'원. 작업대에서 수리해주세요.'}
 else{this.display[slot]=null;this.money+=price;this.sold++;this.notice=q.item.name+' 판매 완료! +'+price+'원'}this.customers.shift();return true}
 dismiss(id){if(this.customers[0]?.id!==id||!this.customers[0].arrived)return false;this.customers.shift();this.notice='손님에게 정중히 다음 방문을 부탁했어요.';return true}
 fail(message){this.notice=message;return false}
 begin(skin){if(this.closed)return this.fail('마감 후에는 다음 날 수리해주세요.');if(this.repair)return this.owner===skin||this.fail(this.owner+'가 작업대를 사용 중이에요.');if(!this.pending.length)return this.fail('카운터에서 먼저 고장난 물건을 매입해주세요.');const order=[0,1,2];for(let i=2;i>0;i--){const j=Math.floor(this.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}this.owner=skin;this.repair={item:this.pending.shift(),order,step:0,stage:'screws',consumed:false,testLeft:0};this.notice='덮개 나사를 1 → 2 → 3 순서로 풀어주세요.';return true}
 tighten(skin,index){const r=this.repair;if(!r||this.owner!==skin||r.stage!=='screws'||this.closed)return false;if(index!==r.order[r.step])return this.fail('번호 순서대로 나사를 풀어주세요.');r.step++;if(r.step===3){r.stage='replace';this.notice='덮개를 열었어요. 필요한 부품을 교체해주세요.'}return true}
 replacePart(skin){const r=this.repair;if(!r||this.owner!==skin||r.stage!=='replace'||this.closed)return false;const p=r.item.part;if(!this.stock[p])return this.fail(parts[p].name+' 재고가 없어요. 부품 주문 후 택배를 수령해주세요.');this.stock[p]--;r.consumed=true;r.stage='test';this.notice='부품 교체 완료. 전원을 켜서 작동 검사를 해주세요.';return true}
 startTest(skin){if(!this.repair||this.owner!==skin||this.repair.stage!=='test'||this.closed)return false;this.repair.stage='testing';this.repair.testLeft=3;this.notice='작동을 검사하고 있어요…';return true}
 cancel(skin){if(this.owner!==skin||!this.repair)return false;this.pending.unshift(this.repair.item);if(this.repair.consumed)this.stock[this.repair.item.part]++;this.repair=null;this.owner=null;this.notice='수리품과 사용한 부품을 돌려놓았어요.';return true}
 exhibit(){if(this.closed)return false;const i=this.display.indexOf(null);if(i<0)return this.fail('진열대 4칸이 모두 사용 중이에요.');if(!this.ready.length)return this.fail('수리를 끝낸 물건이 아직 없어요.');this.display[i]=this.ready.shift();this.notice='진열 완료! 카운터에서 구매 손님을 맞아주세요.';if(!this.customers.some(c=>c.type==='buy')&&this.customers.length<3)this.spawn();return true}
 order(part){if(!parts[part]||this.closed)return false;if(this.deliveries.filter(d=>d.state!=='claimed').length>=3)return this.fail('먼저 도착한 택배를 수령해주세요.');if(this.money<parts[part].price)return this.fail('부품 주문 자금이 부족해요.');this.money-=parts[part].price;this.deliveries.push({id:++this.serial,part,count:3,eta:20,state:'shipping'});this.notice=parts[part].name+' 3개 주문 완료. 영업시간 기준 20초 후 입구에 도착해요.';return true}
 claim(){let n=0;for(const d of this.deliveries)if(d.state==='arrived'){this.stock[d.part]+=d.count;d.state='claimed';n++}this.notice=n?'부품 택배 '+n+'개를 수령했어요.':'아직 도착한 택배가 없어요.';return n>0}
 nextDay(){if(!this.closed)return false;this.day++;this.remaining=DAY_SECONDS;this.closed=false;this.spawnIn=2;this.notice='새로운 하루를 시작해요.';return true}
 get time(){return 9+(DAY_SECONDS-this.remaining)/(DAY_SECONDS/12)}
 get period(){return this.time<11?'아침 · 오픈':this.time<16?'낮':this.time<19?'초저녁':this.closed?'밤 · 마감':'밤'}
}
globalThis.ShopGame={DAY_SECONDS,Game,catalog,parts,species};})();
