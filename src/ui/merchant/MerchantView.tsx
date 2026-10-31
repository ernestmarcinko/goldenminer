import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { firstEmpty } from '../../core/cells';
import { itemName } from '../../core/itemData';
import { MATERIAL_LABELS } from '../../core/itemData';
import { MATERIALS, type Material } from '../../core/items';
import type { GearSet, Slot } from '../../core/items';
import { gamblePrice, gambleTier, type GambleResult } from '../../core/merchant';
import type { BuyResult } from '../../core/trader';
import type { GameStore, BuyNotice } from '../../store/gameStore';
import { Sprite } from '../../sprites/Sprite';
import { EmptyTarget, ItemButton } from '../character/ItemGrid';
import type { ItemHandlers } from '../character/ItemGrid';
import type { ItemTarget } from '../character/itemActions';
import { baseSprite, placeCardLeft, placeCardTop, TOOLTIP_WIDTH } from '../character/itemView';
import type { ClickIntent } from '../character/itemView';
import { useItemDrag } from '../character/useItemDrag';
import { useItemInteractions } from '../character/useItemInteractions';
import { screenView } from '../character/useItemPopover';
import { formatNumber } from '../format';
import { clickedThroughCard } from '../platform';
import { useGame } from '../useGame';
import {
  buyLabel, buyRefusalHolds, buyResultText, exchangeOffer, gambleResultText,
  gambledLine, gambleSlots, MERCHANTS, orbOffers, refinerResultText, stockCaption, stockTiles,
  type OrbOffer,
} from './merchantView';
import '../character/character.css';
import './merchant.css';

const GROUP_TITLES: Readonly<Record<GearSet, string>> = { mining: 'Mining gear', battle: 'Battle gear' };

/** Short ore names for the exchange matrix's headers. */
const ORE_SHORT: Readonly<Record<Material, string>> = {
  copper: 'Copper', tin: 'Tin', iron: 'Iron', silver: 'Silver', mithril: 'Mithril', starsteel: 'Starsteel',
  obsidian: 'Obsidian', voidCrystal: 'Void',
};

/** A floating "−4 Copper" / "+1 Tin" that rises from a clicked exchange cell and fades. */
interface FloatText { id: number; x: number; y: number; text: string; tone: 'give' | 'get' }

/** "Buy · 1,240 Gold" with its price kept on one line, so a narrow button wraps only after the dot. */
function PriceLabel({ text }: { text: string }) {
  const at = text.indexOf('· ') + 2;
  return <>{text.slice(0, at)}<span className="gm-merchant__price">{text.slice(at)}</span></>;
}

/** One hover card for a gamble slot or an orb: the price leads, then the name, kind and any lines. */
interface Tip {
  left: number; top: number; price: string; name: string; kind: string; lines: string[];
}

/** Estimated height of a tip, for `placeCardTop`'s below/above choice. The card itself sizes to its content. */
const TIP_ESTIMATE_HEIGHT = 130;

/** Places a tip under (or above) `el` and keeps it inside the screen. */
function tipPlace(el: HTMLElement, price: string, name: string, kind: string, lines: string[]): Tip {
  const r = el.getBoundingClientRect();
  return {
    left: placeCardLeft(r.left, TOOLTIP_WIDTH, document.documentElement.clientWidth),
    top: placeCardTop({ top: r.top, bottom: r.bottom }, TIP_ESTIMATE_HEIGHT, screenView()),
    price, name, kind, lines,
  };
}

/**
 * The three merchants: Brannoc's stock, Old Mirela's gambling and Ferrel's refining, side by side (stacked on a narrow
 * screen). Every tile is the buy control — no separate Buy or Gamble button — so clicking a tile buys or gambles it.
 * Hovering a tile shows its card with the cost on the top line; Old Mirela's reads Unidentified, as a gamble is a
 * mystery item. A tile the miner can't afford yet reads red, like a shop item in an ARPG.
 */
