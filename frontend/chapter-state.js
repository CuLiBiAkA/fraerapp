// State of the current draft, distinct from the edition readers already see.
export function chapterState(chapter = {}) {
  if (chapter.restricted || ['hidden','deleted','purged','archived'].includes(chapter.visibility)) return 'unavailable';
  if (chapter.reviewState === 'in_review') return 'in_review';
  if (chapter.publishedRevision && !chapter.correctionRequested) return 'published';
  if (chapter.reviewState === 'approved' && chapter.submittedRevision === chapter.draftRevision) return 'approved';
  if (chapter.reviewState === 'rejected') return 'rejected';
  return 'draft';
}
export function chapterStateLabel(state, en = false) {
  const labels = {
    unavailable: ['Недоступна', 'Unavailable'], in_review: ['На модерации', 'Under review'],
    published: ['Опубликована', 'Published'], approved: ['✓ Модерация пройдена', '✓ Approved'],
    rejected: ['Нужны исправления', 'Changes requested'], draft: ['Черновик', 'Draft'],
  };
  return (labels[state] || labels.draft)[en ? 1 : 0];
}
