// Chapter navigation is separate from editing the currently loaded document.
export function createStoryPicker({request,state,save}) {
  const host=document.querySelector('#builder-story-picker'),add=document.querySelector('#builder-add-chapter');
  const feedback=document.querySelector('#chapter-review-feedback');
  let works=[],selected=null,chapters=[],notices=[],lastId,loading=false,sequence=0,pendingChapter=null;
  const words=(ru,en)=>state().language==='en'?en:ru;
  const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
  const storyLabel=node('label'),storyText=node('span'),storySelect=node('select');storySelect.id='builder-story-select';storySelect.dataset.builderNavigation='';
  const hint=node('small'),chapterLabel=node('label'),chapterText=node('span'),chapterSelect=node('select');chapterSelect.id='builder-chapter-select';chapterSelect.dataset.builderNavigation='';
  const status=node('p');status.setAttribute('role','status');
  storyLabel.append(storyText,storySelect,hint);chapterLabel.append(chapterText,chapterSelect);host.append(storyLabel,chapterLabel,status);
  function options(select,rows,value,placeholder){select.replaceChildren(new Option(placeholder,''),...rows.map(([id,title])=>new Option(title,id)));select.value=value||'';}
  function render(){
    const s=state();storyText.textContent=words('История','Story');chapterText.textContent=words('Глава','Chapter');hint.textContent=words('Все ваши истории. Опубликованные главы — только для просмотра.','All your stories. Published chapters are view-only.');
    status.hidden=!status.textContent;
    options(storySelect,works.map(w=>[w.collectionId||w.id,w.title]),selected?.collectionId||selected?.storyId,words('Выберите историю','Choose a story'));
    options(chapterSelect,chapters.map((c,i)=>[c.storyId,`${i+1}. ${c.title||c.draftDocument?.title||c.key} · ${c.publishedRevision?words('Опубликована · Только просмотр','Published · View only'):c.reviewState==='in_review'?words('На модерации','Under review'):c.reviewState==='rejected'?words('Нужны исправления','Changes requested'):words('Черновик','Draft')}`]),s.id,words('Выберите главу','Choose a chapter'));
    storySelect.title=selected?.title||'';chapterSelect.title=chapterSelect.selectedOptions[0]?.textContent||'';
    storySelect.disabled=loading||!s.canEdit;chapterSelect.disabled=loading||!s.canEdit||!chapters.length;
    add.textContent=words('+ Добавить главу','+ Add chapter');add.disabled=loading||!s.canEdit||!selected?.collectionId||selected.draftDocument?.completionStatus==='completed';
    feedback.querySelector('summary').setAttribute('aria-label',words('Комментарии модератора','Moderator comments'));
    feedback.querySelector('summary').title=words('Комментарии модератора','Moderator comments');
    const unread=notices.some(n=>n.unread&&n.kind==='moderation'&&n.storyId===s.id);
    feedback.querySelector('.feedback-unread').hidden=!unread;
  }
  async function selectWork(id){
    const seq=++sequence;loading=true;render();
    try{
      const standalone=works.find(w=>w.id===id||w.collectionId===id)?.kind==='scenario';
      const work=id?await request(standalone?`/api/author/stories/${encodeURIComponent(id)}`:`/api/author/collections/${encodeURIComponent(id)}`):null;
      const parts=standalone?[work]:work?await Promise.all((work.draftDocument?.items||[]).filter(i=>i.target.kind==='scenario').map(i=>request(`/api/author/stories/${encodeURIComponent(i.target.id)}`))):[];
      if(seq!==sequence)return;
      selected=work;chapters=parts;pendingChapter=null;status.textContent='';
    }catch(e){if(seq===sequence)status.textContent=e.message;}finally{if(seq===sequence){loading=false;render();}}
  }
  function dialog(title,text,choices,inputValue){return new Promise(resolve=>{
    const d=node('dialog');d.className='story-picker-dialog';const h=node('h2',title);h.id='story-picker-dialog-title';d.setAttribute('aria-labelledby',h.id);d.append(h,node('p',text));
    let input;if(inputValue!==undefined){const label=node('label',words('Название главы','Chapter title'));input=node('input');input.value=inputValue;input.required=true;label.append(input);d.append(label);}
    const error=node('p');error.setAttribute('role','alert');d.append(error);const actions=node('div');actions.className='actions';
    for(const [key,label] of choices){const b=node('button',label);b.type='button';b.onclick=()=>{if(key!=='cancel'&&input&&!input.value.trim()){error.textContent=words('Укажите название главы.','Enter a chapter title.');return;}d.returnValue=key;d.close();};actions.append(b);}
    d.append(actions);document.body.append(d);d.addEventListener('close',()=>{resolve({action:d.returnValue||'cancel',title:input?.value.trim()});d.remove();},{once:true});d.showModal();
  });}
  async function leave(){
    if(state().readOnly||!state().unsaved)return true;
    const result=await dialog(words('Есть несохранённые изменения','Unsaved changes'),words('Сохранить текущую главу перед переходом?','Save the current chapter before leaving?'),[['save',words('Сохранить и перейти','Save and continue')],['discard',words('Перейти без сохранения','Discard and continue')],['cancel',words('Остаться','Stay')]]);
    if(result.action==='save')await save();return ['save','discard'].includes(result.action);
  }
  function navigate(id,published=false){const url=new URL('/builder/',location.origin);url.searchParams.set('story',id);if(selected?.collectionId)url.searchParams.set('work',selected.collectionId);if(published)url.searchParams.set('view','published');try{sessionStorage.setItem('fraerapp.builderNavigation',id);}catch{}location.assign(url);}
  storySelect.onchange=()=>selectWork(storySelect.value);
  chapterSelect.onchange=async()=>{
    const chapter=chapters.find(c=>c.storyId===chapterSelect.value);if(!chapter)return;
    try{
      if(chapter.publishedRevision){const choice=await dialog(words('Глава уже опубликована','This chapter is published'),words('Можно посмотреть сцены, переходы и эффекты. Изменение и сохранение недоступны.','Inspect scenes, transitions and effects. Editing and saving are unavailable.'),[['cancel',words('Отмена','Cancel')],['open',words('Открыть для просмотра','Open for viewing')]]);if(choice.action!=='open'){render();return;}}
      if(await leave())navigate(chapter.storyId,Boolean(chapter.publishedRevision));else render();
    }catch(e){status.textContent=e.message;render();}
  };
  add.onclick=async()=>{
    if(loading||!selected)return;
    try{
      if(!await leave())return;
      const result=await dialog(words('Добавить главу','Add chapter'),words('Глава будет добавлена в выбранную историю.','The chapter will belong to the selected story.'),[['cancel',words('Отмена','Cancel')],['create',words('Добавить главу','Add chapter')]],words(`Глава ${chapters.length+1}`,`Chapter ${chapters.length+1}`));
      if(result.action!=='create')return;
      loading=true;render();
      const work=await request(`/api/author/collections/${encodeURIComponent(selected.collectionId)}`);
      if(work.draftDocument.completionStatus==='completed')throw new Error(words('История уже завершена. Обновите список.','This story is completed. Refresh the list.'));
      if(!pendingChapter){
        const variables={};for(const item of work.draftDocument.items||[]){if(item.target.kind!=='scenario')continue;const prev=await request(`/api/author/stories/${encodeURIComponent(item.target.id)}`);Object.assign(variables,prev.draftDocument?.variables||{});}
        const key=`chapter_${crypto.randomUUID().replaceAll('-','')}`;
        const created=await request('/api/author/stories/import',{method:'POST',body:JSON.stringify({key,title:result.title,description:'',completionStatus:'completed',version:1,startSceneId:'start',variables,assets:[],scenes:[{id:'start',title:result.title,text:words('Глава начинается.','The chapter begins.'),choices:[],ending:{type:'ending',title:result.title}}]})});
        pendingChapter={id:created.storyId,key};
      }
      const document=structuredClone(work.draftDocument);
      if(!document.items.some(i=>i.target.id===pendingChapter.id))document.items.push({target:{kind:'scenario',id:pendingChapter.id,key:pendingChapter.key},label:''});
      await request(`/api/author/collections/${encodeURIComponent(work.collectionId)}`,{method:'PUT',body:JSON.stringify({generation:work.generation,document})});
      navigate(pendingChapter.id);
    }catch(e){status.textContent=e.message+(pendingChapter?words(' Глава сохранена отдельно. Повторите добавление, чтобы связать её с историей.',' The chapter is saved separately. Retry to attach it to the story.'):'');}finally{loading=false;render();}
  };
  feedback.addEventListener('toggle',async()=>{
    if(!feedback.open)return;
    const id=state().id;
    try{for(const n of notices.filter(n=>n.unread&&n.kind==='moderation'&&n.storyId===id)){await request(`/api/account/notifications/${encodeURIComponent(n.id)}/read`,{method:'POST'});n.unread=false;}render();}catch(e){status.textContent=e.message;}
  });
  return {
    update(){const s=state(),key=`${s.id||''}:${s.parent?.collectionId||''}`;if(lastId!==key){lastId=key;selectWork(s.parent?.collectionId||(works.some(w=>w.kind==='scenario'&&w.id===s.id)?s.id:''));}render();},
    async refresh(){
      if(!state().canEdit)return;
      const all=[];for(let page=0;;page++){const result=await request(`/api/author/folders?page=${page}&size=100`);const rows=result.items||[];all.push(...rows);if(rows.length<100||all.length>=result.total)break;}
      works=all.filter(w=>!['deleted','purged','archived'].includes(w.visibility));
      if(!selected&&state().id&&works.some(w=>w.kind==='scenario'&&w.id===state().id))await selectWork(state().id);
      notices=(await request('/api/account')).notifications||[];render();
    }
  };
}
