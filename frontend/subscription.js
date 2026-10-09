const en=localStorage.getItem('fraerapp.language')==='en',w=(ru,english)=>en?english:ru,$=s=>document.querySelector(s);
const english={skip:'Skip to subscription',eyebrow:'FOR AUTHORS',title:'Your stories start here',intro:'Build worlds where readers choose their own path.',test:'Test mode',plan:'Author',price:'₽139 / month',period:'One calendar month of access · no automatic renewal',adfree:'Read without advertising breaks',benefit1:'Build stories, scenes and choices',benefit2:'Create and save drafts',benefit3:'Submit stories for moderation',moderation:'Publication requires moderation. Only one of your stories and its chapters may be under review at a time.',activate:'Start a test subscription',login:'Sign in or register',disabled:'Test checkout is temporarily disabled.',nocharge:'Payments are not connected yet. No bank details needed. This is a checkout test, not a real purchase.',access:'My access',loading:'Loading…',create:'Go to my stories',refresh:'Refresh status',history:'Subscription history',historyHint:'Latest 100 operations. All purchases here are tests; no money was charged.',faq:'Good to know',faq1:'What happens after the month ends?',answer1:'Subscription access ends, and advertising breaks may appear again while reading. Stories and drafts remain saved. Start another period to continue; permissions granted separately by an administrator remain.',faq2:'Will I be charged automatically?',answer2:'No. Test mode has no payments or automatic renewal. You confirm each new period.',faq3:'Does a subscription guarantee publication?',answer3:'No. It unlocks author tools. A moderator reviews every publication application separately.',terms:'Terms of use',privacy:'Privacy policy',confirmTitle:'Confirm test checkout',confirmText:'The Author plan is ₽139 per month. In test mode, you receive one calendar month free. Renewals add a month to your remaining period.',total:'Amount due: ₽0',confirmNote:'No money will be charged. Automatic renewal is off.',consent:'I understand this is a test checkout without payment.',confirm:'Confirm',cancel:'Cancel'};
document.documentElement.lang=en?'en':'ru';document.title=w('Подписка — FraerApp','Subscription — FraerApp');
if(en)document.querySelectorAll('[data-copy]').forEach(n=>n.textContent=english[n.dataset.copy]);
let user=null,account=null,busy=false,sequence=0,requestId=null;
const dialog=$('#checkout-dialog'),date=value=>new Date(value).toLocaleString(en?'en-GB':'ru-RU',{dateStyle:'long',timeStyle:'short'});
function el(tag,text){const n=document.createElement(tag);n.textContent=text;return n;}
async function api(path,options={},retry=true){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers:{'Content-Type':'application/json','X-Fraer-Request':'same-origin'},body:options.body?JSON.stringify(options.body):undefined});
 if(response.status===401&&retry){const refresh=await fetch('/auth/refresh',{method:'POST',credentials:'same-origin',headers:{'X-Fraer-Request':'same-origin'}});if(refresh.ok)return api(path,options,false);}
 if(!response.ok)throw Object.assign(new Error('Request failed'),{status:response.status});return response.json();
}
function errorText(error){return error.status===401?w('Войдите снова, затем повторите оформление.','Sign in again, then retry checkout.'):error.status===403?w('Для этого аккаунта действие недоступно.','This action is unavailable for this account.'):error.status===409?w('Условия изменились. Обновите статус подписки.','Conditions changed. Refresh your subscription status.'):w('Не удалось выполнить запрос. Попробуйте ещё раз.','Request failed. Please try again.');}
function paint(){
 const sub=account?.subscription,active=sub?.status==='active',canBuy=Boolean(user&&account?.plan.checkoutEnabled&&!busy);
 if(!account){$('#subscription-history').hidden=true;$('#subscription-orders').replaceChildren();}
 $('#subscribe').hidden=!user;$('#subscribe').disabled=!canBuy;$('#subscription-login').hidden=Boolean(user);
 $('#subscribe').textContent=active?w('Продлить на месяц — тест','Renew for a month — test'):w('Оформить тестовую подписку','Start a test subscription');
 $('#checkout-disabled').hidden=!account||account.plan.checkoutEnabled;
 $('#subscription-create').hidden=!account?.authorAccess;
 const host=$('#subscription-current');host.replaceChildren();
 if(!user){host.append(el('p',w('Войдите в аккаунт, чтобы оформить подписку и видеть её статус.','Sign in to start a subscription and see its status.')));return;}
 host.append(el('p',user.email));
 if(!account){host.append(el('p',w('Не удалось загрузить доступ. Обновите статус.','Could not load your access. Refresh the status.')));return;}
 if(sub){host.append(el('h3',({active:w('Подписка активна','Subscription active'),expired:w('Срок подписки закончился','Subscription expired'),revoked:w('Доступ по подписке отозван','Subscription access revoked')})[sub.status]),el('p',w('Период: ','Period: ')+date(sub.startedAt)+' — '+date(sub.expiresAt)));
  if(sub.status==='revoked'){const event=account.events.find(e=>e.action==='revoked');if(event)host.append(el('p',w('Причина: ','Reason: ')+event.reason));}
 }else host.append(el('h3',w('Подписка пока не оформлена','No subscription yet')));
 if(account.manualAuthor)host.append(el('p',w('У вас уже есть отдельно выданные права автора или администратора. Для текущего доступа подписка не требуется.','You already have separately granted author or administrator access. A subscription is not required for that access.')));
 host.append(el('p',w('Автопродление выключено. Новые периоды оформляются вручную.','Automatic renewal is off. Start each new period yourself.')));
 $('#subscription-history').hidden=!account.orders.length;const orders=$('#subscription-orders');orders.replaceChildren();
 for(const order of account.orders){const row=el('article','');row.className='subscription-order';row.append(el('p',date(order.createdAt)),el('p',w('Тестовое оформление · 0 ₽','Test checkout · ₽0')),el('p',w('Доступ до ','Access until ')+date(order.periodEnd)));orders.append(row);}
}
async function load(){
 if(busy)return;const seq=++sequence;$('#subscription').setAttribute('aria-busy','true');$('#subscription-status').textContent=w('Обновляем…','Refreshing…');
 try{const me=await api('/auth/me');if(seq!==sequence)return;if(user?.id!==me.id){account=null;requestId=null;}user=me;const value=await api('/auth/subscription');if(seq!==sequence)return;account=value;$('#subscription-status').textContent='';}
 catch(error){if(seq!==sequence)return;if([401,403].includes(error.status)){user=null;account=null;$('#subscription-history').hidden=true;$('#subscription-orders').replaceChildren();}$('#subscription-status').textContent=error.status===401?'':errorText(error);}
 finally{if(seq===sequence){paint();$('#subscription').setAttribute('aria-busy','false');}}
}
$('#subscription-login').onclick=()=>localStorage.setItem('fraerapp.subscriptionIntent',String(Date.now()+30*60*1000));
$('#subscribe').onclick=()=>{if(busy||!user)return;requestId=sessionStorage.getItem('fraerapp.checkout.'+user.id)||crypto.randomUUID();sessionStorage.setItem('fraerapp.checkout.'+user.id,requestId);$('#checkout-consent').checked=false;$('#checkout-status').textContent='';dialog.showModal();$('#checkout-cancel').focus();};
$('#checkout-cancel').onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
$('#checkout-form').onsubmit=async event=>{
 event.preventDefault();if(busy||!user||!$('#checkout-consent').checked)return;busy=true;sequence++;
 $('#checkout-confirm').disabled=true;$('#checkout-cancel').disabled=true;$('#checkout-status').textContent=w('Оформляем…','Processing…');paint();
 try{
  account=await api('/auth/subscription/mock-checkout',{method:'POST',body:{planId:account.plan.id,requestId,confirmTest:true}});sessionStorage.removeItem('fraerapp.checkout.'+user.id);requestId=null;
  dialog.close();$('#subscription-status').textContent=account.subscription?.status==='active'?w('Тестовая подписка оформлена. Доступ автора открыт, деньги не списывались.','Test subscription activated. Author access is open; no money was charged.'):w('Это оформление уже учтено. Ниже показан текущий статус подписки.','This checkout was already recorded. Your current subscription status is shown below.');
 }catch(error){$('#checkout-status').textContent=errorText(error);if([401,403].includes(error.status)){user=null;account=null;$('#subscription-history').hidden=true;$('#subscription-orders').replaceChildren();}}
 finally{busy=false;$('#checkout-confirm').disabled=false;$('#checkout-cancel').disabled=false;paint();if(!dialog.open)$('#subscription-create').focus();}
};
$('#subscription-refresh').onclick=load;window.addEventListener('focus',()=>{if(!dialog.open)load();});
localStorage.removeItem('fraerapp.subscriptionIntent');load();
