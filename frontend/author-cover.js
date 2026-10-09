import {el,button,field,words,errorMessage} from './collection-ui.js?v=5';
import {coverImage} from './author-ui.js?v=1';

const library = [
  ['/assets/stories/cat-sofa-background-v2.png','Кошка у двери','Cat by the door'],
  ['/assets/door.svg','Открытая дверь','Open door'],
  ['/assets/platform.svg','Платформа','Platform'],
  ['/assets/tracks.svg','Железная дорога','Railway'],
  ['/assets/departure.svg','Отправление','Departure'],
];

export async function uploadImage(path,file,fields={}) {
  const body=new FormData();body.append('file',file);
  for(const [key,value] of Object.entries(fields))body.append(key,value);
  async function send(retry=true){
    const response=await fetch(path,{method:'POST',credentials:'include',headers:{'X-Fraer-Request':'same-origin'},body});
    if(response.status===401&&retry){const refresh=await fetch('/auth/refresh',{method:'POST',credentials:'include',headers:{'X-Fraer-Request':'same-origin'}});if(refresh.ok)return send(false);}
    let result={};try{result=await response.json();}catch{}
    if(!response.ok)throw Object.assign(new Error(result.message||result.detail||words('Не удалось загрузить изображение.','Could not upload image.')),{status:response.status});
    return result.url;
  }
  return send();
}

export async function chooseCover({url,onSelect,upload,getImages}) {
  const previous=document.activeElement,dialog=el('dialog',null,'workspace-dialog author-cover-dialog');
  dialog.setAttribute('aria-labelledby','cover-picker-title');
  const title=el('h2',words('Обложка истории','Story cover'));title.id='cover-picker-title';
  const feedback=el('p','', 'workspace-status');feedback.setAttribute('role','status');
  const grid=el('div',null,'author-cover-library');
  const choose=(path)=>{onSelect(path);dialog.close();};
  function add(path,label){const control=button('',()=>choose(path));control.append(coverImage(path),el('span',label));control.setAttribute('aria-pressed',String(path===url));grid.append(control);}
  for(const [path,ru,en] of library)add(path,words(ru,en));
  if(url&&!library.some(([path])=>path===url))add(url,words('Текущая обложка','Current cover'));
  const file=field(words('Загрузить свою обложку','Upload your cover'),'','file');file.input.accept='image/png,image/jpeg,image/webp,image/gif';
  let pending=false;
  const close=button(words('Закрыть','Close'),()=>dialog.close());
  file.input.onchange=async()=>{
    const selected=file.input.files[0];if(!selected||pending)return;
    pending=true;dialog.querySelectorAll('button,input').forEach(control=>control.disabled=true);grid.inert=advanced.inert=true;feedback.textContent=words('Загружаем изображение…','Uploading image…');feedback.classList.remove('error');
    try{const path=await upload(selected);choose(path);}
    catch(error){feedback.textContent=errorMessage(error);feedback.classList.add('error');}
    finally{pending=false;dialog.querySelectorAll('button,input').forEach(control=>control.disabled=false);grid.inert=advanced.inert=false;file.input.value='';}
  };
  dialog.oncancel=event=>{if(pending)event.preventDefault();};
  const advanced=el('details');advanced.append(el('summary',words('Указать путь вручную','Enter a path manually')));
  const path=field(words('Путь к изображению','Image path'),url||'');
  advanced.append(path.label,button(words('Использовать путь','Use path'),()=>{
    if(!/^\/(assets|uploads)\/[\w./-]+$/.test(path.input.value)||path.input.value.includes('..')){feedback.textContent=words('Используйте путь из библиотеки /assets/ или своей загрузки /uploads/.','Use an /assets/ library path or your own /uploads/ path.');return;}
    choose(path.input.value);
  }));
  dialog.append(title,el('p',words('Выберите изображение из библиотеки или загрузите своё. Затем сохраните настройки истории.','Choose a library image or upload your own, then save the story settings.')),grid,file.label,advanced,feedback,button(words('Убрать обложку','Remove cover'),()=>choose('')),close);
  dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus();else document.querySelector('.author-metadata:not([hidden]) .author-cover-setting button')?.focus();},{once:true});document.body.append(dialog);dialog.showModal();
  if(getImages)try{const images=await getImages();for(const image of images||[])if(image.url&&image.url!==url)add(image.url,image.filename||words('Моя загрузка','My upload'));}catch(error){feedback.textContent=errorMessage(error);}
}
