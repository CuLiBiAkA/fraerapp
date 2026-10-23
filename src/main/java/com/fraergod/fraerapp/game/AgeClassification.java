package com.fraergod.fraerapp.game;

import java.util.List;

final class AgeClassification {
 private AgeClassification() {}
 static void requireReviewRating(String rating,String warnings) {
  if("18+".equals(rating)||warnings==null)return;
  String text=warnings.toLowerCase(java.util.Locale.ROOT);
  if(List.of("подробные интимные сцены","подробные сцены убийств, пыток или жестокости","сцены сексуального насилия").stream().anyMatch(text::contains))
   throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST,"Выбранные предупреждения требуют категории 18+. Обновите возрастную категорию перед отправкой на модерацию.");
 }
 static void validate(String rating,String warnings,List<String> errors) {
  if(rating!=null&&!rating.isEmpty()&&!List.of("0+","6+","12+","16+","18+").contains(rating))errors.add("Выберите возрастную категорию: 0+, 6+, 12+, 16+ или 18+.");
  if(warnings!=null&&warnings.length()>1000)errors.add("Предупреждения о содержании: не больше 1000 символов.");
 }
}
