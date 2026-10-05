// Keep the select as the value/option source; replace its platform popup.
export function enhanceFilterSelect(select) {
  const wrapper = document.createElement("div");
  wrapper.className = "filter-select";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.id = `${select.id}-trigger`;
  trigger.className = "filter-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  const label = document.querySelector(`label[for="${select.id}"]`);
  label.id = `${select.id}-label`;
  label.htmlFor = trigger.id;
  const list = document.createElement("div");
  list.id = `${select.id}-options`;
  list.className = "filter-select-options";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-labelledby", label.id);
  list.hidden = true;
  trigger.setAttribute("aria-controls", list.id);
  trigger.setAttribute("aria-labelledby", `${label.id} ${trigger.id}`);
  wrapper.append(trigger, list);
  select.after(wrapper);
  select.hidden = true;

  function close(restoreFocus = false) {
    list.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus();
  }
  function refresh() {
    trigger.textContent = select.selectedOptions[0]?.textContent || "";
    list.replaceChildren();
    for (const option of select.options) {
      const item = document.createElement("div");
      item.className = "filter-select-option";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(option.selected));
      item.tabIndex = -1;
      item.textContent = option.textContent;
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        refresh();
        close(true);
      });
      list.append(item);
    }
  }
  function open() {
    refresh();
    list.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    (list.querySelector('[aria-selected="true"]') || list.firstElementChild)?.focus();
  }
  trigger.addEventListener("click", () => list.hidden ? open() : close());
  trigger.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      open();
    }
  });
  list.addEventListener("keydown", (event) => {
    const items = [...list.children];
    const index = items.indexOf(document.activeElement);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
        : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    } else if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      items[index]?.click();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === "Tab") {
      close(true);
    }
  });
  document.addEventListener("click", (event) => {
    if (!wrapper.contains(event.target)) close();
  });
  select.closest("details")?.addEventListener("toggle", (event) => {
    if (!event.currentTarget.open) close();
  });
  select.addEventListener("change", refresh);
  refresh();
  return { refresh };
}
