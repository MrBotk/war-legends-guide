(() => {
  const data = window.TALENTS_DATA;
  const state = { milestone: 1, selected: 1, planned: new Set() };
  let lastNodeClick = null;
  const resources = {
    2: { name: 'Золото', icon: 'icon_gold' },
    201: { name: 'Обычные руны', icon: 'icon_rune_common_big' },
    202: { name: 'Редкие руны', icon: 'icon_rune_rare_big' },
    203: { name: 'Эпические руны', icon: 'icon_rune_epic_big' }
  };
  const leagueNames = { 1: 'Железная', 2: 'Бронзовая', 3: 'Серебряная' };
  const leagueIcons = { 1: 'iron', 2: 'bronze', 3: 'silver' };
  const divisions = { 1: 'I', 2: 'II', 3: 'III' };
  const unitNames = {4:'маны',5:'маны',6:'маны',7:'маны',9:'золота',10:'древесины',11:'ед.',16:'еды',21:'еды',22:'энергии',23:'энергии',24:'энергии',25:'ед.',28:'очков БП',29:'монет',30:'очков БП'};
  const byId = new Map(data.nodes.map(node => [node.id, node]));
  function league(milestone) {
    return `${leagueNames[Math.floor(milestone.division / 100)] || 'Лига'} ${divisions[milestone.division % 100] || ''}`.trim();
  }
  function render({content, escape, format, picture}) {
    const section = data.milestones.find(item => item.id === state.milestone);
    const nodes = data.nodes.filter(node => node.milestone === section.id).sort((a,b) => a.col-b.col || a.row-b.row);
    if (!nodes.some(node => node.id === state.selected)) state.selected = nodes[0].id;
    const current = byId.get(state.selected);
    const talent = data.types[current.talent];
    const columns = Math.max(...nodes.map(node => node.col)) + 1;
    const planned = data.nodes.filter(node => state.planned.has(node.id));
    const sameTalent = data.nodes.filter(node => node.talent === current.talent);
    const plannedAmount = planned.filter(node => node.talent === current.talent).length * talent.amount;
    const maxAmount = sameTalent.length * talent.amount;
    const afterAmount = plannedAmount + (state.planned.has(current.id) ? 0 : talent.amount);
    const unit = talent.percent ? '%' : `${unitNames[talent.id] || 'ед.'}${talent.perMinute ? '/мин' : ''}`;
    const effect = amount => `${format(amount)} ${unit}`;
    const progress = amount => `${format(amount)} / ${format(maxAmount)} ${unit}`;
    const totals = new Map();
    for (const node of planned) for (const cost of node.costs) totals.set(cost.resource, (totals.get(cost.resource) || 0) + cost.amount);
    const costView = cost => {
      const resource = resources[cost.resource];
      if (!resource) return `<span class="talent-cost">${format(cost.amount)} · Ресурс ${escape(cost.resource)}</span>`;
      return `<span class="talent-cost">${picture(resource.icon, '', '')}<span><b>${format(cost.amount)}</b><small>${escape(resource.name)}</small></span></span>`;
    };
    const paths = nodes.flatMap(node => node.prereq.map(id => {
      const previous = byId.get(id);
      if (!previous || previous.milestone !== node.milestone) return '';
      const x1 = previous.col * 88 + 44, y1 = previous.row * 106 + 51;
      const x2 = node.col * 88 + 44, y2 = node.row * 106 + 51;
      return `<path d="M ${x1} ${y1} C ${(x1+x2)/2} ${y1}, ${(x1+x2)/2} ${y2}, ${x2} ${y2}"/>`;
    })).join('');
    const circles = nodes.map(node => {
      const info = data.types[node.talent];
      return `<button type="button" class="talent-node rarity-${info.rarity} ${node.id === current.id ? 'is-selected' : ''} ${state.planned.has(node.id) ? 'is-planned' : ''}" style="left:${node.col*88+11.7}px;top:${node.row*106+16.8}px" data-talent-node="${node.id}" aria-label="${escape(info.name)}" aria-description="${state.planned.has(node.id)?'Добавлен в план':'Не добавлен в план'}. Дважды нажмите, чтобы изменить." aria-pressed="${node.id === current.id}"><img src="assets/${encodeURIComponent(info.icon)}.png" alt=""><span aria-hidden="true">${state.planned.has(node.id)?'✓':''}</span></button>`;
    }).join('');
    const prerequisites = current.prereq.map(id => {
      const previous = byId.get(id);
      if (!previous) return '';
      const previousLeague = data.milestones.find(item => item.id === previous.milestone);
      return `<button type="button" class="talent-connection" data-talent-go="${previous.id}">${escape(data.types[previous.talent].name)} <small>${escape(league(previousLeague))}</small></button>`;
    }).join('');
    const leagueButtons = data.milestones.map(item => `<button type="button" class="talent-league ${item.id===section.id?'active':''}" data-talent-league="${item.id}" aria-pressed="${item.id===section.id}"><img src="assets/icon_league_${leagueIcons[Math.floor(item.division / 100)]}_big.png" alt="" aria-hidden="true"><span>${escape(league(item))}</span></button>`).join('');
    const rarityName = {1:'Обычный',2:'Редкий',3:'Эпический'}[talent.rarity] || '';
    content.innerHTML = `<div class="breadcrumb">СПРАВОЧНИК <span> / </span> ТАЛАНТЫ</div>
      <header class="talents-hero"><div><span class="eyebrow">ДРЕВО ТАЛАНТОВ</span><h2>Таланты</h2><p>Выберите лигу и талант, чтобы увидеть его эффект и стоимость.</p></div><img src="assets/icon_talents.png" alt=""></header>
      <div class="talent-leagues" role="group" aria-label="Лига">${leagueButtons}</div>
      <div class="talent-layout"><section class="talent-tree-panel"><div class="talent-panel-heading"><div><span class="eyebrow">ВЕТКА РАЗВИТИЯ</span><h3>${escape(league(section))}</h3></div><span>${nodes.length} талантов</span></div>
        <div class="talent-scroll" tabindex="0" aria-label="Ветка талантов ${escape(league(section))}"><div class="talent-canvas" style="width:${columns*88}px"><svg viewBox="0 0 ${columns*88} 318" width="${columns*88}" height="318" aria-hidden="true">${paths}</svg>${circles}</div></div>
        <p class="talent-scroll-hint">Нажмите на талант, чтобы посмотреть его. Двойное нажатие добавит или уберёт его из плана. Ветку можно прокручивать в стороны.</p></section>
        <aside class="talent-details" aria-live="polite"><div class="talent-detail-heading"><img src="assets/${encodeURIComponent(talent.icon)}.png" alt=""><div><span class="gear-quality" data-rarity="${talent.rarity}">${escape(rarityName)}</span><h3>${escape(talent.name)}</h3></div></div>
          <p class="talent-description">${escape(talent.description)}</p><div class="talent-value"><span>Эффект одной ступени</span><strong>${effect(talent.amount)}</strong></div>
          <div class="talent-progress"><div class="talent-progress-line"><span>В выбранном плане</span><strong>${progress(plannedAmount)}</strong></div><div class="talent-progress-track" role="progressbar" aria-label="Прогресс таланта в плане" aria-valuemin="0" aria-valuemax="${maxAmount}" aria-valuenow="${plannedAmount}"><span style="width:${maxAmount ? plannedAmount/maxAmount*100 : 0}%"></span></div>${state.planned.has(current.id)?'':`<div class="talent-progress-line"><span>После добавления</span><strong>${progress(afterAmount)}</strong></div>`}</div>
          <h4>Стоимость изучения</h4><div class="talent-costs">${current.costs.map(costView).join('')}</div>
          ${prerequisites?`<h4>Связанные предыдущие таланты</h4><div class="talent-connections">${prerequisites}</div>`:''}
        </aside>
      <section class="talent-plan"><div class="talent-plan-heading"><div><span class="eyebrow">ПЛАН ПРОКАЧКИ</span><h3>Общая стоимость</h3><p>Выбрано талантов: ${planned.length} / ${data.nodes.length}</p></div><div class="talent-plan-actions"><button type="button" class="talent-clear" data-talent-all>Выбрать все</button>${planned.length?'<button type="button" class="talent-clear" data-talent-clear>Очистить план</button>':''}</div></div><div class="talent-costs">${[2,201,202,203].map(resource=>costView({resource,amount:totals.get(resource)||0})).join('')}</div></section></div>`;
    content.onclick = event => {
      const oldMilestone = state.milestone;
      const scrollPosition = content.querySelector('.talent-scroll')?.scrollLeft || 0;
      const leagueScroll = content.querySelector('.talent-leagues')?.scrollLeft || 0;
      const node = event.target.closest('[data-talent-node]');
      const tab = event.target.closest('[data-talent-league]');
      const link = event.target.closest('[data-talent-go]');
      const selectAll = event.target.closest('[data-talent-all]');
      const clear = event.target.closest('[data-talent-clear]');
      if (node) {
        const id = Number(node.dataset.talentNode), now = Date.now();
        state.selected = id;
        if (lastNodeClick && lastNodeClick.id === id && now - lastNodeClick.time <= 500) {
          if (state.planned.has(id)) state.planned.delete(id); else state.planned.add(id);
          lastNodeClick = null;
        } else lastNodeClick = {id,time:now};
      }
      else if (tab) { lastNodeClick = null; state.milestone = Number(tab.dataset.talentLeague); state.selected = -1; }
      else if (link) { const target=byId.get(Number(link.dataset.talentGo)); if(!target)return;lastNodeClick=null;state.milestone=target.milestone;state.selected=target.id; }
      else if (selectAll) { lastNodeClick = null; data.nodes.forEach(item => state.planned.add(item.id)); }
      else if (clear) { lastNodeClick = null; state.planned.clear(); }
      else return;
      render({content, escape, format, picture});
      const leagueScroller = content.querySelector('.talent-leagues');
      if (leagueScroller) leagueScroller.scrollLeft = leagueScroll;
      if (oldMilestone === state.milestone) {
        const scroller = content.querySelector('.talent-scroll');
        if (scroller) scroller.scrollLeft = scrollPosition;
      }
      const focusTarget = selectAll ? '[data-talent-all]' : clear ? '[data-talent-all]' : `[data-talent-node="${state.selected}"]`;
      content.querySelector(focusTarget)?.focus({preventScroll:true});
    };
  }
  window.TalentsPage = {render};
})();
