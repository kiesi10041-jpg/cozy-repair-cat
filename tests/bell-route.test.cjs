// Compare actual walking sprites with the counter foreground along each approach.
const assert = require('node:assert/strict');
const {createCanvas,loadImage} = require('@napi-rs/canvas');
global.window = {};
require('../assets/scene-assets');
require('../src/base-engine');
async function pixels(key,w,h) {
  const ctx=createCanvas(w,h).getContext('2d');
  ctx.drawImage(await loadImage(window.GAME_ASSETS[key]),0,0,w,h);
  return ctx.getImageData(0,0,w,h).data;
}
(async()=>{
  const counter=await pixels('foreground-counter',1024,684);
  const goal=ShopEngine.stations.find(s=>s.id==='counter').point;
  let minimum=1, poses=0;
  for (const [skin,x,y] of [['A',160,286],['B',336,216],['C',450,280]]) {
    const player=Object.assign(new ShopEngine.Player(),{x,y}), sprites=new Map();
    assert(player.setTarget(goal));
    while(player.path.length) {
      player.update(1/60);
      if(player.x<300||player.y>178)continue;
      const key=[skin,player.dir,player.frame()].join('-');
      if(!sprites.has(key))sprites.set(key,await pixels(key,80,108));
      const sprite=sprites.get(key);
      let total=0,visible=0;
      for(let row=0;row<76;row++)for(let col=0;col<80;col++){
        if(sprite[4*(row*80+col)+3]<128)continue;
        total++;
        const gx=2*Math.round(player.x)-40+col,gy=2*Math.round(player.y)-100+row;
        if(counter[4*(gy*1024+gx)+3]<128||player.y>=166)visible++;
      }
      assert(total>0);
      minimum=Math.min(minimum,visible/total);poses++;
    }
  }
  assert(poses>0 && minimum>.95,'head/upper body obscured: '+minimum);
  console.log({poses,minimum});
})().catch(err=>{console.error(err);process.exitCode=1});
