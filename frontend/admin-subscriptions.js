export function mountSubscriptions({api,report,date,confirmAction,authorized,epoch}) {
 const host=document.querySelector('#view-subscriptions');let page=0,pages=0,seq=0,detailSeq=0,selected=null,busy=false,timer;
 const names={active:'Активна',expired:'Истекла',revoked:'Отозвана'},actions={test_activated:'Тестовая активация',test_renewed:'Тестовое продление',revoked:'Доступ отозван'};
 function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
 function button(text,action){const n=el('button',text,'secondary');n.type='button';n.onclick=action;return n;}
 const heading=el('h2','Подписки');heading.id='subscriptions-heading';heading.tabIndex=-1;
 const refresh=button('Обновить',()=>load()),header=el('header',undefined,'admin-section-heading');header.append(heading,refresh);
 const description=el('p','Все оформления тестовые: денег не поступало, автопродления нет. Тариф «Автор» — 139 ₽ в месяц. Активная подписка даёт роль автора на календарный месяц.');
 const metrics=el('div',undefined,'admin-metrics'),filters=el('form',undefined,'admin-filters'),query=el('input'),filter=el('select');query.type='search';query.id='subscription-query';query.placeholder='Адрес или его часть';
 const qlabel=el('label','Поиск по почте');qlabel.htmlFor=query.id;const search=el('div',undefined,'admin-search');search.append(qlabel,query);
 filter.id='subscription-filter';for(const [value,label] of Object.entries({all:'Все подписки',...names})){const o=el('option',label);o.value=value;filter.append(o);}const flabel=el('label','Состояние');flabel.htmlFor=filter.id;const choice=el('div');choice.append(flabel,filter);
 filters.append(search,choice);const status=el('p','', 'admin-status');status.id='subscriptions-status';status.setAttribute('role','status');const list=el('div',undefined,'admin-list');list.id='subscriptions-list';
 const pager=el('div',undefined,'admin-pager'),label=el('span'),previous=button('← Назад',()=>{page--;load();}),next=button('Далее →',()=>{page++;load();});pager.append(label,previous,next);
 host.append(header,description,metrics,filters,status,list,pager);
 const dialog=el('dialog',undefined,'admin-dialog');dialog.id='subscription-dialog';dialog.setAttribute('aria-labelledby','subscription-user-heading');
 const title=el('h2');title.id='subscription-user-heading';const close=button('Закрыть',()=>dialog.close());const detail=el('div');
 const form=el('form'),reasonLabel=el('label','Причина отзыва доступа'),reason=el('textarea');reason.id='subscription-reason';reasonLabel.htmlFor=reason.id;reason.required=true;reason.maxLength=500;reason.rows=3;
 const revoke=button('Отозвать подписку');revoke.type='submit';revoke.className='danger';form.append(reasonLabel,reason,revoke);
 const detailStatus=el('p','', 'admin-status');detailStatus.id='subscription-detail-status';detailStatus.setAttribute('role','status');dialog.append(title,close,detail,form,detailStatus);document.body.append(dialog);
 dialog.addEventListener('close',()=>{detailSeq++;selected=null;reason.value='';});
 async function load(){
  if(!authorized())return;const current=++seq,version=epoch();status.dataset.kind='info';status.textContent='Загружаем подписки…';list.setAttribute('aria-busy','true');
  try{
   const result=await api('/auth/admin/subscriptions?'+new URLSearchParams({page,size:20,query:query.value.trim(),status:filter.value}));if(current!==seq||version!==epoch()||!authorized())return;
   page=result.page;pages=result.totalPages;previous.disabled=page===0;next.disabled=page+1>=pages;label.textContent=`Всего: ${result.totalElements}${pages?' · Страница '+(page+1)+' из '+pages:''}`;
   metrics.replaceChildren();for(const key of ['active','expired','revoked']){const box=el('div',undefined,'admin-metric');box.append(el('strong',String(result.counts[key]||0)),el('span',names[key]));metrics.append(box);}
   list.replaceChildren();if(!result.items.length)list.append(el('p','Подписок не найдено. Измените поиск или фильтр.'));
   for(const item of result.items){const row=el('article',undefined,'admin-record'),copy=el('div');copy.append(el('h3',item.email),el('p',names[item.subscription.status]+' · до '+date(item.subscription.expiresAt)),el('p','Тестовый доступ · без оплаты'));
    if(item.blocked)copy.append(el('p','Аккаунт заблокирован: подписка не открывает вход.'));if(item.manualAuthor)copy.append(el('p','Есть отдельно выданные права автора/администратора.'));
    row.append(copy,button('История и управление',()=>open(item)));list.append(row);
   }status.textContent='';
  }catch(error){if(current===seq&&version===epoch())report('#subscriptions-status',error);}finally{if(current===seq)list.setAttribute('aria-busy','false');}
 }
 function paint(value){
  detail.replaceChildren();const sub=value.subscription;form.hidden=sub?.status!=='active';
  if(sub)detail.append(el('p',`${names[sub.status]} · ${date(sub.startedAt)} — ${date(sub.expiresAt)}`));
  if(value.manualAuthor)detail.append(el('p','Отзыв подписки сохранит отдельно выданные права автора или администратора.'));
  detail.append(el('h3','Оформления · последние 100'));if(!value.orders.length)detail.append(el('p','Оформлений нет.'));
  for(const order of value.orders){const row=el('div',undefined,'admin-record');row.append(el('p',date(order.createdAt)+' · Тест · 0 ₽ · до '+date(order.periodEnd)));detail.append(row);}
  detail.append(el('h3','События · последние 100'));for(const event of value.events){const row=el('div',undefined,'admin-record');row.append(el('p',date(event.createdAt)+' · '+(actions[event.action]||event.action)),el('p',event.action==='revoked'?event.reason:'Без списания денег'),el('p','Инициатор: '+(event.actorLabel||(event.actorId==='system'?'Системное изменение':event.actorId||'Нет данных'))));detail.append(row);}
 }
 async function open(item){
  if(busy)return;const current=++detailSeq,version=epoch();selected=null;title.textContent=item.email;detail.replaceChildren();reason.value='';form.hidden=true;detailStatus.dataset.kind='info';detailStatus.textContent='Загружаем историю…';if(!dialog.open)dialog.showModal();
  try{const value=await api('/auth/admin/subscriptions/'+encodeURIComponent(item.userId));if(current!==detailSeq||version!==epoch()||!dialog.open)return;selected={item,value};paint(value);detailStatus.textContent='';}
  catch(error){if(current===detailSeq&&version===epoch())report('#subscription-detail-status',error);}
 }
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!selected)return;const target=selected,current=detailSeq,version=epoch(),why=reason.value.trim();if(!why){reason.focus();return;}
  busy=true;revoke.disabled=true;
  try{
   if(!await confirmAction('Отозвать подписку?',`Доступ по подписке для ${target.item.email} закончится сейчас. Истории сохранятся. Отдельно выданные права не изменятся.`,{label:'Отозвать',danger:true}))return;
   if(current!==detailSeq||version!==epoch()||!authorized())return;
   const value=await api('/auth/admin/subscriptions/'+encodeURIComponent(target.item.userId)+'/revoke',{method:'POST',body:{version:target.value.subscription.version,reason:why}});
   if(current!==detailSeq||version!==epoch())return;selected={item:target.item,value};paint(value);reason.value='';detailStatus.dataset.kind='success';detailStatus.textContent='Подписка отозвана. Причина сохранена в истории.';await load();
  }catch(error){if(current===detailSeq&&version===epoch()){report('#subscription-detail-status',error);if(error.status===409)detailStatus.textContent='Подписка уже изменилась. Закройте карточку и откройте её снова. Причина сохранена в поле.';}}
  finally{busy=false;revoke.disabled=false;}
 };
 filters.onsubmit=event=>{event.preventDefault();clearTimeout(timer);page=0;load();};query.oninput=()=>{seq++;page=0;clearTimeout(timer);timer=setTimeout(load,250);};filter.onchange=()=>{clearTimeout(timer);page=0;load();};
 return {load,reset(){seq++;detailSeq++;clearTimeout(timer);selected=null;list.replaceChildren();metrics.replaceChildren();detail.replaceChildren();if(dialog.open)dialog.close();}};
}