export function MerchantView({ store }: { store: GameStore }) {
  const { state } = useGame(store);
  const [refused, setRefused] = useState<GambleResult>('ok');
  const [buyRefused, setBuyRefused] = useState<{ index: number; result: BuyResult } | null>(null);
  const [refineRefused, setRefineRefused] = useState<string | null>(null);
  const [refineFlash, setRefineFlash] = useState(0);
  const [fly, setFly] = useState<BuyNotice | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const traderRef = useRef<HTMLHeadingElement>(null);
  const refinerRef = useRef<HTMLElement>(null);
  const floatId = useRef(0);
  const drag = useItemDrag({ store, onResult: (text) => say(text) });
  const { handlers, message, say, cards, tapCard, tapWhere } = useItemInteractions({
    store, state, fallbackRef: traderRef, drag,
  });
  // a refusal shows only while it still holds, so it never contradicts a tile that Gold or room has since enabled
  const holds = refused === 'noGold' ? state.gold < gamblePrice(state) : refused === 'bagFull' ? firstEmpty(state.bag) < 0 : false;
  const buyHolds = buyRefused !== null && buyRefusalHolds(state, buyRefused.index, buyRefused.result);
  const got = store.lastGamble;
  const buy = (index: number): void => {
    say(null);
    setBuyRefused({ index, result: store.buyStock(index) });
  };
  const gamble = (slot: Slot): void => {
    say(null);
    setRefused(store.gamble(slot).result);
  };
  // Shows a Refiner status line and flashes it, so a trade or buy that succeeds is as visible as one that is refused.
  const refine = (text: string | null): void => {
    setRefineRefused(text);
    setRefineFlash((n) => n + 1);
  };
  const buyOrb = (o: OrbOffer): void => {
    say(null);
    const result = store.buyOrb(o.family, o.side, o.tier);
    refine(result === 'ok' ? `Bought ${o.name}` : refinerResultText(result));
  };
  // a successful buy shows its sprite flying into the bag for a moment, then clears
  useEffect(() => {
    const last = store.lastBuy;
    if (last === null) return;
    setFly(last);
    const timer = setTimeout(() => setFly(null), 450);
    return () => clearTimeout(timer);
  }, [store.lastBuy]);
  // a tile's card goes when the page scrolls under it, or the window resizes
  useEffect(() => {
    if (tip === null) return undefined;
    const clear = (): void => setTip(null);
    window.addEventListener('scroll', clear, true);
    window.addEventListener('resize', clear);
    return () => {
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('resize', clear);
    };
  }, [tip]);
  // clicking a stock item buys it, instead of opening its card; a right-click still opens its card
  const stockHandlers: ItemHandlers = {
    ...handlers,
    onPick: (target: ItemTarget, intent: ClickIntent, el: HTMLElement) => {
      if (target.where === 'stock') {
        buy(target.index);
        return;
      }
      handlers.onPick(target, intent, el);
    },
  };
  return (
    <div className="gm-merchant">
      <div className="gm-merchant__head">
        <h2 className="gm-merchant__title">Merchants</h2>
        <span className="gm-merchant__gold">{formatNumber(state.gold)} Gold</span>
      </div>
      <div className="gm-merchants">
        <section className="gm-merchant__card" aria-label={MERCHANTS.trader.name}>
          <div className="gm-merchant__who">
            <Sprite name={MERCHANTS.trader.sprite} scale={4} label={MERCHANTS.trader.name} />
            <div>
              <h3 ref={traderRef} tabIndex={-1} className="gm-merchant__name">{MERCHANTS.trader.name}</h3>
              <div className="gm-merchant__caption gm-small gm-muted">{stockCaption(state)}</div>
            </div>
          </div>
          <ul className="gm-stock">
            {stockTiles(state).map((t) => (
              <li key={t.index} className="gm-stock__tile" data-unaffordable={t.item !== null && !t.affordable ? '' : undefined}>
                {t.item === null ? (
                  <EmptyTarget
                    target={{ where: 'stock', index: t.index }}
                    drag={drag}
                    className="gm-cell gm-cell--empty gm-stock__cell"
                  />
                ) : (
                  <ItemButton
                    item={t.item}
                    target={{ where: 'stock', index: t.index }}
                    handlers={stockHandlers}
                    scale={3}
                    className="gm-cell gm-item gm-stock__cell"
                    label={`${buyLabel(t.price)}: ${itemName(t.item)}`}
                  />
                )}
                <span className="gm-stock__name" data-tone={t.tone}>{t.name}</span>
                <span className="gm-stock__price">{t.item === null ? null : `${formatNumber(t.price)} Gold`}</span>
              </li>
            ))}
          </ul>
          {tapWhere === 'stock' && tapCard}
          <div className="gm-merchant__status" role="status">
            {message ?? (buyHolds ? buyResultText(buyRefused.result) : null)}
          </div>
        </section>

        <section className="gm-merchant__card" aria-label={MERCHANTS.gambler.name}>
          <div className="gm-merchant__who">
            <Sprite name={MERCHANTS.gambler.sprite} scale={4} label={MERCHANTS.gambler.name} />
            <div>
              <h3 className="gm-merchant__name">{MERCHANTS.gambler.name}</h3>
              <div className="gm-merchant__caption gm-small gm-muted">Gamble: click a slot, pay Gold, get a random item</div>
            </div>
          </div>
          <p className="gm-merchant__text gm-small gm-muted">
            Rolled at your deepest tier ({formatNumber(gambleTier(state))}). Most are normal or magic; a few are rare;
            legendaries are very rare.
          </p>
          {gambleSlots(state).map((group) => (
            <section key={group.set} className="gm-merchant__group" aria-label={GROUP_TITLES[group.set]}>
              <h4 className="gm-merchant__group-title">{GROUP_TITLES[group.set]}</h4>
              <ul className={`gm-merchant__slots gm-merchant__slots--${group.set}`}>
                {group.slots.map((s) => (
                  <li key={s.slot} className="gm-merchant__slotwrap">
                    <button
                      type="button"
                      className="gm-merchant__tile gm-merchant__slot"
                      data-unaffordable={s.affordable ? undefined : ''}
                      aria-label={`Gamble · ${formatNumber(s.price)} Gold: ${s.label}`}
                      onClick={(e) => { if (!clickedThroughCard(e)) gamble(s.slot); }}
                      onMouseEnter={(e) => setTip(tipPlace(
                        e.currentTarget, `${formatNumber(s.price)} Gold`, s.label,
                        'Unidentified', ['A random item, rolled at your deepest tier.'],
                      ))}
                      onMouseLeave={() => setTip(null)}
                    >
                      <Sprite name={baseSprite(s.slot)} scale={3} />
                      <span className="gm-merchant__label">{s.label}</span>
                      <span className="gm-merchant__cost">{formatNumber(s.price)} Gold</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {got !== null && (
            <section className="gm-merchant__got" data-rarity={got.rarity} aria-label="You got">
              <div className="gm-small gm-muted">You got</div>
              <div className="gm-merchant__got-name">{itemName(got)}</div>
              <div className="gm-small gm-muted">{gambledLine(got)}</div>
            </section>
          )}
          <div className="gm-merchant__status" role="status">{holds ? gambleResultText(refused) : null}</div>
        </section>

        <section ref={refinerRef} className="gm-merchant__card gm-refiner" aria-label={MERCHANTS.refiner.name}>
          <div className="gm-merchant__who">
            <Sprite name={MERCHANTS.refiner.sprite} scale={4} label={MERCHANTS.refiner.name} />
            <div>
              <h3 className="gm-merchant__name">{MERCHANTS.refiner.name}</h3>
              <div className="gm-merchant__caption gm-small gm-muted">Trade ores for orbs, or for each other</div>
            </div>
          </div>
          <p className="gm-merchant__text gm-small gm-muted">
            Craft orbs add a random prefix or suffix in a tier band; the other orbs remove a line, scatter every value,
            or work the sockets. Prices are fixed, but buying into an ore raises its premium for a while.
          </p>
          {orbOffers(state).map((group) => (
            <section key={group.key} className="gm-merchant__group">
              <h4 className="gm-merchant__group-title">{group.title}</h4>
              <ul className="gm-refiner__orbs">
                {group.offers.map((o) => (
                  <li key={o.name} className="gm-merchant__slotwrap">
                    <button
                      type="button"
                      className="gm-merchant__tile gm-merchant__slot gm-refiner__orb"
                      data-unaffordable={o.affordable ? undefined : ''}
                      aria-label={`Buy ${o.name} · ${formatNumber(o.cost)} ${o.oreLabel}`}
                      onClick={(e) => { if (!clickedThroughCard(e)) buyOrb(o); }}
                      onMouseEnter={(e) => setTip(tipPlace(
                        e.currentTarget, `${formatNumber(o.cost)} ${o.oreLabel}`, o.name,
                        'Crafting orb', [o.effect],
                      ))}
                      onMouseLeave={() => setTip(null)}
                    >
                      <Sprite name={o.sprite} scale={3} label={o.name} />
                      <span className="gm-merchant__label">{o.name}</span>
                      <span className="gm-merchant__cost">{formatNumber(o.cost)} {o.oreLabel}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section className="gm-merchant__group">
            <h4 className="gm-merchant__group-title">Ore exchange</h4>
            <p className="gm-merchant__text gm-small gm-muted">
              Trade any ore for any other: the row is what you give, the column what you get. Each trade raises the bought
              ore's premium, so its rates climb for a while, then ease back.
            </p>
            <div className="gm-refiner__matrix" role="table" aria-label="Ore exchange">
              <div className="gm-refiner__matrix-row gm-refiner__matrix-head" role="row">
                <span className="gm-refiner__matrix-corner" role="columnheader">Give ↓ · Get →</span>
                {MATERIALS.map((to) => (
                  <span key={to} className="gm-refiner__matrix-ore" role="columnheader" title={MATERIAL_LABELS[to]}>
                    <Sprite name={baseSprite(to)} scale={2} label={MATERIAL_LABELS[to]} />
                    <span className="gm-refiner__matrix-name">{ORE_SHORT[to]}</span>
                  </span>
                ))}
              </div>
              {MATERIALS.map((from) => (
                <div key={from} className="gm-refiner__matrix-row" role="row">
                  <span className="gm-refiner__matrix-ore" role="rowheader" title={MATERIAL_LABELS[from]}>
                    <Sprite name={baseSprite(from)} scale={2} label={MATERIAL_LABELS[from]} />
                    <span className="gm-refiner__matrix-name">{ORE_SHORT[from]}</span>
                  </span>
                  {MATERIALS.map((to) => {
                    const offer = exchangeOffer(state, from, to);
                    if (offer === null) {
                      return <span key={to} className="gm-refiner__matrix-cell gm-refiner__matrix-cell--self" aria-hidden="true" />;
                    }
                    return (
                      <button
                        key={to}
                        type="button"
                        className="gm-refiner__matrix-cell"
                        data-unaffordable={offer.affordable ? undefined : ''}
                        aria-disabled={!offer.affordable || undefined}
                        title={offer.cost === offer.base
                          ? `${formatNumber(offer.base)} ${MATERIAL_LABELS[from]} → ${formatNumber(offer.amount)} ${MATERIAL_LABELS[to]}`
                          : `${formatNumber(offer.base)} ${MATERIAL_LABELS[from]} → ${formatNumber(offer.amount)} ${MATERIAL_LABELS[to]} · now ${formatNumber(offer.cost)}`}
                        aria-label={`Trade ${formatNumber(offer.cost)} ${MATERIAL_LABELS[from]} for ${formatNumber(offer.amount)} ${MATERIAL_LABELS[to]}`}
                        onClick={(ev) => {
                          if (clickedThroughCard(ev)) return;
                          say(null);
                          const result = store.tradeOres(offer.from, offer.to, offer.amount);
                          refine(result === 'ok'
                            ? `Traded ${formatNumber(offer.cost)} ${MATERIAL_LABELS[offer.from]} for ${formatNumber(offer.amount)} ${MATERIAL_LABELS[offer.to]}`
                            : refinerResultText(result));
                          if (result !== 'ok') return;
                          const el = ev.currentTarget;
                          const card = refinerRef.current;
                          const c = card?.getBoundingClientRect();
                          const r = el.getBoundingClientRect();
                          const id = ++floatId.current;
                          const x = r.left - (c?.left ?? 0) + r.width / 2;
                          const y = r.top - (c?.top ?? 0);
                          setFloats((prev) => [
                            ...prev,
                            { id, x, y, text: `−${formatNumber(offer.cost)} ${ORE_SHORT[offer.from]}`, tone: 'give' },
                            { id: id + 0.5, x, y: y + 18, text: `+${formatNumber(offer.amount)} ${ORE_SHORT[offer.to]}`, tone: 'get' },
                          ]);
                          window.setTimeout(() => {
                            setFloats((prev) => prev.filter((f) => f.id !== id && f.id !== id + 0.5));
                          }, 1100);
                        }}
                      >
                        {formatNumber(offer.cost)}→{formatNumber(offer.amount)}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
          {floats.map((f) => (
            <span
              key={f.id}
              className="gm-refiner__float"
              data-tone={f.tone}
              style={{ left: f.x, top: f.y }}
              aria-hidden="true"
            >
              {f.text}
            </span>
          ))}
          <div
            key={refineFlash}
            className={`gm-merchant__status${refineFlash > 0 ? ' gm-merchant__status--flash' : ''}`}
            role="status"
          >
            {refineRefused}
          </div>
        </section>
      </div>
      {fly !== null && (
        <div key={fly.id} className="gm-buy-fly" aria-hidden="true">
          <Sprite name={fly.sprite} scale={3} />
        </div>
      )}
      <p className="gm-merchant__text gm-small gm-muted">
        The merchants never sell Diamonds or Souls. Selling items stays in their cards.
      </p>
      {cards}
      {tip !== null && createPortal(
        <div className="gm-card gm-card--tip" role="tooltip" style={{ left: tip.left, top: tip.top }}>
          <div className="gm-card__price">{tip.price}</div>
          <div className="gm-card__name">{tip.name}</div>
          <div className="gm-card__kind">{tip.kind}</div>
          {tip.lines.map((l, i) => (
            <div key={i} className="gm-card__line" data-tone="muted"><span className="gm-card__text">{l}</span></div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
