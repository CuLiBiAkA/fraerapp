const view=new URLSearchParams(location.search);
// Old bookmarks must open the same moderation queue as the main navigation.
if(document.body.dataset.workspace==='moderation'&&view.get('view')==='stories'&&!view.has('story')){
 view.delete('view');history.replaceState(history.state,'',location.pathname+(view.size?'?'+view:'')+location.hash);
}
if(view.has("story")||view.get("view")==="stories")await import("./story-workspace.js?v=10");
await import("./collection-workspace.js?v=32");
