const view=new URLSearchParams(location.search);
if(view.has("story")||view.get("view")==="stories")await import("./story-workspace.js?v=1");
await import("./collection-workspace.js?v=2");
