/* World-only art: 32px props and 36x48px people on the room's native pixel grid. */
(()=>{'use strict';
const kinds=['clock','radio','box','pot','painting','chair','camera','gramophone'];
const sizes=[[26,28],[30,22],[28,20],[27,23],[25,28],[22,29],[26,25],[29,30]];
const atlases=new WeakMap(),people=new WeakMap();
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
function prepare(atlas){if(atlases.has(atlas))return atlases.get(atlas);const width=atlas.naturalWidth||atlas.width,height=atlas.naturalHeight||atlas.height,cw=width/4,ch=height/2,source=canvas(width,height),s=source.getContext('2d');s.drawImage(atlas,0,0);const pixels=s.getImageData(0,0,width,height).data,tiles={};
 kinds.forEach((kind,i)=>{const sx=Math.floor(i%4*cw),sy=Math.floor(Math.floor(i/4)*ch),ex=Math.floor(sx+cw),ey=Math.floor(sy+ch);let l=ex,t=ey,r=sx,b=sy;for(let y=sy;y<ey;y++)for(let x=sx;x<ex;x++)if(pixels[(y*width+x)*4+3]>=128){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x+1);b=Math.max(b,y+1)}if(r<=l||b<=t)return;const tile=canvas(32,32),c=tile.getContext('2d'),[mw,mh]=sizes[i],scale=Math.min(mw/(r-l),mh/(b-t)),w=Math.max(1,Math.round((r-l)*scale)),h=Math.max(1,Math.round((b-t)*scale));c.imageSmoothingEnabled=false;c.drawImage(atlas,l,t,r-l,b-t,Math.floor((32-w)/2),32-h,w,h);tiles[kind]=tile});atlases.set(atlas,tiles);return tiles}
function draw(c,atlas,item,x,baseline,zoom=1,compact=false){if(!atlas)return;const tile=prepare(atlas)[item.kind];if(!tile)return;const size=compact?24:32,dx=Math.round(x-size/2)*zoom,dy=Math.round(baseline-size)*zoom;c.save();c.imageSmoothingEnabled=false;c.fillStyle='#38251f40';c.beginPath();c.ellipse(Math.round(x)*zoom,Math.round(baseline)*zoom,(compact?7:9)*zoom,2*zoom,0,0,Math.PI*2);c.fill();c.drawImage(tile,dx,dy,size*zoom,size*zoom);c.restore()}
function person(c,image,x,y){let tile=people.get(image);if(!tile){tile=canvas(36,48);const p=tile.getContext('2d');p.imageSmoothingEnabled=false;p.drawImage(image,0,0,36,48);people.set(image,tile)}c.drawImage(tile,x-36,y-88,72,96)}
function table(c,room,capacity,zoom=1){if(capacity<=4)return;c.save();c.imageSmoothingEnabled=false;for(let row=0;row<2;row++)for(let col=0;col<3;col++)c.drawImage(room,183,159,51,39,(182+col*36)*zoom,(159+row*38)*zoom,36*zoom,39*zoom);c.restore()}
window.GAME_ASSETS['world-items']='assets/world-items-atlas.png';
globalThis.ShopWorldItems={kinds,sizes,prepare,draw,person,table};
})();
