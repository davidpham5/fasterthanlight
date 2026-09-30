import { hashForIndex, indexFromHash, swipeDirection, wrapIndex } from './slideshow-state';

/** Turns a no-JS photo list (see Slideshow.astro) into a one-photo-at-a-time slideshow. */
export function enhance(root: HTMLElement): void {
  const items = Array.from(root.querySelectorAll<HTMLElement>('.set__item'));
  const thumbs = Array.from(root.querySelectorAll<HTMLButtonElement>('.slideshow__thumb'));
  const navButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('.slideshow__nav'));
  const thumbStrip = root.querySelector<HTMLElement>('.slideshow__thumbs');
  const status = root.querySelector<HTMLElement>('.slideshow__status');
  const list = root.querySelector<HTMLElement>('.set__list');
  const count = items.length;
  if (count === 0 || !list) return;

  let current = -1;

  function centerThumb(index: number): void {
    const thumb = thumbs[index];
    if (!thumbStrip || !thumb) return;
    thumbStrip.scrollLeft = thumb.offsetLeft - (thumbStrip.clientWidth - thumb.clientWidth) / 2;
  }

  function show(index: number, fromUser: boolean): void {
    const next = wrapIndex(index, count);
    if (next === current) return;
    current = next;

    items.forEach((item, i) => item.classList.toggle('is-active', i === current));
    thumbs.forEach((thumb, i) => {
      const active = i === current;
      thumb.classList.toggle('is-active', active);
      if (active) thumb.setAttribute('aria-current', 'true');
      else thumb.removeAttribute('aria-current');
    });

    // Preload neighbours so next/previous feel instant.
    for (const offset of [1, -1]) {
      const img = items[wrapIndex(current + offset, count)].querySelector('img');
      if (img) img.loading = 'eager';
    }
    centerThumb(current);

    if (fromUser) {
      root.classList.add('is-navigating');
      history.replaceState(null, '', hashForIndex(current));
      if (status) {
        const caption = items[current].querySelector('figcaption')?.textContent?.trim();
        status.textContent = `Photo ${current + 1} of ${count}${caption ? `: ${caption}` : ''}`;
      }
    }
  }

  // The server renders photo 1 as active; only a deep link (#n) changes the initial photo.
  root.classList.add('is-enhanced');
  show(indexFromHash(location.hash, count), false);

  navButtons.forEach((button) =>
    button.addEventListener('click', () => show(current + Number(button.dataset.dir), true)),
  );
  thumbs.forEach((thumb, i) => thumb.addEventListener('click', () => show(i, true)));

  document.addEventListener('keydown', (event) => {
    if (count < 2 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowLeft') show(current - 1, true);
    else if (event.key === 'ArrowRight') show(current + 1, true);
  });

  let start: { x: number; y: number } | null = null;
  list.addEventListener('pointerdown', (event) => {
    start = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY };
  });
  list.addEventListener('pointerup', (event) => {
    if (!start || count < 2) return;
    const direction = swipeDirection(event.clientX - start.x, event.clientY - start.y);
    start = null;
    if (direction !== 0) show(current + direction, true);
  });

  window.addEventListener('hashchange', () => show(indexFromHash(location.hash, count), true));
}
