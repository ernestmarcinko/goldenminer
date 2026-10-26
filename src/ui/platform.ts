/** Read once: on a Mac, Ctrl+click is the context menu, so Cmd+click (`metaKey`) sells instead. */
export const IS_MAC: boolean = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** The key that sells with a click, as the hover card names it. */
export function sellKey(mac: boolean): string {
  return mac ? '⌘' : 'Ctrl';
}

let pointerType = 'mouse';

// Installed as the module loads, so the tap that opened a view already counts when its first cells mount.
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => { pointerType = e.pointerType; }, { capture: true });
}

/**
 * The kind of pointer last pressed anywhere on the page ('mouse' until one is). A cell that mounts under a resting
 * pointer has no pointerdown of its own to ask, and a touch leaves `:hover` stuck where it tapped.
 */
export function lastPointerType(): string {
  return pointerType;
}

/**
 * Where a click inside an item card landed, until the pointer moves off that point. A card's action or a click on
 * the pinned card closes it, and a second click at the same point lands on whatever the card covered: a Buy or Gamble
 * button that was never aimed at.
 */
export function cardClickTracker() {
  let at: { x: number; y: number } | null = null;
  return {
    click(x: number, y: number, inCard: boolean): void { if (inCard) at = { x, y }; },
    move(x: number, y: number): void { if (at !== null && (x !== at.x || y !== at.y)) at = null; },
    through(x: number, y: number): boolean { return at !== null && x === at.x && y === at.y; },
  };
}

const cardClicks = cardClickTracker();

if (typeof document !== 'undefined') {
  // a click from the keyboard (detail 0) has no point
  document.addEventListener('click', (e) => {
    if (e.detail > 0) cardClicks.click(e.clientX, e.clientY, e.target instanceof Element && e.target.closest('[data-item-card]') !== null);
  }, { capture: true });
  document.addEventListener('pointermove', (e) => cardClicks.move(e.clientX, e.clientY), { capture: true });
}

/** The click came at the point of a click inside a card, with no move since: the pointer was aimed at that card. */
export function clickedThroughCard(e: { clientX: number; clientY: number; detail: number }): boolean {
  return e.detail > 0 && cardClicks.through(e.clientX, e.clientY);
}
