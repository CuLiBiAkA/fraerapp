package com.fraergod.fraerapp.game;

import java.util.List;

record CollectionDocument(Integer schemaVersion, String key, String type, String title,
 String description, String coverUrl, String completionStatus, List<Item> items,
 List<Transition> transitions) {
 record Item(WorkMetadata.Target target, String label) {}
 record Transition(String id, WorkMetadata.Target from, WorkMetadata.Target to, WorkMetadata.Transfer stateTransfer) {}
}
