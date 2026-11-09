(()=>{'use strict';const $=id=>document.getElementById(id),body=document.body;let page='map',manual=false;body.dataset.page=page;
function layout(){const small=matchMedia('(pointer:coarse)').matches||matchMedia('(max-width:1000px) and (max-height:650px)').matches;body.classList.toggle('game-layout',small||manual)}
function select(next){page=next;body.dataset.page=page;for(const b of document.querySelectorAll('[data-page]'))b.setAttribute('aria-pressed',String(b.dataset.page===page))}
for(const b of document.querySelectorAll('[data-page]'))b.onclick=()=>select(b.dataset.page);
$('portrait-continue').onclick=()=>body.classList.add('portrait-allowed');$('install-close').onclick=()=>$('install-guide').close();
async function fullscreen(){manual=true;layout();const root=document.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;if(request){try{await request.call(root);try{await screen.orientation?.lock?.('landscape')}catch{}}catch{if(!navigator.standalone&&!matchMedia('(display-mode:standalone)').matches)$('install-guide').showModal()}}else if(!navigator.standalone&&!matchMedia('(display-mode:standalone)').matches)$('install-guide').showModal();}
$('fullscreen').onclick=fullscreen;$('screen-toggle').onclick=fullscreen;window.addEventListener('resize',layout);window.addEventListener('orientationchange',layout);layout();
})();
