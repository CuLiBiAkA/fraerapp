import test from "node:test";
import assert from "node:assert/strict";
import {
  allowsWorkspace, authorActions, authorFilters, canEditStories, canModerateStories, documentChanges,
  filterAfterSubmit, matchesAuthorFilter, moderationActions, needsOwnOverride,
  publicStoryUrl, revisionLabels, safePreviewMediaUrl, storyLabels, workspaceTarget,
} from "./story-workflow.js";

const user = roles => ({ id: "owner", roles });
const story = overrides => ({ storyId: "story-1", title: "Ночная история", key: "night", ownerUserId: "owner", visibility: "public", publishedRevision: 2, submittedRevision: 3, draftRevision: 4, reviewState: "in_review", hasDraft: true, restricted: false, ...overrides });

test("access recovery only redirects to allowlisted workspaces with current permissions", () => {
  assert.equal(workspaceTarget("/my-stories/"),"/my-stories/");
  assert.equal(workspaceTarget("moderation"),"/moderation/");
  for (const value of ["https://example.test", "//example.test", "/auth/admin", "/moderation/?next=other", null]) assert.equal(workspaceTarget(value),null);
  assert.equal(allowsWorkspace("/my-stories/",user(["player"])),true);
  assert.equal(allowsWorkspace("/moderation/",user(["player","author"])),false);
  assert.equal(allowsWorkspace("/moderation/",user(["moderator"])),true);
  assert.equal(allowsWorkspace("/moderation/",{...user(["admin"]),blocked:true}),false);
  assert.equal(allowsWorkspace("/my-stories/",null),false);
});

test("three simultaneous revisions keep their separate visible roles", () => {
  assert.deepEqual(storyLabels(story()), ["Опубликована v2", "На согласовании v3", "Черновик v4"]);
  assert.deepEqual(storyLabels(story(), "en"), ["Published v2", "In review v3", "Draft v4"]);
});

test("hidden publication is labeled as a previous publication, never live", () => {
  assert.deepEqual(storyLabels(story({visibility:"hidden"})), ["Последняя публикация v2", "На согласовании v3", "Черновик v4", "Скрыта модератором"]);
  assert.equal(publicStoryUrl(story({visibility:"hidden", publishedSlug:"night"})), null);
  assert.equal(publicStoryUrl(story({publishedSlug:"night"})), "/history/night");
});

test("a submitted or approved snapshot that shares the draft pointer is not called a working draft", () => {
  assert.deepEqual(revisionLabels(story({draftRevision:3,hasDraft:false}),3),["На согласовании"]);
  assert.deepEqual(revisionLabels(story({draftRevision:3,hasDraft:false,reviewState:"approved"}),3),["Одобрена"]);
  assert.deepEqual(revisionLabels(story({draftRevision:2,hasDraft:false,submittedRevision:2,reviewState:"approved"}),2),["Опубликована","Одобрена"]);
  assert.deepEqual(revisionLabels(story(),4),["Черновик"]);
});

test("overlapping filters keep one story entry and exclude trash except in trash", () => {
  const items = [story(), story({storyId:"trash", visibility:"deleted"})];
  for (const filter of ["all", "drafts", "review", "publications"]) assert.deepEqual(items.filter(item => matchesAuthorFilter(item,filter)).map(item=>item.storyId), ["story-1"]);
  assert.deepEqual(items.filter(item => matchesAuthorFilter(item,"trash")).map(item=>item.storyId), ["trash"]);
  assert.ok(authorFilters.includes("corrections"));
  assert.ok(matchesAuthorFilter(story(),"review"," НОЧНАЯ "));
  assert.equal(matchesAuthorFilter(story(),"review","missing"), false);
  assert.equal(filterAfterSubmit("drafts"),"review");
  assert.equal(filterAfterSubmit("all"),"all");
});

