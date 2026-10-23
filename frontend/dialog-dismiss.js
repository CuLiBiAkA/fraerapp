// Dismiss only a genuine backdrop gesture, never padding or a drag from a field.
let backdropStart=null;
const dismissible='dialog.workspace-dialog,dialog.author-profile-dialog,dialog.review-dialog,dialog.image-preparation';
function backdropDialog(event){
 const dialog=event.target;
 if(!(dialog instanceof HTMLDialogElement)||!dialog.open||!dialog.matches(dismissible))return null;
 const rect=dialog.getBoundingClientRect();
 return event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom?dialog:null;
}
document.addEventListener('pointerdown',event=>{backdropStart=event.button===0?backdropDialog(event):null;},true);
document.addEventListener('pointercancel',()=>{backdropStart=null;},true);
document.addEventListener('click',event=>{
 const dialog=backdropDialog(event),started=backdropStart;backdropStart=null;
 if(!dialog||dialog!==started||dialog.closest('[inert],[aria-busy="true"]')||dialog.querySelector('form[inert]'))return;
 // The existing Escape/cancel guards also protect uploads and active saves.
 if(dialog.dispatchEvent(new Event('cancel',{cancelable:true})))dialog.close();
},true);
