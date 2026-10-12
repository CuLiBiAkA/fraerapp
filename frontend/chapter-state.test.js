import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chapterState} from './chapter-state.js';
test('only the current approved draft can be published',()=>{
  assert.equal(chapterState({reviewState:'approved',submittedRevision:2,draftRevision:2}),'approved');
  assert.equal(chapterState({reviewState:'approved',submittedRevision:2,draftRevision:3}),'draft');
  assert.equal(chapterState({reviewState:'approved',submittedRevision:2,draftRevision:3,publishedRevision:2}),'published');
  assert.equal(chapterState({reviewState:'approved',submittedRevision:2,draftRevision:2,publishedRevision:2}),'published');
  assert.equal(chapterState({reviewState:'rejected',draftRevision:3}),'rejected');
  assert.equal(chapterState({reviewState:'in_review',publishedRevision:2,draftRevision:3}),'in_review');
  assert.equal(chapterState({reviewState:'approved',submittedRevision:2,draftRevision:2,restricted:true}),'unavailable');
});
