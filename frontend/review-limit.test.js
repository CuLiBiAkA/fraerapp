import test from "node:test";
import assert from "node:assert/strict";
import {reviewLimitMessage} from "./review-limit.js";
import {authorActions} from "./story-workflow.js";

test("daily quota explains the date and remains distinct from pending capacity",()=>{
  assert.match(reviewLimitMessage("ru",{reviewDailyLimitReached:true,reviewAvailableAt:"2026-10-12T12:00:00Z"}),/24 часа.*12\.10\.2026/);
  assert.match(reviewLimitMessage("en",{code:"REVIEW_DAILY_LIMIT_REACHED"}),/every 24 hours/);
  assert.match(reviewLimitMessage("en"),/already under review/);
});
test("only restorable author trash offers a restore action",()=>{
  const author={roles:["author"]};
  assert.deepEqual(authorActions({visibility:"deleted",canRestoreTrash:true},author),["restore"]);
  assert.deepEqual(authorActions({visibility:"deleted",canRestoreTrash:false},author),[]);
  assert.deepEqual(authorActions({visibility:"purged",canRestoreTrash:true},author),[]);
  assert.deepEqual(authorActions({visibility:"deleted",canRestoreTrash:true},{roles:["player"]}),[]);
});
