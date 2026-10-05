package com.fraergod.fraerapp.game;

import java.util.List;
import com.fasterxml.jackson.databind.JsonNode;

record WorkMetadata(Integer schemaVersion, List<Relation> relations, InputContract inputContract) {
 record Target(String kind, String id, String key) {}
 record Mapping(String from, String to, String type) {}
 record Transfer(String mode, Integer contractVersion, List<Mapping> mapping) {}
 record Relation(String id, String type, Target target, String label, Transfer stateTransfer) {}
 record InputContract(Integer version, Boolean allowIndependentStart, List<Field> fields) {}
 record Field(String name, String type, Boolean required, JsonNode defaultValue,
              Double min, Double max, List<JsonNode> allowedValues) {}
}
