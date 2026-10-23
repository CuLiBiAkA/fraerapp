import {el,button,field,words,request,errorMessage} from './collection-ui.js?v=6';
import {uploadImage} from './author-cover.js?v=3';
import {prepareImage} from './image-preparation.js?v=1';

const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='/author-profile.css?v=1';document.head.append(sheet);
function modal(){
 const previous=document.activeElement,dialog=el('dialog',null,'author-profile-dialog');
 const heading=el('h2',words('Об авторе','About the author'));heading.id='author-profile-'+crypto.randomUUID();dialog.setAttribute('aria-labelledby',heading.id);
 const close=el('button','×','author-profile-close');close.type='button';close.onclick=()=>dialog.close();close.setAttribute('aria-label',words('Закрыть','Close'));
 dialog.append(heading,close);document.body.append(dialog);
 dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus();},{once:true});
 dialog.showModal();return dialog;
}
function avatar(url){const node=url?el('img'):el('span','А');node.className='author-profile-avatar';if(url){node.src=url;node.alt='';}return node;}
export function authorCapsule(story){
 if(!story.authorId)return null;
 const control=button(words('Автор: ','Author: ')+(story.authorName||words('Автор','Author')),()=>showAuthor(story.authorId),'author-capsule');
 control.setAttribute('aria-label',words('Об авторе: ','About author: ')+(story.authorName||words('Автор','Author')));return control;
}
async function showAuthor(id,preview){
 const dialog=modal(),status=el('p',words('Загружаем…','Loading…'));status.setAttribute('role','status');dialog.append(status);
 try{
  const data=preview||await request('/api/authors/'+encodeURIComponent(id));if(!dialog.isConnected)return;
  status.textContent='';const p=data.profile,top=el('div',null,'author-profile-top'),copy=el('div');
  copy.append(el('h3',p.nickname||words('Автор','Author')));if(p.biography)copy.append(el('p',p.biography,'author-profile-bio'));
  top.append(avatar(p.avatar),copy);dialog.append(top);
  if(!preview){const favorite=button('',async()=>{favorite.disabled=true;try{
    const result=await request('/api/authors/'+encodeURIComponent(id)+'/favorite',{method:'PUT',body:{favorite:!data.favorite}});data.favorite=result.favorite;paint();status.textContent='';
   }catch(error){status.textContent=error.status===401?words('Войдите в аккаунт, чтобы добавить автора в избранное.','Sign in to save this author.'):errorMessage(error);}finally{favorite.disabled=false;}
  });function paint(){favorite.textContent=data.favorite?words('♥ В избранном','♥ Saved'):words('♡ В избранное','♡ Save author');favorite.setAttribute('aria-pressed',String(data.favorite));}paint();dialog.append(favorite);}
  const socials=el('div',null,'author-profile-links');for(const item of p.links||[]){const a=el('a',item.label);a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';socials.append(a);}dialog.append(socials);
  dialog.append(el('h3',words('Истории автора','Stories by this author')));
  const works=el('div',null,'author-profile-works');for(const work of data.works||[]){const a=el('a');a.href=work.url;if(work.coverUrl){const cover=el('img');cover.src=work.coverUrl;cover.alt='';a.append(cover);}a.append(el('span',work.title));works.append(a);}if(!works.childElementCount)works.append(el('p',words('Опубликованных историй пока нет.','No published stories yet.')));dialog.append(works);
 }catch(error){status.textContent=errorMessage(error);}
}
export async function editAuthorProfile(){
 const dialog=modal(),status=el('p',words('Загружаем профиль…','Loading profile…'));status.setAttribute('role','status');dialog.append(status);
 try{
  const profile=await request('/api/author/profile');if(!dialog.isConnected)return;status.textContent='';
  const form=el('form'),name=field(words('Публичное имя','Public name'),profile.nickname),bio=el('textarea');name.input.maxLength=60;
  const bioLabel=el('label',words('О себе','About you'));bio.value=profile.biography;bio.maxLength=1200;bio.rows=4;bioLabel.append(bio);
  let picture=avatar(profile.avatar);const imageRow=el('div',null,'author-profile-top'),file=field(words('Выбрать аватар','Choose avatar'),'','file');file.input.accept='image/png,image/jpeg,image/webp,image/gif';file.label.hidden=true;
  const choose=button(words('Выбрать аватар','Choose avatar'),()=>file.input.click());imageRow.append(picture,choose,file.label);
  const links=el('div',null,'author-profile-link-fields');
  function addLink(item={label:'',url:''}){
   if(links.childElementCount>=5)return;const row=el('div',null,'author-profile-link-row'),label=field(words('Соцсеть','Social network'),item.label),url=field(words('Ссылка https://','https:// link'),item.url,'url');label.input.maxLength=40;url.input.maxLength=500;url.input.required=true;url.input.pattern='https://.*';
   row.append(label.label,url.label,button('×',()=>row.remove()));row.lastChild.setAttribute('aria-label',words('Удалить ссылку','Remove link'));links.append(row);
  }
  for(const item of profile.links)addLink(item);
  let uploading=false,saving=false,dirty=false;form.addEventListener('input',()=>{dirty=true;});form.addEventListener('click',e=>{if(e.target.closest('.author-profile-link-fields'))dirty=true;});
  function value(){return {...profile,nickname:name.input.value.trim(),biography:bio.value.trim(),links:[...links.children].map(row=>{const inputs=row.querySelectorAll('input');return {label:inputs[0].value.trim(),url:inputs[1].value.trim()};})};}
  const save=button(words('Сохранить','Save'),()=>{},'author-profile-primary');save.type='submit';
  file.input.onchange=async()=>{const selected=file.input.files[0];if(!selected)return;uploading=true;save.disabled=true;file.input.disabled=true;
   try{const prepared=await prepareImage(selected,{purpose:'cover'});if(prepared){profile.avatar=await uploadImage('/api/author/profile/avatar',prepared);const next=avatar(profile.avatar);picture.replaceWith(next);picture=next;dirty=true;status.textContent=words('Аватар загружен. Сохраните профиль.','Avatar uploaded. Save your profile.');}}
   catch(error){status.textContent=errorMessage(error);}finally{uploading=false;save.disabled=false;file.input.disabled=false;file.input.value='';}
  };
  const actions=el('div',null,'author-profile-actions');actions.append(save,button(words('Посмотреть профиль','Preview profile'),async()=>{if(!form.reportValidity()||uploading||saving)return;try{const existing=await request('/api/authors/'+encodeURIComponent(profile.id));if(dialog.isConnected)showAuthor(profile.id,{profile:value(),works:existing.works});}catch(error){status.textContent=errorMessage(error);}}));
  form.append(el('p',words('Ваш публичный профиль. Заполнение необязательно.','Your public profile. All fields are optional.')),imageRow,name.label,bioLabel,el('h3',words('Соцсети — по желанию','Social links — optional')),links,button(words('+ Добавить ссылку','+ Add link'),()=>{addLink();dirty=true;}),actions);
  form.onsubmit=async e=>{e.preventDefault();if(uploading||saving)return;saving=true;form.inert=true;status.textContent=words('Сохраняем…','Saving…');
   try{await request('/api/author/profile',{method:'PUT',body:value()});dirty=false;status.textContent=words('Профиль сохранён.','Profile saved.');}
   catch(error){status.textContent=errorMessage(error);}finally{saving=false;form.inert=false;}
  };
  const canClose=()=>!uploading&&!saving&&(!dirty||confirm(words('Закрыть без сохранения изменений?','Discard unsaved changes?')));
  dialog.querySelector('.author-profile-close').onclick=()=>{if(canClose())dialog.close();};dialog.addEventListener('cancel',event=>{if(!canClose())event.preventDefault();});
  dialog.insertBefore(form,status);
 }catch(error){status.textContent=errorMessage(error);}
}
