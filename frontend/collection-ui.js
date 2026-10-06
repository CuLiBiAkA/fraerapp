// Shared collection controls. All labels/content use textContent, never HTML.
export const collectionTypes = {
  story: ["Папка", "Folder"], volume: ["Папка", "Folder"],
  cycle: ["Папка", "Folder"], catalog: ["Папка", "Folder"], scenario: ["История / глава", "Story / chapter"],
};
export const language = () => document.documentElement.lang === "en" ? "en" : "ru";
export const words = (ru, en) => language() === "en" ? en : ru;
export const typeName = type => words(...(collectionTypes[type] || collectionTypes.scenario));
export function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function link(text, href) { const a = el("a", text); a.href = href; return a; }
export function button(text, action, className) {
  const b = el("button", text, className); b.type = "button";
  b.addEventListener("click", action); return b;
}
export function field(text, value = "", type = "text") {
  const label = el("label", text); const input = el(type === "textarea" ? "textarea" : "input");
  if (type !== "textarea") input.type = type;
  input.value = value ?? ""; label.append(input); return { label, input };
}
export function select(text, options, value) {
  const label = el("label", text), input = el("select");
  input.setAttribute("aria-label",text);
  for (const [key, caption] of options) { const option = el("option", caption); option.value = key; input.append(option); }
  input.value = value ?? options[0]?.[0] ?? ""; label.append(input); return { label, input };
}
export function checkbox(text, checked) {
  const label = el("label", null, "collection-checkbox"), input = el("input"); input.type = "checkbox"; input.checked = Boolean(checked);
  label.append(input, document.createTextNode(text)); return { label, input };
}
export function errorMessage(error) {
  const folderErrors = {
    "This work is already in another folder": words("Произведение уже находится в другой папке. Сначала уберите его оттуда; если папка опубликована, отправьте изменение на проверку.", "This work is already in another folder. Remove it there first; if that folder is published, submit the change for review."),
    "A folder cannot contain itself or its parent": words("Нельзя вложить папку в саму себя или в одну из её вложенных папок.", "A folder cannot be placed inside itself or one of its descendants."),
    "Collection cannot include itself": words("Нельзя вложить папку в саму себя.", "A folder cannot contain itself."),
  };
  if (folderErrors[error.message]) return folderErrors[error.message];
  if (error.status === 401) return words("Сессия завершена. Войдите на главной и повторите действие.", "Your session ended. Sign in on the home page and retry.");
  if (error.status === 403) return words("Нет доступа к этому действию. Проверьте свои права.", "You do not have permission for this action.");
  if (error.status === 409) return words("Данные или условия перехода изменились. Обновите сведения и проверьте их; ваш текст сохранён в форме.", "The data or transition requirements changed. Reload and inspect them; your text remains in the form.") + (error.message ? ` ${error.message}` : "");
  if (error.status === 404) return words("Произведение недоступно.", "This work is unavailable.");
  return error.message || words("Не удалось выполнить действие. Повторите попытку.", "The action failed. Try again.");
}
export async function request(path, options = {}, retry = true) {
  const response = await fetch(path, { credentials: "include", cache: "no-store", ...options,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers: { Accept: "application/json", "X-Fraer-Request": "same-origin", ...(options.body === undefined ? {} : {"Content-Type":"application/json"}) } });
  if (response.status === 401 && retry) {
    const refresh = await fetch("/auth/refresh", {method:"POST", credentials:"include", headers:{"X-Fraer-Request":"same-origin"}});
    if (refresh.ok) return request(path, options, false);
  }
  const body = await response.text(); let data;
  try { data = body ? JSON.parse(body) : {}; } catch { data = {}; }
  if (!response.ok) { const error = new Error(data.message || data.detail || words("Ошибка запроса", "Request failed")); error.status = response.status; throw error; }
  return data;
}
export function download(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], {type:"application/json"}));
  const a = link(filename, url); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const targetRef = target => ({kind: target.kind || "scenario", id: target.id || target.storyId || target.collectionId, key: target.key});
export const targetKey = target => `${target.kind || "scenario"}:${target.id || target.storyId || target.collectionId || target.key}`;
export function moveItem(items, from, to) {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const result = [...items]; const [item] = result.splice(from, 1); result.splice(to, 0, item); return result;
}
export function allowedChild(target) {
  return target.owned !== false && ["scenario", "collection"].includes(target.kind);
}
export function transferEditor(policy = {mode:"independent"}, changed = () => {}, {allowReference=false} = {}) {
  const value = structuredClone(policy || {mode:allowReference?"reference":"independent"}), root = el("fieldset", null, "collection-transfer");
  root.append(el("legend", words("Параметры при переходе", "Transition state")));
  const modes=[["independent",words("Независимый старт", "Independent start")],["mapped",words("Перенести выбранные параметры", "Transfer selected values")]];
  if(allowReference)modes.unshift(["reference",words("Только информационная ссылка", "Informational link only")]);
  const mode = select(words("Режим", "Mode"), modes, value.mode);
  const version = field(words("Версия входного контракта", "Input contract version"), value.contractVersion || 1, "number"); version.input.min = "1";
  const rows = el("div"), add = button(words("+ Параметр", "+ Parameter"), () => { value.mapping.push({from:"",to:"",type:"number"}); renderRows(); changed(); }, "add-button");
  value.mapping ||= [];
  function renderRows() {
    rows.replaceChildren();
    value.mapping.forEach((mapping, i) => {
      const row = el("div", null, "collection-mapping");
      const from = field(words("Откуда", "From"), mapping.from), to = field(words("Куда", "To"), mapping.to);
      const type = select(words("Тип", "Type"), [["number",words("Число", "Number")],["boolean",words("Да/нет", "Boolean")],["string",words("Текст", "Text")]], mapping.type);
      for (const [key, control] of [["from",from],["to",to],["type",type]]) control.input.oninput = () => { mapping[key] = control.input.value; changed(); };
      row.append(from.label, to.label, type.label, button(words("Убрать", "Remove"), () => { value.mapping.splice(i,1); renderRows(); changed(); })); rows.append(row);
    });
  }
  function visibility() { version.label.hidden = rows.hidden = add.hidden = mode.input.value !== "mapped"; }
  mode.input.onchange = () => { value.mode = mode.input.value; visibility(); changed(); };
  version.input.oninput = () => { value.contractVersion = Number(version.input.value); changed(); };
  root.append(mode.label, version.label, rows, add); renderRows(); visibility();
  return { root, value: () => value.mode === "reference" ? null : value.mode === "mapped" ? {...value,contractVersion:Number(version.input.value)} : {mode:"independent"} };
}
