import { useRef, useState } from 'react';
import { firstEmpty } from '../../core/cells';
import { itemName } from '../../core/itemData';
import type { GearSet } from '../../core/items';
import { gamblePrice, gambleTier, type GambleResult } from '../../core/merchant';
import type { BuyResult } from '../../core/trader';
import type { GameStore } from '../../store/gameStore';
import { Sprite } from '../../sprites/Sprite';
import { EmptyTarget, ItemButton } from '../character/ItemGrid';
import { baseSprite } from '../character/itemView';
import { useItemDrag } from '../character/useItemDrag';
import { useItemInteractions } from '../character/useItemInteractions';
import { formatNumber } from '../format';
import { clickedThroughCard } from '../platform';
import { useGame } from '../useGame';
import {
  buyLabel, buyRefusalHolds, buyResultText, gambleResultText, gambledLine, gambleSlots, MERCHANTS, stockCaption,
  stockTiles,
} from './merchantView';
import '../character/character.css';
import './merchant.css';

const GROUP_TITLES: Readonly<Record<GearSet, string>> = { mining: 'Mining gear', battle: 'Battle gear' };

/**
 * Brannoc the Trader's stock and Old Mirela's gambling, side by side (stacked on a narrow screen). A bought tile stays
 * where it was, reading Sold, and what a buy or a gamble says sits below its own grid, so the button under the pointer
 * never moves between clicks. A Buy or Gamble button uncovered by a card that a click closed ignores clicks at that
 * point until the pointer moves: they were aimed at the card.
 */
export function MerchantView({ store }: { store: GameStore }) {
  const { state } = useGame(store);
  const [refused, setRefused] = useState<GambleResult>('ok');
  const [buyRefused, setBuyRefused] = useState<{ index: number; result: BuyResult } | null>(null);
  const traderRef = useRef<HTMLHeadingElement>(null);
  const drag = useItemDrag({ store, onResult: (text) => say(text) });
  const { handlers, message, say, cards, tapCard, tapWhere } = useItemInteractions({
    store, state, fallbackRef: traderRef, drag,
  });
  // a refusal shows only while it still holds, so it never contradicts a button that Gold or room has since enabled
  const holds = refused === 'noGold' ? state.gold < gamblePrice(state) : refused === 'bagFull' ? firstEmpty(state.bag) < 0 : false;
  const buyHolds = buyRefused !== null && buyRefusalHolds(state, buyRefused.index, buyRefused.result);
  const got = store.lastGamble;
  const buy = (index: number): void => {
    say(null);
    setBuyRefused({ index, result: store.buyStock(index) });
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
              <li key={t.index} className="gm-stock__tile">
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
                    handlers={handlers}
                    scale={3}
                    className="gm-cell gm-item gm-stock__cell"
                    label={itemName(t.item)}
                  />
                )}
                <span className="gm-stock__name" data-tone={t.tone}>{t.name}</span>
                <span className="gm-stock__price">{t.item === null ? null : `${formatNumber(t.price)} Gold`}</span>
                <button
                  type="button"
                  className="gm-btn gm-stock__buy"
                  data-buy={t.index}
                  disabled={t.item === null}
                  // stays clickable so a click can say why it was refused
                  aria-disabled={(t.item !== null && (!t.affordable || !t.room)) || undefined}
                  aria-label={t.item === null ? 'Sold' : `${buyLabel(t.price)}: ${t.name}`}
                  onClick={(e) => { if (!clickedThroughCard(e)) buy(t.index); }}
                >
                  {t.item === null ? 'Sold' : buyLabel(t.price)}
                </button>
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
              <div className="gm-merchant__caption gm-small gm-muted">Gamble: pick a slot, pay Gold, get a random item</div>
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
                  <li key={s.slot} className="gm-merchant__slot">
                    <Sprite name={baseSprite(s.slot)} scale={3} />
                    <span className="gm-merchant__label">{s.label}</span>
                    <button
                      type="button"
                      className="gm-btn gm-merchant__gamble"
                      data-gamble={s.slot}
                      // stays clickable so a click can say why it was refused
                      aria-disabled={!s.affordable || undefined}
                      aria-label={`Gamble · ${formatNumber(s.price)} Gold: ${s.label}`}
                      onClick={(e) => { if (!clickedThroughCard(e)) setRefused(store.gamble(s.slot).result); }}
                    >
                      Gamble · {formatNumber(s.price)} Gold
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
      </div>
      <p className="gm-merchant__text gm-small gm-muted">
        The merchants never sell Diamonds or Souls. Selling items stays in their cards.
      </p>
      {cards}
    </div>
  );
}
