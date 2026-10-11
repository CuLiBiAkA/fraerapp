export function reviewLimitMessage(language = "ru", status = {}) {
  if (status.reviewDailyLimitReached || status.code === "REVIEW_DAILY_LIMIT_REACHED") {
    const next = status.reviewAvailableAt && new Date(status.reviewAvailableAt);
    const at = next && !Number.isNaN(next.getTime()) ? next.toLocaleString(language === "en" ? "en-GB" : "ru-RU") : "";
    return language === "en"
      ? `You can submit one new story every 24 hours.${at ? ` Next submission: ${at}.` : ""} You can keep editing drafts and updating the same story.`
      : `На модерацию можно отправлять одну новую историю за 24 часа.${at ? ` Следующая отправка: ${at}.` : ""} Черновики и уже отправленную историю можно продолжать редактировать.`;
  }
  return language === "en"
    ? "Another story is already under review. Wait for the moderator’s decision before submitting this one. You can keep creating and saving drafts."
    : "Другая ваша история уже на модерации. Дождитесь решения модератора, прежде чем отправлять эту. Создавать и сохранять черновики можно без ограничений.";
}
