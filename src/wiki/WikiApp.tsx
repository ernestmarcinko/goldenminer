import { useState, type ReactNode } from 'react';
import {
  ASCEND_DEPTH_PER_POINT, ASCEND_LEVEL, ASCEND_LEVEL_STEP, BAG_SIZE, BASE_OFFLINE_CAP_MS, ORB_BAG_STACK,
  GAMBLE_GOLD, GATE_EVERY, GEM_BAG_STACK, HAZARD_START_METRE, LEVEL_CAP, MAP_CRAFT_SOULS_PER_TIER, MAP_TIER_CAP, MATERIAL_BAG_STACK,
  MAX_CRAFTED_LINES, MAX_ITEM_LEVEL, MAX_LAMP_SIGHT, MAX_MAP_MODS, MAX_OFFLINE_CAP_MS, MAX_SIDE_LINES, MAX_SOCKETS,
  MAX_STASH_PAGES, MIN_OFFLINE_CAP_MS, RESET_WEB_DIAMONDS, RESPEC_GOLD_BASE, SOUL_UPGRADE_BASE, STASH_PAGE_SIZE,
  STASH_PAGE_GOLD, START_GENERAL_PAGES, STOCK_BAND_METRES, STOCK_SIZE, TRADER_PRICE_MULT, XP_EXPONENT, XP_PER_LEVEL,
  XP_RAMP_KNEE, XP_RAMP_LATE, XP_RAMP_START, XP_RAMP_STEEP,
} from '../core/balance';
import { ABYSS_BAND_HEIGHT, ABYSS_START, bandAt } from '../core/bands';
import { BASE_NAMES, GEM_GRADE_LABELS, GEM_LABELS, RARE_FIRST, RARE_SECOND, STAT_NAMES } from '../core/itemData';
import {
  BATTLE_SLOTS, GEM_GRADES, GEM_TYPES, MINING_SLOTS, RARITIES, type StatKey,
} from '../core/items';
import type { AscendancyNode } from '../core/ascendancy';
import type { SheetRow } from '../core/stats';
import { formatDuration, formatNumber, formatRate } from '../ui/format';

import { achievementBoostPercent, achievementFamilies, achievementSecretCount, achievementTotal } from './data/achievements';
import { AFFIX_TIERS_SHOWN, affixTables, type AffixRow } from './data/affixes';
import { MAP_MOD_TIERS_SHOWN, mapModRows, mapSpecialRows } from './data/maps';
import { craftCosts, materialRows, orbRecipes, oreExchange, orePremium } from './data/materials';
import { ascendancyNodes, keystoneNodes, notableNodes, smallNodes } from './data/skills';
import { freshCharacterSheet } from './data/stats';
import { uniqueRows } from './data/uniques';

// ── Static, generated tables (computed once from core data; nothing is hand-typed) ──────────────────────────────────

const AFFIXES = affixTables();
const MATERIALS = materialRows();
const ORB_RECIPES = orbRecipes();
const CRAFTS = craftCosts();
const UNIQUES = uniqueRows();
const KEYSTONES = keystoneNodes();
const NOTABLES = notableNodes();
const SMALLS = smallNodes();
const ASCENDANCY = ascendancyNodes();
const MAP_MODS = mapModRows();
const MAP_SPECIALS = mapSpecialRows();
const FAMILIES = achievementFamilies();
const MILESTONES = FAMILIES.filter((f) => f.kind === 'ladder');
const FEATS = FAMILIES.filter((f) => f.kind === 'feat');
const COLLECTIONS = FAMILIES.filter((f) => f.kind === 'collection');
const SHEET = freshCharacterSheet();

