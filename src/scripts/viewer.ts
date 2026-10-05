import { swipeDirection, wrapIndex } from './slideshow-state';

/**
 * Opens Photo Log photos large in a <dialog>, stepping through the photos of the same post.
 * Without JavaScript each photo's link simply opens the 1600px image.
 */
export function enhanceViewer(dialog: HTMLDialogElement): void {
  const caption = dialog.querySelector<HTMLElement>('.viewer__caption');
  const navButtons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('.viewer__nav'));
  let img = dialog.querySelector<HTMLImageElement>('.viewer__img');
  if (!caption || !img) return;

  let group: HTMLAnchorElement[] = [];
  let current = 0;
  let opener: HTMLAnchorElement | null = null;

  function show(index: number): void {
    current = wrapIndex(index, group.length);
    const link = group[current];
    const thumb = link.querySelector('img');
    if (!thumb || !img) return;
    const width = Number(thumb.getAttribute('width'));
    const height = Number(thumb.getAttribute('height'));
    // A fresh element, so the previous photo never lingers while the next one loads. The image
    // already on the page shows straight away underneath; the 1600px file paints over it.
    const next = img.cloneNode(false) as HTMLImageElement;
    next.style.setProperty('--ar', String(width / height));
    next.style.setProperty('--w', `${Math.min(width, 1600)}px`);
    next.style.backgroundImage = `url("${thumb.currentSrc || thumb.src}")`;
    next.alt = thumb.alt;
    next.src = link.href;
    img.replaceWith(next);
    img = next;
    caption!.textContent = link.parentElement?.querySelector('figcaption')?.innerText ?? '';
    navButtons.forEach((button) => (button.hidden = group.length < 2));
  }

  document.addEventListener('click', (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-viewer-item]');
    if (!link) return;
    event.preventDefault();
    const root = link.closest('[data-viewer-group]') ?? document;
    group = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[data-viewer-item]'));
    opener = link;
    dialog.showModal();
    show(group.indexOf(link));
  });

  dialog.addEventListener('close', () => opener?.focus());
  dialog.querySelector('.viewer__close')?.addEventListener('click', () => dialog.close());
  navButtons.forEach((button) =>
    button.addEventListener('click', () => show(current + Number(button.dataset.dir))),
  );
  // The dialog fills the screen, so a click on the white space around the photo acts as the backdrop.
  dialog.addEventListener('click', (event) => {
    if (!(event.target as Element).closest('.viewer__img, .viewer__caption, button'))
      dialog.close();
  });
  dialog.addEventListener('keydown', (event) => {
    if (group.length < 2) return;
    if (event.key === 'ArrowLeft') show(current - 1);
    else if (event.key === 'ArrowRight') show(current + 1);
  });

  let start: { x: number; y: number } | null = null;
  dialog.addEventListener('pointerdown', (event) => {
    start = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY };
  });
  dialog.addEventListener('pointerup', (event) => {
    if (!start || group.length < 2) return;
    const direction = swipeDirection(event.clientX - start.x, event.clientY - start.y);
    start = null;
    if (direction !== 0) show(current + direction);
  });
}
