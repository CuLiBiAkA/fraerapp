const catStats = {
  trust: ['Доверие', 'Trust'],
  cat_mood: ['Настроение кота', 'Cat mood'],
  noise: ['Шум', 'Noise'],
  scratches: ['Царапины', 'Scratches'],
  treats: ['Лакомства', 'Treats'],
  distance: ['Дистанция', 'Distance'],
};

export function decorateReadingStat(card, key, storyKey, language) {
  const known = storyKey === 'kak_pogladit_kota_ne_ubiv' ? catStats[key] : null;
  if (known) card.querySelector('.variable-header strong').textContent = known[language === 'en' ? 1 : 0];
}

export function readingBackground(story, scene) {
  const placeholders = ['/assets/hall.svg', '/assets/platform.svg', '/assets/signal.svg', '/assets/ticket.svg', '/assets/door.svg', '/assets/departure.svg'];
  if (story.key === 'kak_pogladit_kota_ne_ubiv' && (!scene.backgroundUrl || placeholders.includes(scene.backgroundUrl))) return '/assets/stories/cat-sofa-background-v2.png';
  return scene.backgroundUrl || '/assets/platform.svg';
}
