// Original layered SVG drawings. No external images, sprites, or generated assets.
export function catSVG(cat, id) {
  const { fur, ink, shape, pattern, ears, eyes } = cat;
  const wide = shape === 'round' ? 46 : shape === 'fluffy' ? 44 : shape === 'pear' ? 39 : 32;
  const headY = shape === 'tall' ? 66 : 79;
  const earTop = ears === 'tall' ? headY - 61 : ears === 'small' ? headY - 39 : headY - 50;
  const outline = '#51443e';
  const marks = {
    tabby: `<path d="M76 ${headY - 30}l4 14m10-18v16m13-13-4 14M52 129l15 4m-15 9 13 3m49-15 14-5m-13 19 14-3" fill="none" stroke="${ink}" stroke-width="6"/>`,
    tiger: `<path d="M72 ${headY - 29}l8 17m11-20v18m13-15-6 16M59 117l16 7m-18 9 15 7m39-19 12-8m-14 24 15-5m-63 19 13 6" fill="none" stroke="${ink}" stroke-width="7"/>`,
    siamese: `<ellipse cx="90" cy="${headY + 5}" rx="29" ry="23" fill="${ink}"/><ellipse cx="65" cy="173" rx="14" ry="9" fill="${ink}"/><ellipse cx="113" cy="173" rx="14" ry="9" fill="${ink}"/>`,
    calico: `<path d="M54 ${headY - 15}q10-31 32-14v36q-23 14-32-22" fill="${ink}"/><path d="M111 116q33 5 19 40l-22-8z" fill="#5e5a59"/><path d="M104 ${headY - 29}q27 0 26 23l-20 10z" fill="#5e5a59"/>`,
    tuxedo: `<path d="M78 113l12 12 13-12 14 51H66z" fill="${ink}"/><path d="M90 ${headY - 15}l-13 27h26z" fill="${ink}"/>`,
    patch: `<ellipse cx="112" cy="${headY - 3}" rx="18" ry="25" fill="${ink}"/><ellipse cx="66" cy="146" rx="17" ry="24" fill="${ink}"/>`,
    freckles: `<g fill="${ink}"><circle cx="62" cy="${headY + 10}" r="3"/><circle cx="68" cy="${headY + 17}" r="2"/><circle cx="119" cy="${headY + 10}" r="3"/><circle cx="112" cy="${headY + 17}" r="2"/></g>`,
    moon: `<path d="M96 ${headY - 28}a11 11 0 1 0 9 17 10 10 0 0 1-9-17" fill="#f8e8b2"/>`,
    star: `<path d="M90 ${headY - 29}l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z" fill="${ink}"/>`,
    fluff: `<path d="M67 119l11 9 12-9 11 9 13-9-6 28H72z" fill="#fff9ed"/><path d="M62 ${headY - 31}l12-10 7 9 10-12 9 11" fill="${fur}" stroke="${outline}" stroke-width="2.5"/>`,
    solid: `<ellipse cx="90" cy="143" rx="24" ry="25" fill="#cbd2d2"/>`,
  };
  const eye = eyes === 'sleepy'
    ? `<path d="M66 ${headY}q7 6 13 0m23 0q7 6 13 0" fill="none"/>`
    : eyes === 'happy' ? `<path d="M66 ${headY + 2}q6-10 13 0m23 0q6-10 13 0" fill="none"/>`
      : `<ellipse cx="73" cy="${headY}" rx="4.5" ry="7"/><ellipse cx="108" cy="${headY}" rx="4.5" ry="7"/><g fill="#fff" stroke="none"><circle cx="74" cy="${headY - 2}" r="1.5"/><circle cx="109" cy="${headY - 2}" r="1.5"/></g>`;
  return `<svg viewBox="0 0 180 200" role="img" aria-labelledby="cat-${id}"><title id="cat-${id}">${cat.name}</title>
  <ellipse class="cat-shadow" cx="90" cy="185" rx="51" ry="7" fill="#625147" opacity=".12"/>
  <g class="cat-body" stroke="${outline}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">
    <path class="cat-tail" d="M${90 + wide - 8} 160Q170 177 153 120Q147 104 139 114" fill="none" stroke="${ink}" stroke-width="14"/>
    <path d="M${90 - wide} 163Q${90 - wide - 5} 125 70 105H110Q${90 + wide + 7} 127 ${90 + wide} 163Q130 181 90 179Q49 181 ${90 - wide} 163Z" fill="${fur}"/>
    <g class="cat-ears" fill="${fur}">
      <path d="M54 ${headY - 8}L${ears === 'fold' ? 46 : 53} ${earTop}Q65 ${earTop - 3} 79 ${headY - 26}M102 ${headY - 27}Q124 ${earTop - 7} 130 ${ears === 'fold' ? earTop + 16 : earTop}L126 ${headY - 5}"/>
      <path d="M59 ${headY - 20}l-1-17 14 14m40 0 11-14-1 18" fill="#e5b0a9" stroke="none"/>
    </g>
    <path d="M49 ${headY}Q46 ${headY - 32} 90 ${headY - 32}Q135 ${headY - 32} 132 ${headY}L${shape === 'fluffy' ? 140 : 131} ${headY + 10}L129 ${headY + 15}Q124 ${headY + 36} 90 ${headY + 34}Q55 ${headY + 35} 51 ${headY + 16}L${shape === 'fluffy' ? 42 : 50} ${headY + 12}Z" fill="${fur}"/>
    <g stroke="none">${marks[pattern] || ''}</g>
    <g class="cat-eyes" stroke="${pattern === 'siamese' ? '#fff1da' : outline}" fill="${pattern === 'siamese' ? '#b6d7dc' : outline}" stroke-width="3">${eye}</g>
    <g fill="#e9a39b" opacity=".65" stroke="none"><ellipse cx="62" cy="${headY + 13}" rx="7" ry="4"/><ellipse cx="120" cy="${headY + 13}" rx="7" ry="4"/></g>
    <path d="M86 ${headY + 9}q4-3 8 0l-4 4z" fill="#c4837e" stroke-width="1.5"/>
    <g class="mouth-closed" fill="none" stroke-width="2"><path d="M90 ${headY + 13}v5q-5 6-10 0m10 0q5 6 10 0"/></g>
    <g class="mouth-open"><ellipse cx="90" cy="${headY + 23}" rx="9" ry="11" fill="#63403f"/><path d="M84 ${headY + 28}q6-7 12 0q-6 8-12 0" fill="#e7a09b" stroke="none"/></g>
    <path d="M43 ${headY + 10}l17 4m-16 8 15-3m62-5 17-4m-16 9 15 3" fill="none" stroke-width="1.7"/>
    <g class="cat-paws" fill="${pattern === 'siamese' ? ink : fur}"><ellipse cx="69" cy="172" rx="15" ry="10"/><ellipse cx="111" cy="172" rx="15" ry="10"/><path d="M65 174v4m7-4v4m35-4v4m7-4v4" stroke-width="1.5"/></g>
  </g></svg>`;
}
