(() => {
  const damageFields={'Режущий':'resistCut','Колющий':'resistPierce','Дробящий':'resistSmash','Взрывной':'resistExplode','Магический':'resistMagic'};
  const settings=level=>({level,armor:100,enemyResist:0,incoming:'resistCut',uptime:100,hit:100});
  const number=(x,fallback=null)=>Number.isFinite(x)?x:fallback;
  const bounded=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
  const statsOf=(unit,level)=>unit.levels.find(x=>x.level===level)?.stats||[];
  const stat=(stats,group,name)=>stats.find(s=>s.group===group&&s.name===name)?.value;
  function domain(unit,stats){
    if(/^(light|dark)_nav_/.test(unit.icon||''))return 'sea';
    if(stat(stats,'Общие','Роль')==='Авиация')return 'air';
    return 'ground';
  }
  function groupFor(stats,target){
    const split=target==='air'?'Атака по воздушным':'Атака по наземным';
    if(stats.some(s=>s.group===split&&s.name==='Урон'))return split;
    if(stats.some(s=>s.group==='Атака'&&s.name==='Урон'))return 'Атака';
    if(stats.some(s=>s.group==='Общее'&&s.name==='Урон')&&stats.some(s=>s.group==='Атака'))return 'Атака';
    return null;
  }
  function weapon(unit,stats,hints,actions,target){
    const group=groupFor(stats,target);if(!group)return null;
    const split=group.startsWith('Атака по ');
    const val=(name)=>{let v=stat(stats,group,name);if(v===undefined&&!split)v=stat(stats,'Общее',name);return v;};
    const match=Object.entries(hints).find(([k,h])=>k.startsWith('12:')&&k.endsWith(':dmgVal1')&&(h.group===group||(!split&&h.group==='')));
    const id=match?.[0].split(':')[1],raw=window.GEAR_DUEL_WEAPONS?.[id];
    const targetText=val('Цели');
    if(targetText==='Наземные'&&target==='air')return null;
    if(targetText==='Воздушные'&&target!=='air')return null;
    if(targetText&& !['Любые цели','Наземные','Воздушные'].includes(targetText))return null;
    const rawRange=val('Дальность атаки');
    // An omitted target restriction is only interpreted for a normal melee attack.
    if(!targetText&&(rawRange!=='Ближний бой'||target==='air'))return null;
    let range=rawRange==='Ближний бой'?1:number(rawRange,number(raw?.range));
    const type=val('Тип урона');let dmg=number(val('Урон')),attacks=number(val('Скорость атаки'));
    if(!(range>0)||!(dmg>0)||!(attacks>0)||!damageFields[type])return null;
    let crit=number(val('Шанс крит. атаки'),0),critDmg=number(val('Крит. урон'),0);
    let targetAccuracy=number(val('Меткость по движ.'),100);
    let walkAccuracy=raw?.walking?number(val('Меткость в движении'),number(stat(stats,'Общее','Меткость в движении'),number(raw.walkAccuracy))):null;
    let interval=600/attacks;
    for(const a of actions){if(a.type!==12||String(a.id)!==id||a.op!=='add'||!Number.isFinite(a.value))continue;
      if(a.field==='dmgVal1')dmg+=a.value;
      if(a.field==='critChance')crit+=a.value/10;
      if(a.field==='critDmg')critDmg+=a.value/10;
      if(a.field==='distance')range+=a.value/100;
      if(a.field==='round_len')interval+=a.value;
      const hint=hints[`${a.type}:${a.id}:${a.field}`];
      if(a.field==='accuracy_dynamic'&&hint?.name==='Меткость по движ.')targetAccuracy+=a.value;
      if(a.field==='accuracy_walk'&&hint?.name==='Меткость в движении'&&walkAccuracy!==null)walkAccuracy+=a.value;
    }
    if(interval<=0||range<=0||dmg<=0)return null;
    return {damage:dmg,type:damageFields[type],range,minRange:number(val('Мин. дальность'),0),interval:interval/10,crit:bounded(crit,0,100),critDmg,targetAccuracy:bounded(targetAccuracy,0,100),walkAccuracy:walkAccuracy===null?null:bounded(walkAccuracy,0,100)};
  }
  function profile(unit,level,items,hints,build){
    const stats=statsOf(unit,level),result=window.GearCompare.evaluate(unit,items,hints,build,settings(level));
    if(!(result.life>0)||result.armor===null||!(result.move>0))return null;
    const attacks={};for(const d of ['ground','air','sea'])attacks[d]=weapon(unit,stats,hints,result.allActions||[],d);
    return {unit,domain:domain(unit,stats),hp:result.life,armor:result.armor,regen:number(result.regen,0),resists:result.resists,speed:result.move,deploy:number(result.deploy,0),attacks};
  }
  function compatible(a,b){
    if(!a||!b)return false;
    if((a.domain==='sea'&&b.domain==='ground')||(a.domain==='ground'&&b.domain==='sea'))return false;
    const aw=a.attacks[b.domain],bw=b.attacks[a.domain];
    return !!(aw&&bw&&Number.isFinite(a.resists[bw.type])&&Number.isFinite(b.resists[aw.type]));
  }
  function hit(weapon,defender,targetMoving,attackerMoving){
    const resistance=defender.resists[weapon.type];
    if(!Number.isFinite(resistance)||defender.armor<0)return 0;
    const critical=1+weapon.crit/100*weapon.critDmg/100;
    const accuracy=(targetMoving?weapon.targetAccuracy:100)/100*(attackerMoving?(weapon.walkAccuracy??0)/100:1);
    return Math.max(0,weapon.damage*(1-resistance/100)*400/(400+defender.armor)*critical*accuracy);
  }
  function simulate(a,b,useKite=true){
    if(!compatible(a,b))return null;
    const fighters=[a,b],guns=[a.attacks[b.domain],b.attacks[a.domain]],hp=[a.hp,b.hp],ready=[a.deploy,b.deploy];
    const dt=.1,maxTime=90;let distance=Math.min(12,Math.max(1.5,guns[0].range,guns[1].range)),time=0;
    for(let step=0;step<maxTime/dt&&hp[0]>0&&hp[1]>0;step++){
      time=step*dt;const movement=[0,0];
      for(let i=0;i<2;i++){
        const j=1-i,w=guns[i],enemy=guns[j];
        const kites=useKite&&w.range>enemy.range+.5&&fighters[i].speed>fighters[j].speed&&w.range>1&&fighters[i].deploy===0;
        const safe=Math.min(w.range-.1,enemy.range+.7);
        if(distance>w.range)movement[i]=1;
        else if(distance<w.minRange)movement[i]=-1;
        else if(kites&&distance<safe)movement[i]=-1;
      }
      distance=Math.max(.25,distance-(movement[0]*fighters[0].speed/60+movement[1]*fighters[1].speed/60)*dt);
      const nextDamage=[0,0];
      for(let i=0;i<2;i++){
        const j=1-i,w=guns[i],moving=movement[i]!==0;
        if(time+1e-8>=ready[i]&&distance<=w.range&&distance>=w.minRange&&(!moving||w.walkAccuracy!==null)){
          nextDamage[j]=hit(w,fighters[j],movement[j]!==0,moving);ready[i]=time+w.interval;
        }
      }
      for(let i=0;i<2;i++)hp[i]=Math.min(fighters[i].hp,hp[i]+fighters[i].regen*dt/60)-nextDamage[i];
    }
    const remainingA=bounded(hp[0]/a.hp,0,1),remainingB=bounded(hp[1]/b.hp,0,1);
    return {score:remainingA-remainingB,winner:hp[0]<=0&&hp[1]<=0?'draw':hp[1]<=0?'a':hp[0]<=0?'b':'draw',time};
  }
  function compare(unit,builds,records,equipment){
    const pool=records.filter(r=>[1,3].includes(r.type)&&!statsOf(r,1).some(s=>s.group==='Общие'&&s.name==='Роль'&&s.value==='Рабочий'));
    const ownItems=equipment.items.filter(x=>x.unit===unit.entity),ownHints=equipment.hints[String(unit.entity)]||{};
    const ownProfiles=[1,12,24].map(level=>builds.map(build=>profile(unit,level,ownItems,ownHints,build)));
    const matches=[];
    for(const opponent of pool){
      const opponentHints=equipment.hints[String(opponent.entity)]||{};
      const deltas=[],wins=[0,0];
      let incomingDamageType;
      for(let l=0;l<3;l++){
        const level=[1,12,24][l];const enemy=profile(opponent,level,[],opponentHints,[]);const [x,y]=ownProfiles[l];
        if(!compatible(x,enemy)||!compatible(y,enemy))continue;
        incomingDamageType ??= enemy.attacks[x.domain].type;
        for(const kite of [false,true]){const first=simulate(x,enemy,kite),second=simulate(y,enemy,kite);if(first&&second){deltas.push(first.score-second.score);if(first.winner==='a')wins[0]++;if(second.winner==='a')wins[1]++;}}
      }
      if(deltas.length){const delta=deltas.reduce((s,x)=>s+x,0)/deltas.length;matches.push({unit:opponent,delta,wins,samples:deltas.length,incomingDamageType});}
    }
    matches.sort((a,b)=>b.delta-a.delta);
    const positive=matches.filter(m=>m.delta>.015),negative=matches.filter(m=>m.delta<-.015).reverse();
    const overall=matches.length?matches.reduce((s,m)=>s+m.delta,0)/matches.length:null;
    return {matches,positive,negative,overall};
  }
  window.GearDuel={domain,weapon,profile,compatible,hit,simulate,compare};
})();
