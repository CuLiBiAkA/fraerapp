package com.fraergod.fraerapp.game;

import java.util.List;

final class AgeClassification {
 private AgeClassification() {}
 static void validate(String rating,String warnings,List<String> errors) {
  if(rating!=null&&!rating.isEmpty()&&!List.of("0+","6+","12+","16+","18+").contains(rating))errors.add("Выберите возрастную категорию: 0+, 6+, 12+, 16+ или 18+.");
  if(warnings!=null&&warnings.length()>1000)errors.add("Предупреждения о содержании: не больше 1000 символов.");
 }
}
