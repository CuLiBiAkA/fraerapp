const copy={ru:{label:'Реклама',title:'Небольшая пауза между сценами',body:'Это тестовый рекламный блок. Продолжайте историю в любой момент.',link:'Подробнее',next:'Продолжить историю',subscribe:'Читать без рекламы',hint:'Активная подписка отключает рекламные паузы.'},en:{label:'Advertisement',title:'A short break between scenes',body:'This is a demo advertisement. Continue your story whenever you like.',link:'Learn more',next:'Continue story',subscribe:'Read without ads',hint:'An active subscription removes advertising breaks.'}};
export function adCopy(language){return copy[language]||copy.ru;}
export function safeAdUrl(value){
 if(!value||/[\\\u0000-\u0020\u007f]/.test(value)||value.startsWith('//'))return '';
 try{const url=new URL(value,location.origin);return (value.startsWith('/')&&url.origin===location.origin||url.protocol==='https:')&&!url.username&&!url.password?url.href:'';}catch{return '';}
}
export function createReaderAds({request,language}){
 const style=document.createElement('link');style.rel='stylesheet';style.href='/reader-ads.css?v=1';document.head.append(style);
 const dialog=document.createElement('dialog');dialog.id='reader-ad-dialog';dialog.className='reader-ad';dialog.setAttribute('aria-labelledby','reader-ad-title');
 const node=(tag,id)=>{const element=document.createElement(tag);if(id)element.id=id;return element;};
 const label=node('p'),title=node('h2','reader-ad-title'),body=node('p','reader-ad-body'),link=node('a','reader-ad-link'),next=node('button','reader-ad-continue'),subscribe=node('a','reader-ad-subscribe'),hint=node('p');
 label.className='reader-ad-label';body.className='reader-ad-body';hint.className='reader-ad-hint';next.type='button';link.target='_blank';link.rel='noopener noreferrer sponsored';subscribe.href='/subscription/';
 dialog.append(label,title,body,link,next,subscribe,hint);document.body.append(dialog);next.onclick=()=>dialog.close();
 let generation=0,current='',context='',shown=null;const attempted=new Set();
 function paint(ad){const t=adCopy(language());label.textContent=t.label;title.textContent=ad.title||t.title;body.textContent=ad.body||t.body;const url=safeAdUrl(ad.linkUrl);link.hidden=!url;if(url)link.href=url;else link.removeAttribute('href');link.textContent=ad.buttonLabel||t.link;next.textContent=t.next;subscribe.textContent=t.subscribe;hint.textContent=t.hint;}
 function hide(){generation++;current='';context='';shown=null;if(dialog.open)dialog.close();}
 async function present(state){
  const id=state.readerAd?.id,key=state.sessionId+':'+state.scene?.id;
  if(context!==key){hide();context=key;}
  if(!id||state.status==='finished'||state.scene?.ending){hide();return;}
  if(current===id){if(shown)paint(shown);return;}
  if(attempted.has(id))return;current=id;attempted.add(id);const version=++generation;
  try{const result=await request('/api/reader-ads/claim',{method:'POST',body:{offerId:id}});if(version!==generation||!result.ad)return;shown=result.ad;paint(shown);dialog.showModal();next.focus();}
  catch{attempted.delete(id);/* Retry on a later scene, never block reading or loop on rerender. */}
 }
 return {present,hide};
}
