import {el,field,select,words} from './collection-ui.js?v=6';

if(!document.querySelector('link[data-age-classification]')){
 const style=document.createElement('link');style.rel='stylesheet';style.href='/age-classification.css?v=1';style.dataset.ageClassification='';document.head.append(style);
}
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
 rating.input.disabled=readOnly;rating.input.onchange=()=>{doc.ageRating=rating.input.value||null;onChange();};
 const warnings=field(words('Предупреждения о содержании (необязательно)','Content warnings (optional)'),doc.contentWarnings||'','textarea');warnings.input.maxLength=1000;warnings.input.readOnly=readOnly;
 warnings.input.placeholder=words('Например: пугающие сцены, грубая лексика','For example: frightening scenes, strong language');warnings.input.oninput=()=>{doc.contentWarnings=warnings.input.value;onChange();};
 box.append(row,rating.label,warnings.label,el('small',words('Изменения станут видны читателям после модерации и публикации.','Readers will see changes after review and publication.')));return box;
}