test("a revoked author retains readable story labels but loses every mutation", () => {
  assert.deepEqual(authorActions(story(), user(["player"])), []);
  assert.ok(storyLabels(story()).includes("На согласовании v3"));
  assert.equal(canEditStories(user(["moderator"])), false);
  assert.equal(canModerateStories(user(["author"])), false);
  assert.equal(canEditStories({...user(["admin"]),blocked:true}), false);
  assert.equal(canModerateStories({...user(["admin"]),blocked:true}), false);
});

test("author actions never include publishing or lifting restrictions", () => {
  assert.deepEqual(authorActions(story(),user(["author"])), ["edit","submit","withdraw","archive"]);
  assert.deepEqual(authorActions(story({visibility:"hidden", restricted:true}),user(["author"])), ["edit","submit","withdraw"]);
  assert.deepEqual(authorActions(story({visibility:"deleted"}),user(["admin"])), []);
  assert.ok(authorActions(story({visibility:"private", publishedRevision:null}),user(["author"])).includes("delete"));
});

test("moderator cannot approve or restore their own story; admin needs explicit override", () => {
  const own = story();
  const combined = user(["author","moderator"]);
  assert.deepEqual(moderationActions(own,combined), ["reject","hide","archive","delete"]);
  assert.deepEqual(moderationActions(story({visibility:"deleted"}),combined), []);
  const admin = user(["admin"]);
  assert.ok(moderationActions(own,admin).includes("approve-publish"));
  for (const action of ["approve", "approve-publish", "publish-approved", "visibility", "restore"]) assert.equal(needsOwnOverride(action,own,admin),true);
  assert.equal(needsOwnOverride("reject",own,admin),false);
  assert.equal(needsOwnOverride("approve",story({ownerUserId:"other"}),admin),false);
});

test("hidden, archived, and deleted stories cannot be directly republished", () => {
  const moderator = {id:"reviewer",roles:["moderator"]};
  for (const visibility of ["hidden","archived","deleted"]) {
    const actions = moderationActions(story({visibility,reviewState:"approved",restricted:true}),moderator);
    assert.equal(actions.includes("publish-approved"),false);
    assert.equal(actions.includes("visibility"),false);
    assert.ok(actions.includes("restore"));
  }
  assert.deepEqual(moderationActions(story({visibility:"deleted"}),moderator),["restore"]);
});

test("publishing approved revision is distinct from approval and requires an unpublished change", () => {
  const moderator = {id:"reviewer",roles:["moderator"]};
  assert.ok(moderationActions(story({reviewState:"approved"}),moderator).includes("publish-approved"));
  assert.equal(moderationActions(story({reviewState:"approved",submittedRevision:2}),moderator).includes("publish-approved"), false);
  assert.equal(moderationActions(story({reviewState:"rejected"}),moderator).includes("approve"), false);
});

test("revision diff includes nested choice conditions, media, removals and escaped paths", () => {
  const before = {title:"Before",scenes:[{id:"start",choices:[{text:"Go",conditions:{"x/y":1}}]}],assets:[{url:"/uploads/s/a.png"}],obsolete:true};
  const after = structuredClone(before); after.title="After"; after.scenes[0].choices[0].conditions["x/y"]=2; after.assets[0].url="/uploads/s/b.png"; delete after.obsolete; after.added=0;
  const changes = documentChanges(before,after);
  assert.deepEqual(changes.map(change=>change.path),["/title","/scenes/0/choices/0/conditions/x~1y","/assets/0/url","/obsolete","/added"]);
  assert.equal(changes[3].kind,"removed"); assert.equal(changes[4].kind,"added");
  assert.deepEqual(documentChanges(before,structuredClone(before)),[]);
  assert.equal(before.title,"Before");
});

test("private preview never embeds arbitrary external or script media", () => {
  assert.equal(safePreviewMediaUrl("/uploads/story/revision.png"),"/uploads/story/revision.png");
  for (const value of ["https://example.test/pixel.png","//example.test/pixel.png","javascript:alert(1)","data:image/svg+xml,test","/uploads/../secret",null]) assert.equal(safePreviewMediaUrl(value),null);
});
