export function renderPiano(element, notes) {
  element.innerHTML = notes.map(n => `<button type="button" class="piano-key ${n.black ? 'black' : 'white'}" data-note="${n.id}" style="--position:${n.position};--accent:${n.cat.fur}" aria-label="${n.note}, ${n.cat.name}, клавиша ${n.key}" aria-pressed="false"><span class="note-label">${n.note}</span><kbd>${n.key}</kbd></button>`).join('');
  return (id, active) => {
    const key = element.querySelector(`[data-note="${id}"]`);
    key.classList.toggle('pressed', active); key.setAttribute('aria-pressed', String(active));
  };
}
