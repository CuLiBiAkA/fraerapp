// A private replay uses the same scene renderer without creating a reader save.
export function createDraftPlaytest({ request, panel, language, onLoading, onState, onError, onBusy }) {
  const moderationPreview=new URLSearchParams(globalThis.location?.search||'').get('moderationPreview')==='1';
  let draft = null, generation = 0, busy = false, failure = null;
  const banner = document.createElement('section');
  banner.className = 'draft-playtest-banner';
  banner.hidden = true;
  const title = document.createElement('strong');
  const chapter = document.createElement('p');
  chapter.id = 'draft-playtest-chapter';
  chapter.setAttribute('aria-live', 'polite');
  const note = document.createElement('p');
  const actions = document.createElement('div');
  const back = document.createElement('a');
  back.href = '/my-stories/';
  back.addEventListener('click',event=>{if(moderationPreview&&window.parent!==window){event.preventDefault();window.parent.postMessage({type:'fraer-review-close'},location.origin);}});
  const restart = document.createElement('button');
  restart.type = 'button';
  restart.id = 'draft-playtest-restart';
  const next = document.createElement('button');
  next.type = 'button';
  next.id = 'draft-playtest-next';
  next.hidden = true;
  actions.append(back, restart, next);
  banner.append(title, chapter, note, actions);
  panel.prepend(banner);

  function sync() {
    const en = language() === 'en';
    title.textContent = en ? 'Draft preview' : 'Предпросмотр черновика';
    note.textContent = en ? 'Test the story before publishing. This playthrough is not saved.'
      : 'Проверьте историю перед публикацией. Это прохождение не сохраняется.';
    back.textContent = en ? 'My stories' : 'Мои истории';
    back.href = draft?.kind === 'collection' ? `/my-stories/?collection=${encodeURIComponent(draft.id)}` : '/my-stories/';
    if(moderationPreview){title.textContent=en?'Submitted chapter':'Глава на проверке';note.textContent=en?'Private review. Reader progress is not saved.':'Режим проверки. Читательский прогресс не сохраняется.';back.textContent=en?'Back to application':'К заявке';back.href='/moderation/';}
    restart.textContent = en ? 'Start again' : 'Начать сначала';
    restart.disabled = busy;
    const manifest = draft?.manifest;
    chapter.hidden = !manifest;
    if (manifest) chapter.textContent = `${manifest.title} · ${en ? 'Chapter' : 'Глава'} ${draft.chapterIndex + 1} ${en ? 'of' : 'из'} ${manifest.chapters.length}: ${manifest.chapters[draft.chapterIndex].title}`;
    next.textContent = en ? 'Next chapter' : 'Следующая глава';
    next.hidden = !hasNextChapter();
    next.disabled = busy;
    if (failure) onError(errorMessage(failure));
  }

  function errorMessage(error) {
    const en = language() === 'en';
    if(moderationPreview&&[401,403,404,409].includes(error.status))return en?'The submitted chapter is unavailable. Close this window and reload the application.':'Глава из заявки недоступна. Закройте это окно и обновите заявку.';
    if (error.code === 'NO_CHAPTERS') return en
      ? 'Add a chapter to this story before starting its preview.' : 'Добавьте главу в историю, чтобы открыть предпросмотр.';
    if (error.code === 'UNSUPPORTED_PREVIEW') return en
      ? 'This preview supports stories with chapters in a single sequence. Open My stories to check the structure.'
      : 'Предпросмотр доступен для истории с последовательными главами. Проверьте её структуру в «Моих историях».';
    if (error.status === 401 || error.status === 403 || error.status === 404) return en
      ? 'This draft is unavailable. Open My stories and sign in with the author account.'
      : 'Черновик недоступен. Откройте «Мои истории» и войдите в аккаунт автора.';
    if (error.status === 409) return en
      ? 'The draft changed. Open its latest preview from My stories.'
      : 'Черновик изменился. Откройте его новый предпросмотр из «Моих историй».';
    return en ? 'Could not load the preview. Please try again.' : 'Не удалось загрузить предпросмотр. Попробуйте ещё раз.';
  }

  function hasNextChapter() {
    return draft?.kind === 'collection' && draft.finished && draft.manifest && draft.chapterIndex + 1 < draft.manifest.chapters.length;
  }

  function chapterStep(index) {
    const item = draft.manifest.chapters[index];
    return { id: item.id, revision: item.revision, choices: [] };
  }

  async function replay(history) {
    if (!draft || busy) return;
    const current = generation;
    busy = true;
    failure = null;
    onBusy(true);
    sync();
    try {
      if (!draft.id) throw Object.assign(new Error('Invalid preview link'), { status: 404 });
      if (draft.kind === 'collection' && !draft.manifest) {
        const manifest = await request(`/api/author/collections/${encodeURIComponent(draft.id)}/playtest?revision=${encodeURIComponent(draft.revision)}`);
        if (current !== generation) return;
        if (!manifest.chapters?.length) throw Object.assign(new Error('No chapters'), { code: 'NO_CHAPTERS' });
        draft.manifest = Object.freeze({ ...manifest, chapters: Object.freeze(manifest.chapters.map(item => Object.freeze({ ...item }))) });
        draft.revision = manifest.revision;
      }
      if (!Number.isSafeInteger(draft.revision) || draft.revision < 1) {
        throw Object.assign(new Error('Invalid preview link'), { status: 404 });
      }
      const collection = draft.kind === 'collection';
      const path = `/api/author/${collection ? 'collections' : 'stories'}/${encodeURIComponent(draft.id)}/playtest`;
      const proposed = history ?? (collection ? [chapterStep(0)] : []);
      const body = collection ? { revision: draft.revision, steps: proposed } : { revision: draft.revision, choices: proposed };
      const result = await request(path, { method: 'POST', body });
      if (current !== generation) return;
      const state = collection ? result.session : result;
      if (collection) {
        draft.steps = proposed;
        draft.chapterIndex = result.chapterIndex;
      } else draft.choices = proposed;
      draft.finished = state.status === 'finished';
      onState(state);
    } catch (error) {
      if (current === generation) { failure = error; onError(errorMessage(error)); }
    } finally {
      if (current === generation) { busy = false; onBusy(false); sync(); }
    }
  }

  restart.addEventListener('click', () => replay());
  next.addEventListener('click', () => { if (hasNextChapter()) replay([...draft.steps, chapterStep(draft.chapterIndex + 1)]); });

  async function open(id, revision, kind) {
    generation++;
    busy = false;
    failure = null;
    draft = { id, kind, revision: kind === 'collection' ? revision || 'draft' : Number(revision), choices: [], steps: [], chapterIndex: 0, finished: false };
    banner.hidden = false;
    sync();
    onLoading();
    await replay();
  }
  return {
    get active() { return draft !== null; },
    open(id, revision) { return open(id, revision, 'story'); },
    openCollection(id, revision) { return open(id, revision, 'collection'); },
    choose(id) {
      if (draft.kind !== 'collection') return replay([...draft.choices, id]);
      return replay(draft.steps.map((step, index) => index === draft.chapterIndex ? { ...step, choices: [...step.choices, id] } : step));
    },
    completionMessage() {
      return hasNextChapter() ? (language() === 'en' ? 'Chapter completed.' : 'Глава завершена.')
        : (language() === 'en' ? 'Story completed.' : 'История пройдена.');
    },
    sync,
    close() {
      generation++;
      draft = null;
      busy = false;
      failure = null;
      banner.hidden = true;
    },
  };
}
