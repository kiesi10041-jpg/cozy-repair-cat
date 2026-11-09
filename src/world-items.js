/* World-only art: 32px props on the room's native pixel grid. */
(()=>{'use strict';
const kinds=['clock','radio','box','pot','painting','chair','camera','gramophone'];
const sizes=[[26,28],[30,22],[28,20],[27,23],[25,28],[22,29],[26,25],[29,30]];
const atlases=new WeakMap();
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
// Bounds measured at build time. No browser pixel reads (works with file:// and restricted canvases).
const sourceSize=[1774, 887],bounds=[[104, 86, 249, 299], [535, 137, 259, 238], [985, 146, 249, 229], [1403, 146, 302, 216], [73, 555, 295, 260], [561, 480, 209, 368], [973, 511, 247, 318], [1420, 472, 263, 376]];
function prepare(atlas){if(atlases.has(atlas))return atlases.get(atlas);const width=atlas.naturalWidth||atlas.width,height=atlas.naturalHeight||atlas.height;if(!width||!height)return{};const tiles={};kinds.forEach((kind,i)=>{const [x,y,bw,bh]=bounds[i],tile=canvas(32,32),c=tile.getContext('2d'),[mw,mh]=sizes[i],scale=Math.min(mw/bw,mh/bh),w=Math.max(1,Math.round(bw*scale)),h=Math.max(1,Math.round(bh*scale));c.imageSmoothingEnabled=false;c.drawImage(atlas,x*width/sourceSize[0],y*height/sourceSize[1],bw*width/sourceSize[0],bh*height/sourceSize[1],Math.floor((32-w)/2),32-h,w,h);tiles[kind]=tile});atlases.set(atlas,tiles);return tiles}
function draw(c,atlas,item,x,baseline,zoom=1,compact=false){if(!atlas)return;const tile=prepare(atlas)[item.kind];if(!tile)return;const size=compact?24:32,dx=Math.round(x-size/2)*zoom,dy=Math.round(baseline-size)*zoom;c.save();c.imageSmoothingEnabled=false;c.fillStyle='#38251f40';c.beginPath();c.ellipse(Math.round(x)*zoom,Math.round(baseline)*zoom,(compact?7:9)*zoom,2*zoom,0,0,Math.PI*2);c.fill();c.drawImage(tile,dx,dy,size*zoom,size*zoom);c.restore()}
function table(c,room,capacity,zoom=1){if(capacity<=4)return;c.save();c.imageSmoothingEnabled=false;for(let row=0;row<2;row++)for(let col=0;col<3;col++)c.drawImage(room,183,159,51,39,(182+col*36)*zoom,(159+row*38)*zoom,36*zoom,39*zoom);c.restore()}
window.GAME_ASSETS['world-items']='assets/world-items-atlas.png';
globalThis.ShopWorldItems={kinds,sizes,prepare,draw,table};
})();
