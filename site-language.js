(() => {
  const messages = window.SITE_TRANSLATIONS;
  const byLowercase = new Map(Object.entries(messages).map(([key, value]) => [key.toLowerCase(), value]));
  const locales = {ru: 'ru-RU', uk: 'uk-UA', en: 'en-US'};
  const names = {ru: 'Русский', uk: 'Українська', en: 'English'};
  const attrs = ['aria-label', 'aria-description', 'aria-valuetext', 'alt', 'title', 'placeholder'];
  const stored = new WeakMap();
  let language = 'ru';
  try {
    const saved = localStorage.getItem('wl-language');
    if (Object.hasOwn(locales, saved)) language = saved;
  } catch (_) {}

  function translated(source) {
    if (language === 'ru' || !/[А-ЯЁа-яё]/u.test(source)) return source;
    const key = source.replace(/\s+/gu, ' ').trim();
    const use = (uk, en) => language === 'uk' ? uk : en;
    const direct = messages[key];
    if (direct) return direct[language === 'uk' ? 0 : 1];
    const equivalent = byLowercase.get(key.toLowerCase());
    if (equivalent) {
      const text = equivalent[language === 'uk' ? 0 : 1];
      return key === key.toUpperCase() ? text.toLocaleUpperCase(locales[language]) : text;
    }
    for (const separator of [' → ', ' · ', ' / ']) {
      if (key.includes(separator)) return key.split(separator).map(translated).join(separator);
    }
    const rules = [
      [/^(\d+)-я ступень · скидка (\d+)%$/u, (_, rank, discount) => use(`Ступінь ${rank} · знижка ${discount}%`, `Rank ${rank} · ${discount}% off`)],
      [/^(\d+)-я ступень$/u, (_, rank) => use(`Ступінь ${rank}`, `Rank ${rank}`)],
      [/^скидка (\d+)%$/u, (_, discount) => use(`знижка ${discount}%`, `${discount}% off`)],
      [/^Уровень (\d+) из (\d+)$/u, (_, level, max) => use(`Рівень ${level} із ${max}`, `Level ${level} of ${max}`)],
      [/^(Уровень|Тир|Сборка|Ресурс) (\d+)$/u, (_, label, num) => `${translated(label)} ${num}`],
      [/^Выбрать уровень (предметов )?(\d+)$/u, (_, items, level) => use(`Вибрати рівень ${items ? 'предметів ' : ''}${level}`, `Choose ${items ? 'item ' : ''}level ${level}`)],
      [/^Уровень всех вещей сборки (\d+)$/u, (_, num) => use(`Рівень усіх предметів збірки ${num}`, `Level for all items in build ${num}`)],
      [/^Уровень предмета «(.+)»$/u, (_, item) => use(`Рівень предмета «${translated(item)}»`, `Level of ${translated(item)}`)],
      [/^(Снять|Заменить) (.+)$/u, (_, verb, item) => `${translated(verb)} ${translated(item)}`],
      [/^Выбрать предмет для слота (\d+)$/u, (_, num) => use(`Вибрати предмет для слота ${num}`, `Choose an item for slot ${num}`)],
      [/^Нужны (\d+) вещи одного комплекта$/u, (_, num) => use(`Потрібні ${num} предмети одного комплекту`, `Equip ${num} items from the same set`)],
      [/^Уровни ([\d, ]+)$/u, (_, levels) => use(`Рівні ${levels}`, `Levels ${levels}`)],
      [/^Персонаж (\d+)-го уровня$/u, (_, level) => use(`Персонаж ${level}-го рівня`, `Character level ${level}`)],
      [/^([+\-−]?\d[\d., ]*) HP от брони$/u, (_, hp) => use(`${hp} HP від броні`, `${hp} HP from armor`)],
      [/^Итого с (\d+) до (\d+) уровня$/u, (_, min, max) => use(`Усього з ${min} до ${max} рівня`, `Total from level ${min} to ${max}`)],
      [/^Стоимость показана для предмета «(.+)»; цены других вещей могут отличаться\.$/u, (_, item) => use(`Вартість наведено для предмета «${translated(item)}». Ціни інших предметів можуть відрізнятися.`, `Cost shown for ${translated(item)}. Other items may have different costs.`)],
      [/^Иконки для (\d+) из (\d+) вещей этого комплекта пока недоступны\.$/u, (_, num, max) => use(`Іконки для ${num} із ${max} предметів цього комплекту поки недоступні.`, `Icons for ${num} of ${max} items in this set are unavailable.`)],
      [/^(Железная|Бронзовая|Серебряная|Лига) (I{1,3})$/u, (_, name, rank) => `${translated(name)} ${rank}`],
      [/^Ветка талантов (.+)$/u, (_, league) => use(`Гілка талантів ${translated(league)}`, `Talent branch: ${translated(league)}`)],
      [/^(\d+) талантов$/u, (_, num) => use(`Талантів: ${num}`, `${num} talents`)],
      [/^Выбрано талантов: (.+)$/u, (_, count) => use(`Вибрано талантів: ${count}`, `Talents selected: ${count}`)],
      [/^([\d, .]+) очков до (\d+)-го уровня$/u, (_, points, level) => use(`${points} очок до ${level}-го рівня`, `${points} points to level ${level}`)],
      [/^Сверь с пропуском$/u, () => use('Звір із перепусткою', 'Check your pass')],
      [/^(\d+)-й уровень за ([\d,. ]+) очков$/u, (_, level, points) => use(`${level}-й рівень за ${points} очок`, `level ${level} at ${points} points`)],
      [/^Введи прогресс до следующего уровня, от 0 до ([\d,. ]+) очков\.$/u, (_, points) => use(`Введи поступ до наступного рівня, від 0 до ${points} очок.`, `Enter your progress toward the next level, from 0 to ${points} points.`)],
      [/^Укажи текущий и целевой уровни от 1 до (\d+)\.$/u, (_, max) => use(`Укажи поточний і цільовий рівні від 1 до ${max}.`, `Enter current and target levels from 1 to ${max}.`)],
      [/^Укажи прогресс от 0 до ([\d,. ]+) очков\.$/u, (_, max) => use(`Укажи поступ від 0 до ${max} очок.`, `Enter progress from 0 to ${max} points.`)],
      [/^Набрано ([\d,. ]+) из ([\d,. ]+) очков до цели\.$/u, (_, now, goal) => use(`Набрано ${now} з ${goal} очок до цілі.`, `Earned ${now} of ${goal} points toward your goal.`)],
      [/^Цель — уровень (\d+)$/u, (_, level) => use(`Ціль — рівень ${level}`, `Target level ${level}`)],
      [/^Экипировка: (.+), уровень вещей (\d+)$/u, (_, who, level) => use(`Спорядження: ${translated(who)}, рівень предметів ${level}`, `Gear: ${translated(who)}, item level ${level}`)],
      [/^(.+), уровень (\d+)$/u, (_, who, level) => use(`${translated(who)}, рівень ${level}`, `${translated(who)}, level ${level}`)],
      [/^Уровень (.+)$/u, (_, who) => use(`Рівень ${translated(who)}`, `${translated(who)} level`)],
      [/^(Прокачка|Экипировка|Конструктор шмота|Герои|Армия|Здания|Свитки|Выбрано): (.+)$/u, (_, label, who) => `${translated(label)}: ${translated(who)}`],
      [/^СНАРЯЖЕНИЕ \/ (.+)$/u, (_, faction) => `${translated('СНАРЯЖЕНИЕ')} / ${translated(faction)}`]
    ];
    for (const [rule, result] of rules) {
      const match = key.match(rule);
      if (match) return result(...match);
    }
    const amount = source.match(/^([+\-−]?\d[\d.,\s]*(?:\/\s*\d[\d.,\s]*)?)([°/А-ЯЁа-яё].+)$/u);
    if (amount) return amount[1] + translated(amount[2]);
    const perMinute = key.match(/^(.+)(\/мин)$/u);
    if (perMinute) return translated(perMinute[1]) + translated(perMinute[2]);
    return source;
  }

  function applyValue(node, field, value, set) {
    if (value == null || !value.trim()) return;
    let props = stored.get(node);
    if (!props) stored.set(node, props = new Map());
    const previous = props.get(field);
    const source = previous?.shown === value ? previous.source : value;
    const body = source.trim();
    const shown = source.replace(body, () => translated(body));
    props.set(field, {source, shown});
    if (shown !== value) set(shown);
  }

  const skipped = 'script, style, [data-language-native]';
  function apply(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.parentElement?.closest(skipped)) {
        applyValue(node, 'text', node.data, value => { node.data = value; });
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || node.closest(skipped)) return;
    for (const attr of attrs) applyValue(node, attr, node.getAttribute(attr), value => node.setAttribute(attr, value));
    for (const child of node.childNodes) apply(child);
  }

  function init(onChange) {
    const select = document.querySelector('#site-language');
    const flag = document.querySelector('#site-language-flag');
    const control = document.querySelector('#site-language-control');
    const toggle = document.querySelector('#site-language-toggle');
    const originalTitle = document.title;
    let hidden = false;
    try { hidden = localStorage.getItem('wl-language-hidden') === '1'; } catch (_) {}

    function syncVisibility() {
      control.hidden = hidden;
      toggle.setAttribute('aria-expanded', String(!hidden));
      const label = hidden ? 'Показать переключатель языка' : 'Скрыть переключатель языка';
      toggle.setAttribute('aria-label', label);
      toggle.setAttribute('title', label);
      apply(toggle);
    }
    function sync() {
      document.documentElement.lang = language;
      document.title = translated(originalTitle);
      select.value = language;
      select.setAttribute('aria-label', {ru:'Язык сайта',uk:'Мова сайту',en:'Site language'}[language]);
      flag.dataset.language = language;
      flag.title = names[language];
      apply(document.body);
    }
    sync();
    syncVisibility();
    toggle.addEventListener('click', () => {
      hidden = !hidden;
      try { localStorage.setItem('wl-language-hidden', hidden ? '1' : '0'); } catch (_) {}
      syncVisibility();
    });
    select.addEventListener('change', () => {
      if (!Object.hasOwn(locales, select.value)) return;
      language = select.value;
      try { localStorage.setItem('wl-language', language); } catch (_) {}
      sync();
      onChange();
      apply(document.body);
    });
    new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') {
          for (const added of record.addedNodes) if (added.isConnected) apply(added);
        } else if (record.target.isConnected) {
          if (record.type === 'characterData') apply(record.target);
          else if (!record.target.closest(skipped)) {
            const attr = record.attributeName;
            applyValue(record.target, attr, record.target.getAttribute(attr), value => record.target.setAttribute(attr, value));
          }
        }
      }
    }).observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:attrs});
  }
  window.SiteLanguage = {init, text:translated, get locale() { return locales[language]; }};
})();
