import { authoringPrompt, examplePackage } from './authoring-prompt-template.js?v=1';

const words = {
  ru: { title: 'Промпты для создания истории', intro: 'Составьте запрос и скопируйте его в выбранный ИИ. Промпт содержит формат JSON и возможности конструктора. Содержимое никуда не отправляется автоматически.', kind: 'Что создаём', chapter: 'Одну главу', package: 'Целую историю с главами', mode: 'Задача', create: 'Создать', edit: 'Изменить существующее', brief: 'Сюжет или изменения', placeholder: 'Например: кошка любит открытые двери; 3 главы, 2 сезона, 3 концовки. Выборы меняют доверие и смелость.', include: 'Включить текущее содержимое в промпт', privacy: 'Весь текст выбранной главы или экспортированной истории попадёт в копируемый промпт. Проверьте его перед передачей выбранному ИИ.', unavailable: 'В этом окне исходного содержимого нет. Для правок откройте промпты из нужной истории или главы либо вставьте её экспорт в шаблон самостоятельно.', build: 'Подготовить промпт', copy: 'Копировать промпт', download: 'Скачать .txt', output: 'Готовый промпт', ready: 'Промпт готов. Проверьте текст, затем скопируйте или скачайте его.', copied: 'Промпт скопирован.', manual: 'Автоматическое копирование недоступно. Текст выделен: скопируйте его вручную или скачайте файл.', wait: 'Подготавливаем промпт…', close: 'Закрыть', example: 'Скачать пример целой истории', cat: 'Скачать историю про Миру', help: 'Как использовать', steps: 'Пакет целой истории импортируйте в «Моих историях». JSON одной главы — в открытой главе конструктора. Проверьте результат, сохраните черновик и отправьте на модерацию. Скачивание примера не заменяет ваш черновик.', missing: 'Не удалось получить содержимое. Откройте нужную историю или главу и повторите попытку.', language: 'Язык промпта' },
  en: { title: 'Story creation prompts', intro: 'Describe your request and copy it into your chosen AI. The prompt includes the JSON format and supported Builder features. Nothing is sent automatically.', kind: 'Scope', chapter: 'One chapter', package: 'A complete story with chapters', mode: 'Task', create: 'Create', edit: 'Edit existing content', brief: 'Plot or changes', placeholder: 'For example: a cat loves open doors; 3 chapters, 2 seasons, 3 endings. Choices change trust and courage.', include: 'Include current content in the prompt', privacy: 'The complete selected chapter or exported story text will be included in the copied prompt. Review it before sharing with your chosen AI.', unavailable: 'No source content is available here. To edit, open prompts from a story or chapter, or paste its export into the template yourself.', build: 'Prepare prompt', copy: 'Copy prompt', download: 'Download .txt', output: 'Prepared prompt', ready: 'Your prompt is ready. Review it, then copy or download it.', copied: 'Prompt copied.', manual: 'Automatic copy is unavailable. The text is selected: copy it manually or download the file.', wait: 'Preparing prompt…', close: 'Close', example: 'Download a complete story example', cat: 'Download Mira’s story', help: 'How to use', steps: 'Import a complete story package in My stories. Import chapter JSON into the intended chapter in Builder. Check the result, save the draft and submit for moderation. Downloading an example does not replace your draft.', missing: 'Content could not be loaded. Open the intended story or chapter and try again.', language: 'Prompt language' },
};

function element(tag, text, className) {
  const node = document.createElement(tag); if (text) node.textContent = text; if (className) node.className = className; return node;
}

export async function copyPromptText(text, textarea, clipboard = globalThis.navigator?.clipboard) {
  try { if (!clipboard?.writeText) throw new Error('Clipboard unavailable'); await clipboard.writeText(text); return true; }
  catch { textarea.focus(); textarea.select(); textarea.setSelectionRange(0, text.length); return false; }
}

