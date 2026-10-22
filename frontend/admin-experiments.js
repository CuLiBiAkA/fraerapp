export function mountExperiments({ api, report, authorized, epoch }) {
  const host = document.querySelector('#view-experiments');
  host.innerHTML = `<h2 id="experiments-heading" tabindex="-1">Эксперименты</h2>
    <p>Небольшие проекты вне основного функционала FraerApp.</p>
    <h3>Мяу-пианино</h3><p><a href="/meow/" target="_blank" rel="noopener">Открыть пианино ↗</a></p>
    <p id="experiments-status" class="admin-status" role="status"></p>
    <div id="experiment-metrics" class="admin-metrics"></div>
    <p id="experiments-since"></p>
    <p>Посетители — уникальные браузеры, а не аккаунты. Другой браузер или очистка данных считаются новым посетителем. Открытия включают повторные загрузки страницы.</p>
    <p>Сегодня и последние 7 дней считаются по времени Калининграда (UTC+2). Учёт начат с запуска счётчика; более ранних посещений здесь нет.</p>
    <button id="experiments-refresh" class="secondary" type="button">Обновить статистику</button>`;
  const metrics = host.querySelector('#experiment-metrics'), since = host.querySelector('#experiments-since');
  const status = host.querySelector('#experiments-status'), refresh = host.querySelector('#experiments-refresh');
  let seq = 0;
  async function load() {
    if (!authorized()) return;
    const current = ++seq, version = epoch();
    metrics.replaceChildren(); since.textContent = ''; status.textContent = 'Загружаем статистику…'; status.dataset.kind = 'info'; refresh.disabled = true;
    try {
      const value = await api('/api/admin/experiments/meow');
      if (current !== seq || version !== epoch() || !authorized()) return;
      for (const [label, count] of [['Посетителей за всё время', value.visitors], ['Посетителей сегодня', value.visitorsToday], ['Посетителей за 7 дней', value.visitorsWeek], ['Открытий страницы', value.pageViews]]) {
        const card = document.createElement('div'); card.className = 'admin-metric';
        const number = document.createElement('strong'), caption = document.createElement('span');
        number.textContent = Number(count).toLocaleString('ru-RU'); caption.textContent = label; card.append(number, caption); metrics.append(card);
      }
      since.textContent = value.firstVisitAt ? 'Первое учтённое посещение: ' + new Date(value.firstVisitAt).toLocaleString('ru-RU', { timeZone: value.timeZone }) : 'Посещений пока нет.';
      status.textContent = 'Статистика обновлена.';
    } catch (error) { if (current === seq && version === epoch()) report('#experiments-status', error); }
    finally { if (current === seq) refresh.disabled = false; }
  }
  refresh.onclick = load;
  return { load, reset() { seq++; metrics.replaceChildren(); since.textContent = ''; status.textContent = ''; refresh.disabled = false; } };
}
