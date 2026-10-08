export const genres = [
  ['Романтика', 'Romance'], ['Фэнтези', 'Fantasy'], ['Мистика', 'Mystery'],
  ['Детектив', 'Detective'], ['Триллер', 'Thriller'], ['Ужасы', 'Horror'],
  ['Приключения', 'Adventure'], ['Научная фантастика', 'Science fiction'],
  ['Драма', 'Drama'], ['Комедия', 'Comedy'], ['Повседневность', 'Slice of life'],
  ['Историческая история', 'Historical fiction'], ['Постапокалипсис', 'Post-apocalypse'],
];
export const topics = [
  ['Школа', 'School'], ['Университет', 'University'], ['Работа и карьера', 'Work and career'],
  ['Дружба', 'Friendship'], ['Семья', 'Family'], ['Первая любовь', 'First love'],
  ['Взросление', 'Coming of age'], ['Соперничество', 'Rivalry'], ['Тайны прошлого', 'Secrets of the past'],
  ['Магия', 'Magic'], ['Сверхъестественное', 'Supernatural'], ['Путешествия', 'Travel'],
  ['Выживание', 'Survival'], ['Животные', 'Animals'], ['Космос', 'Space'],
];

export function fillClassification(select, items, value, language) {
  const option = (value, label) => new Option(label, value);
  select.replaceChildren(option('', language === 'en' ? 'Not selected' : 'Не выбран'));
  for (const [ru, en] of items) select.append(option(ru, language === 'en' ? en : ru));
  // Keep authored values from older files without replacing them on open.
  if (value && !items.some(([ru]) => ru === value)) select.append(option(value, value));
  select.value = value || '';
}
