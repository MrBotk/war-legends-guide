
(() => {
  const {records} = window.GAME_DATA;
  const equipment = window.EQUIPMENT_DATA;
  const equipmentIcons = new Set(window.EQUIPMENT_ICON_NAMES || []);
  const names = {1:'Армия',2:'Здания',3:'Герои',4:'Свитки'};
  const rarity = {1:'Обычный',2:'Редкий',3:'Эпический'};
  const equipmentRarity = {1:'ОБЫЧНОЕ',2:'РЕДКОЕ',3:'ЭПИЧЕСКОЕ'};
  const list = document.querySelector('#list');
  const content = document.querySelector('#content');
  const search = document.querySelector('#search');
  const root = document.querySelector('html');
  const catalog = document.querySelector('#catalog-sidebar');
  const catalogToggle = document.querySelector('#catalog-toggle');
  const catalogClose = document.querySelector('#catalog-close');
  const catalogBackdrop = document.querySelector('#catalog-backdrop');
  let catalogOpen = false;
  const mobileCatalog = () => !!window.matchMedia?.('(max-width: 700px)').matches;
  function syncCatalog() {
    const mobile = mobileCatalog();
    const open = mobile && catalogOpen;
    root.classList.toggle('catalog-open', open);
    catalogToggle.setAttribute('aria-expanded', String(open));
    catalogToggle.setAttribute('aria-label', open ? 'Закрыть каталог' : 'Открыть каталог');
    catalogBackdrop.hidden = !open;
    if (mobile) catalog.setAttribute('aria-hidden', String(!open));
    else catalog.removeAttribute('aria-hidden');
  }
  function closeCatalog() {
    const wasOpen = catalogOpen && mobileCatalog();
    catalogOpen = false;
    syncCatalog();
    if (wasOpen) catalogToggle.focus({preventScroll:true});
  }
  let type = 3;
  let chosen = records.find(item => item.type === 3 && item.name === 'Мириэль') || records[0];
  let lastEquipmentChoice = chosen;
  let selectedLevel = 1;
  let mode = 'upgrade';
  let selectedSet = null;
  let equipmentLevel = 1;
  let buildingTier = 1;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format = (value, digits = 0) => Number(value).toLocaleString('ru-RU', {maximumFractionDigits: Math.min(3, Math.max(0, digits))});
  const picture = (name, className = '', alt = '') => `<img class="${className}" src="assets/${encodeURIComponent(name || 'icon_cards')}.png" alt="${escape(alt)}" onerror="this.onerror=null;this.src='assets/icon_cards.png'">`;
  const levelBadge = (level, id='') => `<span class="level-badge"><img class="level-badge__flag" src="assets/image_card_level_flag_light.png" alt="" aria-hidden="true"><img class="level-badge__gold" src="assets/image_card_level_flag_panel_dark.png" alt="" aria-hidden="true"><img class="level-badge__panel" src="assets/image_card_level_flag_panel_light.png" alt="" aria-hidden="true"><span class="level-badge__number"${id?` id="${escape(id)}"`:''}>${escape(level)}</span></span>`;
  function characteristicIcon(name, field = '') {
    const text = `${name || ''} ${field}`.toLocaleLowerCase('ru');
    if (/крит|crit/.test(text)) return /урон|dmg/.test(text) ? 'icon_deltafield_crit_dmg' : 'icon_deltafield_crit_chance';
    if (/сопр|resist/.test(text)) {
      if (/режущ|cut/.test(text)) return 'icon_deltafield_resist_cutting';
      if (/колющ|pierce/.test(text)) return 'icon_deltafield_resist_piercing';
      if (/дробящ|smash/.test(text)) return 'icon_deltafield_resist_crushing';
      if (/взрыв|explode/.test(text)) return 'icon_deltafield_resist_exploding';
      if (/маг|magic/.test(text)) return 'icon_deltafield_resist_magic';
      return 'icon_deltafield_resist';
    }
    if (/брон|защит|щит|armor/.test(text)) return 'icon_deltafield_armor';
    if (/реген|восстановлен|regen/.test(text)) return 'icon_deltafield_regen';
    if (/здоров|жизн|лечен|исцелен|life/.test(text)) return 'icon_deltafield_hp';
    if (/обзор|sight/.test(text)) return 'icon_deltafield_vision';
    if (/цел[ьи]|target/.test(text)) return 'icon_deltafield_target';
    if (/дальност|метк|точност|distance|accuracy/.test(text)) return 'icon_deltafield_range';
    if (/радиус|radius/.test(text)) return 'icon_deltafield_radius';
    if (/разворот|rotate/.test(text)) return 'icon_deltafield_turnspeed';
    if (/движени|перемещен|speed/.test(text) && !/атаки|attack/.test(text)) return 'icon_deltafield_movespeed';
    if (/скорость атаки|ускорение атаки|round_len|attack_speed/.test(text)) return 'icon_deltafield_attack_speed';
    if (/урон|атак|damage|dmg|attack/.test(text)) return 'icon_deltafield_dmg';
    if (/перезаряд|cooldown/.test(text)) return 'icon_deltafield_cool';
    if (/время|длительност|задерж|интервал|duration|time/.test(text)) return 'icon_deltafield_time';
    if (/количеств|кол-во|снаряд|quantity/.test(text)) return 'icon_deltafield_quantity';
    if (/маг|ман|mana/.test(text)) return 'icon_deltafield_mana';
    return 'icon_deltafield_target';
  }
  const statPicture = (name, field = '') => picture(characteristicIcon(name,field), 'stat-icon');
  const upgradeStat=(icon,value,label)=>`<div class="upgrade-stat">${picture(icon,'upgrade-stat__icon')}<span class="upgrade-stat__copy"><b>${escape(value)}</b><small>${escape(label)}</small></span></div>`;
  const faction = item => item.faction === 1 ? 'Свет' : item.faction === 2 ? 'Тьма' : 'Нейтральные';
  const findLevel = level => chosen.levels.find(entry => entry.level === level);

  function renderList() {
    const query = search.value.trim().toLocaleLowerCase('ru');
    const factionRank = item => item.faction === 1 ? 0 : item.faction === 2 ? 1 : 2;
    const visible = records.filter(item => item.type === type && item.name.toLocaleLowerCase('ru').includes(query)).sort((a,b)=>factionRank(a)-factionRank(b) || (a.gameOrder ?? Infinity)-(b.gameOrder ?? Infinity) || a.name.localeCompare(b.name,'ru'));
    document.querySelector('#count').textContent = `${visible.length} / ${records.filter(item=>item.type===type).length}`;
    document.querySelector('#clear-search').hidden = !query;
    let previousFaction = null;
    list.innerHTML = visible.length ? visible.map(item => {const factionIcon=item.faction===1?'icon_light_faction_logo':item.faction===2?'icon_dark_faction_logo':null;const heading=item.faction!==previousFaction?`<div class="faction-heading" data-faction="${escape(item.faction)}">${factionIcon?`<img src="assets/${factionIcon}.png" alt="" aria-hidden="true">`:''}${escape(faction(item))}</div>`:'';previousFaction=item.faction;return `${heading}<button type="button" class="entity ${item.id===chosen.id?'active':''}" data-id="${escape(item.id)}" aria-pressed="${item.id===chosen.id}">${picture(item.icon,'','')}<span><b>${escape(item.name)}</b><small data-rarity="${escape(item.rarity)}">${escape(rarity[item.rarity] || '')}</small></span><span class="arrow" aria-hidden="true">›</span></button>`}).join('') : '<div class="empty"><b>В этой категории ничего не найдено</b><p>Проверьте имя или выберите другую категорию.</p></div>';
  }
  function statCard(stat, previous) {
    const delta = previous && typeof previous.value === 'number' ? stat.value - previous.value : 0;
    return `<div class="stat"><div class="stat-name">${statPicture(stat.name)}<span>${escape(stat.name)}</span></div><div class="stat-value">${format(stat.value,stat.digits ?? 1)} <small>${escape(stat.unit || '')}</small>${delta ? `<span class="delta">${delta>0?'+':''}${format(delta,2)}</span>`:''}</div></div>`;
  }
  const equipmentLabels = {
    life:['Здоровье',1,''], armor:['Броня',1,''], dmgVal1:['Урон',1,''],
    regen:['Регенерация',1,'/мин'], critChance:['Шанс критической атаки',0.1,'%'],
    critDmg:['Критический урон',0.1,'%'], distance:['Дальность атаки',0.01,'кл.'],
    resistCut:['Сопротивление режущему урону',1,'%'], resistPierce:['Сопротивление колющему урону',1,'%'],
    resistSmash:['Сопротивление дробящему урону',1,'%'], resistExplode:['Сопротивление взрывному урону',1,'%'],
    resistMagic:['Сопротивление магическому урону',1,'%'], round_len:['Интервал атаки',0.1,'сек'],
    explosion_radius:['Радиус взрыва',0.01,'кл.'], rotate:['Скорость разворота',10,'°/сек'],
    speed:['Интервал движения',null,'внутр. ед.'], duration:['Длительность',0.1,'сек'], radius:['Радиус',0.01,'кл.'],
    allyValue1:['Параметр усиления союзников',null,'внутр. ед.'], enemyValue1:['Параметр воздействия на врагов 1',null,'внутр. ед.'],
    enemyValue2:['Параметр воздействия на врагов 2',null,'внутр. ед.'], enemyValue3:['Параметр воздействия на врагов 3',null,'внутр. ед.'],
    effect:['Эффект способности',null,'внутр. ед.'],effectValue:['Эффект оружия',null,'внутр. ед.'],
    harvestGoldTime:['Время добычи золота',null,'внутр. ед.'],harvestLumberTime:['Время добычи древесины',null,'внутр. ед.'],
    repairBuildingTimePerc:['Время ремонта',null,'внутр. ед.'],bonusDmg1:['Бонусный урон 1',null,'внутр. ед.'],bonusDmg2:['Бонусный урон 2',null,'внутр. ед.'],
    tick_to_spec:['Время перехода в режим',null,'внутр. ед.'],tick_from_spec:['Время выхода из режима',null,'внутр. ед.'],
    accuracy_dynamic:['Точность в движении',null,'внутр. ед.'],accuracy_static:['Точность',null,'внутр. ед.'],
    bombardierAccuracyBonus:['Бонус точности',null,'внутр. ед.'],forest_speed_decr:['Замедление в лесу',null,'внутр. ед.'],
    newZombieLifePerc:['Здоровье призванного зомби',null,'внутр. ед.'],effectDuration:['Длительность эффекта',null,'внутр. ед.'],
    explosion_decr:['Ослабление взрыва',null,'внутр. ед.']
  };
  function actionText(action) {
    if(action.unresolved)return {name:'Неизвестный эффект',value:'—'};
    const hint=(equipment.hints[String(chosen.entity)]||{})[`${action.type}:${action.id}:${action.field}`];
    const fallback=equipmentLabels[action.field] || [action.field,null,'внутр. ед.'];
    const name=action.field==='speed' && hint?.factor == null ? fallback[0] : (hint?.name || fallback[0]);
    const group=hint?.group && (hint.showGroup || !['Атака','Защита','Перемещение'].includes(hint.group)) ? `${hint.group} · ` : '';
    const state=hint?.mode ? ` · ${hint.mode}` : '';
    const factor=hint?.factor ?? fallback[1];
    const unit=hint?.factor != null ? hint.unit : fallback[2];
    const amount=action.value*(factor ?? 1);
    return {name:group+name+state, value:`${action.op==='add' && amount>0?'+':''}${format(amount,2)}${unit ? ' '+unit : ''}`,raw:factor==null};
  }
  function visibleEquipmentActions(actions) {
    if (chosen.entity !== 28) return actions;
    return actions.filter(action => !(action.type === 10 && action.id === 40 && actions.some(other =>
      other.type === 10 && other.id === 39 && other.field === action.field && other.op === action.op && other.value === action.value
    )));
  }
  function renderEquipment() {
    const unitItems=equipment.items.filter(item=>item.unit===chosen.entity && [1,3].includes(chosen.type));
    const groups=new Map();
    for(const item of unitItems){if(!groups.has(item.setId))groups.set(item.setId,[]);groups.get(item.setId).push(item)}
    const sets=[...groups.entries()].sort((a,b)=>a[1][0].rarity-b[1][0].rarity || (a[1][0].setBonuses[0]?.name||'').localeCompare(b[1][0].setBonuses[0]?.name||'','ru'));
    if(!groups.has(selectedSet))selectedSet=sets.length?sets[0][0]:null;
    const options=sets.map(([id,items])=>`<option value="${id}" ${id===selectedSet?'selected':''}>${escape(items[0].setBonuses[0]?.name || 'Комплект')} · ${escape((rarity[items[0].rarity] || 'Неизвестный').toLocaleLowerCase('ru'))}</option>`).join('');
    const group=groups.get(selectedSet) || [];
    const heading=`<div class="breadcrumb">СПРАВОЧНИК <span> / </span> ЭКИПИРОВКА <span> / </span> ${escape(chosen.name)}</div><div class="gear-heading"><div><span class="eyebrow">СНАРЯЖЕНИЕ / ${escape(faction(chosen).toUpperCase())}</span><h2>Экипировка · ${escape(chosen.name)}</h2></div>${picture(chosen.icon,'gear-unit-icon',chosen.name)}</div>`;
    if(!group.length){content.innerHTML=heading+'<div class="notice">Экипировка для этого персонажа пока недоступна. Выберите другого героя или юнита.</div>';return}
    const current=group[0].levels.find(level=>level.level===equipmentLevel) || group[0].levels[0];
    const levelOptions=Array.from({length:10},(_,i)=>`<button type="button" data-gear-level="${i+1}" aria-label="Уровень ${i+1}" aria-pressed="${i+1===current.level}">${levelBadge(i+1)}</button>`).join('');
    document.querySelector('#selection-status').textContent=`Экипировка: ${chosen.name}, уровень вещей ${current.level}`;
    const missingIcons=group.filter(item=>!equipmentIcons.has(item.icon)).length;
    const cards=group.map(item=>{
      const level=item.levels.find(l=>l.level===current.level) || item.levels[0];
      const hasIcon=equipmentIcons.has(item.icon);
      return `<article class="gear-card"><div class="gear-card-top"><div class="gear-image ${hasIcon?'':'gear-image--missing'}"><span ${hasIcon?'hidden':''}>ИКОНКА<br>НЕДОСТУПНА</span>${hasIcon?`<img src="assets/${encodeURIComponent(item.icon)}.png" alt="" onerror="this.hidden=true;this.previousElementSibling.hidden=false">`:''}</div><div><span class="gear-quality" data-rarity="${escape(item.rarity)}">${escape(equipmentRarity[item.rarity] || 'НЕИЗВЕСТНОЕ')}</span><h4>${escape(item.name)}</h4><span class="gear-level">УРОВЕНЬ ${levelBadge(level.level)}</span></div></div><div class="gear-stats">${visibleEquipmentActions(level.actions).map(action=>{const a=actionText(action);return `<div class="gear-stat"><span class="stat-with-icon">${statPicture(a.name,action.field)}<span>${escape(a.name)}</span></span><b>${escape(a.value)}</b></div>`}).join('')}</div></article>`;
    }).join('');
    const bonuses=group[0].setBonuses.map(b=>`<div class="set-bonus ${current.level>=b.level?'unlocked':''}"><div class="bonus-number">${levelBadge(b.level)}</div><div><div class="bonus-title">Все вещи ${b.level}-го уровня</div>${visibleEquipmentActions(b.actions).map(a=>{const text=actionText(a);return `<div class="bonus-effect"><span class="stat-with-icon">${statPicture(text.name,a.field)}<span>${escape(text.name)}</span></span><b>${escape(text.value)}</b></div>`}).join('')}</div><span class="bonus-state">${current.level>=b.level?'ДОСТУПЕН':'ПОЗЖЕ'}</span></div>`).join('');
    const priceLevels=group[0].levels.filter(level=>level.level>=1&&level.level<=10).sort((a,b)=>a.level-b.level);
    const totalPrice=priceLevels.filter(level=>level.level>1).reduce((total,level)=>({gold:total.gold+level.gold,dust:total.dust+level.dust}),{gold:0,dust:0});
    const samePrices=group.every(item=>priceLevels.every(level=>item.levels.some(other=>other.level===level.level&&other.gold===level.gold&&other.dust===level.dust)));
    const gearPriceRows=priceLevels.map(level=>`<tr class="${level.level===current.level?'selected':''}" data-gear-cost-level="${level.level}"><td><button type="button" class="level-link" aria-label="Выбрать уровень предметов ${level.level}" ${level.level===current.level?'aria-current="true"':''}>${levelBadge(level.level)}</button></td><td>${upgradeStat('icon_gold',level.level===1?'—':format(level.gold),'Золото')}</td><td>${upgradeStat('icon_crystal_dust',level.level===1?'—':format(level.dust),'Пыль')}</td></tr>`).join('');
    const priceSection=`<div class="section-head"><div><span class="eyebrow">03 / ПРОКАЧКА</span><h3>Цена прокачки одной вещи</h3></div></div><p class="summary-note">${samePrices?'Стоимость одинакова для каждой вещи комплекта.':`Стоимость показана для предмета «${escape(group[0].name)}»; цены других вещей могут отличаться.`}</p><div class="table-wrap"><table class="levels" id="gear-price-table" role="table"><thead role="rowgroup" class="sr-only"><tr role="row"><th>Уровень</th><th>Золото</th><th>Пыль</th></tr></thead><tbody role="rowgroup" style="--level-rows:${Math.ceil(priceLevels.length/2)}">${gearPriceRows}</tbody></table></div><div class="gear-price-total"><div class="gear-price-total__title"><strong>Итого с 1 до 10 уровня</strong><span>За одну вещь</span></div><div class="gear-price-total__values">${upgradeStat('icon_gold',format(totalPrice.gold),'Золото')}${upgradeStat('icon_crystal_dust',format(totalPrice.dust),'Пыль')}</div></div>`;
    content.innerHTML=heading+`<div class="gear-controls"><label>Комплект<select id="gear-set">${options}</select></label><div class="gear-level-picker"><span class="gear-level-picker__label">Уровень предметов</span><details class="gear-level-select" id="gear-level-picker"><summary id="gear-level-summary" aria-label="Уровень предметов ${current.level}. Выбрать уровень">${levelBadge(current.level)}<span>${current.level} уровень</span><span class="gear-level-chevron" aria-hidden="true">▾</span></summary><div class="gear-level-options" id="gear-level-options" role="group" aria-label="Выбрать уровень предметов">${levelOptions}</div></details></div></div>${missingIcons?`<div class="notice gear-notice">Иконки для ${missingIcons} из ${group.length} вещей этого комплекта пока недоступны.</div>`:''}<div class="section-head"><div><span class="eyebrow">01 / ПРЕДМЕТЫ</span><h3>Вещи комплекта</h3></div><span class="hint">${group.length} предмета</span></div><div class="gear-grid">${cards}</div><div class="section-head"><div><span class="eyebrow">02 / БОНУС КОМПЛЕКТА</span><h3>${escape(group[0].setBonuses[0]?.name || 'Комплект')}</h3></div></div><div class="bonus-list">${bonuses}</div>${priceSection}`;
    document.querySelector('#gear-set').addEventListener('change',event=>{selectedSet=Number(event.target.value);render()});
    document.querySelector('#gear-level-options').addEventListener('click',event=>{const selected=event.target.closest('[data-gear-level]');if(!selected)return;equipmentLevel=Number(selected.dataset.gearLevel);render();document.querySelector('#gear-level-summary').focus({preventScroll:true})});
    document.querySelector('#gear-level-options').addEventListener('keydown',event=>{if(event.key==='Escape'){document.querySelector('#gear-level-picker').open=false;document.querySelector('#gear-level-summary').focus({preventScroll:true})}});
    document.querySelector('#gear-price-table').addEventListener('click',event=>{const selected=event.target.closest('[data-gear-cost-level]');if(!selected)return;equipmentLevel=Number(selected.dataset.gearCostLevel);render();document.querySelector('#gear-price-table [aria-current="true"]').focus({preventScroll:true})});
  }
  function render() {
    content.onclick = null;
    content.onchange = null;
    if(mode==='talents'){window.TalentsPage.render({content,escape,format,picture});return}
    if(mode==='equipment'){renderEquipment();return}
    const item=chosen, current=findLevel(selectedLevel) || item.levels[0], prev=findLevel(current.level-1);
    document.querySelector('#selection-status').textContent=`${item.name}, уровень ${current.level}`;
    const maxLevel=Math.max(...item.levels.map(level=>level.level));
    const tierStats = level => level?.statsByTier?.[String(buildingTier)] || level?.stats || [];
    const stats=tierStats(current).length ? tierStats(current) : current.core;
    const previous=prev ? (tierStats(prev).length ? tierStats(prev) : prev.core) : [];
    const isScroll=item.type===4;
    const rows=item.levels.map(level=>{const resource=isScroll?level.books:level.cards;return `<tr class="${level.level===current.level?'selected':''}" data-level="${level.level}"><td><button type="button" class="level-link" aria-label="Выбрать уровень ${level.level}" ${level.level===current.level?'aria-current="true"':''}>${levelBadge(level.level)}</button></td><td>${upgradeStat('icon_gold',level.level===1?'Открытие':format(level.gold),'Золото')}</td><td>${upgradeStat(isScroll?'icon_books':'icon_cards',level.level===1?'—':isScroll&&!resource?'—':format(resource),isScroll?'Книги':'Карточки')}</td></tr>`}).join('');
    let details='';
    if(stats.length){
      const grouped=new Map();
      for(const stat of stats){const group=stat.group || 'Основные';if(!grouped.has(group))grouped.set(group,[]);grouped.get(group).push(stat)}
      const order=['Основные','Атака','Защита','Перемещение','Общие'];
      const groups=[...grouped].sort(([a],[b])=>{const ai=order.indexOf(a),bi=order.indexOf(b);return (ai<0?order.length:ai)-(bi<0?order.length:bi)});
      details=groups.map(([group,entries])=>`<section class="game-stat-group"><h4 class="game-stat-title">${escape(group)}</h4><div class="game-stat-grid">${entries.map(s=>{const old=previous.find(p=>p.name===s.name&&(p.group||'Основные')===(s.group||'Основные'));const delta=old && typeof old.value==='number' && typeof s.value==='number' ? s.value-old.value : 0;const displayed=typeof s.value==='number'?format(s.value,s.digits ?? 0):escape(s.value);return `<div class="game-stat">${statPicture(s.name)}<div class="game-stat-copy"><div class="game-stat-value">${displayed}${s.unit?` <span>${escape(s.unit)}</span>`:''}${Math.abs(delta)>1e-9?` <em>${delta>0?'+':''}${format(delta,2)}</em>`:''}</div><div class="game-stat-label">${escape(s.name)}</div></div></div>`}).join('')}</div></section>`).join('');
    }
    content.innerHTML=`<div class="breadcrumb">СПРАВОЧНИК <span> / </span> ${escape(names[item.type])} <span> / </span> ${escape(item.name)}</div>
      <div class="hero"><div class="portrait">${picture(item.icon,'',item.name)}</div><div><div class="title-label">${escape(names[item.type].toUpperCase())} · ${escape(faction(item).toUpperCase())}</div><h2>${escape(item.name)}</h2><p class="description">${escape(item.description || 'Характеристики и прокачка.')}</p>${item.iconAvailable?'':'<p class="summary-note">Иконка карточки пока недоступна.</p>'}</div><div class="hero-badge" data-rarity="${escape(item.rarity)}">${escape((rarity[item.rarity]||'').toUpperCase())}</div></div>
      <div class="section-head"><div><span class="eyebrow">01 / ХАРАКТЕРИСТИКИ</span><h3>Характеристики</h3></div><span class="hint">Прирост показан относительно предыдущего уровня</span></div>
      <div class="game-stats-panel"><div class="game-stats-top"><div class="sheet-identity"><span class="game-stats-kicker">${escape(names[item.type].toUpperCase())} / ${escape(item.name.toUpperCase())}</span><strong class="sheet-level-label">Уровень ${levelBadge(current.level,'level-value')}</strong></div><div class="sheet-level"><input id="level-range" type="range" min="1" max="${maxLevel}" value="${current.level}" step="1" aria-label="Уровень ${escape(item.name)}" aria-valuetext="Уровень ${current.level} из ${maxLevel}"><div class="sheet-stepper"><button type="button" id="level-prev" aria-label="Предыдущий уровень" ${current.level<=1?'disabled':''}>−</button><button type="button" id="level-next" aria-label="Следующий уровень" ${current.level>=maxLevel?'disabled':''}>+</button></div></div>${item.buildingTiers?`<label class="tier-control">ТИР ЗДАНИЯ<select id="building-tier" aria-label="Боевой тир здания">${Array.from({length:item.buildingTiers},(_,i)=>`<option value="${i+1}" ${i+1===buildingTier?'selected':''}>Тир ${i+1}</option>`).join('')}</select></label>`:''}</div>${details || '<div class="notice sheet-notice">Подробные характеристики этой карточки пока недоступны.</div>'}</div>
      <div class="section-head"><div><span class="eyebrow">02 / ТАБЛИЦА УЛУЧШЕНИЙ</span><h3>Все уровни</h3></div></div><div class="table-wrap"><table class="levels" role="table"><thead role="rowgroup" class="sr-only"><tr role="row"><th>Уровень</th><th>Золото</th><th>${isScroll?'Книги':'Карточки'}</th></tr></thead><tbody role="rowgroup" style="--level-rows:${Math.ceil(item.levels.length/2)}">${rows}</tbody></table></div>`;
    if(item.buildingTiers) document.querySelector('#building-tier').addEventListener('change',event=>{buildingTier=Number(event.target.value);render()});
    const range=document.querySelector('#level-range');
    range.addEventListener('input', event => {document.querySelector('#level-value').textContent=event.target.value;range.setAttribute('aria-valuetext',`Уровень ${event.target.value} из ${maxLevel}`)});
    range.addEventListener('change', event => {selectedLevel=Number(event.target.value);render();document.querySelector('#level-range').focus({preventScroll:true})});
    for (const [selector,step] of [['#level-prev',-1],['#level-next',1]]) {
      document.querySelector(selector).addEventListener('click',()=>{selectedLevel=Math.max(1,Math.min(maxLevel,current.level+step));render();const next=document.querySelector(selector);if(!next.disabled)next.focus({preventScroll:true})});
    }
    document.querySelectorAll('[data-level]').forEach(row=>row.addEventListener('click',()=>{selectedLevel=Number(row.dataset.level);render()}));
  }
  function syncTabs(){
    document.querySelectorAll('.tabs button').forEach(button=>{
      const category=Number(button.dataset.type), active=category===type;
      button.hidden=mode==='equipment' && ![1,3].includes(category);
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
  }
  document.querySelectorAll('.tabs button').forEach(button=>button.addEventListener('click',()=>{const nextType=Number(button.dataset.type);if(mode==='equipment'&&![1,3].includes(nextType))return;type=nextType;search.value='';chosen=records.find(item=>item.type===type);if([1,3].includes(type))lastEquipmentChoice=chosen;selectedLevel=1;buildingTier=1;selectedSet=null;equipmentLevel=1;syncTabs();renderList();render();document.querySelector('#selection-status').textContent=`${names[type]}: ${chosen.name}`}));
  document.querySelectorAll('.mode').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.mode;root.classList.toggle('mode-talents',mode==='talents');if(mode==='talents'&&catalogOpen)closeCatalog();if(mode==='equipment'&&![1,3].includes(chosen.type)){chosen=lastEquipmentChoice;type=chosen.type;search.value='';selectedLevel=1;buildingTier=1;selectedSet=null;equipmentLevel=1}document.querySelectorAll('.mode').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button))});syncTabs();renderList();render();document.querySelector('#selection-status').textContent=mode==='talents'?'Древо талантов':`${mode==='equipment'?'Экипировка':'Прокачка'}: ${chosen.name}`}));
  search.addEventListener('input',renderList);
  document.querySelector('#clear-search').addEventListener('click',()=>{search.value='';renderList();search.focus()});
  list.addEventListener('click',event=>{const button=event.target.closest('[data-id]');if(!button)return;chosen=records.find(item=>item.id===button.dataset.id);if([1,3].includes(chosen.type))lastEquipmentChoice=chosen;selectedLevel=1;buildingTier=1;selectedSet=null;equipmentLevel=1;renderList();render();document.querySelector('#selection-status').textContent=`Выбрано: ${chosen.name}`;if(mobileCatalog()){closeCatalog();content.scrollIntoView({block:'start'})}});
  catalogToggle.addEventListener('click',()=>{if(!mobileCatalog())return;if(catalogOpen){closeCatalog();return}catalogOpen=true;syncCatalog();catalogClose.focus({preventScroll:true})});
  catalogClose.addEventListener('click',closeCatalog);
  catalogBackdrop.addEventListener('click',closeCatalog);
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && catalogOpen)closeCatalog()});
  const mobileMedia = window.matchMedia?.('(max-width: 700px)');
  const onLayoutChange = () => {catalogOpen=false;syncCatalog()};
  if(mobileMedia?.addEventListener)mobileMedia.addEventListener('change',onLayoutChange);
  else mobileMedia?.addListener?.(onLayoutChange);
  renderList();render();
  root.classList.add('mobile-menu-ready');
  syncCatalog();
})();
