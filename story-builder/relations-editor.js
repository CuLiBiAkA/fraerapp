import {el, button, field, select, checkbox, request, words, errorMessage, link, transferEditor, targetRef} from "/collection-ui.js?v=1";

export function renderRelationsEditor(host, {draft, changed, storyId, documentValue}) {
  if (!host) return;
  host.replaceChildren();
  const getMeta = () => draft.metadata ||= {schemaVersion:1,relations:[]};
  const status = el("p", "", "collection-status"); status.setAttribute("role", "status");
  const intro = el("p", words("Свяжите продолжения и настройте параметры, которые принимает эта глава. Изменения сохраняются вместе с черновиком.", "Link related works and configure values accepted by this chapter. Changes are saved with the draft."));
  const parent = link(words("Управлять оглавлением, томами и циклами", "Manage chapters, volumes and series"), `/my-stories/?view=collections${storyId ? `&scenario=${encodeURIComponent(storyId)}` : ""}`);
  const relations = el("div"), contract = el("div"), picker = el("div");
  host.append(intro, parent, status, relations, picker, contract);
  let targets = [], targetsQuery="", targetsPage=0, targetRequest=0;
  const refresh = button(words("Найти истории для связи", "Find stories to link"), async () => {
    refresh.disabled = true;
    try {
      targets = await request("/api/author/collections/targets");
      if (!host.isConnected || !host.contains(picker)) return;
      renderPicker(); status.textContent = "";
    } catch (error) { status.textContent = errorMessage(error); }
    finally { refresh.disabled = false; }
  });
  picker.append(refresh);
  function renderPicker() {
    picker.replaceChildren();
    const search = field(words("Поиск по названию или ключу", "Search title or key"),targetsQuery); search.input.type = "search";
    const target = select(words("Произведение", "Work"), [], "");
    function filter() {
      target.input.replaceChildren();
      for (const item of targets.filter(item => item.id !== storyId && `${item.title} ${item.key}`.toLowerCase().includes(search.input.value.toLowerCase()))) {
        const option = el("option", `${item.title} · ${item.key}`); option.value = `${item.kind}:${item.id}`; target.input.append(option);
      }
    }
    search.input.oninput = filter; filter();
    const find=async(more)=>{
      const seq=++targetRequest;
      targetsQuery=search.input.value;targetsPage=more?targetsPage+1:0;
      const values=await request(`/api/author/collections/targets?q=${encodeURIComponent(targetsQuery)}&page=${targetsPage}&size=100`);
      if(seq!==targetRequest||!host.isConnected||!host.contains(picker))return;
      targets=more?[...targets,...values.filter(t=>!targets.some(old=>old.id===t.id&&old.kind===t.kind))]:values;renderPicker();
    };
    const findButton=button(words("Найти на сервере", "Search server"),()=>find(false).catch(error=>{status.textContent=errorMessage(error);}));
    picker.append(search.label,findButton,button(words("Показать ещё", "Load more"),()=>find(true).catch(error=>{status.textContent=errorMessage(error);})), target.label, button(words("+ Добавить связь", "+ Add relation"), () => {
      const chosen = targets.find(item => `${item.kind}:${item.id}` === target.input.value);
      if (!chosen) return;
      const meta = getMeta(); meta.relations ||= [];
      meta.relations.push({id:crypto.randomUUID(),type:"related",target:targetRef(chosen),label:chosen.title,stateTransfer:{mode:"independent"}});
      changed(); renderRelations();
    }, "add-button"));
  }
  function renderRelations() {
    relations.replaceChildren(el("h3", words("Связанные произведения", "Related works")));
    const list = draft.metadata?.relations || [];
    if (!list.length) relations.append(el("p", words("Связей пока нет.", "No relations yet.")));
    list.forEach((relation, index) => {
      const box = el("section", null, "collection-item");
      const heading = el("h4", relation.target?.key || relation.target?.id);
      const kind = select(words("Тип связи", "Relation"), [["related",words("Связанная история", "Related story")],["sequel",words("Продолжение", "Sequel")],["prequel",words("Приквел", "Prequel")],["branch",words("Ответвление", "Branch")]], relation.type);
      const caption = field(words("Подпись ссылки", "Link label"), relation.label); caption.input.maxLength = 200;
      kind.input.onchange = () => { relation.type = kind.input.value; changed(); };
      caption.input.oninput = () => { relation.label = caption.input.value; changed(); };
      const transfer = transferEditor(relation.stateTransfer??null, () => { relation.stateTransfer = transfer.value(); changed(); }, {allowReference:true});
      box.append(heading, kind.label, caption.label);
      if (relation.target?.kind === "scenario") {
        box.append(transfer.root);
        const testPanel=el("details");testPanel.append(el("summary",words("Проверить перенос на примере", "Test with sample values")));
        const inputs=[];
        for(const variable of draft.variables.filter(v=>v.name)){
          const control=variable.type==="boolean"?select(variable.name,[["true",words("Да", "True")],["false",words("Нет", "False")]],String(variable.value)):field(variable.name,variable.value,variable.type==="number"?"number":"text");
          inputs.push([variable,control]);testPanel.append(control.label);
        }
        const result=el("p","","collection-status");result.setAttribute("role","status");
        const testButton=button(words("Проверить без сохранения игры", "Test without creating a save"),async()=>{
          testButton.disabled=true;
          try{
            const values=Object.fromEntries(inputs.map(([v,c])=>[v.name,v.type==="number"?Number(c.input.value):v.type==="boolean"?c.input.value==="true":c.input.value]));
            const response=await request("/api/author/relations/test",{method:"POST",body:{source:documentValue(),targetRef:relation.target,stateTransfer:transfer.value(),values}});
            result.textContent=words("Перенос допустим: ", "Transfer is valid: ")+JSON.stringify(response.values);
          }catch(error){result.textContent=errorMessage(error);}finally{testButton.disabled=false;}
        });testPanel.append(testButton,result);box.append(testPanel);
      }
      box.append(button(words("Удалить связь", "Remove relation"), () => { list.splice(index,1); changed(); renderRelations(); }));
      relations.append(box);
    });
  }
  function renderContract() {
    contract.replaceChildren(el("h3", words("Входные параметры этой главы", "This chapter's input contract")));
    if (!draft.metadata?.inputContract) {
      contract.append(el("p", words("Без контракта глава начинается со своих значений и не принимает переносимые параметры.", "Without a contract, the chapter starts with its own values and accepts no transferred parameters.")), button(words("Настроить входные параметры", "Configure inputs"), () => {
        getMeta().inputContract = {version:1,allowIndependentStart:true,fields:[]}; changed(); renderContract();
      })); return;
    }
    const value = draft.metadata.inputContract;
    value.fields ||= [];
    const version = field(words("Версия контракта", "Contract version"), value.version, "number"); version.input.min = "1";
    version.input.oninput = () => { value.version = Number(version.input.value); changed(); };
    const independent = checkbox(words("Разрешить старт без предыдущей главы", "Allow starting without a previous chapter"), value.allowIndependentStart);
    independent.input.onchange = () => { value.allowIndependentStart = independent.input.checked; changed(); };
    const rows = el("div");
    function renderFields() {
      rows.replaceChildren();
      value.fields.forEach((item, i) => {
        const box = el("fieldset", null, "collection-transfer"); box.append(el("legend", words(`Параметр ${i+1}`, `Input ${i+1}`)));
        const name = select(words("Переменная главы", "Chapter variable"), [[item.name || "",item.name || words("Выберите переменную", "Select variable")], ...draft.variables.filter(v => v.name && v.name !== item.name).map(v => [v.name,v.name])], item.name);
        const type = select(words("Тип", "Type"), [["number",words("Число", "Number")],["boolean",words("Да/нет", "Boolean")],["string",words("Текст", "Text")]], item.type);
        name.input.onchange = () => { item.name = name.input.value; item.type = draft.variables.find(v => v.name === item.name)?.type || "string"; changed(); renderFields(); };
        type.input.onchange = () => { item.type = type.input.value; delete item.defaultValue; changed(); renderFields(); };
        const required = checkbox(words("Обязателен при переносе", "Required for transfer"), item.required); required.input.onchange = () => { item.required = required.input.checked; changed(); };
        const useDefault = checkbox(words("Задать значение, если параметр не передан", "Use a default when missing"), Object.hasOwn(item,"defaultValue"));
        const fallback = item.type === "boolean" ? select(words("Значение по умолчанию", "Default value"), [["false",words("Нет", "False")],["true",words("Да", "True")]], String(item.defaultValue ?? false)) : field(words("Значение по умолчанию", "Default value"), item.defaultValue ?? "", item.type === "number" ? "number" : "text");
        fallback.label.hidden = !useDefault.input.checked;
        const setDefault = () => { if (useDefault.input.checked) item.defaultValue = item.type === "number" ? Number(fallback.input.value) : item.type === "boolean" ? fallback.input.value === "true" : fallback.input.value; else delete item.defaultValue; changed(); };
        useDefault.input.onchange = () => { fallback.label.hidden = !useDefault.input.checked; setDefault(); }; fallback.input.oninput = setDefault;
        box.append(name.label,type.label,required.label,useDefault.label,fallback.label);
        if (item.type === "number") for (const [key, ru, en] of [["min","Минимум (необязательно)","Minimum (optional)"],["max","Максимум (необязательно)","Maximum (optional)"]]) {
          const control = field(words(ru,en),item[key] ?? "","number"); control.input.oninput = () => { if (control.input.value === "") delete item[key]; else item[key] = Number(control.input.value); changed(); }; box.append(control.label);
        }
        if (item.type === "string") {
          const values = field(words("Допустимые значения: по одному на строку (необязательно)", "Allowed values: one per line (optional)"), (item.allowedValues || []).join("\n"), "textarea");
          values.input.oninput = () => { if (values.input.value.trim()) item.allowedValues = values.input.value.split("\n").filter(Boolean); else delete item.allowedValues; changed(); }; box.append(values.label);
        }
        box.append(button(words("Убрать параметр", "Remove input"), () => { value.fields.splice(i,1); changed(); renderFields(); })); rows.append(box);
      });
    }
    contract.append(version.label,independent.label,rows,button(words("+ Входной параметр", "+ Input"), () => { value.fields.push({name:"",type:"number",required:false}); changed(); renderFields(); }, "add-button")); renderFields();
  }
  renderRelations(); renderContract();
}