const SECTIONS = [
  { id: 'getting-started', title: 'Getting started' },
  { id: 'digging', title: 'Digging and the mine' },
  { id: 'gear', title: 'Gear' },
  { id: 'stats', title: 'Character stats' },
  { id: 'affixes', title: 'Prefixes and suffixes' },
  { id: 'levels', title: 'Item levels and tiers' },
  { id: 'crafting', title: 'Crafting and enchanting' },
  { id: 'ores', title: 'Ores and the market' },
  { id: 'uniques', title: 'Uniques' },
  { id: 'maps', title: 'Maps and dungeons' },
  { id: 'skills', title: 'Skills' },
  { id: 'ascension', title: 'Ascension' },
  { id: 'achievements', title: 'Achievements' },
  { id: 'merchant', title: 'Merchant' },
  { id: 'saves', title: 'Log, saves and settings' },
  { id: 'numbers', title: 'Numbers reference' },
] as const;

// ── Generated prose helpers (values always come from core, never typed here) ────────────────────────────────────────

function statText(stat: StatKey, value: number): string {
  return `${value} ${STAT_NAMES[stat]}`;
}

function ascendancyEffectText(node: AscendancyNode): string {
  return node.effects.map((e) => {
    switch (e.kind) {
      case 'stat': return statText(e.stat, e.value);
      case 'startingDepth': return `${e.value} m starting depth`;
      case 'passivePoints': return `+${e.value} passive point${e.value === 1 ? '' : 's'}`;
      case 'autoMapQueue': return `+${e.value} auto-map queue slot${e.value === 1 ? '' : 's'}`;
    }
  }).join(', ');
}

/** The named bands 0..1000 m, read from `bandAt` so the boundaries never drift. */
function bandRows(): { name: string; start: number; end: number; tier: number }[] {
  const rows: { name: string; start: number; end: number; tier: number }[] = [];
  let start = 0;
  let prev = bandAt(0);
  for (let d = 1; d <= ABYSS_START; d++) {
    const b = bandAt(d);
    if (b.name !== prev.name) {
      rows.push({ name: prev.name, start, end: d, tier: prev.tier });
      start = d;
      prev = b;
    }
  }
  rows.push({ name: prev.name, start, end: ABYSS_START, tier: prev.tier });
  return rows;
}
const BANDS = bandRows();

/** The passive web's small nodes, grouped by side + stat, summed into one row each. */
function smallGroups(): { side: string; statName: string; value: number; count: number }[] {
  const map = new Map<string, { side: string; statName: string; value: number; count: number }>();
  for (const node of SMALLS) {
    const effect = node.effects.find((e) => e.kind === 'stat');
    if (effect === undefined || effect.kind !== 'stat') continue;
    const key = `${node.side}\u0000${effect.stat}\u0000${effect.value}`;
    const group = map.get(key);
    if (group === undefined) map.set(key, { side: node.side, statName: STAT_NAMES[effect.stat], value: effect.value, count: 1 });
    else group.count += 1;
  }
  return [...map.values()];
}
const SMALL_GROUPS = smallGroups();

function ascendancyMidsAndBigs(): AscendancyNode[] {
  return ASCENDANCY.filter((n) => n.kind === 'mid' || n.kind === 'big');
}
function ascendancySmallGroups(): { name: string; text: string; count: number }[] {
  const map = new Map<string, { name: string; text: string; count: number }>();
  for (const node of ASCENDANCY) {
    if (node.kind !== 'small') continue;
    const text = ascendancyEffectText(node);
    const key = `${node.name}\u0000${text}`;
    const group = map.get(key);
    if (group === undefined) map.set(key, { name: node.name, text, count: 1 });
    else group.count += 1;
  }
  return [...map.values()];
}

const hours = (ms: number): string => `${ms / 3_600_000} h`;

// ── Rendering helpers ────────────────────────────────────────────────────────────────────────────────────────────────

function rowText(r: SheetRow): string {
  switch (r.format) {
    case 'number': return formatNumber(r.value);
    case 'rate': return formatRate(r.value);
    case 'percent': return `${formatRate(r.value)}%`;
    case 'multiplier': return `×${formatRate(r.value)}`;
    case 'perSecond': return `${formatRate(r.value)}/s`;
    case 'mPerMin': return `${formatRate(r.value)} m/min`;
    case 'durationMs': return formatDuration(r.value);
    case 'range': return `${formatNumber(r.value)}–${formatNumber(r.value2 ?? r.value)}`;
  }
}

