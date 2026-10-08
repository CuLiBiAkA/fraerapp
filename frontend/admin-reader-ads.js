import {adCopy,safeAdUrl} from './reader-ads.js?v=1';
export function mountReaderAds({api,report,date,confirmAction,authorized,epoch}){
 const host=document.querySelector('#view-advertising');let saved=null,seq=0,busy=false,dirty=false;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const heading=el('h2','Реклама при чтении');heading.id='advertising-heading';heading.tabIndex=-1;
 const description=el('p','Реклама показывается читателям без активной подписки. Отдельно выданная роль автора не отключает рекламу. Новые пользователи получают роль «Читатель».');
 const form=el('form');form.id='advertising-form';form.className='admin-ad-form';const fields=el('fieldset');fields.disabled=true;const legend=el('legend','Настройки показа');fields.append(legend);
 const controls={};
 function field(key,label,type,max){const wrap=el('label',label),input=el(type==='textarea'?'textarea':'input');input.id='ad-'+key;input.name=key;if(type!=='textarea')input.type=type;if(max)input.maxLength=max;if(type==='textarea')input.rows=4;wrap.htmlFor=input.id;wrap.append(input);fields.append(wrap);controls[key]=input;return input;}
 field('enabled','Показывать рекламу','checkbox');const interval=field('intervalScenes','Переходов между рекламными паузами','number');interval.min=1;interval.max=100;interval.required=true;
 fields.append(el('p','По умолчанию — 5 переходов. Счётчик общий для всех историй читателя. Обновление страницы не считается; финальная сцена остаётся без рекламы. Паузу можно сразу закрыть.'));
 field('title','Заголовок (необязательно)','text',100);field('body','Текст (необязательно)','textarea',600);field('linkUrl','Ссылка HTTPS или путь на сайте (необязательно)','text',2000);field('buttonLabel','Надпись на ссылке (необязательно)','text',60);
 fields.append(el('p','Если текст не заполнен, читатель увидит тестовый блок на своём языке. Без ссылки дополнительная кнопка не появится. Рекламная сеть не подключена.'));
 const save=el('button','Сохранить настройки');save.type='submit';save.id='advertising-save';const refresh=el('button','Загрузить сохранённые');refresh.type='button';refresh.className='secondary';refresh.id='advertising-refresh';const actions=el('div');actions.className='admin-actions';actions.append(save,refresh);fields.append(actions);form.append(fields);
 const status=el('p');status.id='advertising-status';status.className='admin-status';status.setAttribute('role','status');const audit=el('p');audit.className='admin-ad-audit';
 const preview=el('aside');preview.className='admin-ad-preview';preview.setAttribute('aria-labelledby','ad-preview-heading');const previewHeading=el('h3','Предпросмотр');previewHeading.id='ad-preview-heading';const previewLabel=el('p','Реклама'),previewTitle=el('h4'),previewBody=el('p'),previewLink=el('a'),previewContinue=el('p','Продолжить историю');previewLink.target='_blank';previewLink.rel='noopener noreferrer sponsored';preview.append(previewHeading,previewLabel,previewTitle,previewBody,previewLink,previewContinue);
 const layout=el('div');layout.className='admin-ad-layout';layout.append(form,preview);host.append(heading,description,status,audit,layout);
 function values(){return {enabled:controls.enabled.checked,intervalScenes:Number(interval.value),...Object.fromEntries(['title','body','linkUrl','buttonLabel'].map(k=>[k,controls[k].value.trim()])),version:saved?.version};}
 function paintPreview(){const v=values(),t=adCopy('ru');previewTitle.textContent=v.title||t.title;previewBody.textContent=v.body||t.body;previewLink.textContent=v.buttonLabel||t.link;const url=safeAdUrl(v.linkUrl);previewLink.hidden=!url;if(url)previewLink.href=url;else previewLink.removeAttribute('href');}
 function paint(value){saved=value;dirty=false;for(const [key,input] of Object.entries(controls)){if(key==='enabled')input.checked=value[key];else input.value=value[key]??'';}fields.disabled=false;audit.textContent='Версия '+value.version+' · '+(value.updatedBy?date(value.updatedAt)+' · '+value.updatedBy:'Начальные настройки');paintPreview();}
 form.oninput=()=>{dirty=true;controls.linkUrl.setCustomValidity('');paintPreview();status.dataset.kind='info';status.textContent='Есть несохранённые изменения.';};
 async function load(force=false){
  if(!authorized()||busy)return;if(saved&&!force)return;
  const version=epoch(),current=++seq;status.textContent='Загружаем настройки…';status.dataset.kind='info';
  try{const value=await api('/api/admin/reader-ads');if(current!==seq||version!==epoch()||!authorized())return;paint(value);status.textContent='';}
  catch(error){if(current===seq&&version===epoch())report('#advertising-status',error);}
 }
 refresh.onclick=async()=>{const version=epoch();if(dirty&&!await confirmAction('Загрузить сохранённые настройки?','Несохранённые изменения будут заменены последней версией.',{label:'Загрузить'}))return;if(version===epoch())load(true);};
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!saved||!authorized())return;const value=values();if(value.linkUrl&&!safeAdUrl(value.linkUrl)){controls.linkUrl.setCustomValidity('Укажите HTTPS-ссылку или путь на этом сайте.');controls.linkUrl.reportValidity();return;}
  const version=epoch(),current=++seq;busy=true;fields.disabled=true;status.textContent='Сохраняем…';status.dataset.kind='info';
  try{const result=await api('/api/admin/reader-ads',{method:'PUT',body:value});if(current!==seq||version!==epoch()||!authorized())return;paint(result);status.dataset.kind='success';status.textContent=result.enabled?'Настройки сохранены. Новый интервал начнётся со следующего перехода читателя.':'Реклама отключена.';}
  catch(error){if(current===seq&&version===epoch()){report('#advertising-status',error);if(error.status===409)status.textContent='Настройки изменил другой администратор. Ваш текст сохранён в полях; загрузите последнюю версию перед повторным сохранением.';}}
  finally{busy=false;fields.disabled=!saved||!authorized();}
 };
 window.addEventListener('beforeunload',event=>{if(dirty&&authorized()){event.preventDefault();event.returnValue='';}});
 return {load,reset(){seq++;saved=null;dirty=false;fields.disabled=true;form.reset();audit.textContent='';status.textContent='';previewTitle.textContent='';previewBody.textContent='';previewLink.removeAttribute('href');previewLink.hidden=true;}};
}
