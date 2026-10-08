import { credentialToJson, parseCreationOptions, parseRequestOptions, passkeysSupported } from './passkeys.js';
import { mountSubscriptions } from './admin-subscriptions.js?v=1';
import { mountReaderAds } from './admin-reader-ads.js?v=1';

const $ = selector => document.querySelector(selector);
const roles = {player:'Читатель', author:'Автор', moderator:'Модератор', admin:'Администратор'};
const state = {me:null, admin:false, epoch:0, view:'users', users:[], authors:[], userPage:0, loginPage:0, userPages:0, loginPages:0, userSeq:0, loginSeq:0, authorSeq:0, selected:null, runtime:new Map(), mutation:false};
let refreshing = null, userTimer, loginTimer, messageOwner = null, userContext = 0, messageContext = 0, inviteContext = 0;
const date = value => value ? new Date(value).toLocaleString('ru-RU', {dateStyle:'medium', timeStyle:'short'}) : 'Нет данных';
const roleNames = list => (list || []).map(role => roles[role] || role).join(', ');
const subscriptions=mountSubscriptions({api,report,date,confirmAction,authorized:()=>state.admin,epoch:()=>state.epoch});
const advertising=mountReaderAds({api,report,date,confirmAction,authorized:()=>state.admin,epoch:()=>state.epoch});
function el(tag, text, className) { const node=document.createElement(tag); if(text !== undefined) node.textContent=text; if(className) node.className=className; return node; }
function status(id, text='', kind='info') { const node=$(id); node.textContent=text; node.dataset.kind=kind; }
function button(text, action, className='secondary') { const node=el('button',text,className); node.type='button'; node.onclick=()=>action(node); return node; }
function errorText(error) {
  if(error.name==='NotAllowedError') return 'Действие отменено или устройство не подтвердило ключ доступа. Попробуйте ещё раз.';
  if(error.name==='InvalidStateError') return 'Этот ключ доступа уже добавлен. Используйте другое устройство.';
  const known = {'At least one active admin must remain':'В системе должен остаться хотя бы один активный администратор.', 'Admin cannot delete the current account':'Нельзя удалить аккаунт, с которого вы сейчас вошли.', 'User is blocked':'Аккаунт заблокирован. Сначала восстановите доступ.', 'User not found':'Пользователь не найден. Проверьте адрес или разрешите создание аккаунта.', 'Recent authentication required':'Для добавления ключа нужен недавний вход. Выйдите и войдите снова.'};
  if(known[error.detail]) return known[error.detail];
  return {400:'Проверьте заполненные поля и повторите действие.',401:'Сессия закончилась. Войдите снова.',403:'Недостаточно прав. Проверьте доступ к аккаунту.',404:'Запись не найдена. Обновите список.',409:'Действие недоступно для текущего состояния. Обновите данные и повторите.',429:'Слишком много запросов. Подождите немного и попробуйте снова.'}[error.status] || 'Не удалось выполнить запрос. Проверьте соединение и повторите попытку.';
}
async function api(path, options={}, retry=true) {
  const response=await fetch(path,{method:options.method || 'GET',credentials:'include',headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})},body:options.body?JSON.stringify(options.body):undefined});
  if(response.status===401 && retry && !/^\/auth\/(login-link|verify|refresh|passkeys\/authentication)/.test(path)) {
    if(!refreshing) refreshing=fetch('/auth/refresh',{method:'POST',credentials:'include',headers:{Accept:'application/json'}}).then(r=>r.ok).catch(()=>false).finally(()=>{refreshing=null;});
    if(await refreshing) return api(path,options,false);
  }
  const text=await response.text(); let payload;
  try { payload=text?JSON.parse(text):{}; } catch { payload={}; if(response.ok) throw new Error('Invalid response'); }
  if(!response.ok) { const error=new Error('Request failed'); error.status=response.status; error.code=payload?.code; error.detail=payload?.message || payload?.detail || ''; throw error; }
  return payload;
}
function revokeAccess(error) {
  if(error.code==='RECENT_AUTH_REQUIRED' || error.detail==='Recent authentication required') return;
  if(![401,403].includes(error.status)) return;
  state.admin=false; state.epoch++; state.selected=null; state.users=[]; state.authors=[]; state.runtime.clear();$('#identity').textContent=error.status===401?'Вход не выполнен':'Доступ требует проверки';
  subscriptions.reset();
  advertising.reset();
  for(const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  for(const id of ['#users-list','#authors-list','#logins-list','#passkey-list','#user-metrics']) $(id).replaceChildren();
  $('#message-text').value=''; clearInvite();
  $('#admin-layout').hidden=true; $('#login-section').hidden=error.status!==401; $('#access-denied').hidden=error.status!==403;
  status('#page-status',errorText(error),'error');
}
function report(id,error) { status(id,errorText(error),'error'); revokeAccess(error); }
async function perform(trigger,id,work) {
  if(state.mutation) { status(id,'Дождитесь завершения предыдущего действия.');return; }
  state.mutation=true; const priorDisabled=trigger.disabled, epoch=state.epoch, context=userContext, messageVersion=messageContext;
  trigger.disabled=true; trigger.setAttribute('aria-busy','true'); status(id);
  try { await work(); } catch(error) {
    if(epoch===state.epoch) report((id==='#user-action-status'&&context!==userContext)||(id==='#message-status'&&messageVersion!==messageContext)?'#page-status':id,error);
  }
  finally { state.mutation=false; trigger.disabled=priorDisabled; trigger.removeAttribute('aria-busy'); if(state.selected)paintUser(); }
}
function sameUser(user,epoch,context) { return epoch===state.epoch && context===userContext && state.selected?.id===user.id; }
function showDialog(id) { $(id).showModal(); }
for(const close of document.querySelectorAll('[data-close]')) close.onclick=()=>$('#'+close.dataset.close).close();
function confirmAction(title,description,{label='Подтвердить',email='',danger=false}={}) {
  const dialog=$('#confirm-dialog'); $('#confirm-heading').textContent=title; $('#confirm-description').textContent=description;
  $('#confirm-submit').textContent=label; $('#confirm-submit').className=danger?'danger':'';
  $('#confirm-typed').hidden=!email; $('#confirm-email').disabled=!email; $('#confirm-email').value=''; $('#confirm-email').setCustomValidity('');
  return new Promise(resolve=>{
    let accepted=false;
    $('#confirm-form').onsubmit=event=>{ event.preventDefault(); if(email && $('#confirm-email').value.trim().toLowerCase()!==email.toLowerCase()) { $('#confirm-email').setCustomValidity('Адрес не совпадает с выбранным пользователем.'); $('#confirm-email').reportValidity(); return; } accepted=true; dialog.close(); };
    $('#confirm-email').oninput=()=>$('#confirm-email').setCustomValidity('');
    dialog.addEventListener('close',()=>resolve(accepted),{once:true}); dialog.showModal();
    (email?$('#confirm-email'):dialog.querySelector('[data-close]')).focus();
  });
}
function empty(container,title,detail) { const box=el('div',undefined,'admin-empty');box.append(el('h3',title),el('p',detail));container.replaceChildren(box); }
function badge(text,kind='') { return el('span',text,'admin-badge '+kind); }
function renderPager(kind,page) {
  state[kind==='users'?'userPage':'loginPage']=page.page;
  state[kind==='users'?'userPages':'loginPages']=page.totalPages;
  $('#'+kind+'-page').textContent=page.totalElements?`${page.page*page.size+1}–${Math.min((page.page+1)*page.size,page.totalElements)} из ${page.totalElements}`:'Всего: 0';
  $('#'+kind+'-prev').disabled=page.page<=0; $('#'+kind+'-next').disabled=page.page+1>=page.totalPages;
}
async function loadUsers() {
  if(!state.admin) return;
  const seq=++state.userSeq, epoch=state.epoch;
  const query=new URLSearchParams({page:state.userPage,size:$('#user-size').value,query:$('#user-query').value.trim(),role:$('#user-role').value,status:$('#user-status').value});
  $('#users-list').setAttribute('aria-busy','true'); status('#users-status','Загружаем пользователей…');
  try {
    const page=await api('/auth/admin/users?'+query);
    if(seq!==state.userSeq || epoch!==state.epoch) return;
    state.users=page.items || []; renderUsers(); renderPager('users',page); status('#users-status');
  } catch(error) { if(seq===state.userSeq && epoch===state.epoch) report('#users-status',error); }
  finally { if(seq===state.userSeq) $('#users-list').setAttribute('aria-busy','false'); }
}
function renderUsers() {
  const list=$('#users-list'); list.replaceChildren();
  if(!state.users.length) { empty(list,'Пользователи не найдены','Измените поисковый запрос или сбросьте фильтры.');return; }
  for(const user of state.users) {
    const row=el('article',undefined,'admin-user'), identity=el('div'); identity.append(el('h3',user.email));
    const badges=el('div',undefined,'admin-badges');for(const role of user.roles) badges.append(badge(roles[role] || role));
    if(user.blocked) badges.append(badge('Заблокирован','blocked'));
    if(user.id===state.me?.id) badges.append(badge('Это вы','self'));
    const pending=badge('Заявка автора','pending');pending.dataset.authorRequest=user.id;pending.hidden=!state.authors.some(r=>r.userId===user.id);badges.append(pending);
    identity.append(badges,el('p','Регистрация: '+date(user.createdAt)));
    const activity=el('div',undefined,'admin-user-activity');activity.append(el('p',`Активные входы: ${user.activeSessions}`),el('p',`Ключи доступа: ${user.passkeys}`));
    const open=button('Открыть карточку',()=>openUser(user));open.setAttribute('aria-label','Открыть карточку '+user.email);
    row.append(identity,activity,open);list.append(row);
  }
}
async function openUser(user) {
  const context=++userContext;
  state.selected={...user,roles:[...user.roles]};status('#user-action-status');paintUser();showDialog('#user-dialog');
  const epoch=state.epoch;
  try {
    const stats=await api('/api/admin/users/runtime-stats?userIds='+encodeURIComponent(user.id));
    if(!sameUser(user,epoch,context)) return;
    state.runtime.set(user.id,stats.find(item=>item.userId===user.id) || {});paintUser();
  } catch(error) { if(sameUser(user,epoch,context)) { status('#user-action-status','Статистика историй временно недоступна. Данные доступа показаны.','error');revokeAccess(error); } }
}
function paintUser() {
  const user=state.selected;if(!user)return;
  $('#user-heading').textContent=user.email;$('#user-summary').textContent=roleNames(user.roles)+' · '+(user.blocked?'Доступ заблокирован':'Доступ открыт');
  const metrics=$('#user-metrics');metrics.replaceChildren();
  const runtime=state.runtime.get(user.id);
  const detail=$('#user-detail-stats');detail.replaceChildren();
  for(const [label,value] of [['Имя читателя',runtime?.username],['Активные сохранения',runtime?.activeSessions],['Черновики историй',runtime?.draftStories],['Истории на проверке',runtime?.reviewStories],['Опубликованные истории',runtime?.publishedStories],['Архивные истории',runtime?.archivedStories],['Чтения авторских историй',runtime?.authoredRuns],['События аккаунта',user.auditEvents],['Регистрация',date(user.createdAt)],['Последнее изменение',date(user.updatedAt)],['Дата блокировки',user.blockedAt?date(user.blockedAt):'Нет']]) detail.append(el('dt',label),el('dd',value??'—'));
  for(const [name,value] of [['Активные входы',user.activeSessions],['Ключи доступа',user.passkeys],['Всего входов',user.sessions],['Сохранения',runtime?.sessions],['Завершённые чтения',runtime?.finishedSessions],['Авторские истории',runtime?.authoredStories]]) {
    const metric=el('div',undefined,'admin-metric');metric.append(el('strong',value??'—'),el('span',name));metrics.append(metric);
  }
  $('#block-user').textContent=user.blocked?'Разблокировать':'Заблокировать';$('#user-invite').disabled=user.blocked;
  $('#delete-user').disabled=user.id===state.me?.id;$('#self-hint').hidden=user.id!==state.me?.id;updateRoleButtons();
}
function updateRoleButtons() { const role=$('#role-choice').value;$('#remove-role').disabled=role==='player'||!state.selected?.roles.includes(role);$('#grant-role').textContent=role==='player'?'Оставить только чтение':'Выдать права'; }
$('#role-choice').onchange=updateRoleButtons;
async function loadAuthors({quiet=false}={}) {
  if(!state.admin)return; const seq=++state.authorSeq,epoch=state.epoch;
  if(!quiet)status('#authors-status','Загружаем заявки…');
  try { const items=await api('/auth/admin/author-requests');if(epoch!==state.epoch||seq!==state.authorSeq)return;state.authors=items;$('#authors-count').textContent=items.length;renderAuthors();for(const badge of document.querySelectorAll('[data-author-request]'))badge.hidden=!items.some(r=>r.userId===badge.dataset.authorRequest);status('#authors-status'); }
  catch(error){if(epoch===state.epoch&&seq===state.authorSeq)report('#authors-status',error);}
}
function renderAuthors() {
  const query=$('#author-query').value.trim().toLowerCase(), list=$('#authors-list');list.replaceChildren();
  const items=state.authors.filter(r=>r.email.toLowerCase().includes(query));
  if(!items.length){empty(list,query?'Заявки не найдены':'Новых заявок нет',query?'Попробуйте другой адрес.':'Новые запросы на права автора появятся здесь.');return;}
  for(const item of items){const row=el('article',undefined,'admin-record'),copy=el('div');copy.append(el('h3',item.email),el('p','Подана '+date(item.requestedAt)));
    const actions=el('div',undefined,'admin-actions');actions.append(button('Выдать права автора',trigger=>perform(trigger,'#authors-status',async()=>{
      await api('/auth/admin/roles',{method:'POST',body:{email:item.email,role:'author',grant:true}});await loadAuthors();status('#authors-status',`Права автора выданы: ${item.email}.`,'success');
    }),''),button('Найти пользователя',()=>{ $('#user-query').value=item.email;$('#user-role').value='all';$('#user-status').value='all';state.userPage=0;switchView('users'); }));row.append(copy,actions);list.append(row);}
}
async function loadLogins() {
  if(!state.admin)return;const seq=++state.loginSeq,epoch=state.epoch;status('#logins-status','Загружаем историю…');
  try {
    const page=await api('/auth/admin/login-requests?'+new URLSearchParams({page:state.loginPage,size:$('#request-size').value,query:$('#request-query').value.trim()}));
    if(seq!==state.loginSeq||epoch!==state.epoch)return;
    if(page.page>0&&!page.items.length){state.loginPage=Math.max(0,page.totalPages-1);return loadLogins();}
    renderPager('logins',page);renderLogins(page.items||[]);status('#logins-status');
  }catch(error){if(seq===state.loginSeq&&epoch===state.epoch)report('#logins-status',error);}
}
function renderLogins(items) {
  const list=$('#logins-list');list.replaceChildren();if(!items.length){empty(list,'Обращений нет','Запросы ссылок на вход появятся здесь.');return;}
  for(const item of items){const row=el('article',undefined,'admin-record'),copy=el('div');copy.append(el('h3',item.email),el('p',`Запросов: ${item.requestCount} · Активных ссылок: ${item.activeUnusedLinks}`),el('p','Последний запрос: '+date(item.lastRequestedAt)),el('p',item.userId?(item.blocked?'Аккаунт заблокирован':roleNames(item.roles)):'Аккаунт ещё не создан'));
    const actions=el('div',undefined,'admin-actions'),invite=button(item.userId?'Помочь со входом':'Пригласить',()=>prepareInvite(item.email,!item.userId));invite.disabled=item.blocked;
    actions.append(invite,button('Удалить запись',trigger=>perform(trigger,'#logins-status',async()=>{
      if(!await confirmAction('Удалить запись о входе?',`Адрес: ${item.email}. История запросов и неиспользованные ссылки будут удалены. Сам аккаунт останется.`,{label:'Удалить запись',danger:true}))return;
      await api('/auth/admin/login-requests/delete',{method:'POST',body:{email:item.email}});await loadLogins();status('#logins-status','Запись и неиспользованные ссылки удалены.','success');
    })));row.append(copy,actions);list.append(row);}
}
function clearInvite(){ inviteContext++;$('#invite-url').value='';$('#invite-result').hidden=true;status('#copy-status'); }
function prepareInvite(email,create=false){if($('#user-dialog').open)$('#user-dialog').close();switchView('invite');clearInvite();$('#invite-email').value=email;$('#invite-create').checked=create;$('#invite-role').value='';$('#invite-email').focus();}
$('#user-invite').onclick=()=>prepareInvite(state.selected.email);
$('#invite-form').onsubmit=event=>{event.preventDefault();const email=$('#invite-email').value.trim(),role=$('#invite-role').value,createUser=$('#invite-create').checked;
  perform(event.submitter,'#invite-status',async()=>{
    const detail=`Получатель: ${email}. ${createUser?'Если аккаунта нет, он будет создан. ':''}${role?'Будут выданы права: '+roles[role]+'. ':''}Предыдущие активные ссылки перестанут работать.`;
    if(!await confirmAction('Создать ссылку для входа?',detail,{label:'Создать ссылку'}))return;
    clearInvite();const context=inviteContext,epoch=state.epoch;
    const result=await api('/auth/admin/users/login-link',{method:'POST',body:{email,redirectPath:'/',createUser,grantRoles:role?[role]:[]}});
    if(epoch!==state.epoch)return;
    if(context!==inviteContext||state.view!=='invite'){status('#page-status','Ссылка для '+email+' создана и скрыта. Новую можно создать в разделе «Приглашение и вход».');return;}
    $('#invite-url').value=result.loginUrl;$('#invite-recipient').textContent='Получатель: '+result.email;$('#invite-expiry').textContent='Действует до '+date(result.expiresAt)+'. Передайте ссылку только этому человеку.';$('#invite-result').hidden=false;status('#invite-status','Ссылка создана. Она не отправляется автоматически.','success');$('#copy-invite').focus();
  });
};
$('#copy-invite').onclick=async()=>{try{await navigator.clipboard.writeText($('#invite-url').value);status('#copy-status','Ссылка скопирована.','success');}catch{$('#invite-url').focus();$('#invite-url').select();status('#copy-status','Браузер не разрешил копирование. Ссылка выделена — скопируйте её вручную.');}};
$('#clear-invite').onclick=clearInvite;
$('#user-message').onclick=()=>{const user=state.selected;messageContext++;if(messageOwner!==user.id){$('#message-text').value='';messageOwner=user.id;}$('#message-recipient').textContent='Получатель: '+user.email;$('#message-text').dispatchEvent(new Event('input'));status('#message-status');showDialog('#message-dialog');$('#message-text').focus();};
$('#message-text').oninput=()=>{status('#message-status');$('#message-count').textContent=`${$('#message-text').value.length} / 2000`;$('#message-text').setCustomValidity('');};
$('#message-form').onsubmit=event=>{event.preventDefault();const message=$('#message-text').value.trim(),user=state.selected;if(!message){$('#message-text').setCustomValidity('Введите текст сообщения.');$('#message-text').reportValidity();return;}
  const epoch=state.epoch,context=userContext,version=messageContext;
  perform(event.submitter,'#message-status',async()=>{await api('/api/account/admin/messages',{method:'POST',body:{userId:user.id,message}});if(epoch!==state.epoch)return;
    if(version===messageContext){$('#message-text').value='';$('#message-dialog').close();}
    status(sameUser(user,epoch,context)?'#user-action-status':'#page-status','Сообщение отправлено: '+user.email+'.','success');});
};
async function changeRole(trigger,grant){const user=state.selected,role=$('#role-choice').value,epoch=state.epoch,context=userContext;await perform(trigger,'#user-action-status',async()=>{
  const description=role==='player'?`У ${user.email} останутся только права читателя. Доступ автора, модератора и администратора будет снят, активная подписка отозвана.`:`${grant?'Выдать':'Снять'} права «${roles[role]}» для ${user.email}? ${role==='author'?grant?'Это отдельные права: они сохранятся после окончания подписки.':'Активная подписка также будет отозвана.':''} ${role==='admin'&&grant?'Администратор сможет управлять аккаунтами и правами других пользователей.':''}`;
  if(!await confirmAction('Изменить права?',description,{label:'Изменить права',danger:!grant||role==='player'}))return;
  const result=await api('/auth/admin/roles',{method:'POST',body:{email:user.email,role,grant}});if(epoch!==state.epoch)return;
  if(sameUser(user,epoch,context)){state.selected={...user,...result};paintUser();}
  status(sameUser(user,epoch,context)?'#user-action-status':'#page-status','Права обновлены: '+user.email+'.','success');
  if(user.id===state.me.id){await loadSession();}else{await loadUsers();await loadAuthors({quiet:true});}
});}
$('#role-form').onsubmit=event=>{event.preventDefault();changeRole(event.submitter,true);};$('#remove-role').onclick=event=>changeRole(event.currentTarget,false);
$('#block-user').onclick=event=>{const user=state.selected,blocked=!user.blocked,epoch=state.epoch,context=userContext;perform(event.currentTarget,'#user-action-status',async()=>{
  if(!await confirmAction(blocked?'Заблокировать аккаунт?':'Восстановить доступ?',`${user.email}. ${blocked?'Активные входы будут завершены. Пользователь не сможет войти до разблокировки.':'Пользователь снова сможет войти. Истории и сохранения останутся прежними.'}`,{label:blocked?'Заблокировать':'Разблокировать',danger:blocked}))return;
  const result=await api('/auth/admin/users/block',{method:'POST',body:{email:user.email,blocked}});if(epoch!==state.epoch)return;
  if(sameUser(user,epoch,context)){state.selected={...user,...result,blocked};paintUser();}
  status(sameUser(user,epoch,context)?'#user-action-status':'#page-status',(blocked?'Аккаунт заблокирован: ':'Доступ восстановлен: ')+user.email+'.','success');if(user.id===state.me.id)await loadSession();else await loadUsers();
});};
$('#delete-user').onclick=event=>{const user=state.selected,epoch=state.epoch,context=userContext;perform(event.currentTarget,'#user-action-status',async()=>{
  if(!await confirmAction('Удалить аккаунт навсегда?',`${user.email}. Будут удалены входы, ключи доступа, роли и временные ссылки. Игровые сохранения в основной базе не удаляются. Отменить удаление аккаунта нельзя.`,{label:'Удалить аккаунт',email:user.email,danger:true}))return;
  await api('/auth/admin/users/delete',{method:'POST',body:{email:user.email}});if(epoch!==state.epoch)return;
  if(sameUser(user,epoch,context)){$('#user-dialog').close();state.selected=null;}
  await loadUsers();await loadAuthors({quiet:true});status('#users-status','Аккаунт удалён: '+user.email,'success');
});};
async function loadPasskeys(){const epoch=state.epoch;status('#security-status','Загружаем ключи доступа…');try{const result=await api('/auth/passkeys');if(epoch!==state.epoch)return;const list=$('#passkey-list');list.replaceChildren();
  if(!result.passkeys?.length)empty(list,'Ключей доступа пока нет','Добавьте ключ на личном устройстве для быстрого входа.');
  for(const key of result.passkeys||[]){const row=el('article',undefined,'admin-record'),copy=el('div');copy.append(el('h3',key.displayName||'Ключ доступа'),el('p','Добавлен '+date(key.createdAt)));row.append(copy,button('Удалить ключ',trigger=>perform(trigger,'#security-status',async()=>{if(!await confirmAction('Удалить ключ доступа?',`Ключ «${key.displayName||'Без названия'}» перестанет работать. Убедитесь, что сможете войти другим способом.`,{label:'Удалить ключ',danger:true}))return;await api('/auth/passkeys/'+encodeURIComponent(key.credentialId),{method:'DELETE'});await loadPasskeys();status('#security-status','Ключ удалён.','success');})));list.append(row);}status('#security-status',passkeysSupported()?'':'Добавление ключей недоступно в этом браузере. Используйте совместимое устройство.');
}catch(error){if(epoch===state.epoch)report('#security-status',error);}}
$('#passkey-form').onsubmit=event=>{event.preventDefault();perform(event.submitter,'#security-status',async()=>{const name=$('#passkey-name').value.trim();const options=await api('/auth/passkeys/registration/options',{method:'POST'});const credential=await navigator.credentials.create({publicKey:parseCreationOptions(options.publicKey)});if(!credential)throw new DOMException('Cancelled','NotAllowedError');await api('/auth/passkeys/registration/verify',{method:'POST',body:{challengeId:options.challengeId,displayName:name,credential:credentialToJson(credential)}});$('#passkey-name').value='';await loadPasskeys();status('#security-status','Ключ доступа добавлен.','success');});};
$('#refresh-passkeys').onclick=loadPasskeys;
$('#passkey-login').onclick=event=>perform(event.currentTarget,'#login-status',async()=>{const options=await api('/auth/passkeys/authentication/options',{method:'POST'});const credential=await navigator.credentials.get({publicKey:parseRequestOptions(options.publicKey)});if(!credential)throw new DOMException('Cancelled','NotAllowedError');await api('/auth/passkeys/authentication/verify',{method:'POST',body:{challengeId:options.challengeId,credential:credentialToJson(credential)}});await loadSession();});
$('#passkey-login').disabled=!passkeysSupported();$('#passkey-register').disabled=!passkeysSupported();
$('#login-form').onsubmit=event=>{event.preventDefault();perform(event.submitter,'#login-status',async()=>{await api('/auth/login-link',{method:'POST',body:{email:$('#login-email').value.trim(),redirectPath:'/auth/admin',personalDataConsent:$('#login-consent').checked}});status('#login-status','Запрос принят. Если вход доступен, инструкции будут доставлены доступным способом.','success');});};
function switchView(view,focus=true){if(!state.admin)return;if(!['users','authors','subscriptions','advertising','logins','invite','security'].includes(view))view='users';if(state.view==='invite'&&view!=='invite')clearInvite();state.view=view;history.replaceState(null,'','#'+view);for(const panel of document.querySelectorAll('[data-panel]'))panel.hidden=panel.dataset.panel!==view;for(const link of document.querySelectorAll('[data-view]')){if(link.dataset.view===view)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');}if(focus)$('#'+view+'-heading')?.focus();if(view==='users')loadUsers();if(view==='authors')loadAuthors();if(view==='subscriptions')subscriptions.load();if(view==='advertising')advertising.load();if(view==='logins')loadLogins();if(view==='security')loadPasskeys();}
for(const link of document.querySelectorAll('[data-view]'))link.onclick=event=>{event.preventDefault();switchView(link.dataset.view);};
window.addEventListener('hashchange',()=>switchView(location.hash.slice(1)));
$('#user-filters').onsubmit=event=>{event.preventDefault();clearTimeout(userTimer);state.userPage=0;loadUsers();};
$('#user-query').oninput=()=>{state.userSeq++;clearTimeout(userTimer);state.userPage=0;userTimer=setTimeout(loadUsers,250);};
for(const id of ['#user-role','#user-status','#user-size'])$(id).onchange=()=>{clearTimeout(userTimer);state.userPage=0;loadUsers();};
$('#reset-users').onclick=()=>{$('#user-query').value='';$('#user-role').value='all';$('#user-status').value='all';clearTimeout(userTimer);state.userPage=0;loadUsers();};
$('#request-query').oninput=()=>{state.loginSeq++;clearTimeout(loginTimer);state.loginPage=0;loginTimer=setTimeout(loadLogins,250);};
$('#request-size').onchange=()=>{state.loginPage=0;loadLogins();};$('#author-query').oninput=renderAuthors;
$('#refresh-users').onclick=loadUsers;$('#refresh-logins').onclick=loadLogins;$('#refresh-authors').onclick=()=>loadAuthors();
for(const kind of ['users','logins'])for(const direction of ['prev','next'])$('#'+kind+'-'+direction).onclick=()=>{const pageKey=kind==='users'?'userPage':'loginPage',pagesKey=kind==='users'?'userPages':'loginPages';state[pageKey]=Math.max(0,Math.min(Math.max(0,state[pagesKey]-1),state[pageKey]+(direction==='next'?1:-1)));(kind==='users'?loadUsers:loadLogins)();};
async function logout(event){await perform(event.currentTarget,'#page-status',async()=>{await api('/auth/logout',{method:'POST'});location.replace('/auth/admin');});}
$('#logout').onclick=logout;$('#denied-logout').onclick=logout;$('#retry-access').onclick=loadSession;
async function loadSession(){const epoch=++state.epoch;status('#page-status','Проверяем доступ…');try{const me=await api('/auth/me');if(epoch!==state.epoch)return;state.me=me;state.admin=me.roles.includes('admin');$('#identity').textContent=me.email+' · '+roleNames(me.roles);$('#security-identity').textContent='Вы вошли как '+me.email;$('#login-section').hidden=true;$('#access-denied').hidden=state.admin;$('#denied-moderation').hidden=!me.roles.some(r=>['moderator','admin'].includes(r));$('#admin-layout').hidden=!state.admin;status('#page-status');if(state.admin){loadAuthors({quiet:true});switchView(location.hash.slice(1)||'users',false);}else{for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();clearInvite();}}
  catch(error){if(epoch!==state.epoch)return;revokeAccess(error);state.admin=false;state.selected=null;for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();clearInvite();$('#admin-layout').hidden=true;$('#login-section').hidden=error.status===403;$('#access-denied').hidden=error.status!==403;$('#identity').textContent=error.status===403?'Доступ требует проверки':'Вход не выполнен';status('#page-status',error.status===401?'':errorText(error),error.status===401?'info':'error');}
}
const timer=setInterval(()=>{if(state.admin&&!document.hidden&&!state.mutation&&!document.querySelector('dialog[open]'))loadAuthors({quiet:true});},30000);
window.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(userTimer);clearTimeout(loginTimer);clearInvite();},{once:true});
async function start(){const params=new URLSearchParams(location.search),token=params.get('auth_token');if(token){history.replaceState(null,'','/auth/admin');try{await api('/auth/verify',{method:'POST',body:{token}});}catch(error){status('#login-status',errorText(error),'error');}}await loadSession();}
start();
