// Each topic: title, explanation, example. Text follows the current runtime behavior.
export const helpTopics = {
  authorWorkspace: [
    ['Моя глава', 'Здесь показана только открытая глава: её история, номер, статус и сохранение. Кнопка сохранения записывает черновик на сервер. Предпросмотр показывает текущие тексты и варианты выборов без создания читательского прогресса.', 'Сохраните главу, затем откройте вкладку с галочкой для проверки JSON. Создать историю или добавить главу можно в разделе «Мои истории» через личный кабинет.'],
    ['My chapter', 'This tab shows the current chapter, its story, number, status and saved state. Save writes the draft to the server. Preview shows current scene text and choices without reader progress.', 'Save the chapter, then open the check tab to validate JSON. Create stories and add chapters in My stories through your account.'],
  ],
  relations: [
    ['Связи и главы', 'Добавляйте главы в историю через «Мои истории» и при необходимости указывайте сезоны. При последовательном чтении глобальные значения переходят в следующую главу автоматически. Отдельные связи позволяют связать ваши произведения между собой.', 'Если в первой главе читатель выбрал имя героя, следующая глава этой истории его запомнит. Локальные переменные останутся в своих сценах. Отдельное продолжение можно связать с другим произведением и настроить передаваемые значения.'],
    ['Relations and chapters', 'Add chapters to a story in My stories and optionally group them by season. Reading in order carries global values into the next chapter automatically. Separate relations can connect your own works.', 'If the reader chooses a character’s name in chapter one, the next chapter of that story remembers it. Local variables stay in their scenes. A separate sequel can link to another work with explicit value transfer.'],
  ],
  storyMetadata: [
    ['Настройки главы', 'Название, описание, жанр, тема, ключ и стартовая сцена открытой главы. Общие название, описание, обложка, порядок глав и сезоны всей истории задаются в «Моих историях».', 'Название главы: «Перрон». Ключ: midnight_train_1. Чтобы изменить обложку всей истории, вернитесь по ссылке «К главам истории».'],
    ['Chapter settings', 'The open chapter’s title, description, genre, topic, key and start scene. Edit the whole story’s title, description, cover, chapter order and seasons in My stories.', 'Chapter title: Platform. Key: midnight_train_1. To change the whole story cover, use Story chapters to return to its settings.'],
  ],
  variablesTitle: [
    ['Глобальные переменные', 'Переменная хранит то, что история должна запомнить: число, текст или ответ «да/нет». Глобальные переменные доступны во всех сценах одного прохождения. Используйте их для денег, отношений с героями или найденных предметов.', 'Создайте число coins со значением 10. Покупка билета уменьшит его до 7. В следующей сцене у читателя останется 7 монет. Локальная переменная, напротив, доступна только в своей сцене.'],
    ['Global variables', 'A variable stores a number, text or a true/false value. Global variables are available in every scene of one playthrough. Use them for money, relationships or collected items.', 'Create the number coins with a value of 10. Buying a ticket reduces it to 7. The next scene still has 7 coins. A local variable is available only in its own scene.'],
  ],
  sceneLocalVariables: [
    ['Локальные переменные сцены', 'Это значения, которые нужны только одной сцене. Другие сцены их не видят. При возвращении в эту сцену в том же прохождении сохранённое значение остаётся. Если имя совпадает с глобальным, в этой сцене используется локальное значение, а глобальное не меняется.', 'В сцене с загадкой заведите число attempts со значением 0. После неверного ответа увеличивайте его на 1. Для общего счёта или предмета, нужного в других сценах, выберите глобальную переменную.'],
    ['Scene-local variables', 'These values belong to one scene and are unavailable in other scenes. Their saved values remain when you revisit that scene in the same playthrough. A local name takes precedence over the same global name without changing the global value.', 'In a puzzle scene, create attempts with a value of 0 and increase it after a wrong answer. Use a global variable for a score or item needed in other scenes.'],
  ],
  assetsTitle: [
    ['Медиафайлы истории', 'Медиафайлы — это изображения, музыка и звуки истории. Глобальный медиафайл можно использовать в нескольких сценах, обращаясь к нему по ID — короткому имени.', 'Загрузите музыку и задайте ей ID train_music. Выберите этот материал в нескольких сценах поезда, чтобы не загружать один файл повторно.'],
    ['Global assets', 'Assets are story images, music and sounds. A global asset can be used in several scenes through its ID, a short name.', 'Upload a music file with the ID train_music and use it in several train scenes instead of uploading the same file again.'],
  ],
  sceneLocalAssets: [
    ['Медиафайлы сцены', 'Это материалы, доступные только в выбранной сцене. Используйте их для уникального фона или звука. Если локальный и глобальный медиафайл имеют одинаковый ID, в этой сцене используется локальный.', 'Изображение записки нужно только в сцене «Купе» — добавьте его сюда. Музыку для всего поезда удобнее добавить в медиафайлы истории.'],
    ['Scene-local assets', 'These media files are available only in this scene. Use them for a unique background or sound. A local asset takes precedence over a global asset with the same ID.', 'A note image used only in the Compartment scene belongs here. Music used throughout the train belongs in global assets.'],
  ],
  scenesTitle: [
    ['Сцены', 'Сцена — один шаг истории: текст, оформление и варианты действий читателя. Соединяйте сцены переходами в блоке «Выборы». У каждой сцены должен быть свой ID.', 'В сцене «Перрон» предложите два действия: «Войти в поезд» ведёт в «Купе», а «Остаться» — в сцену на вокзале.'],
    ['Scenes', 'A scene is one step of the story, with text, media and reader actions. Connect scenes using Choices. Each scene needs its own ID.', 'In Platform, Enter the train leads to Compartment, while Stay leads to a station scene.'],
  ],
  choicesTitle: [
    ['Выборы', 'Это действия, которые читатель может выбрать. Укажите подпись кнопки и сцену перехода. При необходимости добавьте условия и эффекты, чтобы выбор зависел от событий истории.', 'Кнопка «Поговорить с проводником» переводит читателя в сцену dialogue. Эффект выбора может увеличить доверие проводника на 1.'],
    ['Choices', 'These are actions the reader can select. Set the button label and destination scene. Add conditions and effects when the choice should depend on story events.', 'Talk to the conductor leads to the dialogue scene. Its effect can increase the conductor’s trust by 1.'],
  ],
  conditionsTitle: [
    ['Условия', 'Условие проверяет значение переменной и помогает выбрать подходящий переход. Укажите обычную сцену назначения и, если нужен другой исход при невыполненном условии, запасную сцену. Эффекты выбора применяются до проверки условий перехода.', 'Для действия «Открыть дверь» проверьте: has_key равно true. Успех ведёт в комнату, запасной переход — к сообщению «Нужен ключ».'],
    ['Conditions', 'A condition checks a variable to determine the appropriate transition. Set a destination and, if needed, a fallback scene for a failed condition. Choice effects are applied before transition conditions are checked.', 'For Open the door, check whether has_key equals true. Success leads into the room; the fallback says You need a key.'],
  ],
  sceneEffects: [
    ['Эффекты сцены', 'Эффект меняет переменную: задаёт значение или увеличивает число. Эффекты сцены выполняются при входе в неё. При повторном входе они могут сработать снова.', 'При входе в сцену «Находка» задайте has_key = true: теперь история помнит, что читатель нашёл ключ.'],
    ['Scene effects', 'An effect sets a variable or increases a number. Scene effects run when the reader enters the scene and can run again on re-entry.', 'On entering Discovery, set has_key to true so the story remembers that the reader found a key.'],
  ],
  choiceEffects: [
    ['Эффекты выбора', 'Эти изменения выполняются, когда читатель нажимает конкретный вариант ответа. Они позволяют запомнить последствия его решения.', 'У выбора «Помочь проводнику» добавьте увеличение trust на 1. У другого ответа этого эффекта не будет.'],
    ['Choice effects', 'These changes run when the reader selects this particular answer. They let the story remember the consequences of a decision.', 'For Help the conductor, increase trust by 1. Other answers do not receive this effect.'],
  ],
  endingTitle: [
    ['Финал', 'Отметьте сцену как финал, если здесь заканчивается путь читателя. У истории может быть несколько финальных сцен с разными исходами.', 'Один путь заканчивается сценой «Спасение», другой — «Последний поезд». Включите финал в обеих сценах и задайте названия концовок.'],
    ['Ending', 'Mark a scene as an ending when it completes the reader’s route. A story can contain several ending scenes with different outcomes.', 'One route ends in Rescue, another in The last train. Enable an ending in both scenes and name each outcome.'],
  ],
  projectStructureTitle: [
    ['Структура', 'Это оглавление конструктора. Здесь видны общие переменные, материалы и сцены. Нажмите на название, чтобы перейти к его настройкам; стрелка рядом раскрывает вложенные разделы.', 'Раскройте сцену «Начало» и выберите «Локальные переменные сцены», чтобы настроить значения только для неё.'],
    ['Structure', 'This is the builder’s table of contents. Select a name to jump to its settings, or use the arrow to expand its sections.', 'Expand Start and select Scene-local variables to configure values used only in that scene.'],
  ],
  runtimeActions: [
    ['Публикация', 'Здесь глава отправляется на модерацию. Перед отправкой изменения сохраняются и проверяются. Глава становится доступна читателям после одобрения и публикации модератором. Здесь же отображаются статус заявки и замечания модератора.', 'Моя глава → Проверка → Публикация. Если модератор вернул главу, исправьте замечания и отправьте её повторно.'],
    ['Publication', 'Submit the chapter for moderation here. Changes are saved and validated before submission. Readers can access it after a moderator approves and publishes it. This tab also shows review status and moderator comments.', 'My chapter → Validation → Publication. If a chapter is returned, address the comments and submit it again.'],
  ],
  validationTitle: [
    ['Проверка', 'Здесь показываются найденные ошибки в структуре истории. Исправьте их перед отправкой на проверку. Автоматическая проверка не оценивает сюжет — его стоит пройти самостоятельно.', 'Если выбор ведёт в несуществующую сцену, создайте эту сцену или выберите другое назначение.'],
    ['Validation', 'This block shows structural errors. Fix them before submitting. Automatic validation does not judge the plot, so also play through your story.', 'If a choice points to a missing scene, create that scene or choose another destination.'],
  ],
  storyJsonTitle: [
    ['JSON главы', 'Это текстовая запись открытой главы: сцен, переменных, материалов и переходов. Пакет всей истории с оглавлением и остальными главами экспортируется и импортируется в «Моих историях». Кнопка «Промпты для ИИ» готовит инструкции для обоих форматов.', 'Перед большими изменениями нажмите «Скачать JSON главы». Ответ ИИ для одной главы откройте через «Импорт JSON главы»; пакет всей истории импортируйте в «Моих историях».'],
    ['Chapter JSON', 'This describes the open chapter: scenes, variables, assets and transitions. Export and import the complete story package, including its contents and all chapters, in My stories. AI prompts provides instructions for both formats.', 'Use Download chapter JSON before major edits. Import AI output for a single chapter using Import chapter JSON; import a whole story package in My stories.'],
  ],
};