function rangeCell(range: { lo: number; hi: number }): string {
  return range.lo === range.hi ? String(range.lo) : `${range.lo}–${range.hi}`;
}

function Table({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'wiki__table wiki__table--wide' : 'wiki__table'}>
      <table>{children}</table>
    </div>
  );
}

function AffixTable({ title, rows }: { title: string; rows: AffixRow[] }) {
  const tiers = Array.from({ length: AFFIX_TIERS_SHOWN }, (_, i) => i + 1);
  return (
    <section className="wiki__sub">
      <h3>{title}</h3>
      <Table wide>
        <thead>
          <tr>
            <th>Stat</th>
            <th>Word</th>
            <th>Side</th>
            <th className="wiki__num">Base</th>
            <th className="wiki__num">Step</th>
            {tiers.map((t) => <th key={t} className="wiki__num">T{t}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.stat}>
              <td>{row.statName}</td>
              <td className="wiki__word">{row.word}</td>
              <td>{row.side === 'prefix' ? 'Prefix' : 'Suffix'}</td>
              <td className="wiki__num">{row.base}</td>
              <td className="wiki__num">{row.step}</td>
              {row.tiers.map((range, i) => <td key={i} className="wiki__num">{rangeCell(range)}</td>)}
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}

function SheetTable({ title, rows }: { title: string; rows: SheetRow[] }) {
  return (
    <section className="wiki__sub">
      <h3>{title}</h3>
      <Table>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td className="wiki__num">{rowText(r)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}

// ── The wiki ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export function WikiApp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="wiki">
      <header className="wiki__header">
        <div className="wiki__title">The Golden Minder</div>
        <div className="wiki__subtitle">The reference — generated from the game&apos;s own data</div>
        <a className="wiki__back" href="./index.html">Back to the mine</a>
      </header>
      <div className="wiki__layout">
        <nav className="wiki__nav" aria-label="Wiki sections">
          <button
            type="button"
            className="wiki__nav-toggle"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Sections
          </button>
          <ol className={open ? 'wiki__nav-list is-open' : 'wiki__nav-list'}>
            {SECTIONS.map((s) => (
              <li key={s.id}><a href={`#${s.id}`} onClick={() => setOpen(false)}>{s.title}</a></li>
            ))}
          </ol>
        </nav>
        <main className="wiki__content">
          <Section id="getting-started" title="Getting started">
            <p>
              The Golden Minder is an idle mining game. You dig a shaft straight down, metre by metre, earning Gold and Diamonds
              from veins, finding gear, gems and maps, and running the maps as little dungeons. Progress is saved in your
              browser; there is no backend.
            </p>
            <p>Click the rock in the Mine view to dig. Digging also ticks along by itself; <strong>Pause digging</strong> stops it, and <strong>Continue digging</strong> starts it again. Your Pause is saved, and a map run keeps fighting while digging is paused.</p>
            <ul className="wiki__list">
              <li>Click an item to pick it up, then click where it should go; click it again (or press Escape) to put it back. Hover it for its card.</li>
              <li>Right-click an item for its action card, which lists every action it offers.</li>
              <li><kbd>Ctrl</kbd>+click (⌘+click on a Mac) sells an item; <kbd>Alt</kbd>+click salvages it.</li>
              <li><kbd>Shift</kbd>+click moves an item between the bag and the stash.</li>
            </ul>
          </Section>

          <Section id="digging" title="Digging and the mine">
            <p>
              Digging earns only from what you dig into: Gold from gold veins, Diamonds from diamond veins, and crafting
              materials from material veins. The minimap records everything found by depth; the dig-face is the metre ahead
              of you, and your lamp sight shows a few metres ahead on the minimap.
            </p>
            <p>The shaft is split into bands, each deeper band holding higher-tier items and rarer materials:</p>
            <Table>
              <thead>
                <tr><th>Band</th><th className="wiki__num">Depth</th><th className="wiki__num">Tier</th></tr>
              </thead>
              <tbody>
                {BANDS.map((b) => (
                  <tr key={b.name}>
                    <td>{b.name}</td>
                    <td className="wiki__num">{b.start}–{b.end} m</td>
                    <td className="wiki__num">{b.tier}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p>
              Below {ABYSS_START} m the mine enters The Abyss, which rises one tier every {ABYSS_BAND_HEIGHT} m and keeps
              going. From {HAZARD_START_METRE} m down, some metres hold gas pockets or unstable rock that slow digging;
              hazard ward on your gear cuts the slowdown.
            </p>
          </Section>

          <Section id="gear" title="Gear">
            <p>
              Chests and gems drop mining and battle gear. One bag of {BAG_SIZE} cells holds everything you carry; the stash
              keeps more, with {STASH_PAGE_SIZE} cells a page (it starts with {START_GENERAL_PAGES}, and more are bought for
              Gold). The paper doll switches between your mining and battle sets.
            </p>
            <p>Mining slots: {MINING_SLOTS.join(', ')}. Battle slots: {BATTLE_SLOTS.join(', ')}.</p>
            <p>
              Rarities, from common to rarest, are {RARITIES.join(', ')}. An item can hold up to {MAX_SOCKETS} socketed
              gems, of which there are five types — {GEM_TYPES.map((g) => GEM_LABELS[g]).join(', ')} — each in five grades
              ({GEM_GRADES.map((g) => GEM_GRADE_LABELS[g]).join(', ')}).
            </p>
            <p>
              An item also has up to {MAX_SIDE_LINES} prefixes and {MAX_SIDE_LINES} suffixes (its rolled lines), plus at
              most {MAX_CRAFTED_LINES} crafted lines from tempering. The loot filter can sell, salvage or stash a new find by
              rule before it reaches the bag.
            </p>
          </Section>

          <Section id="stats" title="Character stats">
            <p>
              The character sheet is read from the same derived values the game runs on, for a fresh, level-1 character.
              Your own numbers grow with gear, levels, the passive web, ascension and achievements.
            </p>
            <p>
              Some stats are <em>local</em> to one slot: a weapon&apos;s damage and damage %, an armor&apos;s armor and armor
              %, and a pickaxe&apos;s dig power and dig power % raise that item&apos;s own flat value first, before the
              global pool adds everything else on top. Everything else is global.
            </p>
            <div className="wiki__cols">
              <SheetTable title="Mining" rows={SHEET.mining} />
              <SheetTable title="Battle" rows={SHEET.battle} />
            </div>
          </Section>

          <Section id="affixes" title="Prefixes and suffixes">
            <p>
              Every stat rolls as either a prefix or a suffix, and each has a magic-name word: a prefix word leads the
              item&apos;s base name, a suffix word follows &ldquo;of&rdquo;. A tier rolls from <code>base + step × (tier − 1)</code>{' '}
              up to just below the next tier&apos;s start. The rollable tier is capped by the item&apos;s level, and lower
              tiers stay the likeliest; deeper items roll higher tiers without limit, so the table shows the first{' '}
              {AFFIX_TIERS_SHOWN} as a window, not a cap.
            </p>
            <AffixTable title="Mining gear" rows={AFFIXES.mining} />
            <AffixTable title="Battle gear" rows={AFFIXES.battle} />
          </Section>

          <Section id="levels" title="Item levels and tiers">
            <p>
              An item&apos;s level caps how high its lines can roll (its tier cap equals its item level), and lower tiers
              are weighted likelier than higher ones. A normal item takes the base name for its slot and level; a magic item
              is named by its prefix and suffix words; a rare item gets a two-word name from fixed word lists.
            </p>
            <p>The base names, by slot and item level:</p>
            <Table>
              <thead>
                <tr><th>Slot</th><th>Base names</th></tr>
              </thead>
              <tbody>
                {(Object.keys(BASE_NAMES) as (keyof typeof BASE_NAMES)[]).map((slot) => (
                  <tr key={slot}>
                    <td>{slot}</td>
                    <td>{BASE_NAMES[slot].join(' · ')}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p>
              Rare names draw a first word from {RARE_FIRST.join(', ')}, and a second word per slot (for example, a pickaxe
              draws from {RARE_SECOND.pickaxe.join(', ')}).
            </p>
          </Section>

          <Section id="crafting" title="Crafting and enchanting">
            <p>
              Drag a material onto an item (or a map) to craft with it. A craft costs <code>base + floor(level / per)</code>{' '}
              of its material — an item&apos;s level is its item level, a map&apos;s is its tier:
            </p>
            <Table>
              <thead>
                <tr><th>Material</th><th className="wiki__num">Base</th><th className="wiki__num">Per level</th></tr>
              </thead>
              <tbody>
                {CRAFTS.map((c) => (
                  <tr key={c.kind}>
                    <td>{c.label}</td>
                    <td className="wiki__num">{c.base}</td>
                    <td className="wiki__num">{c.per === 0 ? '—' : c.per}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p>
              Copper makes a normal item magic and Tin rerolls a magic item&apos;s lines; Silver rerolls a rare item&apos;s.
              Iron, Starsteel and Obsidian are retired as crafts — they are orb currency at the Refiner. Mithril rerolls
              sockets, and Diamonds add a line to a rare item. A Void crystal tempers a magic or rare item (or map): it may
              add a crafted line above its usual tiers, raise every line a tier, do nothing, or ruin it to tier 1 — and the
              item is then sealed.
            </p>
            <p>
              Craft orbs add a random prefix or suffix in a tier band; removal orbs take a random prefix or suffix away;
              a scattering orb rerolls every rolled value; a socket orb adds a socket and a cleansing orb empties the
              sockets. Battle gear can be raised one item level with Souls (costing {SOUL_UPGRADE_BASE} × ilvl² each),
              and enchanting a map also spends {MAP_CRAFT_SOULS_PER_TIER} Souls per tier.
            </p>
          </Section>

          <Section id="ores" title="Ores and the market">
            <p>Each material vein lies only in a metre the seed left otherwise empty, and deeper metres hold rarer ores:</p>
            <Table>
              <thead>
                <tr><th>Ore</th><th className="wiki__num">From (m)</th><th className="wiki__num">Weight</th><th className="wiki__num">Amount</th></tr>
              </thead>
              <tbody>
                {MATERIALS.map((m) => (
                  <tr key={m.material}>
                    <td>{m.label}</td>
                    <td className="wiki__num">{m.from}</td>
                    <td className="wiki__num">{m.weight}</td>
                    <td className="wiki__num">{m.amount}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p>At the Refiner, ore buys the 11 orbs of the catalogue (craft orbs in Minor/Normal/Greater tiers of Iron,
              Mithril and Void crystal; the rest untiered):</p>
            <Table>
              <thead>
                <tr><th>Orb</th><th className="wiki__num">Tier</th><th>Ore</th><th className="wiki__num">Cost</th></tr>
              </thead>
              <tbody>
                {ORB_RECIPES.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td className="wiki__num">{r.tier ?? '—'}</td>
                    <td>{r.oreLabel}</td>
                    <td className="wiki__num">{r.cost}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p>
              Ore exchanges between adjacent rungs of the ladder: up the ladder {oreExchange.up} of one ore becomes 1 of the
              next, and down the ladder 1 becomes {oreExchange.down} of the one below. Buying into an ore adds{' '}
              {orePremium.step} to its premium (capped at {orePremium.cap}); the premium eases back toward 0 over time, so
              each ore stays cheapest when you buy it slowly.
            </p>
          </Section>

          <Section id="uniques" title="Uniques">
            <p>
              Each legendary has a unique line — shown in the legendary colour — that works only while it is worn. Its
              hand-written lines carry no tier, and no craft can change them. Legendaries come in five tiers: tier 1 drops
              from the shallowest metres, tier 5 only from deep, high-level finds and is far rarer.
            </p>
            <Table wide>
              <thead>
                <tr><th>Unique</th><th>Slot</th><th>Tier</th><th>Lines</th><th>Unique effect</th></tr>
              </thead>
              <tbody>
                {UNIQUES.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.slotLabel}</td>
                    <td className="wiki__num">{u.tier}</td>
                    <td>{u.lines.map((l) => `${l.statName} ${l.kind === 'fixed' ? l.value : `×${l.value}`}`).join(', ')}</td>
                    <td className="wiki__word">{u.effect}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Section>

          <Section id="maps" title="Maps and dungeons">
            <p>
              A dungeon entrance you dig past becomes a map. Maps come in normal, magic and rare, hold up to{' '}
              {MAX_MAP_MODS} modifiers (each kind at most once) plus one special, and the Maps tab keeps up to{' '}
              {MAP_TIER_CAP} maps of each tier. Enchanting a map makes its monsters tougher but pays more drops, better
              rarity, more Souls and more materials. A boss may also drop a map one tier either side of the map&apos;s tier.
            </p>
            <p>
              Every {GATE_EVERY}th map tier, from tier {GATE_EVERY} on, is a gate: a wall that asks for one kind of defence.
              Monsters grow tougher tier by tier, and a gate&apos;s are a big step tougher still, so a miner fresh from the
              tier below usually falls there and comes back after some farming; the tier after a gate drops back to the
              usual climb. A physical wall makes the dungeon&apos;s monsters hit with physical damage, harder and more
              often, so armour matters most; an elemental wall makes them hit with elemental damage, so resistances
              matter most. Each pair of gates
              (tiers {GATE_EVERY} and {GATE_EVERY * 2}, then {GATE_EVERY * 3} and {GATE_EVERY * 4}, and so on) has one of each, and your world&apos;s seed decides which comes first.
              The map&apos;s card names its wall. A fire-touched champion still hits with elemental damage.
            </p>
            <p>Map modifiers, by tier (lower tiers are likelier):</p>
            <Table wide>
              <thead>
                <tr>
                  <th>Modifier</th>
                  <th className="wiki__num">Base</th>
                  <th className="wiki__num">Step</th>
                  <th className="wiki__num">Cap</th>
                  {Array.from({ length: MAP_MOD_TIERS_SHOWN }, (_, i) => <th key={i} className="wiki__num">T{i + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                {MAP_MODS.map((m) => (
                  <tr key={m.kind}>
                    <td>{m.label}</td>
                    <td className="wiki__num">{m.base}</td>
                    <td className="wiki__num">{m.step}</td>
                    <td className="wiki__num">{m.cap ?? '—'}</td>
                    {m.tiers.map((range, i) => <td key={i} className="wiki__num">{rangeCell(range)}</td>)}
                  </tr>
                ))}
              </tbody>
            </Table>
            <p>Special modifiers, at most one per map, never counted toward the six:</p>
            <ul className="wiki__list">
              {MAP_SPECIALS.map((s) => <li key={s.special}>{s.text}</li>)}
            </ul>
            <p>
              Run a map from its card; the Run tab shows the fight, and the Log keeps the outcome. With the Surveyor
              notable, the card&apos;s Auto-map action queues a map, and the miner runs the queue while you are away.
            </p>
          </Section>

          <Section id="skills" title="Skills">
            <p>
              Every level gives one point, spent on a passive web: the miner in the middle, mining nodes one side, battle
              the other, hybrid along the bottom. A node is a small stat bonus, a named notable, or a keystone that changes
              a rule with a downside. A node can be taken only next to one already allocated (the miner counts as a start).
              Refund a node for {RESPEC_GOLD_BASE} Gold × your level, or reset the whole web for {RESET_WEB_DIAMONDS}{' '}
              Diamonds.
            </p>
            <h3>Keystones</h3>
            <Table>
              <thead><tr><th>Keystone</th><th>Effect</th></tr></thead>
              <tbody>
                {KEYSTONES.map((k) => (
                  <tr key={k.id}><td>{k.name}</td><td className="wiki__word">{k.desc}</td></tr>
                ))}
              </tbody>
            </Table>
            <h3>Notables</h3>
            <Table>
              <thead><tr><th>Notable</th><th>Effect</th></tr></thead>
              <tbody>
                {NOTABLES.map((k) => (
                  <tr key={k.id}><td>{k.name}</td><td className="wiki__word">{k.desc}</td></tr>
                ))}
              </tbody>
            </Table>
            <h3>Small nodes</h3>
            <p>The small nodes are the web&apos;s bulk +stat budget, grouped here by side and stat:</p>
            <Table>
              <thead><tr><th>Side</th><th>Stat</th><th className="wiki__num">Value</th><th className="wiki__num">Count</th></tr></thead>
              <tbody>
                {SMALL_GROUPS.map((g, i) => (
                  <tr key={i}>
                    <td>{g.side}</td>
                    <td>{g.statName}</td>
                    <td className="wiki__num">{g.value}</td>
                    <td className="wiki__num">{g.count}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Section>

          <Section id="ascension" title="Ascension">
            <p>
              From level {ASCEND_LEVEL} the Ascend tab lets the miner sacrifice the whole run for permanent ascendancy
              points. A run is worth <code>floor(√(depth / {ASCEND_DEPTH_PER_POINT}))</code>, plus — from the second
              ascension on — one point for every {ASCEND_LEVEL_STEP} levels past {ASCEND_LEVEL}. The points spend on a small
              tree of their own; ascending keeps the tree, the queue, your lifetime best and your settings.
            </p>
            <p>Each node costs points: small 1, mid 6, big 12. The mid and big nodes:</p>
            <Table>
              <thead><tr><th>Node</th><th className="wiki__num">Cost</th><th>Effect</th></tr></thead>
              <tbody>
                {ascendancyMidsAndBigs().map((n) => (
                  <tr key={n.id}>
                    <td>{n.name}</td>
                    <td className="wiki__num">{n.cost}</td>
                    <td className="wiki__word">{n.desc}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p>The small nodes, grouped by effect:</p>
            <Table>
              <thead><tr><th>Effect</th><th className="wiki__num">Count</th></tr></thead>
              <tbody>
                {ascendancySmallGroups().map((g, i) => (
                  <tr key={i}>
                    <td>{g.name} — {g.text}</td>
                    <td className="wiki__num">{g.count}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Section>

          <Section id="achievements" title="Achievements">
            <p>
              There are {achievementTotal()} achievements in four kinds. Milestones are lifetime counters that mark once each
              threshold is reached; feats are single deeds; collections count distinct things you have found; and
              {' '}{achievementSecretCount()} secrets stay hidden as "???" until you earn them. Every earned achievement grants
              a permanent {achievementBoostPercent()}% global boost, applied to your final offensive, defensive and yield
              values only.
            </p>
            <h3>Milestones</h3>
            <Table>
              <thead><tr><th>Family</th><th className="wiki__num">Count</th><th className="wiki__num">First</th><th className="wiki__num">Last</th></tr></thead>
              <tbody>
                {MILESTONES.map((f) => (
                  <tr key={f.family}>
                    <td>{f.label}</td>
                    <td className="wiki__num">{f.count}</td>
                    <td className="wiki__num">{formatNumber(f.min)}</td>
                    <td className="wiki__num">{formatNumber(f.max)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <h3>Feats</h3>
            <Table>
              <thead><tr><th>Family</th><th className="wiki__num">Count</th></tr></thead>
              <tbody>
                {FEATS.map((f) => (
                  <tr key={f.family}>
                    <td>{f.label}</td>
                    <td className="wiki__num">{f.count}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <h3>Collections</h3>
            <Table>
              <thead><tr><th>Family</th><th className="wiki__num">Count</th><th className="wiki__num">First</th><th className="wiki__num">Last</th></tr></thead>
              <tbody>
                {COLLECTIONS.map((f) => (
                  <tr key={f.family}>
                    <td>{f.label}</td>
                    <td className="wiki__num">{f.count}</td>
                    <td className="wiki__num">{formatNumber(f.min)}</td>
                    <td className="wiki__num">{formatNumber(f.max)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Section>

          <Section id="merchant" title="Merchant">
            <p>The Merchant tab holds three traders, the same in every world.</p>
            <p>
              <strong>Brannoc the Trader</strong> sells {STOCK_SIZE} items — gear and maps, never a legendary — rolled from
              the world seed and refreshed every {STOCK_BAND_METRES} m you dig deeper, at {TRADER_PRICE_MULT}× their sell
              value. <strong>Old Mirela</strong> gambles: pay {GAMBLE_GOLD} Gold × tier² at your deepest metre for a random
              item, most often normal or magic. <strong>The Refiner</strong> trades ore for the orb catalogue and exchanges
              ore between rungs, with the decaying premium (see <a href="#ores">Ores and the market</a>).
            </p>
          </Section>

          <Section id="saves" title="Log, saves, settings and seeds">
            <p>
              The Log keeps the newest drops and deaths, and a Last-run card. The game autosaves, and Settings holds the
              world seed (a short phrase like <code>amber-fox-427</code>), the motion switches, the loot filter, and the
              save tools: export, import, and start a new world. Two players with the same seed dig the same mine; chest
              contents, bonus finds and combat stay your own luck. Only one tab can play at a time.
            </p>
          </Section>

          <Section id="numbers" title="Numbers reference">
            <p>A compact glossary of the key constants, for players who want the exact figures:</p>
            <Table>
              <tbody>
                {[
                  { label: 'Bag size', value: `${BAG_SIZE} cells` },
                  { label: 'Stash page size', value: `${STASH_PAGE_SIZE} cells` },
                  { label: 'Free stash pages', value: `${START_GENERAL_PAGES}` },
                  { label: 'Max stash pages', value: formatNumber(MAX_STASH_PAGES) },
                  { label: 'A stash page costs', value: `${STASH_PAGE_GOLD} Gold × n²` },
                  { label: 'Level cap', value: `${LEVEL_CAP}` },
                  {
                    label: 'XP to leave level L',
                    value: `${XP_PER_LEVEL} × L^${XP_EXPONENT}, × ${XP_RAMP_STEEP} more a level from ${XP_RAMP_START} to ${XP_RAMP_KNEE}, then × ${XP_RAMP_LATE}`,
                  },
                  { label: 'Base offline cap', value: hours(BASE_OFFLINE_CAP_MS) },
                  { label: 'Min / max offline cap', value: `${hours(MIN_OFFLINE_CAP_MS)} / ${hours(MAX_OFFLINE_CAP_MS)}` },
                  { label: 'Prefixes + suffixes per item', value: `${MAX_SIDE_LINES} + ${MAX_SIDE_LINES}` },
                  { label: 'Crafted lines per item', value: `${MAX_CRAFTED_LINES}` },
                  { label: 'Sockets per item', value: `${MAX_SOCKETS}` },
                  { label: 'Orb catalogue', value: '11 orbs · craft, removal, scattering, sockets' },
                  { label: 'Maps kept per tier', value: `${MAP_TIER_CAP}` },
                  { label: 'Map modifiers per map', value: `${MAX_MAP_MODS}` },
                  { label: 'Max lamp sight', value: `${MAX_LAMP_SIGHT} m` },
                  { label: 'Gem / material / orb bag stack', value: `${GEM_BAG_STACK} / ${MATERIAL_BAG_STACK} / ${ORB_BAG_STACK}` },
                  { label: 'Max item level', value: formatNumber(MAX_ITEM_LEVEL) },
                ].map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    <td className="wiki__num">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Section>
        </main>
      </div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="wiki__section" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
