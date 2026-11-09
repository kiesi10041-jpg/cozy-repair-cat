/* The close-up and the tray share the same workshop state and action checks. */
class ShopBenchControls {
  constructor(workshop) {
    this.workshop = workshop;
    this.detail = document.getElementById('bench-detail').getContext('2d');
    this.choices = document.getElementById('bench-choices');
    this.hint = document.getElementById('bench-hint');
    this.signature = '';
    this.selected = '';
  }
  button(text, action, options = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    if (options.part) {
      const icon = document.createElement('canvas');
      icon.width = icon.height = 72;
      ShopParts.draw(icon.getContext('2d'), options.part, 0, 0, 72);
      button.append(icon);
      button.setAttribute('aria-pressed',String(this.selected === options.part));
    }
    button.append(document.createTextNode(text));
    button.disabled = !this.workshop.o.canWork() || !!options.disabled;
    button.onclick = action;
    this.choices.append(button);
  }
  render(r) {
    const w = this.workshop, c = this.detail;
    c.imageSmoothingEnabled = true;
    c.drawImage(w.canvas, 352, 36, 752, 700, 0, 0, 800, 760);
    const key = r && [r.item.id,r.stage].join('/');
    if (this.job !== key) {this.selected = ''; this.job = key;}
    const stock = w.o.stock();
    const signature = JSON.stringify([key,r?.step,r?.inspected,r?.cleaned,r?.restored,r?.screwTurns,
      r?.fitted,r?.angle,r?.testLeft,w.o.canWork(),stock,this.selected,ShopParts.ready(),w.result()?.id]);
    if (signature === this.signature) return;
    this.signature = signature;
    this.choices.replaceChildren();
    this.hint.textContent = r ? r.item.name : (w.result()?'작업을 마쳤어요.':'물품 인수 대기');
    if (!r) return;
    const send = (type,p) => w.send(type,p,signature+type+JSON.stringify(p));
    const zoneButtons = (done,verb,type) => {
      this.hint.textContent = r.item.name+' · '+verb+' '+done.length+'/3';
      for(let i=0;i<3;i++){
        const label=r.profile?.points?.[i]||('부위 '+(i+1));
        this.button((done.includes(i)?'✓ ':'')+(i+1)+'. '+label+' '+verb,
          ()=>send(type,r.stage==='inspect'?{inspectZone:i}:{zone:i}),{disabled:done.includes(i)});
      }
    };
    switch (r.stage) {
      case 'inspect': zoneButtons(r.inspected,'점검','wipe'); break;
      case 'clean': zoneButtons(r.cleaned||[],'세척','wipe'); break;
      case 'screws': {
        const index=r.order[r.step], quarters=Math.round((r.screwTurns?.[index]||0)*4);
        this.button((r.step+1)+'번 나사 풀기 · '+quarters+'/4',()=>send('screw',{index,turns:.25}));break;
      }
      case 'handoff': this.button('B공정으로 인계',()=>send('pass',{transfer:true,continueQueue:true,itemId:r.item.id}));break;
      case 'replace': {
        const required=r.item.part;
        this.hint.textContent='필요한 재료 · '+ShopGame.parts[required].name;
        const choices=[required,...ShopParts.order.filter(p=>p!==required).slice(0,2)].sort((a,b)=>ShopParts.order.indexOf(a)-ShopParts.order.indexOf(b));
        for(const part of choices) this.button(ShopGame.parts[part].name+' ×'+stock[part],()=>{
          this.selected=part;this.render(r);
        },{part,disabled:!stock[part]});
        const fits=this.selected===required;
        this.button(fits?'선택한 재료 장착':this.selected?'맞지 않는 재료':'재료를 선택하세요',
          ()=>send('replace',{part:this.selected}),{disabled:!fits||!stock[required]});break;
      }
      case 'assemble':
        if(r.item.process==='surface'){zoneButtons(r.restored||[],'복원','fit');break;}
        this.hint.textContent=(r.profile?.pieces?.[r.fitted]||'부품')+' · 목표 '+r.targets[r.fitted]*90+'°';
        this.button('90° 회전 · 현재 '+r.angle*90+'°',()=>send('rotate',{}));
        this.button('맞춰 끼우기',()=>send('fit',{}),{disabled:r.angle!==r.targets[r.fitted]});break;
      case 'test': this.button('최종 검사 시작',()=>send('test',{}));break;
      case 'testing': this.hint.textContent='검사 중 · '+Math.ceil(r.testLeft)+'초';break;
    }
  }
}
