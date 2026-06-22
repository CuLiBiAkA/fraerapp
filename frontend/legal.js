const legal = window.FRAERAPP_LEGAL || {};

document.querySelectorAll("[data-legal]").forEach((element) => {
  const value = legal[element.dataset.legal];
  if (value) element.textContent = value;
});

document.querySelectorAll("[data-legal-email]").forEach((element) => {
  const email = legal.privacyEmail;
  if (!email) return;
  element.textContent = email;
  if (!email.startsWith("УКАЖИТЕ")) element.href = `mailto:${email}`;
});

const incomplete = Object.values(legal).some((value) => String(value).startsWith("УКАЖИТЕ"));
document.querySelector("#legal-config-warning")?.classList.toggle("hidden", !incomplete);