export function downloadPromptFile(content, filename, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = element('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openAuthoringPrompts({ language = 'ru', kind = 'package', getContext } = {}) {
  const existing = document.querySelector('#authoring-prompts');
  if (existing) { existing.focus(); return existing; }
  if (!document.querySelector('[data-authoring-prompts-style]')) {
    const style = element('link'); style.rel = 'stylesheet'; style.href = new URL('./authoring-prompts.css?v=1', import.meta.url).href; style.dataset.authoringPromptsStyle = ''; document.head.append(style);
  }
  let lang = language === 'en' ? 'en' : 'ru';
  const opener = document.activeElement;
  const dialog = element('dialog', '', 'authoring-prompts'); dialog.id = 'authoring-prompts'; dialog.setAttribute('aria-labelledby', 'authoring-prompts-title');
  const heading = element('h2'); heading.id = 'authoring-prompts-title';
  const intro = element('p'); const status = element('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const form = element('form'); form.addEventListener('submit', event => event.preventDefault());
  const labelled = (node, id) => { node.id = id; const label = element('label'); const span = element('span'); label.append(span, node); return { label, span, node }; };
  const select = options => { const node = element('select'); for (const value of options) { const option = element('option'); option.value = value; node.append(option); } return node; };
  const languageField = labelled(select(['ru', 'en']), 'prompt-language'); languageField.node.value = lang;
  const kindField = labelled(select(['package', 'chapter']), 'prompt-kind'); kindField.node.value = kind === 'chapter' ? 'chapter' : 'package';
  const modeField = labelled(select(['create', 'edit']), 'prompt-mode');
  const briefField = labelled(element('textarea'), 'prompt-brief'); briefField.node.rows = 3;
  const include = element('input'); include.type = 'checkbox'; include.disabled = typeof getContext !== 'function'; include.id = 'prompt-include-context';
  const includeText = element('span'); const includeLabel = element('label', '', 'prompt-context-option'); includeLabel.append(include, includeText);
  const privacy = element('p', '', 'prompt-note'); privacy.id = 'prompt-context-note'; include.setAttribute('aria-describedby', privacy.id);
  const build = element('button'); build.type = 'button';
  const outputField = labelled(element('textarea'), 'prompt-output'); outputField.node.readOnly = true; outputField.node.rows = 12; outputField.node.spellcheck = false;
  const copy = element('button'); copy.type = 'button'; copy.disabled = true;
  const download = element('button'); download.type = 'button'; download.disabled = true;
  const close = element('button', '', 'secondary'); close.type = 'button'; close.onclick = () => dialog.close();
  const actions = element('div', '', 'prompt-actions'); actions.append(copy, download, close);
  const help = element('details'); const helpTitle = element('summary'); const steps = element('p'); const sample = element('button'); sample.type = 'button';
  sample.onclick = () => downloadPromptFile(JSON.stringify(examplePackage(lang), null, 2), 'open-doors.package.json', 'application/json');
  const cat = element('a'); cat.href = new URL('./scenarios/koshka-i-otkrytye-dveri.package.json', import.meta.url).href; cat.download = 'koshka-i-otkrytye-dveri.package.json';
  const examples = element('div', '', 'prompt-actions'); examples.append(sample, cat); help.append(helpTitle, steps, examples);
  const options = element('div', '', 'prompt-options'); options.append(kindField.label, modeField.label, languageField.label);
  form.append(options, briefField.label, includeLabel, privacy, build, outputField.label, status, actions, help); dialog.append(heading, intro, form);
  let generation = 0;
  function invalidate() { generation++; outputField.node.value = ''; copy.disabled = download.disabled = true; status.textContent = ''; }
  function translate() {
    const w = words[lang]; dialog.lang = lang; heading.textContent = w.title; intro.textContent = w.intro;
    for (const [field, label] of [[kindField, w.kind], [modeField, w.mode], [languageField, w.language], [briefField, w.brief], [outputField, w.output]]) field.span.textContent = label;
    for (const option of kindField.node.options) option.textContent = w[option.value];
    for (const option of modeField.node.options) option.textContent = w[option.value];
    languageField.node.options[0].textContent = 'Русский'; languageField.node.options[1].textContent = 'English';
    briefField.node.placeholder = w.placeholder; includeText.textContent = w.include; privacy.textContent = getContext ? w.privacy : w.unavailable;
    build.textContent = w.build; copy.textContent = w.copy; download.textContent = w.download; close.textContent = w.close; helpTitle.textContent = w.help; steps.textContent = w.steps; sample.textContent = w.example; cat.textContent = w.cat;
  }
  for (const node of [kindField.node, modeField.node, briefField.node, include]) node.addEventListener('input', invalidate);
  kindField.node.addEventListener('change', () => { include.checked = false; });
  languageField.node.addEventListener('change', () => { lang = languageField.node.value; invalidate(); translate(); });
  build.onclick = async () => {
    const ticket = ++generation; const selectedKind = kindField.node.value; const w = words[lang];
    copy.disabled = download.disabled = true; outputField.node.value = ''; status.textContent = w.wait; build.disabled = true;
    try {
      const context = include.checked ? await getContext(selectedKind) : null;
      if (ticket !== generation || !dialog.open) return;
      if (include.checked && !context) throw new Error(w.missing);
      outputField.node.value = authoringPrompt({ language: lang, kind: selectedKind, mode: modeField.node.value, brief: briefField.node.value, context });
      copy.disabled = download.disabled = false; status.textContent = w.ready;
    } catch { if (ticket === generation) status.textContent = w.missing; }
    finally { build.disabled = false; }
  };
  copy.onclick = async () => { status.textContent = words[lang][await copyPromptText(outputField.node.value, outputField.node) ? 'copied' : 'manual']; };
  download.onclick = () => downloadPromptFile(outputField.node.value, `fraerapp-${kindField.node.value}-${modeField.node.value}-${lang}.txt`);
  dialog.addEventListener('close', () => { generation++; dialog.remove(); if (opener?.isConnected) opener.focus(); });
  translate(); document.body.append(dialog); dialog.showModal(); return dialog;
}
