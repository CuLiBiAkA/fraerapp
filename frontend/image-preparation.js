export const IMAGE_POLICY = Object.freeze({ width: 1920, height: 1080, bytes: 500 * 1024, inputBytes: 10 * 1024 * 1024, pixels: 40_000_000 });

export function imageSize(width, height) {
  const scale = Math.min(1, IMAGE_POLICY.width / width, IMAGE_POLICY.height / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// The visible part of a centred image rendered with object-fit: cover.
export function visibleImageFrame(width, height, aspect) {
  const imageAspect = width / height;
  const w = Math.min(1, aspect / imageAspect), h = Math.min(1, imageAspect / aspect);
  return { left: (1 - w) * 50, top: (1 - h) * 50, width: w * 100, height: h * 100 };
}

const words = (ru, en) => (document.documentElement.lang === 'en' ? en : ru);
const node = (tag, text, className) => {
  const result = document.createElement(tag);
  if (text) result.textContent = text;
  if (className) result.className = className;
  return result;
};

async function compress(file) {
  if (file.size > IMAGE_POLICY.inputBytes) throw new Error(words('Исходное изображение должно быть не больше 10 МБ.', 'The source image must be at most 10 MB.'));
  const sourceUrl = URL.createObjectURL(file), source = new Image();
  try {
    await new Promise((resolve, reject) => { source.onload = resolve; source.onerror = reject; source.src = sourceUrl; });
    if (!source.naturalWidth || source.naturalWidth * source.naturalHeight > IMAGE_POLICY.pixels)
      throw new Error(words('Изображение должно быть не больше 40 мегапикселей.', 'The image must be at most 40 megapixels.'));
    const size = imageSize(source.naturalWidth, source.naturalHeight);
    const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = false;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 255) { transparent = true; break; }
    const type = transparent ? 'image/png' : 'image/jpeg';
    const encode = quality => new Promise(resolve => canvas.toBlob(resolve, type, quality));
    let quality = .9, blob = await encode(quality);
    while (blob && blob.size > IMAGE_POLICY.bytes) {
      if (!transparent && quality > .6) quality -= .1;
      else {
        if (canvas.width === 1 && canvas.height === 1) break;
        canvas.width = Math.max(1, Math.floor(canvas.width * .85));
        canvas.height = Math.max(1, Math.floor(canvas.height * .85));
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
      }
      blob = await encode(quality);
    }
    if (!blob || blob.size > IMAGE_POLICY.bytes) throw new Error(words('Не удалось подготовить изображение.', 'Could not prepare the image.'));
    const name = (file.name.replace(/\.[^.]*$/, '') || 'image') + (transparent ? '.png' : '.jpg');
    return { file: new File([blob], name, { type }), width: canvas.width, height: canvas.height };
  } catch (error) {
    throw error instanceof Error ? error : new Error(words('Не удалось прочитать изображение. Выберите PNG, JPEG, WebP или GIF.', 'Could not read the image. Choose PNG, JPEG, WebP or GIF.'));
  } finally { URL.revokeObjectURL(sourceUrl); }
}

export async function prepareImage(file, { purpose = 'scene' } = {}) {
  if (!file?.type?.startsWith('image/')) return file;
  const prepared = await compress(file);
  if (!document.querySelector('link[data-image-preparation]')) {
    const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/image-preparation.css?v=1';
    style.dataset.imagePreparation = ''; document.head.append(style);
  }
  const previous = document.activeElement, url = URL.createObjectURL(prepared.file);
  const dialog = node('dialog', null, 'image-preparation');
  const heading = node('h2', words('Проверьте изображение', 'Check your image')); heading.id = 'image-preparation-title';
  dialog.setAttribute('aria-labelledby', heading.id);
  dialog.append(heading, node('p', words('Держите лица, надписи и важные детали в центральной области. Рамки показывают пример обрезки на разных экранах.', 'Keep faces, text and important details in the centre. The frames show example crops on different screens.')));
  const stage = node('div', null, 'image-preparation-stage');
  const img = node('img'); img.src = url; img.alt = words('Подготовленное изображение с безопасной областью', 'Prepared image with safe area'); stage.append(img);
  const formats = purpose === 'cover'
    ? [[words('Карточка автора', 'Author card'), 4 / 5], [words('Телефон', 'Phone'), 4 / 3], [words('Страница истории', 'Story page'), 640 / 150]]
    : [[words('Десктоп', 'Desktop'), 16 / 9], [words('Планшет', 'Tablet'), 3 / 4], [words('Телефон', 'Phone'), 390 / 844]];
  const legend = node('div', null, 'image-preparation-legend');
  let left = 0, top = 0, right = 100, bottom = 100;
  formats.forEach(([label, ratio], index) => {
    const frame = visibleImageFrame(prepared.width, prepared.height, ratio);
    left = Math.max(left, frame.left); top = Math.max(top, frame.top);
    right = Math.min(right, frame.left + frame.width); bottom = Math.min(bottom, frame.top + frame.height);
    const overlay = node('div', null, `image-preparation-frame format-${index}`);
    Object.assign(overlay.style, { left: `${frame.left}%`, top: `${frame.top}%`, width: `${frame.width}%`, height: `${frame.height}%` });
    stage.append(overlay); legend.append(node('span', label, `format-${index}`));
  });
  const safe = node('div', null, 'image-preparation-safe');
  Object.assign(safe.style, { left: `${left}%`, top: `${top}%`, width: `${right - left}%`, height: `${bottom - top}%` }); stage.append(safe);
  const details = node('p', `${prepared.width} × ${prepared.height} · ${Math.ceil(prepared.file.size / 1024)} ${words('КБ', 'KB')} · ${words('не больше 1920 × 1080 и 500 КБ', 'at most 1920 × 1080 and 500 KB')}`);
  const notice = node('p', words('Зелёная область видна во всех показанных форматах. На других пропорциях кадрирование может отличаться. Исходные пропорции сохранены; изображение не растягивается.', 'The green area is visible in all shown formats. Other aspect ratios may crop differently. Original proportions are preserved without stretching.'));
  if (file.type === 'image/gif') notice.append(document.createTextNode(words(' GIF будет сохранён как неподвижное изображение.', ' GIF will be saved as a still image.')));
  const actions = node('div', null, 'image-preparation-actions');
  const cancel = node('button', words('Выбрать другое', 'Choose another')), accept = node('button', words('Использовать изображение', 'Use image'));
  cancel.type = accept.type = 'button'; actions.append(cancel, accept);
  dialog.append(stage, legend, details, notice, actions); document.body.append(dialog);
  return new Promise(resolve => {
    let selected = null;
    cancel.onclick = () => dialog.close(); accept.onclick = () => { selected = prepared.file; dialog.close(); };
    dialog.addEventListener('close', () => { URL.revokeObjectURL(url); dialog.remove(); if (previous?.isConnected) previous.focus(); resolve(selected); }, { once: true });
    dialog.showModal(); cancel.focus();
  });
}
