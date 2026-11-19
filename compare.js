(() => {
  const memory = new Map();
  const resistanceNames = {resistCut:'Сопр. режущему',resistPierce:'Сопр. колющему',resistSmash:'Сопр. дробящему',resistExplode:'Сопр. взрывному',resistMagic:'Сопр. магическому'};
  const resistanceIcons = {resistCut:'resist_cutting',resistPierce:'resist_piercing',resistSmash:'resist_crushing',resistExplode:'resist_exploding',resistMagic:'resist_magic'};
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number(n)||0));
  const key=a=>`${a.type}:${a.id}:${a.field}`;
  const slotLimit=unit=>unit?.type===3?4:3;
  function slots(items){return [...new Set(items.map(i=>i.category))];}
  function equipSet(items,setId,level=1,unit){return slots(items).slice(0,slotLimit(unit)).map(category=>{const item=items.find(i=>i.category===category&&i.setId===setId);return {category,id:item?.id||null,level};});}
  function defaultState(items,unit){
    const groups=[...new Set(items.map(i=>i.setId))];
    return {level:1, sides:[equipSet(items,groups[0],1,unit),equipSet(items,groups[1]??groups[0],1,unit)],open:null,armor:100,enemyResist:0,incoming:'resistCut',uptime:100,hit:100};
  }
  function evaluate(unit,items,hints,build,settings){
    const level=unit.levels.find(l=>l.level===settings.level)||unit.levels[0];
    const stats=level.stats||level.core||[];
    const stat=(name,group)=>{const s=stats.find(x=>x.name===name&&(!group||x.group===group));return typeof s?.value==='number'?s.value:null;};
    let out={life:stat('Здоровье','Защита'),armor:stat('Броня','Защита'),regen:stat('Регенерация','Защита'),damage:stat('Урон','Атака'),crit:stat('Шанс крит. атаки','Атака'),critDmg:stat('Крит. урон','Атака'),attacks:stat('Скорость атаки','Атака'),move:stat('Скорость движения','Перемещение'),distance:stat('Дальность атаки','Атака'),gold:stat('Добыча золота','Добытчик'),wood:stat('Добыча древесины','Добытчик'),accuracyMove:stat('Меткость в движении','Общее'),other:[],bonuses:[],activeItems:[],resists:{}};
    for(const [field,name] of Object.entries(resistanceNames))out.resists[field]=stat(name,'Защита');
    out.worker=out.gold!==null||out.wood!==null;
    const mainWeapon=Object.entries(hints).find(([k,v])=>k.startsWith('12:')&&k.endsWith(':dmgVal1')&&v.group==='Атака')?.[0].split(':')[1];
    const mainState=Object.entries(hints).find(([k,v])=>k.startsWith('10:')&&k.endsWith(':armor')&&v.group==='Защита')?.[0].split(':')[1];
    const mode=Object.entries(hints).find(([k])=>k===`10:${mainState}:armor`)?.[1]?.mode;
    out.state=mode||null;
    out.deploy=stat('Развёртывание','Общее');
    const selected=build.map(s=>({slot:s,item:items.find(i=>i.id===s.id&&i.category===s.category)})).filter(x=>x.item);
    out.activeItems=selected.map(x=>x.item);
    const actions=[];
    for(const {slot,item} of selected){const levelData=item.levels.find(l=>l.level===slot.level);for(const a of levelData?.actions||[])actions.push(a);}
    if(selected.length===slotLimit(unit) && new Set(selected.map(x=>x.item.category)).size===slotLimit(unit) && selected.every(x=>x.item.setId===selected[0].item.setId)){
      const minLevel=Math.min(...selected.map(x=>x.slot.level));
      for(const bonus of selected[0].item.setBonuses||[])if(bonus.level<=minLevel){out.bonuses.push(bonus);actions.push(...bonus.actions);}
    }
    out.allActions=actions;
    let interval=out.attacks>0?600/out.attacks:null;
    let moveInterval=out.move>0?600/out.move:null;
    for(const a of actions){
      const hint=hints[key(a)];
      let used=false;
      if(a.op==='add'&&typeof a.value==='number'){
        let field=null, factor=1;
        if(a.type===11&&a.id===unit.entity&&a.field==='life')field='life';
        if(a.type===10&&String(a.id)===mainState){
          if(a.field==='armor')field='armor';
          if(a.field==='regen')field='regen';
          if(a.field==='speed'&&moveInterval!==null){moveInterval+=a.value;used=true;}
          if(a.field in out.resists && out.resists[a.field]!==null){out.resists[a.field]+=a.value;used=true;}
        }
        if(a.type===12&&String(a.id)===mainWeapon){
          if(a.field==='dmgVal1')field='damage';
          if(a.field==='critChance'){field='crit';factor=.1;}
          if(a.field==='critDmg'){field='critDmg';factor=.1;}
          if(a.field==='distance'){field='distance';factor=.01;}
          if(a.field==='round_len'&&interval!==null){interval+=a.value;used=true;}
        }
        if(a.type===200 && hint?.group==='Добытчик'){
          if(a.field==='harvestGoldTime'){field='gold';factor=.1;}
          if(a.field==='harvestLumberTime'){field='wood';factor=.1;}
        }
        if(field&&out[field]!==null){out[field]+=a.value*factor;used=true;}
      }
      if(!used)out.other.push(a);
    }
    out.attacks=interval>0?600/interval:null;
    out.move=moveInterval>0?600/moveInterval:null;
    out.resist=out.resists[settings.incoming];
    const armorFactor=out.armor!==null&&out.armor>=0?400/(400+out.armor):null;
    const resistance=out.resist!==null?1-out.resist/100:null;
    out.ehp=out.life!==null&&armorFactor!==null&&resistance>0?out.life/(armorFactor*resistance):null;
    const critFactor=out.crit!==null&&out.critDmg!==null?1+clamp(out.crit,0,100)/100*out.critDmg/100:1;
    const enemyFactor=400/(400+clamp(settings.armor,0,10000))*(1-clamp(settings.enemyResist,-100,99)/100);
    out.dps=out.damage!==null&&out.attacks!==null?out.damage*out.attacks/60*critFactor*enemyFactor*clamp(settings.uptime,0,100)/100*clamp(settings.hit,0,100)/100:null;
    out.score=out.ehp!==null&&out.dps!==null?out.ehp*out.dps:null;
    out.missingCrit=out.crit===null||out.critDmg===null;
    return out;
  }
  function chooseWinner(a,b){
    const comparable=(x,y)=>Number.isFinite(x)&&Number.isFinite(y);
    const distinct=(x,y)=>comparable(x,y)&&Math.abs(x-y)>Math.max(Math.abs(x),Math.abs(y),1)*.001;
    if(a.worker&&b.worker){
      if(distinct(a.gold,b.gold))return {winner:a.gold<b.gold?0:1,reason:'gold'};
      if(distinct(a.wood,b.wood))return {winner:a.wood<b.wood?0:1,reason:'wood'};
    }
    if(distinct(a.score,b.score))return {winner:a.score>b.score?0:1,reason:'combat'};
    if(comparable(a.score,b.score))return {winner:null,reason:'equal'};
    return {winner:null,reason:'unknown'};
  }

  function comparisonMetrics(unit, builds, hints, level) {
    const groups = [];
    const buildValues = field => builds.map(build => build[field]);
    function section(title, note = '') {
      const rows = [];
      groups.push({title, note, rows});
      return (label, icon, values, unitLabel = '', options = {}) => {
        if (values.some(Number.isFinite)) rows.push({label, icon, values, unitLabel, ...options});
      };
    }

    const core = section('Основное');
    core('Здоровье', 'hp', buildValues('life'), 'HP');
    core('Регенерация', 'regen', buildValues('regen'), 'HP/мин');
    core('Скорость движения', 'movespeed', buildValues('move'), '/мин');

    const gathering = section('Добыча ресурсов');
    gathering('Время добычи золота', 'gold', buildValues('gold'), 'сек.', {smallerIsBetter:true});
    gathering('Время добычи древесины', 'wood', buildValues('wood'), 'сек.', {smallerIsBetter:true});

    const stats = unit.levels.find(entry => entry.level === level)?.stats || [];
    const splitAttack = stats.some(stat => stat.group === 'Атака по воздушным' && stat.name === 'Урон');
    const targets = splitAttack ? ['ground', 'air'] : ['ground'];
    for (const target of targets) {
      const attackGroup = splitAttack ? (target === 'ground' ? 'Атака по наземным' : 'Атака по воздушным') : 'Атака';
      const add = section(splitAttack ? `${attackGroup} целям` : attackGroup);
      const weapons = builds.map(build => window.GearDuel.weapon(unit, stats, hints, build.allActions, target));
      const values = (field, readWeapon) => weapons.map((weapon, i) =>
        weapon ? readWeapon(weapon) : (splitAttack ? null : builds[i][field]));
      add('Урон за удар', 'dmg', values('damage', weapon => weapon.damage));
      add('Шанс крита', 'crit_chance', values('crit', weapon => weapon.crit), '%');
      add('Критический урон', 'crit_dmg', values('critDmg', weapon => weapon.critDmg), '%');
      add('Скорость атаки', 'attack_speed', values('attacks', weapon => 60 / weapon.interval), '/мин');
      if (!stats.some(stat => stat.group === attackGroup && stat.name === 'Дальность атаки' && stat.value === 'Ближний бой')) {
        add('Дальность атаки', 'range', values('distance', weapon => weapon.range), 'кл.');
      }
      add('Средний урон в минуту', 'dmg', weapons.map(weapon =>
        weapon ? weapon.damage * (1 + weapon.crit * weapon.critDmg / 10000) * (60 / weapon.interval) : null), '/мин');
    }

    const effectiveHealth = builds.map(build =>
      Number.isFinite(build.life) && Number.isFinite(build.armor) && build.armor >= 0
        ? build.life * (1 + build.armor / 400) : null);
    const defense = section('Броня и запас здоровья', effectiveHealth.some(Number.isFinite)
      ? 'Эффективное HP = здоровье × (1 + броня / 400). Сопротивления считаются отдельно.' : '');
    defense('Броня', 'armor', buildValues('armor'));
    defense('Эффективное здоровье', 'bonus_hp', effectiveHealth, 'HP', {
      armorHealth: effectiveHealth.map((value, i) => Number.isFinite(value) ? value - builds[i].life : null)
    });

    const resists = section('Сопротивления урону', 'Процент урона, который поглощает сопротивление каждого типа.');
    for (const [field, name] of Object.entries(resistanceNames)) {
      const label = name.replace(/^Сопр\. (.)/u, (_, letter) => letter.toUpperCase());
      resists(`${label} урону`, resistanceIcons[field], builds.map(build => build.resists[field]), '%');
    }
    return groups.filter(group => group.rows.length);
  }

  function render(ctx) {
    const {content, chosen, equipment, equipmentIcons, escape: e, format, picture, levelBadge} = ctx;
    const items = equipment.items.filter(item => item.unit === chosen.entity && [1, 3].includes(chosen.type));
    const title = `<div class="breadcrumb">СПРАВОЧНИК <span> / </span> КОНСТРУКТОР ШМОТА <span> / </span> ${e(chosen.name)}</div>
      <header class="compare-heading">
        ${picture(chosen.icon, 'compare-unit', '')}
        <div><h2>Конструктор шмота</h2><p>${e(chosen.name)}</p></div>
      </header>`;
    if (!items.length) {
      content.innerHTML = title + '<div class="notice">Для этого персонажа нет доступной экипировки.</div>';
      return;
    }

    let state = memory.get(chosen.id);
    if (!state) {
      state = defaultState(items, chosen);
      memory.set(chosen.id, state);
    }
    const sets = [...new Map(items.map(item => [item.setId, item])).values()]
      .sort((a, b) => a.rarity - b.rarity || (a.setBonuses[0]?.name || '').localeCompare(b.setBonuses[0]?.name || '', 'ru'));
    const hints = equipment.hints[String(chosen.entity)] || {};
    const minLevel = Math.min(...chosen.levels.map(entry => entry.level));
    const maxLevel = Math.max(...chosen.levels.map(entry => entry.level));
    state.level = clamp(state.level, minLevel, maxLevel);
    const builds = state.sides.map(slots => evaluate(chosen, items, hints, slots, state));
    const selected = slot => items.find(item => item.id === slot.id && item.category === slot.category);
    const option = (value, label, current) =>
      `<option value="${value}"${value === current ? ' selected' : ''}>${e(label)}</option>`;
    const levels = current => Array.from({length: 10}, (_, i) => option(i + 1, i + 1, current)).join('');
    const qualities = {1: 'Обычное', 2: 'Редкое', 3: 'Эпическое'};
    const gearImage = item => item && equipmentIcons.has(item.icon)
      ? picture(item.icon, 'compare-item-icon')
      : picture('nav_equipment_backpack', 'compare-item-icon');

    function renderSide(index) {
      const build = state.sides[index];
      const calc = builds[index];
      const equipped = calc.activeItems.length;
      const limit = slotLimit(chosen);
      const first = calc.activeItems[0];
      const sameSet = first && calc.activeItems.every(item => item.setId === first.setId) ? first : null;
      const set = equipped === limit ? sameSet : null;
      const slotCards = build.map((slot, slotIndex) => {
        const item = selected(slot);
        const id = `${index}:${slotIndex}`;
        const open = state.open === id;
        const pickerId = `compare-picker-${index}-${slotIndex}`;
        const occupied = new Set(build.filter((other, i) => i !== slotIndex && other.id !== null).map(other => other.category));
        const choices = open ? items.filter(candidate => !occupied.has(candidate.category)).sort((a, b) =>
          Number(b.category === slot.category) - Number(a.category === slot.category) ||
          a.rarity - b.rarity || a.name.localeCompare(b.name, 'ru')) : [];
        return `<div class="compare-slot${item ? '' : ' is-empty'}">
          <div class="compare-slot-row">
            <button type="button" class="compare-item${open ? ' is-open' : ''}" ${item ? `data-rarity="${item.rarity}"` : ''}
              data-compare-open="${id}" aria-expanded="${open}" aria-controls="${pickerId}" aria-label="${e(item ? `Заменить ${item.name}` : `Выбрать предмет для слота ${slotIndex + 1}`)}">
              ${item ? gearImage(item) : '<span class="compare-empty-icon" aria-hidden="true">+</span>'}
              <span class="compare-item-copy"><b>${e(item?.name || 'Пустой слот')}</b><small>${item ? e(qualities[item.rarity] || '') : 'Выбрать вещь'}</small></span>
              <span class="compare-chevron" aria-hidden="true">⌄</span>
            </button>
            ${item ? `<label class="compare-item-level">Уровень
              <select data-compare-item-level="${id}" aria-label="${e(`Уровень предмета «${item.name}»`)}">${levels(slot.level)}</select>
            </label><button type="button" class="compare-clear" data-compare-clear="${id}" aria-label="${e(`Снять ${item.name}`)}" title="Снять предмет">×</button>` : ''}
          </div>
          <div id="${pickerId}" class="compare-picker"${open ? '' : ' hidden'} role="group" aria-label="Выбор предмета">
            ${open ? `<button type="button" class="compare-choice-empty" data-compare-clear="${id}">
              <span aria-hidden="true">∅</span> Пустой слот
            </button>
            <div class="compare-choices">
              ${choices.map(candidate => `<button type="button" class="compare-choice"
                data-rarity="${candidate.rarity}" data-compare-pick="${id}:${candidate.id}" aria-pressed="${candidate.id === slot.id}">
                ${gearImage(candidate)}<span class="compare-item-copy"><b>${e(candidate.name)}</b><small>${e(qualities[candidate.rarity] || '')}</small></span>
              </button>`).join('')}
            </div>` : ''}
          </div>
        </div>`;
      }).join('');

      return `<section class="compare-build" data-side="${index + 1}" aria-label="Сборка ${index + 1}">
        <header class="compare-build-head">
          <div><span class="compare-number" aria-hidden="true">${index === 0 ? 'I' : 'II'}</span>
            <div><h3>Сборка ${index + 1}</h3><p>${e(sameSet?.setBonuses[0]?.name || (equipped ? 'Своя сборка' : 'Без экипировки'))}</p></div></div>
          <div class="compare-count">
            <span><b>${equipped} / ${limit}</b> надето</span>
            <span class="compare-count-track" aria-hidden="true">${build.map(slot => `<i${slot.id !== null ? ' class="is-filled"' : ''}></i>`).join('')}</span>
          </div>
        </header>
        <div class="compare-preset">
          <label>Выбрать комплект<select data-compare-set="${index}"><option value="" disabled${set ? '' : ' selected'}>Выбрать…</option>
            ${sets.map(item => option(item.setId, item.setBonuses[0]?.name || 'Комплект', set?.setId)).join('')}</select></label>
          <label>Все вещи<select data-compare-all-level="${index}" aria-label="Уровень всех вещей сборки ${index + 1}"${equipped ? '' : ' disabled'}>
            <option value="" selected disabled>Уровень</option>${levels(-1)}</select></label>
        </div>
        <div class="compare-slots">${slotCards}</div>
        <div class="compare-set-summary${calc.bonuses.length ? ' is-active' : ''}">${calc.bonuses.length
          ? `<b>Бонусы комплекта активны</b><span>Уровни ${calc.bonuses.map(bonus => bonus.level).join(', ')}</span>`
          : `<b>Бонус комплекта не активен</b><span>Нужны ${limit} вещи одного комплекта</span>`}</div>
      </section>`;
    }

    const groups = comparisonMetrics(chosen, builds, hints, state.level);
    const statGroups = groups.map(({title, note, rows}) => `<tbody>
      <tr class="compare-stat-group"><th colspan="3" scope="rowgroup">${e(title)}${note ? `<small>${e(note)}</small>` : ''}</th></tr>
      ${rows.map(metric => {
        const cells = metric.values.map((value, index) => {
          const other = metric.values[1 - index];
          const better = Number.isFinite(value) && Number.isFinite(other) &&
            (metric.smallerIsBetter ? other - value : value - other) > 1e-6;
          const armorHealth = metric.armorHealth?.[index];
          const amount = Number.isFinite(value)
            ? `<strong>${e(format(value, 2))}</strong>${metric.unitLabel ? ` <span class="compare-stat-unit">${e(metric.unitLabel)}</span>` : ''}`
            : '—';
          return `<td${better ? ' class="compare-stat-better"' : ''}>${amount}${Number.isFinite(armorHealth)
            ? `<small class="compare-stat-detail">+${e(format(armorHealth, 2))} HP от брони</small>` : ''}</td>`;
        });
        return `<tr${metric.armorHealth ? ' class="compare-stat-effective"' : ''}>
          <th scope="row"><span>${picture(`icon_deltafield_${metric.icon}`, 'stat-icon')}${e(metric.label)}</span></th>${cells.join('')}
        </tr>`;
      }).join('')}
    </tbody>`).join('');
    content.innerHTML = title + `<div class="compare-builds">${renderSide(0)}${renderSide(1)}</div>
      <div class="compare-stats">
        <div class="compare-stats-head">
          <h3 id="compare-stats-title">Характеристики сборок</h3>
          <div class="compare-character-level">
            <label for="compare-level-range">Уровень <span aria-hidden="true">${levelBadge(state.level, 'compare-level-value')}</span></label>
            <div class="sheet-level">
              <input id="compare-level-range" data-compare-character-level type="range" min="${minLevel}" max="${maxLevel}" value="${state.level}" step="1" aria-valuetext="Уровень ${state.level} из ${maxLevel}">
              <div class="sheet-stepper">
                <button type="button" data-compare-level-step="-1" aria-label="Предыдущий уровень"${state.level === minLevel ? ' disabled' : ''}>−</button>
                <button type="button" data-compare-level-step="1" aria-label="Следующий уровень"${state.level === maxLevel ? ' disabled' : ''}>+</button>
              </div>
            </div>
          </div>
        </div>
        <table class="compare-stat-table" aria-labelledby="compare-stats-title">
          <thead><tr><th scope="col">Показатель</th><th scope="col" data-side="1">Сборка 1</th><th scope="col" data-side="2">Сборка 2</th></tr></thead>
          ${statGroups}
        </table>
      </div>`;
    function redraw(focusSelector) {
      render(ctx);
      const target = content.querySelector(focusSelector);
      (target?.disabled ? content.querySelector('#compare-level-range') : target)?.focus({preventScroll: true});
    }
    const range = content.querySelector('#compare-level-range');
    range?.addEventListener('input', () => {
      content.querySelector('#compare-level-value').textContent = range.value;
      range.setAttribute('aria-valuetext', `Уровень ${range.value} из ${maxLevel}`);
    });
    content.onclick = event => {
      const step = event.target.closest('[data-compare-level-step]');
      if (step) {
        const {compareLevelStep} = step.dataset;
        state.level = clamp(state.level + Number(compareLevelStep), minLevel, maxLevel);
        redraw(`[data-compare-level-step="${compareLevelStep}"]`);
        return;
      }
      const open = event.target.closest('[data-compare-open]');
      const pick = event.target.closest('[data-compare-pick]');
      const clear = event.target.closest('[data-compare-clear]');
      if (open) {
        const id = open.dataset.compareOpen;
        state.open = state.open === id ? null : id;
        redraw(`[data-compare-open="${id}"]`);
      } else if (clear) {
        const [side, slot] = clear.dataset.compareClear.split(':').map(Number);
        state.sides[side][slot].id = null;
        state.open = null;
        redraw(`[data-compare-open="${side}:${slot}"]`);
      } else if (pick) {
        const [side, slot, id] = pick.dataset.comparePick.split(':').map(Number);
        const build = state.sides[side];
        const item = items.find(candidate => candidate.id === id &&
          !build.some((other, i) => i !== slot && other.id !== null && other.category === candidate.category));
        if (!item) return;
        const vacant = build.find((other, i) => i !== slot && other.id === null && other.category === item.category);
        if (vacant) vacant.category = build[slot].category;
        build[slot] = {...build[slot], id, category: item.category};
        state.open = null;
        redraw(`[data-compare-open="${side}:${slot}"]`);
      }
    };
    content.onchange = event => {
      const {dataset, value} = event.target;
      if (dataset.compareCharacterLevel !== undefined) {
        state.level = clamp(value, minLevel, maxLevel);
        redraw('#compare-level-range');
      } else if (dataset.compareSet !== undefined) {
        const i = Number(dataset.compareSet), id = Number(value);
        if (!sets.some(item => item.setId === id)) return;
        state.sides[i] = state.sides[i].map(slot => ({
          ...slot, id: items.find(item => item.category === slot.category && item.setId === id)?.id ?? null
        }));
        state.open = null;
        redraw(`[data-compare-set="${i}"]`);
      } else if (dataset.compareAllLevel !== undefined && value) {
        const i = Number(dataset.compareAllLevel);
        state.sides[i].forEach(slot => { slot.level = clamp(value, 1, 10); });
        redraw(`[data-compare-all-level="${i}"]`);
      } else if (dataset.compareItemLevel) {
        const [i, slot] = dataset.compareItemLevel.split(':').map(Number);
        state.sides[i][slot].level = clamp(value, 1, 10);
        redraw(`[data-compare-item-level="${i}:${slot}"]`);
      }
    };
  }
  window.GearCompare={render,evaluate,equipSet,defaultState,chooseWinner,slotLimit};
})();
