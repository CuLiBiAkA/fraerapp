import {el,button,field,checkbox,words,request,errorMessage,typeName} from "./collection-ui.js?v=2";
import {renderStoryDocument,renderDocumentDiff} from "./story-workflow.js?v=1";

// One visible application; individual immutable decisions remain server-owned.
export function renderFolderReview(host,{group,roles,onDecision,onDetails}){
  const items=group.items||[],read=new Set(),status=el("p","","collection-status");status.setAttribute("role","status");
  host.append(el("p",words("Раскройте изменённые части и проверьте их. Одно решение применяется только к перечисленным частям заявки; ранее опубликованные тексты повторно не проверяются.","Open and review the changed parts. One decision applies only to the parts listed in this application; previously published texts are not reviewed again.")));
  for(const problem of group.conflicts||[]){
    const raw=typeof problem==="string"?problem:problem.message||"";
    const text=raw.includes("missing or foreign")?words("В папке есть недоступная или чужая работа. Автору нужно убрать её и отправить папку заново.","The folder contains an unavailable or foreign work. The author needs to remove it and resubmit the folder."):words("Автор изменил или отозвал часть заявки. Попросите его повторно отправить папку на проверку.","The author changed or withdrew part of this application. Ask them to resubmit the folder.");
    host.append(el("p",text,"collection-status error"));
  }
  const parts=el("div",null,"folder-review-parts");host.append(parts);
  const refresh=()=>{approve.disabled=busy||!group.canDecide||items.length===0||read.size!==items.length||items.some(i=>i.approvalEligibility&&!(i.approvalEligibility.canApprove||(i.approvalEligibility.canOverride&&override.input.checked)));reject.disabled=busy||!group.canDecide||items.length===0;};
  for(const item of items){
    const panel=el("details",null,"folder-review-part"),summary=el("summary",`${item.kind==="collection"?"📁":"📄"} ${item.document?.title||item.id}`);
    panel.append(summary,el("p",item.publishedDocument?words("Изменено после публикации", "Changed since publication"):words("Новая часть", "New part")));
    if(item.draftRevision&&item.draftRevision!==item.revision)panel.append(el("p",words("У автора есть более новые изменения. Они ещё не входят в эту заявку.", "The author has newer changes. They are not part of this application yet.")));
    if(item.kind==="scenario"){
      const preview=renderStoryDocument(item.document,document.documentElement.lang);
      for(const technical of preview.querySelectorAll(".workspace-json"))technical.open=false;
      panel.append(preview);
    }
    else{
      panel.append(el("p",item.document?.description||""),el("p",typeName(item.document?.type)));
      const contents=el("ol");
      const names=new Map();const walk=n=>{names.set(`${n.kind}:${n.id}`,n.title);for(const c of n.children||[])walk(c);};walk(group.tree);
      for(const entry of item.document?.items||[]){const target=entry.target||{};contents.append(el("li",entry.label||names.get(`${target.kind}:${target.id}`)||target.key||words("Своя история", "Own story")));}panel.append(contents);
    }
    if(item.publishedDocument){const diff=el("details");diff.append(el("summary",words("Что изменилось", "What changed")),renderDocumentDiff(item.publishedDocument,item.document,document.documentElement.lang));panel.append(diff);}
    const confirmed=checkbox(words("Эту часть проверил(а)", "I have reviewed this part"),false);confirmed.input.onchange=()=>{const key=`${item.kind}:${item.id}`;if(confirmed.input.checked)read.add(key);else read.delete(key);refresh();};panel.append(confirmed.label);parts.append(panel);
  }
  if(!items.length)host.append(el("p",words("В этой папке нет новых частей на проверке.","This folder has no new parts awaiting review.")));
  const reason=field(words("Замечания автору", "Feedback to the author"),"","textarea");host.append(reason.label);
  const self=items.some(i=>i.self),override=checkbox(words("Администратор: разрешить проверку своих работ с указанной причиной", "Administrator: allow reviewing my own work with a reason"),false);
  if(self){host.append(el("p",words("В заявке есть ваши работы. Их должен проверить другой модератор.","This application contains your work. Another moderator should review it.")));if(roles.includes("admin"))host.append(override.label);}
  override.input.onchange=refresh;
  let busy=false;
  async function decide(action){
    if(busy)return;
    if((action==="reject"||self)&&!reason.input.value.trim()){status.textContent=words("Напишите причину решения.","Enter a reason for this decision.");return;}
    if(!confirm(action==="reject"?words("Вернуть перечисленные части автору на доработку?","Return the listed parts to the author for changes?"):words("Опубликовать все перечисленные и проверенные части заявки?","Publish all listed and reviewed parts of this application?")))return;
    busy=true;host.inert=true;refresh();status.textContent=words("Сохраняем решение…","Saving the decision…");
    try{await request(`/api/moderation/folders/${encodeURIComponent(group.tree.id)}/decision`,{method:"POST",body:{rootGeneration:group.rootGeneration,items:items.map(({kind,id,generation,revision})=>({kind,id,generation,revision})),action,reason:reason.input.value.trim()||words("Заявка папки проверена", "Folder application reviewed"),ownOverride:override.input.checked}});await onDecision();}
    catch(error){status.textContent=errorMessage(error);}
    finally{busy=false;host.inert=false;refresh();}
  }
  const approve=button(words("Одобрить и опубликовать заявку", "Approve and publish application"),()=>decide("approve-publish"),"add-button");
  const reject=button(words("Вернуть на доработку", "Request changes"),()=>decide("reject"));
  const actions=el("div",null,"collection-actions");actions.append(approve,reject);host.append(actions,status);
  host.append(button(words("История и отдельные решения", "History and individual decisions"),onDetails));refresh();
}
