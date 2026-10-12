import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorActions,moderationActions} from './story-workflow.js';
import {chapterState} from './chapter-state.js';
const author={id:'owner',roles:['author']},reviewer={id:'reviewer',roles:['moderator']};
const published={storyId:'chapter',ownerUserId:'owner',publishedRevision:1,draftRevision:1,submittedRevision:1,reviewState:'approved',visibility:'public'};
test('published chapter has no author edit or submit action, including a legacy draft',()=>{
  for(const story of [published,{...published,draftRevision:2,hasDraft:true,reviewState:'rejected'}]){
    assert.equal(authorActions(story,author).includes('edit'),false);
    assert.equal(authorActions(story,author).includes('submit'),false);
    assert.equal(chapterState(story),'published');
  }
});
test('only an independent moderator can open a correction for a published chapter',()=>{
  assert.ok(moderationActions(published,reviewer).includes('request-correction'));
  assert.equal(moderationActions({...published,publishedRevision:null},reviewer).includes('request-correction'),false);
  assert.equal(moderationActions(published,{id:'owner',roles:['author','moderator','admin']}).includes('request-correction'),false);
  assert.equal(moderationActions({...published,correctionRequested:true},reviewer).includes('request-correction'),false);
});
test('correction is editable only before submission or after rejection',()=>{
  const correction={...published,correctionRequested:true,draftRevision:2,submittedRevision:null,reviewState:'rejected',hasDraft:true};
  assert.equal(chapterState(correction),'rejected');
  assert.ok(authorActions(correction,author).includes('edit'));
  assert.ok(authorActions(correction,author).includes('submit'));
  for(const reviewState of ['in_review','approved']){
    assert.equal(authorActions({...correction,reviewState,submittedRevision:2},author).includes('edit'),false);
  }
});
