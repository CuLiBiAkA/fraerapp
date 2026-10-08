package com.fraergod.fraerapp.game;

import java.util.List;

record CollectionDocument(Integer schemaVersion, String key, String type, String title,
 String description, String coverUrl, String completionStatus, List<Item> items,
 List<Transition> transitions, String genre) {
 CollectionDocument(Integer schemaVersion,String key,String type,String title,String description,String coverUrl,String completionStatus,List<Item> items,List<Transition> transitions){this(schemaVersion,key,type,title,description,coverUrl,completionStatus,items,transitions,null);}
 boolean serialStory(){return Integer.valueOf(2).equals(schemaVersion);}
 record Item(WorkMetadata.Target target, String label, String season) {
  Item(WorkMetadata.Target target,String label){this(target,label,null);}
 }
 record Transition(String id, WorkMetadata.Target from, WorkMetadata.Target to, WorkMetadata.Transfer stateTransfer) {}
}
