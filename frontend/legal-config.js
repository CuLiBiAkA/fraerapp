(() => {
  const config = {
    policyVersion: "2026-07-03",
    operatorName: "Албитов Алексей Владимирович",
    operatorAddress: "Россия, г. Калининград, Советский проспект, д. 238А, кв. 29",
    operatorRegistration: "Оператор является физическим лицом; государственная регистрация в качестве ИП не применяется.",
    privacyEmail: "Culibiaka@gmail.com",
    consentWithdrawalEmail: "Culibiaka@gmail.com",
    serviceOwner: "Албитов Алексей Владимирович",
  };

  const required = [
    "policyVersion",
    "operatorName",
    "operatorAddress",
    "operatorRegistration",
    "privacyEmail",
    "consentWithdrawalEmail",
    "serviceOwner",
  ];
  const missing = required.filter((key) => {
    const value = String(config[key] || "").trim();
    return !value || value.startsWith("УКАЖИТЕ");
  });
  if (missing.length > 0) {
    throw new Error(`FraerApp legal config is incomplete: ${missing.join(", ")}`);
  }

  window.FRAERAPP_LEGAL = config;
})();
