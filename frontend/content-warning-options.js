// Stored Russian labels are stable across interface languages and older exports.
export const warningGroups = [
 ['Страх','Fear', [['Пугающие сцены','Frightening scenes'],['Хоррор и сильное психологическое напряжение','Horror and intense psychological tension']]],
 ['Насилие','Violence', [['Драки и насилие без подробностей','Non-graphic fights and violence'],['Кровь и травмы','Blood and injuries'],['Подробные сцены убийств, пыток или жестокости','Graphic killing, torture or cruelty',18]]],
 ['Интимное содержание','Intimate content', [['Сексуальные намёки','Sexual references'],['Интимные сцены без подробностей','Non-graphic intimate scenes'],['Подробные интимные сцены','Explicit intimate scenes',18]]],
 ['Сексуальное насилие','Sexual violence', [['Упоминания сексуального насилия','References to sexual violence'],['Сцены сексуального насилия','Scenes of sexual violence',18]]],
 ['Речь','Language', [['Грубая лексика','Strong language'],['Нецензурная лексика','Profanity']]],
 ['Алкоголь и вещества','Alcohol and substances', [['Употребление алкоголя','Alcohol use'],['Курение','Smoking'],['Употребление наркотиков','Drug use']]],
 ['Тяжёлые темы','Difficult themes', [['Смерть и утрата','Death and loss'],['Домашнее насилие','Domestic abuse'],['Травля и унижение','Bullying and humiliation'],['Дискриминация','Discrimination']]],
 ['Психическое здоровье','Mental health', [['Упоминания самоубийства','References to suicide'],['Самоповреждение','Self-harm'],['Расстройства пищевого поведения','Eating disorders']]],
 ['Животные','Animals', [['Жестокое обращение с животными','Animal cruelty'],['Гибель животных','Animal death']]],
];
export const warningOptions=warningGroups.flatMap(group=>group[2]);
export function splitWarnings(value=''){
 const selected=new Set(),other=[];
 for(const line of (value||'').split('\n')){
  if(warningOptions.some(option=>option[0]===line))selected.add(line);
  else if(line)other.push(line);
 }
 return {selected,other:other.join('\n')};
}
export function needsAdultRating(doc){
 return doc.ageRating!=='18+'&&warningOptions.some(([label,,minimum])=>minimum===18&&(doc.contentWarnings||'').toLowerCase().includes(label.toLowerCase()));
}
