import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
function functions(names,values={}) {
  const context=vm.createContext(values);
  for(const name of names){const match=source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));assert.ok(match,name);vm.runInContext(match[0],context);}
  return context;
}
const renameFunctions=['renameVariable','rememberVariableName','renameVariableReferencesInScene','renameVariableReferences'];

test('renaming a global variable updates exact text placeholders and live controls without crossing local scope',()=>{
 const score={name:'score'},local={name:'score'};
 const globalScene={text:'{{score}} / {{ score }} / {{score_bonus}} / score',variables:[],effects:[{variable:'score'}],choices:[{conditions:[{variable:'score'}],effects:[{variable:'score'}]}]};
 const localScene={text:'{{score}}',variables:[local],effects:[{variable:'score'}],choices:[]};
 const controls=new WeakMap(),control={isConnected:true,value:globalScene.text};controls.set(globalScene,control);
 const c=functions(renameFunctions,{draft:{variables:[score],scenes:[globalScene,localScene]},sceneTextControls:controls});
 c.renameVariable(score,'trust');
 assert.equal(globalScene.text,'{{trust}} / {{ trust }} / {{score_bonus}} / score');assert.equal(control.value,globalScene.text);
 assert.equal(globalScene.effects[0].variable,'trust');assert.equal(globalScene.choices[0].conditions[0].variable,'trust');
 assert.equal(localScene.text,'{{score}}');assert.equal(localScene.effects[0].variable,'score');
 c.renameVariable(local,'patience',localScene);assert.equal(localScene.text,'{{patience}}');assert.equal(globalScene.effects[0].variable,'trust');
});

test('placeholder replacement treats authored variable names as literal text',()=>{
 const variable={name:'a.b'},scene={text:'{{ a.b }} {{aXb}}',variables:[],effects:[],choices:[]};
 const c=functions(renameFunctions,{draft:{variables:[variable],scenes:[scene]},sceneTextControls:new WeakMap()});
 c.renameVariable(variable,'$new');assert.equal(scene.text,'{{ $new }} {{aXb}}');
});

test('draft persistence failure preserves editable data, exposes recovery and clears after a successful retry',()=>{
 const saved=new Map(),warning={hidden:true,textContent:''},draft={title:'Still here',scenes:[]};let blocked=true,rendered=0;
 const c=functions(['saveDraft','writeLocalStorage'],{
  draft,draftStorageFailed:false,storageKey:'draft',t:key=>key,
  document:{querySelector:()=>warning},renderAuthorWorkspace:()=>rendered++,
  localStorage:{setItem:(key,value)=>{if(blocked)throw new Error('QuotaExceededError');saved.set(key,value);}},
 });
 assert.equal(c.saveDraft(),false);assert.equal(warning.hidden,false);assert.equal(warning.textContent,'localDraftSaveFailed');assert.equal(c.draft,draft);assert.equal(saved.size,0);assert.equal(rendered,1);
 blocked=false;draft.title='Latest edit';assert.equal(c.saveDraft(),true);assert.equal(warning.hidden,true);assert.equal(warning.textContent,'');assert.equal(JSON.parse(saved.get('draft')).title,'Latest edit');
});

test('unavailable browser storage does not interrupt Builder preference and session operations',()=>{
 const fail=()=>{throw new Error('SecurityError');};
 const c=functions(['readLocalStorage','writeLocalStorage','removeLocalStorage'],{localStorage:{getItem:fail,setItem:fail,removeItem:fail}});
 assert.equal(c.readLocalStorage('language'),null);assert.equal(c.writeLocalStorage('language','ru'),false);assert.equal(c.removeLocalStorage('author'),false);
});