let helpDialog;
export function helpButton(topic, language = 'ru') {
  const content = helpTopics[topic]?.[language === 'en' ? 1 : 0];
  if (!content) return null;
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'builder-help-button'; button.textContent = '?'; button.dataset.helpTopic = topic;
  button.setAttribute('aria-label', (language === 'en' ? 'Help: ' : 'Справка: ') + content[0]);
  button.setAttribute('aria-haspopup', 'dialog');
  button.onclick = event => {
    event.preventDefault(); event.stopPropagation();
    if (!helpDialog) { helpDialog = document.createElement('dialog'); helpDialog.className = 'builder-help-dialog'; helpDialog.setAttribute('aria-labelledby', 'builder-help-title'); document.body.append(helpDialog); }
    helpDialog.replaceChildren();
    const heading = document.createElement('h2'); heading.id = 'builder-help-title'; heading.textContent = content[0];
    const text = document.createElement('p'); text.textContent = content[1];
    const example = document.createElement('div'); example.className = 'builder-help-example';
    const label = document.createElement('strong'); label.textContent = language === 'en' ? 'Example' : 'Пример';
    const sample = document.createElement('p'); sample.textContent = content[2]; example.append(label, sample);
    const close = document.createElement('button'); close.type = 'button'; close.textContent = language === 'en' ? 'Got it' : 'Понятно'; close.onclick = () => helpDialog.close();
    helpDialog.append(heading, text, example, close);
    helpDialog.onclose = () => { if (button.isConnected) button.focus(); };
    helpDialog.showModal();
  };
  return button;
}

export function decorateHelp(language) {
  for (const heading of document.querySelectorAll('.builder h2[data-i18n], .builder [data-help-key]')) {
    const topic = heading.dataset.helpKey || heading.dataset.i18n;
    if (!helpTopics[topic]) continue;
    if (heading.tagName === 'SUMMARY') {
      heading.querySelector('.builder-help-button')?.remove(); heading.append(helpButton(topic, language)); continue;
    }
    let wrap = heading.parentElement;
    if (!wrap.classList.contains('builder-help-heading')) {
      wrap = document.createElement('div'); wrap.className = 'builder-help-heading'; heading.before(wrap); wrap.append(heading);
    }
    wrap.querySelector('.builder-help-button')?.remove(); wrap.append(helpButton(topic, language));
  }
}
