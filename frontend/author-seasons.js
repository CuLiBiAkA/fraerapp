import {el,button,field,checkbox,words} from './collection-ui.js?v=6';

// Runs preserve the reading order, including legacy text-only seasons.
export function seasonGroups(items) {
  const groups=[];let number=0;
  items.forEach((item,index)=>{
    const key=item.seasonId||item.season?.trim()||null;
    let group=groups.at(-1);
    if(!key||group?.key!==key){group={key,number:key?++number:null,title:item.season||'',description:item.seasonDescription||'',chapters:[]};groups.push(group);}
    group.chapters.push({item,index});
  });return groups;
}

export function seasonDialog({items,titleFor,onAdd}) {
  const opener=document.activeElement,dialog=el('dialog',null,'workspace-dialog season-dialog');
  const title=el('h2',words('Добавить сезон','Add season'));title.id='season-dialog-title';dialog.setAttribute('aria-labelledby',title.id);
  const name=field(words('Название (необязательно)','Name (optional)'));name.input.maxLength=100;
  const description=field(words('Краткое описание (необязательно)','Short description (optional)'),'','textarea');description.input.maxLength=1000;
  const chapters=el('fieldset');chapters.append(el('legend',words('Какие главы добавить в сезон','Chapters to include')));
  const selections=[];
  items.forEach((item,index)=>{if(item.seasonId||item.season?.trim())return;const choice=checkbox(`${index+1}. ${titleFor(item,index)}`,false);chapters.append(choice.label);selections.push({index,input:choice.input});});
  const error=el('p',null,'error');error.setAttribute('role','alert');
  const add=button(words('Добавить сезон','Add season'),()=>{
    const selected=selections.filter(x=>x.input.checked).map(x=>x.index);
    if(!selected.length){error.textContent=words('Выберите хотя бы одну главу.','Select at least one chapter.');return;}
    if(selected.at(-1)-selected[0]+1!==selected.length){error.textContent=words('Выберите главы, которые идут подряд. Это сохранит порядок чтения.','Select consecutive chapters to preserve the reading order.');return;}
    onAdd({indices:selected,id:crypto.randomUUID(),name:name.input.value.trim(),description:description.input.value.trim()});dialog.close();
  },'add-button');add.disabled=!selections.length;
  if(!selections.length)chapters.append(el('p',words('Все главы уже входят в сезоны. Сначала добавьте новую главу.','All chapters already belong to seasons. Add a new chapter first.')));
  const actions=el('div',null,'collection-actions');actions.append(add,button(words('Отмена','Cancel'),()=>dialog.close()));
  dialog.append(title,el('p',words('Выберите подряд идущие главы. Их порядок и содержимое останутся прежними. После добавления сохраните настройки истории.','Choose consecutive chapters. Their order and content stay unchanged. Save the story settings after adding the season.')),chapters,name.label,description.label,error,actions);
  dialog.addEventListener('close',()=>{dialog.remove();if(opener?.isConnected)opener.focus();else document.querySelector('.add-season')?.focus();},{once:true});
  document.body.append(dialog);dialog.showModal();
}
