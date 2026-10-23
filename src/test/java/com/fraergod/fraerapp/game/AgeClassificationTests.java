package com.fraergod.fraerapp.game;

import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import static org.junit.jupiter.api.Assertions.*;
import org.springframework.web.server.ResponseStatusException;

class AgeClassificationTests {
 @Test void draftsAllowConflictingWarningsButSubmissionRequiresAdultCategory() {
  for(String warning:java.util.List.of("Подробные интимные сцены","Подробные сцены убийств, пыток или жестокости","Сцены сексуального насилия")) {
   var errors=new ArrayList<String>();AgeClassification.validate("16+",warning,errors);assertTrue(errors.isEmpty());
   for(String age:java.util.List.of("","0+","6+","12+","16+"))assertThrows(ResponseStatusException.class,()->AgeClassification.requireReviewRating(age,warning));
   assertThrows(ResponseStatusException.class,()->AgeClassification.requireReviewRating(null,warning));
   assertDoesNotThrow(()->AgeClassification.requireReviewRating("18+",warning));
  }
 }
 @Test void ordinaryAndLegacyWarningsDoNotImplyAnAdultRating() {
  assertDoesNotThrow(()->AgeClassification.requireReviewRating(null,null));
  assertDoesNotThrow(()->AgeClassification.requireReviewRating("16+","Пугающие сцены\nУпоминания сексуального насилия\nМоё предупреждение"));
 }
}
