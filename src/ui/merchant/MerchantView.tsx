import { useState } from 'react';
import { itemName } from '../../core/itemData';
import { gambleTier } from '../../core/merchant';
import type { GameStore } from '../../store/gameStore';
import { Sprite } from '../../sprites/Sprite';
import { baseSprite } from '../character/itemView';
import { formatNumber } from '../format';
import { useGame } from '../useGame';
import { gambleResultText, gambledLine, gambleSlots } from './merchantView';
import './merchant.css';

const GROUP_TITLES = { mining: 'Mining gear', battle: 'Battle gear' } as const;

/**
 * The merchant gambles Gold on an item of the slot you pick. What a gamble shows, the item or a refusal, sits below
 * both slot grids, so the Gamble button under the pointer never moves between clicks.
 */
export function MerchantView({ store }: { store: GameStore }) {
  const { state } = useGame(store);
  const [message, setMessage] = useState<string | null>(null);
  const got = store.lastGamble;
  return (
    <div className="gm-merchant">
      <div className="gm-merchant__head">
        <h2 className="gm-merchant__title">The Merchant</h2>
        <span className="gm-merchant__gold">{formatNumber(state.gold)} Gold</span>
      </div>
      <p className="gm-merchant__text gm-muted">
        Gamble: pay Gold for a random item of the slot you pick, rolled at your deepest tier
        ({formatNumber(gambleTier(state))}). Most are normal or magic; a few are rare; legendaries are very rare.
      </p>
      {gambleSlots(state).map((group) => (
        <section key={group.set} className="gm-merchant__group" aria-label={GROUP_TITLES[group.set]}>
          <h3 className="gm-merchant__group-title">{GROUP_TITLES[group.set]}</h3>
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
                  onClick={() => setMessage(gambleResultText(store.gamble(s.slot).result))}
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
      <div className="gm-merchant__status" role="status">{message}</div>
      <p className="gm-merchant__text gm-small gm-muted">
        The merchant never sells Diamonds or Souls. Selling items stays in their cards.
      </p>
    </div>
  );
}
