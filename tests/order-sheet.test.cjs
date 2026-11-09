const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const ctx=vm.createContext({});
for(const file of ['base-engine','game','pipeline']){
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',file+'.js'),'utf8'),ctx);
}
const g=new ctx.ShopGame.Game(()=>.5),cash=g.money;
const buy=cart=>g.action('A','order',{cart});
for(const cart of [{},{gear:-1},{gear:1.5},{gear:200},{bad:1},{gear:99}]){
 assert.equal(buy(cart),false);
 assert.equal(g.money,cash);
 assert.equal(g.deliveries.length,0);
}
const oldStock={...g.stock};
assert(buy({gear:2,spring:1}));
assert.equal(g.money,cash-110);
assert.equal(new Set(g.deliveries.map(d=>d.shipment)).size,1);
assert.equal(g.action('A','claim'),false);
const resumed=ctx.ShopGame.Game.restore(g.snapshot());
resumed.tick(20);
assert(resumed.action('A','claim'));
assert.equal(resumed.stock.gear,oldStock.gear+6);
assert.equal(resumed.stock.spring,oldStock.spring+3);
assert(!resumed.action('A','claim'));
