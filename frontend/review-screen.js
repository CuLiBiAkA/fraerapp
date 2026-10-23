import {el,button,field,checkbox,words,request,errorMessage} from './collection-ui.js?v=6';
import {renderDocumentDiff,workflowLabel} from './story-workflow.js?v=3';
import {coverImage} from './author-ui.js?v=3';
import {classificationSummary} from './age-classification.js?v=6';

function modal(title,wide=false){
 const opener=document.activeElement,dialog=el('dialog',null,'review-dialog'+(wide?' review-reader-dialog':''));
 const heading=el('h2',title);heading.id='review-dialog-title';dialog.setAttribute('aria-labelledby',heading.id);
 const close=button('×',()=>dialog.close(),'review-dialog-close');close.setAttribute('aria-label',words('Закрыть','Close'));
 const body=el('div',null,'review-dialog-body');dialog.append(heading,close,body);document.body.append(dialog);
 dialog.addEventListener('close',()=>{dialog.remove();if(opener?.isConnected)opener.focus();},{once:true});dialog.showModal();return {dialog,body};
}
function confirmation(title){return new Promise(resolve=>{const {dialog,body}=modal(title);let accepted=false;body.append(button(words('Подтвердить','Confirm'),()=>{accepted=true;dialog.close();}),button(words('Отмена','Cancel'),()=>dialog.close()));dialog.addEventListener('close',()=>resolve(accepted),{once:true});});}

