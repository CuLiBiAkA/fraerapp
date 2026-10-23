const audienceMetrics = value => [['Посетителей за всё время', value.visitors], ['Посетителей сегодня', value.visitorsToday], ['Посетителей за 7 дней', value.visitorsWeek], ['Открытий страницы', value.pageViews]];

export function mountExperiments({ api, report, authorized, epoch }) {
  const host = document.querySelector('#view-experiments');
  host.innerHTML = `<h2 id="experiments-heading" tabindex="-1">Эксперименты</h2>
    <p>Небольшие проекты вне основного функционала FraerApp.</p>
    <p>Посетители — уникальные браузеры, а не аккаунты. Другой браузер или очистка данных считаются новым посетителем. Открытия включают повторные загрузки страницы.</p>
    <p>Сегодня и последние 7 дней считаются по времени Калининграда (UTC+2). Учёт начат с запуска каждого счётчика; более ранних посещений здесь нет.</p>`;
  function card({ key, title, link, linkText, prefix, metricsId, extra = '', metrics = audienceMetrics }) {
    const section = document.createElement('section'); section.className = 'experiment-section';
    section.setAttribute('aria-labelledby', prefix + '-title');
    section.innerHTML = `<h3 id="${prefix}-title">${title}</h3><p><a href="${link}" target="_blank" rel="noopener">${linkText} ↗</a></p>
      <p id="${prefix}-status" class="admin-status" role="status"></p><div id="${metricsId}" class="admin-metrics"></div>
      <p id="${prefix}-since"></p>${extra}<button id="${prefix}-refresh" class="secondary" type="button">Обновить статистику: ${title}</button>`;
    host.append(section);
    const grid = section.querySelector('#' + metricsId), since = section.querySelector('#' + prefix + '-since');
    const status = section.querySelector('#' + prefix + '-status'), refresh = section.querySelector('button');
    let seq = 0;
    async function load() {
      if (!authorized()) return;
      const current = ++seq, version = epoch();
      grid.replaceChildren(); since.textContent = ''; status.textContent = 'Загружаем статистику…'; status.dataset.kind = 'info'; refresh.disabled = true;
      try {
        const value = await api('/api/admin/experiments/' + key);
        if (current !== seq || version !== epoch() || !authorized()) return;
        for (const [label, count] of metrics(value)) {
          const item = document.createElement('div'); item.className = 'admin-metric';
          const number = document.createElement('strong'), caption = document.createElement('span');
          number.textContent = Number(count).toLocaleString('ru-RU', { maximumFractionDigits: 1 });
          caption.textContent = label; item.append(number, caption); grid.append(item);
        }
        since.textContent = value.firstVisitAt ? 'Первое учтённое посещение: ' + new Date(value.firstVisitAt).toLocaleString('ru-RU', { timeZone: value.timeZone }) : 'Посещений пока нет.';
        status.textContent = 'Статистика обновлена.';
      } catch (error) { if (current === seq && version === epoch() && authorized()) report('#' + prefix + '-status', error); }
      finally { if (current === seq) refresh.disabled = false; }
    }
    refresh.onclick = load;
    return { load, reset() { seq++; grid.replaceChildren(); since.textContent = ''; status.textContent = ''; refresh.disabled = false; } };
  }
  const piano = card({ key: 'meow', title: 'Мяу-пианино', link: '/meow/', linkText: 'Открыть пианино', prefix: 'experiments', metricsId: 'experiment-metrics' });
  const cats = card({ key: 'cat-merge', title: 'Котопад', link: '/cat-merge/', linkText: 'Открыть игру', prefix: 'cat-merge', metricsId: 'cat-merge-metrics',
    extra: '<p>Партия начинается с первого броска. Завершённые — победы и проигрыши; перезапуски считаются отдельно. Средние и лучший счёт относятся к завершённым партиям. Время — только активная игра, без пауз.</p><p>События передаёт браузер: блокировщики, закрытие вкладки и потеря сети могут снизить счётчики. Это приблизительная статистика, а не защищённый рейтинг.</p>',
    metrics: value => [...audienceMetrics(value), ['Начатых партий', value.gamesStarted], ['Завершённых партий', value.gamesFinished],
      ['Побед', value.gamesWon], ['Проигрышей', value.gamesLost], ['Перезапусков', value.gamesRestarted],
      ['Лучший счёт', value.bestScore], ['Средний счёт', value.averageScore], ['Средняя партия, сек.', value.averageDurationSeconds]],
  });
  return { load: () => Promise.all([piano.load(), cats.load()]), reset() { piano.reset(); cats.reset(); } };
}
