import {el,words} from './collection-ui.js?v=6';
import {coverImage} from './author-ui.js?v=3';

export function moderationCard(item,action){
  const card=el('article',null,'moderation-card'),copy=el('div',null,'moderation-card-copy');
  card.append(coverImage(item.coverUrl));
  copy.append(el('h2',item.title||item.key),el('p',words('Автор: ','Author: ')+(item.authorName||words('Автор','Author')),'moderation-author'));
  const chapters=[];let number=0;
  const visit=node=>{if(node.kind==='scenario'){number++;if(node.awaitingReview??node.pending)chapters.push({...node,number});}for(const child of node.children||[])visit(child);};visit(item);
  const meta=el('div',null,'moderation-meta'),badges=el('div',null,'moderation-badges');
  if(item.hasRepeatReview)badges.append(el('span',words('Повторная проверка','Repeat review'),'moderation-badge repeat'));
  if(chapters.some(c=>!c.publishedRevision&&!c.repeatReview))badges.append(el('span',words('Новая глава','New chapter'),'moderation-badge'));
  if(chapters.some(c=>c.publishedRevision&&!c.repeatReview))badges.append(el('span',words('Изменения','Changes'),'moderation-badge'));
  meta.append(badges);
  if(item.submittedAt){const date=new Date(item.submittedAt);if(!Number.isNaN(date.valueOf())){const time=el('time',date.toLocaleString(document.documentElement.lang,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}));time.dateTime=date.toISOString();meta.append(time);}}
  copy.append(meta);
  const list=el('ul',null,'moderation-chapters');
  for(const chapter of chapters){const row=el('li'),icon=el('img');icon.src='/assets/moderation-chapter.svg';icon.alt='';row.append(icon,el('span',words(`Глава ${chapter.number}`,`Chapter ${chapter.number}`)+' · '+(chapter.repeatReview?words('Исправления','Corrections'):chapter.publishedRevision?words('Изменения','Changes'):words('Новая глава','New chapter'))));list.append(row);}
  if(!chapters.length)list.append(el('li',words('Карточка истории','Story details')));
  action.className='moderation-open';action.dataset.workId=item.id||item.collectionId;
  const actions=el('div',null,'moderation-card-actions');actions.append(action);copy.append(list,actions);card.append(copy);return card;
}