export function renderFolderReview(host,{group,roles,onDecision,onDirty=()=>{}}){
 host.replaceChildren();host.classList.add('application-review');
 const items=group.items||[],read=new Set(),details=new Map(),tree=group.tree,lang=document.documentElement.lang;
 const status=el('p','','collection-status');status.setAttribute('role','status');let busy=false;
 const nodes=[];const walk=node=>{nodes.push(node);for(const child of node.children||[])walk(child);};walk(tree);
 const chapterNumbers=new Map(nodes.filter(n=>n.kind==='scenario').map((n,i)=>[n.id,i+1]));
 const detail=item=>{const key=item.kind+':'+item.id;if(!details.has(key))details.set(key,request(`/api/moderation/${item.kind==='scenario'?'stories':'collections'}/${encodeURIComponent(item.id)}`).catch(error=>{details.delete(key);throw error;}));return details.get(key);};
 const events=data=>(data.events||[]).filter(e=>['reject','request-correction','approve','approve-publish','publish-approved'].includes(e.action));
 const date=value=>value?new Date(value).toLocaleString(lang):'';
 const title=el('h1',tree.title||words('Проверка заявки','Application review'),'application-title');title.tabIndex=-1;
 const intro=el('div',null,'application-heading'),meta=el('p',words('Автор: ','Author: ')+(tree.authorName||words('Автор','Author'))+(tree.submittedAt?' · '+date(tree.submittedAt):''),'application-author');
 const menu=el('div',null,'application-menu');intro.append(title,meta,menu);host.append(intro);
 const submittedRoot=items.find(i=>i.kind===tree.kind&&i.id===tree.id)?.document||tree.document||{};
 intro.append(classificationSummary(submittedRoot));
 function readChapter(item){
  const {body,dialog}=modal(item.document?.title||item.title,true),frame=el('iframe');frame.title=words('Чтение главы на проверке','Read submitted chapter');
  frame.src='/?'+new URLSearchParams({previewStory:item.id,revision:item.revision,moderationPreview:'1'});body.append(frame);
  const closeReader=event=>{if(event.origin===location.origin&&event.source===frame.contentWindow&&event.data?.type==='fraer-review-close')dialog.close();};window.addEventListener('message',closeReader);dialog.addEventListener('close',()=>window.removeEventListener('message',closeReader),{once:true});
 }
 function about(item={...tree,document:tree.document}){
  const doc=item.document||{}, {body}=modal(words('Об истории','About story'));
  const card=el('section',null,'review-story-preview');card.append(coverImage(doc.coverUrl||doc.metadata?.coverUrl||tree.coverUrl),el('h3',doc.title||tree.title),el('p',doc.description||''));
  card.append(classificationSummary(doc));
  for(const [label,value] of [[words('Жанр','Genre'),doc.genre],[words('Тема','Topic'),doc.topic],[words('Статус','Status'),doc.completionStatus]])if(value)card.append(el('p',`${label}: ${workflowLabel(value,lang)}`));
  const contents=el('ol');for(const node of nodes.filter(n=>n.kind==='scenario'))contents.append(el('li',node.title));card.append(contents);body.append(card);
 }
 menu.append(button(words('Об истории','About story'),()=>about()),button(words('История решений','Decision history'),async()=>{
  const {body}=modal(words('История решений','Decision history'));body.textContent=words('Загружаем…','Loading…');
  try{const history=[];for(const node of nodes){const data=await detail(node);for(const event of events(data))history.push({...event,title:node.title});}
   history.sort((a,b)=>new Date(b.createdAt||b.created_at)-new Date(a.createdAt||a.created_at));body.replaceChildren();
   for(const event of history){const entry=el('article',null,'review-history-entry');entry.append(el('h3',event.title),el('p',event.action==='reject'?words('Возвращено на доработку','Changes requested'):event.action==='request-correction'?words('Запрошено исправление','Correction requested'):words('Одобрено','Approved')),el('time',date(event.createdAt||event.created_at)));if(event.reason)entry.append(el('p',event.reason));body.append(entry);}
   if(!history.length)body.textContent=words('Решений пока нет.','No decisions yet.');
  }catch(error){body.textContent=errorMessage(error);}
 }));
 for(const problem of group.conflicts||[])host.append(el('p',words('Состав заявки изменился. Обновите страницу; автору может потребоваться повторная отправка.','The application changed. Reload; the author may need to resubmit.'),'review-warning'));
 const parts=el('section',null,'review-panel review-parts');parts.append(el('h3',words('Главы на проверке','Chapters for review')));host.append(parts);
 const refresh=()=>{approve.disabled=busy||!group.canDecide||!items.length||read.size!==items.length||items.some(i=>i.approvalEligibility&&!(i.approvalEligibility.canApprove||(i.approvalEligibility.canOverride&&override.input.checked)));reject.disabled=busy||!group.canDecide||!items.length;};
 for(const item of items){
  const panel=el('article',null,'review-part'),top=el('div',null,'review-part-heading'),badge=el('span',item.publishedDocument?words('Изменения','Changes'):words('Новая глава','New chapter'),'review-badge');
  const name=item.kind==='scenario'?`${chapterNumbers.get(item.id)||1}. ${item.document?.title||item.title}`:words('Карточка истории','Story details');
  if(item.kind==='collection')badge.textContent=words('Описание и оглавление','Details and contents');top.append(el('h4',name),badge);panel.append(top);
  const previous=el('div',null,'review-previous');previous.hidden=true;panel.append(previous);
  const loadPrevious=async()=>{try{const data=await detail(item),event=events(data)[0];previous.replaceChildren();if(event&&['reject','request-correction'].includes(event.action)){previous.hidden=false;badge.textContent=words('Повторно','Repeated');badge.classList.add('repeat');previous.append(el('strong',words('Прошлое замечание','Previous feedback')),el('p',event.reason||words('Требовались исправления.','Changes were requested.')));}}catch(error){previous.hidden=false;previous.replaceChildren(el('p',errorMessage(error)),button(words('Повторить загрузку замечаний','Retry feedback'),loadPrevious));}};loadPrevious();
  const actions=el('div',null,'review-part-actions');
  actions.append(button(item.kind==='scenario'?words('Прочитать главу','Read chapter'):words('Проверить карточку','Review story details'),()=>{
   if(item.kind!=='scenario'){about(item);return;}
   readChapter(item);
  }));
  actions.append(button(words('Изменения','Changes'),async()=>{const {body}=modal(words('Изменения','Changes'));body.textContent=words('Загружаем…','Loading…');try{
   let before=item.publishedDocument;const data=await detail(item),rejected=events(data).find(e=>['reject','request-correction'].includes(e.action)&&e.revision<=item.revision);
   if(rejected)before=(await request(`/api/moderation/${item.kind==='scenario'?'stories':'collections'}/${encodeURIComponent(item.id)}/preview?revision=${rejected.revision}`)).document;
   body.replaceChildren(before?renderDocumentDiff(before,item.document,lang):el('p',words('Это первая отправленная редакция. Предыдущей версии для сравнения нет.','This is the first submitted revision; there is no earlier version to compare.')));
   body.querySelectorAll('details').forEach(part=>part.open=true);
   body.querySelectorAll('.workspace-diff-values').forEach(row=>{const labels=row.querySelectorAll('strong');if(labels[0])labels[0].textContent=rejected?words('Предыдущая отправка','Previous submission'):words('Опубликованная редакция','Published revision');if(labels[1])labels[1].textContent=words('Текущая заявка','Current submission');});
   if(before&&!body.querySelector('details'))body.textContent=words('Различий с предыдущей редакцией нет.','No changes from the previous revision.');
  }catch(error){body.textContent=errorMessage(error);}}));
  const confirmed=checkbox(item.kind==='scenario'?words('Глава проверена','Chapter reviewed'):words('Карточка проверена','Story details reviewed'),false);confirmed.input.onchange=()=>{const key=item.kind+':'+item.id;if(confirmed.input.checked)read.add(key);else read.delete(key);onDirty();refresh();};actions.append(confirmed.label);panel.append(actions);parts.append(panel);
 }
 if(!items.length)parts.append(el('p',words('Нет частей, ожидающих решения.','No parts awaiting a decision.')));
 const published=nodes.filter(n=>n.kind==='scenario'&&n.publishedRevision&&!items.some(i=>i.kind==='scenario'&&i.id===n.id));
 if(published.length){const context=el('details',null,'review-panel');context.append(el('summary',words('Ранее опубликованные главы','Previously published chapters')));for(const node of published)context.append(button(node.title,()=>readChapter({...node,revision:node.publishedRevision})));host.append(context);}
 const feedback=el('section',null,'review-panel review-feedback');feedback.append(el('h3',words('Комментарий автору','Feedback to the author')));
 const reason=field(words('Замечания автору','Feedback to the author'),'','textarea');reason.input.placeholder=words('Что нужно исправить и где…','What needs changing and where…');reason.input.oninput=onDirty;reason.label.classList.add('review-reason');feedback.append(reason.label,el('p',words('При возврате на доработку комментарий обязателен','A comment is required when requesting changes'),'review-hint'));
 const self=items.some(i=>i.self),override=checkbox(words('Администратор: разрешить проверку своих работ с указанной причиной','Administrator: allow reviewing my own work with a reason'),false);
 if(self){feedback.append(el('p',words('В заявке есть ваши работы. Их должен проверить другой модератор.','This application contains your work. Another moderator should review it.')));if(roles.includes('admin'))feedback.append(override.label);}override.input.onchange=refresh;
 async function decide(action){
  if(busy)return;if((action==='reject'||self)&&!reason.input.value.trim()){status.textContent=words('Напишите причину решения.','Enter a reason for this decision.');reason.input.focus();return;}
  if(!await confirmation(action==='reject'?words('Вернуть заявку на доработку?','Request changes?'):words('Одобрить заявку? Автор сам выберет время публикации.','Approve? The author will choose when to publish.')))return;
  busy=true;host.inert=true;refresh();status.textContent=words('Сохраняем решение…','Saving decision…');
  try{const command={rootGeneration:group.rootGeneration,items:items.map(({kind,id,generation,revision})=>({kind,id,generation,revision})),action,reason:reason.input.value.trim()||words('Заявка истории проверена','Story application reviewed'),ownOverride:override.input.checked};if(group.standalone){command.generation=items[0].generation;command.revision=items[0].revision;}await request(group.standalone?`/api/moderation/stories/${encodeURIComponent(tree.id)}/${action}`:`/api/moderation/folders/${encodeURIComponent(tree.id)}/decision`,{method:'POST',body:command});await onDecision();}
  catch(error){status.textContent=errorMessage(error);}finally{busy=false;host.inert=false;refresh();}
 }
 const approve=button(words('Одобрить заявку','Approve application'),()=>decide('approve'),'review-approve'),reject=button(words('Вернуть на доработку','Request changes'),()=>decide('reject'),'review-reject');
 const actions=el('div',null,'review-decision-actions');actions.append(reject,approve);feedback.append(actions,el('p',words('Проверьте все части заявки, чтобы одобрить её','Review every part before approving'),'review-hint review-approval-hint'),status);host.append(feedback);refresh();
}
