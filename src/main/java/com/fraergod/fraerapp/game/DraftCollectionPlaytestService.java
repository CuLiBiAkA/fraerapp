package com.fraergod.fraerapp.game;

import java.util.*;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import static com.fraergod.fraerapp.game.WorkLinksService.*;

/** Replays immutable private chapters with the published reading-order policy, without persistence. */
@Service
class DraftCollectionPlaytestService {
 private final CollectionService collections;
 private final StoryWorkflowService workflow;
 private final WorkLinksService links;
 private final StoryRepository stories;
 private final PlayerRepository players;
 private final ChapterReadingService reading;
 private final GameService game;
 DraftCollectionPlaytestService(CollectionService collections,StoryWorkflowService workflow,WorkLinksService links,StoryRepository stories,PlayerRepository players,ChapterReadingService reading,GameService game){
  this.collections=collections;this.workflow=workflow;this.links=links;this.stories=stories;this.players=players;this.reading=reading;this.game=game;
 }
 record Chapter(String id,int revision,String title) {}
 record Manifest(String collectionId,int revision,String title,List<Chapter> chapters) {}
 record Result(GameService.SessionState session,int chapterIndex) {}
 static class Unavailable extends org.springframework.web.server.ResponseStatusException {
  final String code;
  Unavailable(String code,String reason){super(org.springframework.http.HttpStatus.BAD_REQUEST,reason);this.code=code;}
 }
 private CollectionService.Row authorized(String id,AuthIdentity identity){
  boolean moderator=identity.hasRole("moderator")||identity.hasRole("admin");
  if(!moderator&&!identity.hasRole("author"))throw new ForbiddenRoleException();
  var row=collections.row(id);
  if(!moderator){
   String player=players.findByUserId(identity.userId()).map(Player::getId).orElseThrow(ForbiddenRoleException::new);
   collections.owner(row,player);
  }
  TrashRetentionService.requireRetained(row.visibility(),row.deletedAt());
  return row;
 }
 private int revision(CollectionService.Row row,String selected){
  if("draft".equals(selected))return row.draftRevision();
  try{int value=Integer.parseInt(selected);if(value>0)return value;}catch(NumberFormatException ignored){}
  throw bad("Choose a saved story revision or draft");
 }
 private CollectionDocument contents(CollectionService.Row row,int revision){
  CollectionDocument document;
  try{document=collections.document(row,revision);}catch(EmptyResultDataAccessException missing){throw new StoryNotFoundException();}
  if(!document.serialStory())throw new Unavailable("UNSUPPORTED_PREVIEW","Whole-story playtest requires a story with ordered chapters; open an individual chapter for legacy collections");
  if(list(document.items()).isEmpty())throw new Unavailable("NO_CHAPTERS","Add and save the first chapter before starting the story playtest");
  if(document.items().size()>500)throw bad("A story may contain at most 500 chapters");
  if(!list(document.transitions()).isEmpty())throw bad("Chapter progress is transferred automatically");
  var items=new ArrayList<CollectionDocument.Item>();var seen=new HashSet<String>();
  for(var item:document.items()){
   if(item==null||item.target()==null||!"scenario".equals(item.target().kind()))throw new Unavailable("UNSUPPORTED_PREVIEW","Whole-story playtest supports direct chapters only");
   String chapterId=item.target().id();
   if(chapterId==null)chapterId=stories.findByKey(Objects.toString(item.target().key(),"")).map(Story::getId).orElseThrow(StoryNotFoundException::new);
   retainedChapter(chapterId,row.owner());
   var target=links.resolve(item.target(),row.owner(),true);
   if(!seen.add(target.id()))throw bad("A chapter cannot occur twice in the story contents");
   items.add(new CollectionDocument.Item(target,item.label(),item.season(),item.seasonId(),item.seasonDescription()));
  }
  return new CollectionDocument(document.schemaVersion(),document.key(),document.type(),document.title(),document.description(),document.coverUrl(),document.completionStatus(),items,document.transitions(),document.genre(),document.topic(),document.ageRating(),document.contentWarnings());
 }
 private Story retainedChapter(String id,String owner){
  var story=stories.findById(id).orElseThrow(StoryNotFoundException::new);
  if(!Objects.equals(owner,story.getOwnerPlayerId()))throw new ForbiddenRoleException();
  TrashRetentionService.requireRetained(story.getVisibility(),story.getDeletedAt());
  return story;
 }
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 Manifest manifest(String id,String selected,AuthIdentity identity){
  var row=authorized(id,identity);int revision=revision(row,selected);var document=contents(row,revision);
  var chapters=new ArrayList<Chapter>();
  for(var item:document.items()){
   String chapterId=item.target().id();int chapterRevision=workflow.workspace(chapterId).draftRevision();
   var chapter=workflow.revision(chapterId,chapterRevision);
   chapters.add(new Chapter(chapterId,chapterRevision,chapter.title()));
  }
  return new Manifest(row.id(),revision,document.title(),List.copyOf(chapters));
 }
 @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
 Result playtest(String id,DraftCollectionPlaytestController.Playtest command,AuthIdentity identity){
  var row=authorized(id,identity);var document=contents(row,command.revision());
  if(command.steps().size()>document.items().size())throw bad("Playtest steps must follow the saved story contents");
  if(command.steps().stream().mapToInt(step->step.choices().size()).sum()>500)throw bad("A playtest may contain at most 500 choices across all chapters");
  GameService.SessionState state=null;StoryDocument previous=null;String previousId=null;
  for(int index=0;index<command.steps().size();index++){
   var step=command.steps().get(index);
   if(!Objects.equals(document.items().get(index).target().id(),step.id()))throw bad("Playtest steps must follow the saved story contents without skipping chapters");
   retainedChapter(step.id(),row.owner());
   var chapter=workflow.revision(step.id(),step.revision());
   var inputs=reading.transitionInputs(document,previousId,step.id(),previous,chapter,state==null||"finished".equals(state.status()),state==null?Map.of():state.variables());
   state=game.playtest(step.id(),chapter,step.choices(),inputs.values());previous=chapter;previousId=step.id();
  }
  return new Result(state,command.steps().size()-1);
 }
}
