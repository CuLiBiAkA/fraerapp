import {el,field,select,words} from './collection-ui.js?v=6';
import {warningGroups,splitWarnings,needsAdultRating} from './content-warning-options.js?v=1';

const classificationStyle=document.querySelector('link[data-age-classification]')||document.createElement('link');
classificationStyle.rel='stylesheet';classificationStyle.href='/age-classification.css?v=6';classificationStyle.dataset.ageClassification='';
if(!classificationStyle.isConnected)document.head.append(classificationStyle);
export function ageBadge(value){
 const badge=el('span',value||words('Возраст не указан','Age not specified'),'age-badge');
 badge.setAttribute('aria-label',words('Возрастная категория: ','Age category: ')+(value||words('не указана','not specified')));return badge;
}
export function classificationSummary(doc){
 const box=el('div',null,'age-summary');box.append(ageBadge(doc.ageRating));
 if(doc.contentWarnings)box.append(el('p',words('Предупреждения: ','Content warnings: ')+doc.contentWarnings));return box;
}
export function classificationFields(doc,onChange,{readOnly=false}={}){
 const box=el('section',null,'age-classification-fields');
 const row=el('div',null,'age-classification-heading'),title=el('span',words('Возрастная категория','Age category'));
 const help=el('details',null,'age-help'),question=el('summary','?');question.setAttribute('aria-label',words('Как выбрать возрастную категорию','How to choose an age category'));
 const explanation=words('Выберите категорию для всей истории с учётом наиболее взрослого содержания всех глав. Число обозначает минимальный возраст читателя. Укажите отдельно, есть ли пугающие сцены, насилие, грубая лексика или другие чувствительные темы. Если новая глава требует повышения категории, обновите её перед отправкой на модерацию.','Choose a category for the entire story based on the most mature content across all chapters. The number indicates the minimum reader age. List frightening scenes, violence, strong language or other sensitive themes separately. If a new chapter needs a higher category, update it before submitting for review.');
 question.title=explanation;help.append(question,el('p',explanation));row.append(title,help);
 const rating=select(words('Возрастная категория','Age category'),[['',words('Не указана','Not specified')],...['0+','6+','12+','16+','18+'].map(v=>[v,v])],doc.ageRating||'');
 rating.label.firstChild.remove();
 const age=el('div',null,'age-control');age.append(row,rating.label);
 const state=splitWarnings(doc.contentWarnings);
 const warningSection=el('section',null,'content-warning-section');
 warningSection.append(el('h3',words('Предупреждения о содержании','Content warnings')),el('p',words('Можно выбрать несколько. Отметьте то, что встречается в истории.','Select all that appear in your story.')));
 const groups=el('div',null,'warning-groups');
 const warnings=field(words('Другое предупреждение','Other content warning'),state.other,'textarea');warnings.input.maxLength=1000;warnings.input.readOnly=readOnly;
 const alert=el('div',null,'age-conflict');alert.setAttribute('role','alert');
 const promote=el('button',words('Установить 18+','Set to 18+'));promote.type='button';promote.disabled=readOnly;
 const alertText=el('div',null,'age-conflict-copy');
 alertText.append(el('strong',words('Нужно повысить категорию до 18+','An 18+ category is required')),el('p',words('Выбранные подробные сцены требуют категории 18+.','The selected explicit scenes require an 18+ category.')));
 alert.append(alertText,promote);
 alert.title=words('Черновик можно сохранить. Перед отправкой на модерацию повысьте категорию.','You can save the draft. Raise the category before submitting for review.');
 const refresh=()=>{alert.hidden=!needsAdultRating(doc);};
 const update=()=>{doc.contentWarnings=[...state.selected,warnings.input.value.trim()].filter(Boolean).join('\n');onChange();refresh();};
 warningGroups.forEach(([ru,en,options])=>{
  const group=el('fieldset'),legend=el('legend',words(ru,en));group.append(legend);
  for(const [label,english,minimum] of options){
   const item=el('label',null,'warning-choice'),input=el('input');input.type='checkbox';input.checked=state.selected.has(label);input.disabled=readOnly;
   input.onchange=()=>{if(input.checked)state.selected.add(label);else state.selected.delete(label);update();};
   item.append(input,el('span',words(label,english)+(minimum?' · 18+':'')));group.append(item);
  }
  groups.append(group);
 });
 warnings.input.oninput=update;
 rating.input.disabled=readOnly;rating.input.onchange=()=>{doc.ageRating=rating.input.value||null;onChange();refresh();};
 promote.onclick=()=>{rating.input.value='18+';rating.input.onchange();};
 warningSection.append(groups,warnings.label,alert);refresh();
 box.append(age,warningSection,el('small',words('Изменения станут видны читателям после модерации и публикации.','Readers will see changes after review and publication.')));return box;
}
