// Reserve real space for the footer and links before sizing desktop cards.
export function observeHomeFit() {
  const home = document.querySelector("#login-screen");
  const carousel = home.querySelector(".home-carousel");
  const footer = document.querySelector(".site-footer");
  const links = home.querySelector(".home-catalog-links");
  const status = home.querySelector(".home-search-status");
  let frame;
  const px = (value) => Number.parseFloat(value) || 0;
  const outerHeight = (element) => {
    const style = getComputedStyle(element);
    return element.getBoundingClientRect().height + px(style.marginTop) + px(style.marginBottom);
  };
  function fit() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (home.classList.contains("hidden")) return;
      if (innerWidth <= 700) {
        carousel.style.removeProperty("--home-content-unit");
        return;
      }
      const viewportHeight = document.documentElement.clientHeight;
      const top = carousel.getBoundingClientRect().top + scrollY;
      const remaining = viewportHeight - top - outerHeight(footer) - outerHeight(links)
        - outerHeight(status) - px(getComputedStyle(home).paddingBottom) - 2;
      const base = px(getComputedStyle(home.querySelector("h1")).fontSize) / 40;
      // A readable floor remains for unusually short windows / enlarged text.
      const cardScale = innerWidth >= 1400 ? 324.659 / 424 : .85;
      const unit = Math.max(.27, Math.min(base * cardScale, remaining / 424));
      carousel.style.setProperty("--home-content-unit", `${unit}px`);
    });
  }
  const observer = new ResizeObserver(fit);
  [home.querySelector(".home-copy"), home.querySelector(".home-header"), footer, links, status].forEach((node) => observer.observe(node));
  new MutationObserver(fit).observe(home, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("resize", fit);
  document.fonts.ready.then(fit);
  fit();
}
