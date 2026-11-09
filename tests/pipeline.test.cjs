const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');const mem=new Map(),c={console,localStorage:{getItem:k=>mem.get(k)||null,setItem:(k,v)=>mem.set(k,v)}};c.globalThis=c;vm.createContext(c);for(const f of['base-engine.js','game.js','pipeline.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',f),'utf8'),c);const G=c.ShopGame.Game;
function inspect(g,skin){for(let i=0;i<3;i++)assert(g.action(skin,'wipe',{station:'prep',inspectZone:i}))}
function prep(g,skin){inspect(g,skin);let r=g.getJob('prep').repair;if(r.stage==='screws'){for(const i of [...r.order])assert(g.action(skin,'screw',{station:'prep',index:i,turns:1}))}else if(r.stage==='clean')for(let i=0;i<3;i++)assert(g.action(skin,'wipe',{station:'prep',zone:i}));assert.equal(g.getJob('prep').repair.stage,'handoff');assert(g.action(skin,'pass',{station:'prep',transfer:true}))}
function finish(g,skin){const station='finish',r=g.getJob(station).repair,part=r.item.part;g.stock[part]=5;assert(g.action(skin,'replace',{station,part}));if(r.item.process==='surface'){for(let i=0;i<3;i++)assert(g.action(skin,'fit',{station,zone:i}))}else{for(let i=0;i<3;i++){while(r.angle!==r.targets[r.fitted])assert(g.action(skin,'rotate',{station}));assert(g.action(skin,'fit',{station}))}}assert(g.action(skin,'test',{station}));g.tick(3.1)}
let g=new G(()=>.3);assert(g.action('A','begin',{station:'prep'}));assert(g.action('B','begin',{station:'finish'}));assert(g.action('C','counter'));assert(g.getJob('prep')&&g.getJob('finish'));assert(!g.action('A','begin',{station:'finish'}));assert(!g.action('B','screw',{station:'prep',index:0,turns:1}));assert(!g.action('A','counter'));
g.spawn('repair');g.customers[0].arrived=true;const customer=g.customers[0],q=g.quote(customer.id);assert(g.action('C','serve',{id:customer.id,price:q.price}));prep(g,'A');assert.equal(g.prepared.length,1);assert(g.action('A','begin',{station:'prep'}));finish(g,'B');assert(g.getJob('prep'));assert(!g.getJob('finish'));assert.equal(g.ready.length,1);assert(g.action('B','begin',{station:'finish'}));assert(g.getJob('prep')&&g.getJob('finish'));
assert(c.ShopSave.write(g));const loaded=c.ShopSave.read();assert(loaded instanceof G);assert(loaded.getJob('prep')&&loaded.getJob('finish'));assert.equal(loaded.counterOwner,'C');
assert(g.action('B','pass',{station:'finish'}));assert(!g.action('A','begin',{station:'finish'}));assert(g.action('C','release'));assert(g.action('C','begin',{station:'finish'}));assert.equal(g.getJob('finish').owner,'C');
let all=0;for(const def of c.ShopGame.catalog){const t=new G(()=>.3);t.prepared=[];t.pending=[t.makeItem(def)];assert(t.action('A','begin',{station:'prep'}));prep(t,'A');assert(t.action('B','begin',{station:'finish'}));finish(t,'B');assert.equal(t.ready[0].name,def.name);for(const item of t.ready)assert(t.action('C','exhibit',{priceOnly:true,itemId:item.id,askingPrice:item.price}));assert(t.action('C','exhibit',{all:true}));assert.equal(t.display.filter(Boolean).length,1);all++}
const close=new G(()=>.3);close.action('A','begin',{station:'prep'});close.action('B','begin',{station:'finish'});const x=close.getJob('finish').repair.item,stock=close.stock[x.part];close.action('B','replace',{station:'finish',part:x.part});close.remaining=.5;close.tick(1);assert(close.closed);assert(close.getJob('prep')&&close.getJob('finish'));assert.equal(close.stock[x.part],stock-1);assert.equal(close.getJob('finish').repair.stage,'assemble');assert(!close.action('B','fit',{station:'finish',zone:0}));assert(close.action('C','nextday'));assert.equal(close.getJob('finish').repair.stage,'assemble');
const migrator=new c.ShopGame.Game();const data=migrator.snapshot();delete data.pipelineVersion;delete data.jobs;delete data.prepared;delete data.flowLog;data.repair={item:{...c.ShopGame.catalog[0],id:10},stage:'assemble',order:[0,1,2],step:3,fitted:0,wipes:0,targets:[1,3,2],angle:0};data.owner='B';const migrated=G.restore(data);assert.equal(migrated.getJob('finish').owner,'B');
for(const player of[[160,286],[336,216],[450,280]])for(const s of c.ShopEngine.stations)assert(c.ShopEngine.findPath({x:player[0],y:player[1]},s.point).length,s.id);
console.log(JSON.stringify({concurrentA_B_C:true,crossJobWritesRejected:true,AtoBtoCItems:all,independentHandoff:true,simultaneousSaveRestore:true,endOfDayPreservation:true,oldSaveMigrated:true,routes:18}));

