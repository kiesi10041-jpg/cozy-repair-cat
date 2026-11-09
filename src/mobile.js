(()=>{'use strict';const $=id=>document.getElementById(id),body=document.body;let page='map';body.dataset.page=page;
function protectPlay(e){
 if(e.target.closest('input,textarea,[contenteditable=true]'))return;
 if(e.target.closest('.stage,.characters,.business-actions,.camera,#game-nav,.game-layout button'))e.preventDefault();
}
for(const event of ['contextmenu','selectstart','dragstart','dblclick'])window.addEventListener(event,protectPlay);
body.classList.toggle('game-layout',true);
function select(next){page=next;body.dataset.page=page;for(const b of document.querySelectorAll('#game-nav button[data-page]'))b.setAttribute('aria-pressed',String(b.dataset.page===page))}
for(const b of document.querySelectorAll('#game-nav button[data-page]'))b.onclick=()=>select(b.dataset.page);
$('portrait-continue').onclick=()=>body.classList.add('portrait-allowed');$('install-close').onclick=()=>$('install-guide').close();
function guide(){
 const ua=navigator.userAgent||'',android=/Android/i.test(ua),apple=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
 $('install-title').textContent=android?'안드로이드에서 전체화면으로 열기':apple?'아이폰·아이패드에서 넓게 열기':'전체화면으로 열기';
 $('install-steps').textContent=android?'Chrome에서 게임을 직접 열고 전체화면을 누르세요. 전환되지 않으면 ⋮ 메뉴 → 홈 화면에 추가 → 설치를 선택한 후 아이콘으로 실행하세요.':apple?'Safari 공유 메뉴 → 홈 화면에 추가를 선택하세요. 웹 앱으로 열기가 보이면 켠 뒤 아이콘으로 실행하세요.':'브라우저에서 게임 주소를 직접 열고 전체화면 버튼을 다시 누르세요.';
 $('install-guide').showModal();
}
async function fullscreen(){

 const root=document.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;
 if(document.fullscreenElement||document.webkitFullscreenElement||matchMedia('(display-mode:fullscreen)').matches)return;
 if(request){try{await request.call(root);try{await screen.orientation?.lock?.('landscape')}catch{}return}catch{}}
 if(!navigator.standalone)guide();
}
$('fullscreen').onclick=fullscreen;
})();
