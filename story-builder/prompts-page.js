import { openAuthoringPrompts } from './authoring-prompts.js?v=1';
let language = 'ru';
try { language = localStorage.getItem('fraerapp.language') === 'en' || localStorage.getItem('fraerapp.storyBuilderLanguage') === 'en' ? 'en' : 'ru'; } catch { /* A template can be used without browser storage. */ }
if (language === 'en') {
  document.documentElement.lang = 'en'; document.title = 'Story creation prompts · FraerApp';
  document.querySelector('#prompt-page-title').textContent = 'Story creation prompts';
  document.querySelector('#prompt-page-description').textContent = 'AI instructions for a chapter or a complete story package. Examples download separately without replacing your draft.';
  document.querySelector('#open-prompts').textContent = 'Prepare prompt'; document.querySelector('#prompt-page-back').textContent = 'My stories';
}
document.querySelector('#open-prompts').onclick = () => openAuthoringPrompts({ language });
