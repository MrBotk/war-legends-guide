(() => {
  const curves = window.BATTLE_PASS_CURVES;
  const inputs = {curve: 0, current: '1', target: '60', days: '30', partial: '0'};
  const icon = 'icon_battle_pass_points_new';
  const modes = [
    {id:'pvp', name:'PvP 1×1, 2×2, 3×3', icon:'icon_deltafield_dmg', premium:true, minutes:10},
    {id:'arena', name:'Арена', icon:'icon_talent_arena_grandmaster', premium:true, minutes:15},
    {id:'pve', name:'PvE-миссии', icon:'icon_deltafield_target', premium:false, minutes:8},
    {id:'raid', name:'Рейды', icon:'icon_deltafield_role', premium:true, minutes:15},
    {id:'tournament', name:'Турниры', icon:'icon_talents', premium:true, minutes:15}
  ];
  const plan = {dailyQuests:'', weeklyPoints:'', weeklyClaims:'', dailyLimit:'', goldBonus:'', goldWins:'', premium:false};
  for (const mode of modes) {
    plan[mode.id+'-points']='';
    plan[mode.id+'-battles']='';
    plan[mode.id+'-minutes']=String(mode.minutes);
  }
  try {
    const saved=JSON.parse(window.localStorage.getItem('wl-bp-plan') || '{}');
    for (const name of Object.keys(plan)) {
      if (typeof saved[name] === typeof plan[name]) plan[name]=saved[name];
    }
  } catch (_) {}

  function calculate(thresholds, {current, target, days, partial}) {
    const start = thresholds[current - 1];
    const goal = thresholds[target - 1];
    const earned = start + partial;
    const needed = Math.max(0, goal - earned);
    return {earned, goal, needed, daily: needed === 0 ? 0 : Number.isSafeInteger(days) && days > 0 ? Math.ceil(needed / days) : null};
  }

  function forecast({days, needed, dailyQuests, weeklyPoints, weeklyClaims, dailyLimit, goldenDaily, battles}) {
    const dailyBattlePoints = battles.reduce((sum, mode) => sum + mode.points * mode.count, 0);
    const dailyMinutes = battles.reduce((sum, mode) => sum + mode.minutes * mode.count, 0);
    const weeklyDays = new Set(Array.from({length:weeklyClaims}, (_, i) => Math.floor(i * days / weeklyClaims)));
    const earnings = Array.from({length:days}, (_, day) => Math.min(dailyLimit,
      dailyQuests + goldenDaily + dailyBattlePoints + (weeklyDays.has(day) ? weeklyPoints : 0)));
    const total = earnings.reduce((sum, points) => sum + points, 0);
    const remaining = needed === null ? null : Math.max(0, needed - total);
    const capacity = earnings.map(points => dailyLimit - points);
    const extraFights = points => {
      if (remaining === null || points <= 0) return null;
      if (remaining === 0) return 0;
      if (dailyLimit === Infinity) return Math.ceil(remaining / points);
      if (capacity.reduce((sum, free) => sum + free, 0) + 1e-9 < remaining) return null;
      const full = capacity.reduce((sum, free) => sum + Math.floor(free / points), 0);
      if (full * points >= remaining) return Math.ceil(remaining / points);
      let stillNeeded = remaining - full * points;
      let count = full;
      const partials = capacity.map(free => free % points).filter(Boolean).sort((a,b) => b-a);
      for (const partial of partials) {
        if (stillNeeded <= 1e-9) break;
        count++;
        stillNeeded -= partial;
      }
      return count;
    };
    return {total, remaining, dailyMinutes, extraFights, fitsLimit:remaining === null || capacity.reduce((sum, free) => sum + free, 0) + 1e-9 >= remaining};
  }

  function render({content, format, picture, levelBadge}) {
    const max = curves[0].length;
    const n = (id, label, min, upper, optional = false) => `<label class="bp-field" for="bp-${id}"><span>${label}</span>
      <input id="bp-${id}" name="${id}" type="number" min="${min}"${upper === undefined ? '' : ` max="${upper}"`}
        step="1" inputmode="numeric" ${optional ? 'placeholder="0"' : 'required'}></label>`;
    const planField = (name, label, {placeholder='0', max=999999, step=1} = {}) =>
      `<label class="bp-field" for="bp-plan-${name}"><span>${label}</span><input id="bp-plan-${name}" name="${name}" type="number" min="0" max="${max}" step="${step}" inputmode="${step === 1 ? 'numeric' : 'decimal'}" placeholder="${placeholder}"></label>`;
    const modeRows = modes.map(mode => `<article class="bp-mode">
      <div class="bp-mode-name">${picture(mode.icon)}<strong>${mode.name}</strong>${mode.premium ? '<span class="bp-mode-multiplier" aria-hidden="true">×2</span>' : ''}</div>
      <div class="bp-mode-fields">
        ${planField(mode.id+'-points', 'Очки за бой', {step:0.1})}
        ${planField(mode.id+'-battles', 'Боёв в день', {max:999})}
        ${planField(mode.id+'-minutes', 'Минут за бой', {max:1440,step:0.1})}
      </div>
      <div class="bp-mode-results">
        <div><span>Очки в день без лимита</span><strong id="bp-income-${mode.id}">—</strong></div>
        <div><span>Ещё боёв до цели</span><strong id="bp-fights-${mode.id}">—</strong></div>
        <div><span>Время на эти бои</span><strong id="bp-time-${mode.id}">—</strong></div>
      </div>
    </article>`).join('');
    content.innerHTML = `
      <section class="bp-page" aria-labelledby="bp-title">
        <header class="bp-hero">
          <div><span class="eyebrow">БОЕВОЙ ПРОПУСК</span><h2 id="bp-title">Расчёт БП</h2>
            <p>Выбери цель и составь план на оставшиеся дни.</p></div>
          ${picture(icon, 'bp-crest')}
        </header>
        <section class="bp-panel bp-goal-panel">
          <form id="bp-form" novalidate>
            <div class="bp-form-head">
              <h3>План прокачки</h3>
              <label class="bp-field bp-curve" for="bp-curve"><span>Шкала БП</span>
                <select id="bp-curve" name="curve">${curves.map((curve, i) =>
                  `<option value="${i}">${format(curve.at(-1))} очков до ${curve.length}-го уровня</option>`).join('')}</select>
              </label>
            </div>
            <div class="bp-fields">
              ${n('current', 'Текущий уровень', 1, max)}
              ${n('target', 'Целевой уровень', 1, max)}
              ${n('days', 'Осталось дней', 0, 366)}
            </div>
            <details class="bp-extra"${Number(inputs.partial) > 0 ? ' open' : ''}>
              <summary>Учесть очки внутри текущего уровня</summary>
              <div class="bp-extra-body">${n('partial', 'Уже набрано', 0, undefined, true)}<p id="bp-partial-hint"></p></div>
            </details>
          </form>
          <div class="bp-results" aria-live="polite">
            <div class="bp-result">${picture(icon)}<div><span>Осталось набрать</span><strong id="bp-needed">—</strong><small>очков БП</small></div></div>
            <div class="bp-result">${picture('icon_clock')}<div><span>Темп в день</span><strong id="bp-daily">—</strong><small>очков БП</small></div></div>
            <div class="bp-result">${picture('icon_deltafield_target')}<div><span>Порог цели</span><strong id="bp-goal">—</strong><small>очков всего</small></div></div>
          </div>
          <div class="bp-progress">
            <progress id="bp-progress" value="0" max="100" aria-label="Прогресс до целевого уровня"></progress>
            <p id="bp-summary" role="status"></p>
          </div>
        </section>
        <section id="bp-plan-panel" class="bp-panel bp-plan-panel" aria-labelledby="bp-plan-title">
          <header class="bp-plan-heading">
            <div><h3 id="bp-plan-title">Откуда брать очки БП</h3>
              <p>Заполни средние награды по своим результатам. Поля времени содержат пример, его можно изменить.</p></div>
            <div class="bp-premium-control">
              <span class="bp-premium-icon" aria-hidden="true"></span>
              <button type="button" id="bp-premium" class="bp-premium" aria-pressed="false"><span class="bp-switch" aria-hidden="true"></span><b>Премиум</b><span id="bp-premium-status">Выключен</span></button>
            </div>
          </header>
          <form id="bp-income-form" novalidate>
            <div class="bp-income-summary" aria-live="polite">
              <div><span>Наберёшь за период</span><strong id="bp-forecast-total">—</strong></div>
              <div><span>Среднее в день</span><strong id="bp-forecast-daily">—</strong></div>
              <div><span>Не хватает до цели</span><strong id="bp-forecast-left">—</strong></div>
              <div><span>Игровое время в день</span><strong id="bp-forecast-time">—</strong></div>
            </div>
            <p id="bp-forecast-status" class="bp-forecast-status" role="status"></p>
            <section class="bp-quest-source">
              <div class="bp-source-heading">${picture('icon_talent_bp_points_for_quests')}<div><h4>Задания и поручения</h4><p>Ежедневные обновляются каждый день, еженедельные — по понедельникам. Учитывай свой бонус таланта в суммах.</p></div></div>
              <div class="bp-plan-fields">
                ${planField('dailyQuests','Очки за день')}
                ${planField('weeklyPoints','Очки за недельные задания')}
                ${planField('weeklyClaims','Недельных наборов до конца',{placeholder:'',max:53})}
              </div>
              <div class="bp-source-total"><span>За период до лимита</span><strong id="bp-quest-total">—</strong></div>
            </section>
            <details class="bp-plan-extra">
              <summary>Дневной лимит и Золотой БП</summary>
              <div class="bp-plan-fields">
                ${planField('dailyLimit','Лимит очков в день',{placeholder:'—'})}
                ${planField('goldBonus','Бонус очков за победу')}
                ${planField('goldWins','Побед с бонусом в день',{max:3})}
              </div>
              <p>Золотой БП и Премиум — разные бонусы. Золотой БП добавляет очки за первые три победы дня. Впиши лимит из игры, если хочешь учесть его в прогнозе.</p>
            </details>
            <div class="bp-battles-heading"><h4>Бои и миссии</h4>
              <p>Введи средние очки за бой без бонусов Премиума и Золотого БП. Премиум удваивает очки в PvP, на Арене, в рейдах и турнирах. Для PvE используй награду за миссию.</p>
              <p>Поражение в PvP или на Арене быстрее трёх минут может остаться без награды. Для оценки времени укажи среднюю длительность боя с очередью.</p>
            </div>
            <div class="bp-modes">${modeRows}</div>
            <p class="bp-plan-note">«Ещё боёв до цели» — сколько дополнительных боёв нужно сыграть только в этом режиме сверх уже запланированных. Недельные награды учитываются по одному набору в день получения.</p>
          </form>
        </section>
        <section class="bp-panel bp-table-panel">
          <div class="bp-table-head"><h3 id="bp-levels-title">Все уровни БП</h3></div>
          <div id="bp-levels" class="bp-level-columns"></div>
        </section>
      </section>`;
    const find = id => content.querySelector('#bp-' + id);
    const form = find('form');
    const table = find('levels');
    const incomeForm = find('income-form');
    const premium = find('premium');
    const fields = Object.fromEntries(Object.keys(inputs).map(id => [id, find(id)]));
    const planFields = Object.fromEntries(Object.keys(plan).filter(name => name !== 'premium').map(name => [name, find('plan-'+name)]));
    fields.partial.setAttribute('aria-describedby', 'bp-partial-hint');
    for (const [name, element] of Object.entries(fields)) element.value = inputs[name];
    for (const [name, element] of Object.entries(planFields)) element.value = plan[name];

    const displayNumber = value => Number.isFinite(value) ? format(value, 1) : '—';
    const displayMinutes = value => Number.isFinite(value) ? `${format(Math.ceil(value))} мин.` : '—';
    function planNumber(name) {
      const element = planFields[name];
      const number = element.valueAsNumber;
      return Number.isFinite(number) ? Math.min(Number(element.max) || 999999, Math.max(0, number)) : 0;
    }
    function updatePlan(days, result) {
      const validDays = Number.isInteger(days) && days > 0 && days <= 366;
      premium.setAttribute('aria-pressed', String(plan.premium));
      find('plan-panel').classList.toggle('is-premium', plan.premium);
      find('premium-status').textContent = plan.premium ? 'Активен' : 'Выключен';
      planFields.weeklyClaims.placeholder = validDays ? String(Math.floor(days/7)) : '0';
      const battles = modes.map(mode => ({
        ...mode,
        points: planNumber(mode.id+'-points') * (plan.premium && mode.premium ? 2 : 1),
        count: Math.floor(planNumber(mode.id+'-battles')),
        minutes: planNumber(mode.id+'-minutes')
      }));
      const dailyLimit = planFields.dailyLimit.value === '' ? Infinity : planNumber('dailyLimit');
      const weeklyClaims = Math.min(days, planFields.weeklyClaims.value === ''
        ? Math.floor(days/7) : Math.floor(planNumber('weeklyClaims')));
      const dailyQuests = planNumber('dailyQuests');
      const weeklyPoints = planNumber('weeklyPoints');
      const estimate = validDays ? forecast({
        days, needed:result?.needed ?? null, dailyQuests, weeklyPoints, weeklyClaims, dailyLimit,
        goldenDaily:planNumber('goldBonus') * Math.floor(planNumber('goldWins')), battles
      }) : null;
      const configured = ['dailyQuests','weeklyPoints','goldBonus'].some(name=>planFields[name].value !== '') ||
        battles.some(mode=>planFields[mode.id+'-points'].value !== '');
      find('forecast-total').textContent = displayNumber(configured ? estimate?.total : null);
      find('forecast-daily').textContent = displayNumber(configured && estimate ? estimate.total / days : null);
      find('forecast-left').textContent = displayNumber(configured ? estimate?.remaining : null);
      find('forecast-time').textContent = displayMinutes(configured ? estimate?.dailyMinutes : null);
      find('quest-total').textContent = displayNumber(validDays && (planFields.dailyQuests.value !== '' || planFields.weeklyPoints.value !== '')
        ? days * dailyQuests + weeklyClaims * weeklyPoints : null);
      find('forecast-status').textContent = !validDays ? 'Укажи количество оставшихся дней для прогноза.'
        : !configured ? 'Добавь награды за задания или очки за бой, чтобы получить прогноз.'
        : estimate.remaining === null ? 'Укажи текущий и целевой уровни для сравнения с планом.'
        : !estimate.fitsLimit ? 'С таким дневным лимитом до цели не успеть.'
        : estimate.remaining > 0 ? 'План пока не закрывает цель. Ниже видно, сколько дополнительных боёв нужно.'
        : 'По этому плану ты успеваешь к цели.';
      for (const mode of battles) {
        const extra = estimate?.extraFights(mode.points);
        const hasRate = planFields[mode.id+'-points'].value !== '';
        find('income-'+mode.id).textContent = displayNumber(hasRate ? mode.count * mode.points : null);
        find('fights-'+mode.id).textContent = displayNumber(extra);
        find('time-'+mode.id).textContent = displayMinutes(extra === 0 ? 0 : Number.isFinite(extra) && mode.minutes > 0 ? extra * mode.minutes : null);
      }
    }

    let activeCurve;
    function update() {
      const thresholds = curves[Number(fields.curve.value)];
      const {length} = thresholds;
      const current = fields.current.valueAsNumber;
      const target = fields.target.valueAsNumber;
      const days = fields.days.valueAsNumber;
      const partial = fields.partial.value === '' ? 0 : fields.partial.valueAsNumber;
      const isLevel = level => Number.isInteger(level) && level >= 1 && level <= length;
      const validLevels = isLevel(current) && isLevel(target);
      const nextCost = isLevel(current) && current < length ? thresholds[current] - thresholds[current - 1] : 0;
      const partialMax = Math.max(0, nextCost - 1);
      fields.partial.max = partialMax;
      find('partial-hint').textContent = nextCost
        ? `Введи прогресс до следующего уровня, от 0 до ${format(partialMax)} очков.`
        : 'На максимальном уровне дополнительных очков не требуется.';
      const validPartial = Number.isInteger(partial) && partial >= 0 && partial <= partialMax;
      const result = validLevels && validPartial ? calculate(thresholds, {current, target, days, partial}) : null;
      const value = number => number == null ? '—' : format(number);
      find('needed').textContent = value(result?.needed);
      find('daily').textContent = value(result?.daily);
      find('goal').textContent = isLevel(target) ? format(thresholds[target - 1]) : '—';
      find('progress').value = !result ? 0 : result.needed === 0 ? 100 : 100 * result.earned / result.goal;
      let summary;
      if (!validLevels) summary = `Укажи текущий и целевой уровни от 1 до ${length}.`;
      else if (!validPartial) summary = `Укажи прогресс от 0 до ${format(partialMax)} очков.`;
      else if (result.needed === 0) summary = 'Цель уже достигнута.';
      else if (fields.days.value === '') summary = 'Введи число оставшихся дней, чтобы узнать темп.';
      else if (!Number.isSafeInteger(days) || days < 0) summary = 'Укажи целое число дней от нуля.';
      else if (days === 0) summary = 'Дней до конца не осталось.';
      else summary = `Набрано ${format(result.earned)} из ${format(result.goal)} очков до цели.`;
      find('summary').textContent = summary;
      updatePlan(days, result);

      if (activeCurve !== thresholds) {
        activeCurve = thresholds;
        const rows = thresholds.map((points, i) => `<tr data-bp-level="${i + 1}">
          <th scope="row"><button type="button" data-bp-target="${i + 1}" aria-label="Цель — уровень ${i + 1}">${levelBadge(i + 1)}</button></th>
          <td>${i === 0 ? 'Старт' : '+' + format(points - thresholds[i - 1])}</td><td>${format(points)}</td>
        </tr>`);
        const columnSize = Math.ceil(rows.length / 3);
        const columns = [];
        for (let start = 0; start < rows.length; start += columnSize) {
          columns.push(`<table class="bp-table" aria-labelledby="bp-levels-title">
            <thead><tr><th scope="col">Уровень</th><th scope="col">За переход</th><th scope="col">Всего для уровня</th></tr></thead>
            <tbody>${rows.slice(start, start + columnSize).join('')}</tbody>
          </table>`);
        }
        table.innerHTML = columns.join('');
      }
      for (const row of table.querySelectorAll('[data-bp-level]')) {
        const level = Number(row.dataset.bpLevel);
        row.classList.toggle('bp-current', current === level);
        row.classList.toggle('bp-target', target === level);
        row.classList.toggle('bp-in-range', level > current && level < target);
        row.querySelector('button').setAttribute('aria-pressed', String(target === level));
      }
    }

    form.addEventListener('submit', event => event.preventDefault());
    incomeForm.addEventListener('submit', event => event.preventDefault());
    function savePlan() {
      try { window.localStorage.setItem('wl-bp-plan', JSON.stringify(plan)); } catch (_) {}
    }
    incomeForm.addEventListener('input', event => {
      const {name, value} = event.target;
      if (!Object.hasOwn(planFields, name)) return;
      plan[name] = value;
      savePlan();
      update();
    });
    premium.addEventListener('click', () => {
      plan.premium = !plan.premium;
      savePlan();
      update();
    });
    form.addEventListener('input', event => {
      const {name, value} = event.target;
      inputs[name] = value;
      if (name === 'current' || name === 'curve') {
        const thresholds = curves[Number(fields.curve.value)];
        const index = fields.current.valueAsNumber - 1;
        if (Number.isInteger(index) && index >= 0 && index < thresholds.length) {
          const available = (thresholds[index + 1] ?? thresholds[index]) - thresholds[index];
          if (Number(fields.partial.value) >= available) inputs.partial = fields.partial.value = '0';
        }
      }
      update();
    });
    table.addEventListener('click', event => {
      const button = event.target.closest('[data-bp-target]');
      if (!button) return;
      inputs.target = fields.target.value = button.dataset.bpTarget;
      update();
    });
    update();
  }

  window.BattlePassPage = {render, calculate, forecast};
})();