const flexible = new G(()=>.3);
assert(flexible.action('A','begin',{station:'prep'}));
assert(flexible.action('A','wipe',{station:'prep',inspectZone:0}));
const interrupted = flexible.getJob('prep').repair;
assert(flexible.action('B','counter'));
assert(!flexible.action('A','counter'));
assert.equal(flexible.getJob('prep').owner,'A');
assert(flexible.action('B','release'));
assert(flexible.action('A','counter'));
assert.equal(flexible.counterOwner,'A');
assert.equal(flexible.getJob('prep').owner,null);
assert(flexible.action('A','release'));
assert(flexible.action('A','begin',{station:'prep'}));
assert.equal(flexible.getJob('prep').repair,interrupted);
assert.equal(interrupted.inspected[0],0);

const relay = new G(()=>.3);
assert(relay.begin('A','prep'));
const first=relay.jobs.prep.repair;
assert(relay.action('A','wipe',{station:'prep',inspectZone:0}));
assert(relay.action('A','pass',{station:'prep',itemId:first.item.id,to:'B'}));
assert.equal(relay.jobs.prep.owner,'B');
assert.deepEqual(Array.from(first.inspected),[0]);
assert(!relay.action('A','pass',{station:'prep',itemId:first.item.id,to:'C'}));
first.stage='handoff';
const forward={station:'prep',itemId:first.item.id,transfer:true,continueQueue:true};
assert(relay.action('B','pass',forward));
assert.equal(relay.prepared.at(-1).id,first.item.id);
assert.equal(relay.jobs.prep.owner,'B');
assert.notEqual(relay.jobs.prep.repair.item.id,first.item.id);
assert(!relay.action('B','pass',forward));

// One keeper completes both benches, prices each piece and earns the permit.
const soloShop=new G(()=>.3);
for(let turn=0;turn<6&&!soloShop.campaign.permit;turn++){
 if(!soloShop.prepared.length){
  if(!soloShop.pending.length){
   assert(soloShop.spawn('repair'));
   const seller=soloShop.customers[0];seller.arrived=true;
   assert(soloShop.action('A','counter'));
   assert(soloShop.action('A','serve',{id:seller.id,price:soloShop.quote(seller.id).price}));
   assert(soloShop.action('A','release'));
  }
  assert(soloShop.begin('A','prep'));prep(soloShop,'A');
 }
 assert(soloShop.begin('A','finish'));finish(soloShop,'A');
 const item=soloShop.ready[0];
 assert(soloShop.action('A','exhibit',{itemId:item.id,askingPrice:item.price,slot:0}));
 if(soloShop.customers.length){soloShop.customers[0].arrived=true;soloShop.action('A','counter');soloShop.action('A','dismiss',{id:soloShop.customers[0].id});soloShop.action('A','release')}
 assert(soloShop.spawn('buy'));const buyer=soloShop.customers[0];buyer.arrived=true;
 assert(soloShop.action('A','counter'));
 assert(soloShop.action('A','serve',{id:buyer.id,slot:0,price:soloShop.quote(buyer.id,0).price}));
 assert(soloShop.action('A','release'));
}
assert(soloShop.campaign.permit);
assert.equal(soloShop.capacity,4);
