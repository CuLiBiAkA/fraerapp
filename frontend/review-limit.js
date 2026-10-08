export function reviewLimitMessage(language = "ru") {
  return language === "en"
    ? "Another story is already under review. Wait for the moderator’s decision before submitting this one. You can keep creating and saving drafts."
    : "Другая ваша история уже на модерации. Дождитесь решения модератора, прежде чем отправлять эту. Создавать и сохранять черновики можно без ограничений.";
}
