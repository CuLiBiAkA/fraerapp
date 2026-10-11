const view=new URLSearchParams(location.search);
if(view.has("story")||view.get("view")==="stories")await import("./story-workspace.js?v=4");
await import("./collection-workspace.js?v=9");
