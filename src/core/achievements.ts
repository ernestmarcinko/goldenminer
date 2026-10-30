import { GATE_EVERY, LEVEL_CAP } from './balance';
import { deriveBattleStats } from './battle';
import { dungeonLayout } from './dungeons';
import { gateWall, isGateTier } from './gates';
import { LEGENDARIES, MATERIAL_LABELS } from './itemData';
import {
  BATTLE_SLOTS, GEM_GRADES, GEM_TYPES, MAP_MOD_KINDS, MAP_SPECIALS, MATERIALS, RUNE_TYPES, isGear, type Item, type Material,
} from './items';
import { addToSet } from './ledger';
import type { IconGlyphId } from './skillIcons';
import {
  CHAMPION_MODS, type ChampionMod, type GameState, type MapRun, type MonsterState, type RunHandicaps, type RunResult,
} from './types';

/**
 * The permanent, global boost each earned achievement grants: +1% per achievement, applied to the final derived
 * offensive, defensive and yield values only. It never re-enters the stat pool, so it cannot be rolled on gear or read
 * back as a bonus.
 */
export const ACHIEVEMENT_BOOST = 0.01;

/** A ladder climbs a counter by thresholds; a feat is a single deed; a collection is a count of distinct finds; a hidden one is a secret feat. */
export type AchievementKind = 'ladder' | 'feat' | 'collection' | 'hidden';

/** One achievement: its id (a generated `<family>.<value>` for a ladder), the family it belongs to, its kind and its threshold. */
export interface AchievementDef {
  id: string;
  family: string;
  kind: AchievementKind;
  value: number;            // the threshold for ladders and collections; 1 for feats and hidden
  name: string;
  desc: string;
}

/** How a family's achievements read: its group label, its thresholds and the description for a threshold. */
interface FamilyDef {
  family: string;
  label: string;
  thresholds: readonly number[];
  desc: (n: number) => string;
  /** A collection's size so far, read off the lifetime ledger; absent for a ladder, whose counter `familyValue` knows. */
  size?: (state: GameState) => number;
}

/** Whole numbers with thousands separators, for the generated descriptions. */
const commas = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// --------------------------------------------------------------------------------------------------------------------
// Threshold design.
//
// The +1% each achievement grants is part of the power curve, so the ladders are paced to a first run of about two
// weeks. A family's first step comes after real play, past what the first night's capped offline digging and the first
// check-in produce (no "1 chest", "1 gem", "10 clicks"): the reference session pins that it earns a handful at most.
// About half of each ladder falls inside the first run; the rest sits beyond it, on lifetime totals that take several
// ascensions. Steps climb in the 1–2.5–5 series, 8–12 to a family, and a few exotic values (42, 666, 1337, 8760,
// 123456) are salted in as cookie-clicker-style milestones. Only deaths, levels and ascensions start where one is
// already progress.
//
// The anchors are the reference run's own numbers at the first level-100 cap: a few hundred map clears, ~150,000
// kills, ~500,000 Souls and a few million Gold, with a human miner digging some 10,000–15,000 m of the two weeks.
// Digging slows as hardness climbs (10 + 0.13·m), so a single run's depth tops out near 100,000 m; lifetime totals end
// an order of magnitude past a first run. Time played/away end at 8760 hours, exactly one year.
// --------------------------------------------------------------------------------------------------------------------

const FAMILY_DEFS: readonly FamilyDef[] = [
  { family: 'depth', label: 'Maximum Depth',
    thresholds: [750, 1000, 1337, 2500, 5000, 7500, 10000, 15000, 25000, 50000, 100000],
    desc: (n) => `Reach a depth of ${commas(n)} metres.` },
  { family: 'dig', label: 'Total Depth',
    thresholds: [1000, 2500, 5000, 10000, 25000, 50000, 100000, 123456, 250000, 500000, 1000000, 2500000],
    desc: (n) => `Dig ${commas(n)} metres over your lifetime.` },
  { family: 'clicks', label: 'Clicks',
    thresholds: [500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000],
    desc: (n) => `Click ${commas(n)} times over your lifetime.` },
  { family: 'handMined', label: 'Hand Mined',
    thresholds: [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000],
    desc: (n) => `Dig ${commas(n)} metres by hand over your lifetime.` },
  { family: 'autoMined', label: 'Auto Mined',
    thresholds: [1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000],
    desc: (n) => `Dig ${commas(n)} metres automatically over your lifetime.` },

  { family: 'gold', label: 'Gold',
    thresholds: [123456, 250000, 666666, 1000000, 2500000, 5000000, 10000000, 25000000, 100000000, 250000000, 1000000000],
    desc: (n) => `Earn ${commas(n)} Gold over your lifetime.` },
  { family: 'goldSpent', label: 'Gold Spent',
    thresholds: [10000, 25000, 50000, 100000, 250000, 1000000, 2500000, 10000000, 25000000, 100000000, 250000000],
    desc: (n) => `Spend ${commas(n)} Gold over your lifetime.` },

  { family: 'diamonds', label: 'Diamonds',
    thresholds: [250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000],
    desc: (n) => `Earn ${commas(n)} Diamonds over your lifetime.` },
  { family: 'diamondsSpent', label: 'Diamonds Spent',
    thresholds: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000],
    desc: (n) => `Spend ${commas(n)} Diamonds over your lifetime.` },

  { family: 'soulsEarned', label: 'Souls Earned',
    thresholds: [1000, 5000, 25000, 100000, 250000, 1000000, 2500000, 10000000, 25000000, 100000000, 250000000],
    desc: (n) => `Earn ${commas(n)} Souls over your lifetime.` },
  { family: 'soulsSpent', label: 'Souls Spent',
    thresholds: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000],
    desc: (n) => `Spend ${commas(n)} Souls over your lifetime.` },

  { family: 'gems', label: 'Gems',
    thresholds: [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000],
    desc: (n) => `Find ${commas(n)} gems over your lifetime.` },
  { family: 'chests', label: 'Chests',
    thresholds: [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000],
    desc: (n) => `Open ${commas(n)} chests over your lifetime.` },
  { family: 'maps', label: 'Maps Cleared',
    thresholds: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000],
    desc: (n) => `Clear ${commas(n)} maps over your lifetime.` },
  { family: 'mapsFound', label: 'Maps Found',
    thresholds: [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000],
    desc: (n) => `Find ${commas(n)} maps over your lifetime.` },
  { family: 'mapsLost', label: 'Maps Lost',
    thresholds: [10, 25, 50, 100, 250, 500, 1000, 2500],
    desc: (n) => `Lose ${commas(n)} maps over your lifetime.` },

  { family: 'kills', label: 'Kills',
    thresholds: [1000, 2500, 10000, 25000, 100000, 250000, 1000000, 2500000, 10000000, 25000000, 100000000],
    desc: (n) => `Kill ${commas(n)} monsters over your lifetime.` },
  { family: 'champions', label: 'Champions',
    thresholds: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000],
    desc: (n) => `Kill ${commas(n)} champion monsters over your lifetime.` },
  { family: 'bosses', label: 'Bosses',
    thresholds: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000],
    desc: (n) => `Kill ${commas(n)} bosses over your lifetime.` },
  { family: 'deaths', label: 'Deaths',
    thresholds: [1, 10, 25, 50, 100, 250, 500, 666, 1000],
    desc: (n) => `Die ${commas(n)} times over your lifetime.` },

  { family: 'levels', label: 'Levels',
    thresholds: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    desc: (n) => `Reach level ${commas(n)}.` },
  { family: 'levelsGained', label: 'Levels Gained',
    thresholds: [25, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 5000],
    desc: (n) => `Gain ${commas(n)} levels over your lifetime.` },
  { family: 'ascensions', label: 'Ascensions',
    thresholds: [1, 2, 3, 5, 10, 20, 30, 42, 50, 75, 100],
    desc: (n) => `Ascend ${commas(n)} times.` },

  { family: 'craft', label: 'Crafting',
    thresholds: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    desc: (n) => `Craft ${commas(n)} items over your lifetime.` },
  { family: 'merchant', label: 'Merchant',
    thresholds: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    desc: (n) => `Buy ${commas(n)} items from the merchant over your lifetime.` },
  { family: 'itemsKept', label: 'Items Kept',
    thresholds: [250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000],
    desc: (n) => `Keep ${commas(n)} items over your lifetime.` },
  { family: 'itemsSold', label: 'Items Sold',
    thresholds: [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000],
    desc: (n) => `Sell ${commas(n)} items over your lifetime.` },
  { family: 'itemsSalvaged', label: 'Items Salvaged',
    thresholds: [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000],
    desc: (n) => `Salvage ${commas(n)} items over your lifetime.` },
  { family: 'oresTraded', label: 'Ores Traded',
    thresholds: [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000],
    desc: (n) => `Trade ${commas(n)} ores at the Refiner over your lifetime.` },

  { family: 'legendaries', label: 'Legendaries',
    thresholds: [5, 10, 25, 50, 100, 250, 500, 1000],
    desc: (n) => `Find ${commas(n)} legendary items.` },
  { family: 'sockets', label: 'Sockets',
    thresholds: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    desc: (n) => `Socket ${commas(n)} gems into gear over your lifetime.` },

  { family: 'timePlayed', label: 'Time Played',
    thresholds: [2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 8760],
    desc: (n) => `Play for ${commas(n)} hours.` },
  { family: 'timeAway', label: 'Time Away',
    thresholds: [10, 24, 50, 100, 250, 500, 1000, 2500, 5000, 8760],
    desc: (n) => `Spend ${commas(n)} hours away from the mine.` },
];

// Each ore's ladder follows how deep it first appears and how heavily it is weighted: copper is everywhere, void crystal
// only turns up past 1000 m and one at a time. Every one is ten steps of the 1–2.5–5 series, starting past what the
// first night digs and ending a thousand times higher.
const ORE_STARTS: Readonly<Record<Material, number>> = {
  copper: 1000, tin: 500, iron: 250, silver: 100, mithril: 100, starsteel: 25, obsidian: 10, voidCrystal: 10,
};
const ORE_STEPS = 10;

/** `steps` values of the 1–2.5–5 series from `start`, which must itself be on the series. */
function oreSeries(start: number, steps: number): number[] {
  const out: number[] = [];
  let decade = 10 ** Math.floor(Math.log10(start));
  while (out.length < steps) {
    for (const m of [1, 2.5, 5]) {
      const v = Math.round(m * decade);
      if (v >= start && out.length < steps) out.push(v);
    }
    decade *= 10;
  }
  return out;
}

const ORE_DEFS: readonly FamilyDef[] = MATERIALS.map((material) => {
  const label = MATERIAL_LABELS[material];
  return {
    family: `ore.${material}`,
    label,
    thresholds: oreSeries(ORE_STARTS[material], ORE_STEPS),
    desc: (n: number) => `Find ${commas(n)} ${label.toLowerCase()} over your lifetime.`,
  };
});

// --------------------------------------------------------------------------------------------------------------------
// Collections. One ladder per set of distinct finds, climbing to the set's full size, so the last step is "every one".
// --------------------------------------------------------------------------------------------------------------------

/** The `steps` below `total`, then `total` itself: a collection's ladder always ends at the full set. */
function stepsTo(total: number, steps: readonly number[]): number[] {
  return [...steps.filter((n) => n < total), total];
}

const LEGENDARY_TIERS = [1, 2, 3, 4, 5] as const;
const legendariesOfTier = (tier: number): string[] => LEGENDARIES.filter((d) => d.tier === tier).map((d) => d.id);
const GEM_PAIRS = GEM_TYPES.length * GEM_GRADES.length;

const COLLECTION_DEFS: readonly FamilyDef[] = [
  { family: 'collection.legendaries', label: 'Legendaries Found',
    thresholds: stepsTo(LEGENDARIES.length, [1, 3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]),
    size: (state) => state.stats.legendariesFound.length,
    desc: (n) => n === LEGENDARIES.length ? 'Find every legendary.' : `Find ${n} different legendaries.` },
  ...LEGENDARY_TIERS.map((tier): FamilyDef => {
    const ids = legendariesOfTier(tier);
    return {
      family: `collection.legendaryTier${tier}`,
      label: `Tier ${tier} Legendaries`,
      thresholds: stepsTo(ids.length, [1, 3, 5, 8, 10, 12]),
      size: (state) => state.stats.legendariesFound.filter((id) => ids.includes(id)).length,
      desc: (n) => n === ids.length ? `Find every tier ${tier} legendary.` : `Find ${n} different tier ${tier} legendaries.`,
    };
  }),
  { family: 'collection.runes', label: 'Runes Found', thresholds: stepsTo(RUNE_TYPES.length, [1, 2, 3, 4, 5, 6, 7, 8, 9]),
    size: (state) => state.stats.runesFound.length,
    desc: (n) => n === RUNE_TYPES.length ? 'Find every rune.' : `Find ${n} different runes.` },
  { family: 'collection.championMods', label: 'Champion Mods Slain', thresholds: stepsTo(CHAMPION_MODS.length, [1, 2, 3, 4, 5]),
    size: (state) => state.stats.championModsKilled.length,
    desc: (n) => n === CHAMPION_MODS.length ? 'Slay a champion with every mod.' : `Slay champions bearing ${n} different mods.` },
  { family: 'collection.specials', label: 'Map Specials Cleared', thresholds: stepsTo(MAP_SPECIALS.length, [1, 2, 3, 4, 5]),
    size: (state) => state.stats.specialsCleared.length,
    desc: (n) => n === MAP_SPECIALS.length ? 'Clear a map of every special.' : `Clear maps of ${n} different specials.` },
  { family: 'collection.gems', label: 'Gems Found', thresholds: stepsTo(GEM_PAIRS, [5, 10, 15, 20]),
    size: (state) => GEM_TYPES.reduce((n, type) => n + GEM_GRADES.filter((grade) => state.stats.gemsFound[type][grade] > 0).length, 0),
    desc: (n) => n === GEM_PAIRS ? 'Find every gem of every grade.' : `Find ${n} different gems, each type and grade counting once.` },
  ...GEM_GRADES.map((grade): FamilyDef => {
    const label = `${grade[0]?.toUpperCase() ?? ''}${grade.slice(1)}`;
    return {
      family: `collection.gemGrade.${grade}`,
      label: `${label} Gems`,
      thresholds: stepsTo(GEM_TYPES.length, [3]),
      size: (state) => GEM_TYPES.filter((type) => state.stats.gemsFound[type][grade] > 0).length,
      desc: (n) => n === GEM_TYPES.length ? `Find a ${grade} gem of every type.` : `Find ${grade} gems of ${n} different types.`,
    };
  }),
  { family: 'collection.dungeons', label: 'Dungeon Types Cleared', thresholds: [5, 10, 25, 50, 100],
    size: (state) => state.stats.dungeonTypesCleared.length,
    desc: (n) => `Clear ${n} different dungeon types in one world.` },
];

const ALL_DEFS: readonly FamilyDef[] = [...FAMILY_DEFS, ...ORE_DEFS, ...COLLECTION_DEFS];

const SIZE_OF: ReadonlyMap<string, (state: GameState) => number> = new Map(
  COLLECTION_DEFS.flatMap((def) => (def.size === undefined ? [] : [[def.family, def.size] as const])),
);

// --------------------------------------------------------------------------------------------------------------------
// Naming. Every achievement gets a hand-written, cookie-clicker-style name — a pun, a phrase or a sentence, never a
// template. The list has more entries than the table, so no two achievements share a name; each is assigned in table
// order (which runs family by family, so the flavour wanders rather than clumps).
// --------------------------------------------------------------------------------------------------------------------
const NAMES: readonly string[] = [
  'Downward Spiral', 'Six Feet Under', 'Hole-y Grail', 'The Long Drop', 'Mole on a Mission', 'Dirt Cheap',
  'Shallow Grave', 'Bedrock Believer', 'Scraping the Bottom', 'Sinking Feeling', 'Down to Earth', 'Buried Alive',
  'The Digger’s Lament', 'Rock and Roll', 'Subterranean Homesick Blues', 'Way Down Hadestown',
  'Pick of Destiny', 'Ground Zero', 'Beneath Notice', 'The Underdark', 'Tunnel Vision', 'A Mine is a Terrible Thing',
  'Down the Rabbit Hole', 'Escape Velocity', 'The Core of the Matter', 'Straight to Bedrock', 'Digging Deep',
  'Below the Belt', 'In Too Deep', 'The Mantle of Responsibility', 'Lithosphere Legend', 'Cave Story',
  'Gilded Age', 'Fool’s Gold', 'Midas Touch', 'Golden Goose', 'Nest Egg', 'Rainy Day Fund', 'Blood Money',
  'Gold Standard', 'The Midas Curse', 'Aurum Est Potestas', 'Glittering Prize', 'All That Glitters',
  'Strike It Rich', 'Nugget of Wisdom', 'The Mother Lode', 'Paydirt Payoff', 'Money Pit', 'Filthy Lucre',
  'Gold Fever', 'Panning Out', 'The Golden Rule', 'Silver Lining', 'Treasure Beyond Measure', 'King of the Hoard',
  'Diamonds Are Forever', 'A Girl’s Best Friend', 'Under Pressure', 'Carbon Copy', 'The Hard Stuff', 'Rock Solid',
  'Gemstone Groove', 'Frozen in Carbonite', 'Clear Cut', 'Facet of Life', 'A Cut Above', 'Pressure Makes Diamonds',
  'Soul Survivor', 'Soul Searching', 'Selling Your Soul', 'Heart and Soul', 'The Soul of the Party', 'Soul Food',
  'Soul Train', 'Soul Proprietor', 'Rest in Pieces', 'A Ghost of a Chance', 'Spirit Guide', 'Soul on Ice',
  'Chest of Drawers', 'Open Sesame', 'Pandora’s Pantry', 'What’s in the Box', 'Loot and Found', 'Box of Delights',
  'The Treasure Chest', 'Prizefighter', 'Unboxing Day', 'Chest in Show', 'A Chest of Goodies', 'Locked and Loaded',
  'Map Quest', 'Cartographer’s Dream', 'Here There Be Dragons', 'You Are Here', 'The Road Less Travelled',
  'Charting the Unknown', 'Atlas Shrugged', 'Fold It In', 'Off the Map', 'Landmark Achievement', 'Wayfinder',
  'Monster Mash', 'Hack and Slash', 'Bug Squasher', 'Pest Control', 'Exterminatus', 'The Killing Floor',
  'Slayer of the Deep', 'Critter Critic', 'A Monster of a Task', 'Whack-a-Mole', 'The Grind', 'Death by a Thousand Cuts',
  'Boss Battle', 'The Big One', 'Overthrowing the Overlord', 'Heavy is the Crown', 'Boss Mode', 'The Final Countdown',
  'Kissed by Death', 'Mortality Check', 'The Grim Reaper’s Quota', 'Death Becomes You', 'Respawning Soon',
  'A Brush with Death', 'The Sixth Life', 'Dead End', 'Lazarus Complex', 'Unlife of the Party',
  'Level Headed', 'XP Marks the Spot', 'Power Leveling', 'The Grindstone', 'Gaining Ground', 'Level Up and Away',
  'The Long Haul', 'Ascension Awaits', 'Born Again', 'Phoenix Rising', 'New Game Plus', 'The Eternal Return',
  'Crafty One', 'The Artisan', 'Hammer and Tongs', 'Forge Ahead', 'Anvil Chorus', 'Forging a Legacy',
  'Masterwork', 'Craftsmanship', 'Measure Twice, Cut Once', 'The Tinkerer', 'Bits and Bobs', 'Junkyard Genius',
  'Shop ’Til You Drop', 'Big Spender', 'Retail Therapy', 'Window Shopper', 'The Customer is Always Right',
  'Impulse Buy', 'A Fool and His Gold', 'Bargain Hunter', 'The Market Wizard', 'Shopping Spree',
  'Keep It Secret, Keep It Safe', 'Hoarder’s Delight', 'Pack Rat', 'Storage Wars', 'A Place for Everything',
  'The Vault', 'Salvage Crew', 'Reduce, Reuse, Recycle', 'One Man’s Trash', 'Scrap Metal', 'Breaking It Down',
  'The Broker', 'Wheeling and Dealing', 'Market Forces', 'Supply and Demand', 'The Exchange', 'Trade Secrets',
  'The Unicorn', 'Legendary Status', 'Once in a Blue Moon', 'Mythical Beast', 'The Chosen One', 'Rarer Than Rare',
  'Socket to Me', 'A Gem of an Idea', 'Cut and Polish', 'Setting the Stone', 'The Jeweler', 'Gem Encrusted',
  'The Longest Day', 'Clockwatcher', 'Time on My Hands', 'Around the Clock', 'The Graveyard Shift', 'Time Flies',
  'Burn the Midnight Oil', 'The Waiting Game', 'Patience of a Saint', 'Hurry Up and Wait', 'Absence Makes the Heart',
  'Gone Fishing', 'Away with the Fairies', 'The Wanderer', 'Out to Lunch', 'Sleeping Giant', 'While You Were Away',
  'Copper Bottomed', 'Tin Man’s Heart', 'Iron Will', 'Silver Tongue', 'Mithril Memory', 'Stargazer',
  'Black Mirror', 'Void Stare', 'Clicker Hero', 'Trigger Happy', 'Manual Labour', 'Sweat Equity', 'Hand Over Fist',
  'Elbow Grease', 'The Old-Fashioned Way', 'By Hand', 'Finger on the Pulse', 'On Autopilot', 'Cruise Control',
  'Set It and Forget It', 'Self-Made', 'The Machine Age', 'Hands-Free', 'The Long Game',
  'Jack of All Trades', 'Diamond in the Rough', 'The Deep End', 'Over the Top', 'The Final Frontier',
  'Through the Looking Glass', 'Down the Drain', 'The Underminer', 'Cave Dweller', 'The Prospector’s Dream',
  'Eureka!', 'The Big Score', 'Windfall', 'The Golden Hour', 'Streets Paved with Gold', 'The Last Mile',
  'Deep Blue', 'The Earth Mover', 'Subterranean', 'The Grubstake', 'Prospecting Fever', 'The Bonanza',
  'Mother Earth', 'The Seam', 'The Shaft', 'The Hoist', 'The Headframe', 'The Winch', 'The Catacombs',
  'The Crypt', 'The Ossuary', 'The Mausoleum', 'The Sepulchre', 'The Ossified Deep', 'The Silent Depths',
  'The Worm’s Turn', 'The Burrower', 'The Tunneler', 'The Sapper', 'The Excavator', 'The Delver', 'The Mole King',
  'The Gopher Prince', 'The Badger Baron', 'The Vole Viceroy', 'The Shrew Sheriff', 'The Groundhog Duke',
  'The Ant Lord', 'The Termite Tsar', 'The Worm Warden', 'The Beetle Boss', 'The Grub Governor', 'The Larva Leader',
  'The Earthworm Emperor', 'The Nightcrawler King', 'The Dung Beetle Duke', 'The Scarab Sovereign',
  'The Chitin Chieftain', 'The Carapace King', 'The Exoskeleton Emperor', 'The Mandible Monarch',
  'The Pincer Prince', 'The Burrow Duke', 'The Den Dweller', 'The Lair Lord', 'The Warren Warden',
  'The Hive Mind', 'The Colony Commander', 'The Swarm Sovereign', 'The Buzzing Baron', 'The Winged Warlord',
  'The Chitin Crown', 'The Amber Age', 'The Bone Bazaar', 'The Skull Market', 'The Relic Row', 'The Fossil Fair',
  'The Gem Guild', 'The Ore Order', 'The Metal Militia', 'The Crystal Cult', 'The Stone Syndicate', 'The Rock Ring',
  'The Cavern Cartel', 'The Tunnels', 'The Underworld', 'The Nether', 'The Deep', 'The Abyss Stares Back',
  'The Void Below', 'The Pit', 'The Gorge', 'The Ravine', 'The Chasm', 'The Crevasse', 'The Fissure', 'The Crack',
  'The Rift', 'The Break', 'The Fault Line', 'The Tectonic Shift', 'The Quake', 'The Tremor', 'The Aftershock',
  'The Landslide', 'The Avalanche', 'The Rockfall', 'The Cave-In', 'The Subsidence', 'The Sinkhole', 'The Erosion',
  'The Weathering', 'The Sediment', 'The Stratum', 'The Layer Cake', 'The Geode', 'The Vug', 'The Pocket',
  'The Paystreak', 'The Placer', 'The Alluvium', 'The Sluice', 'The Pan', 'The Cradle', 'The Rocker Box', 'The Trommel',
  'The Dredge', 'The Long Tom', 'The Gold Bug', 'The Fever Dream', 'The Mirage', 'The Oasis', 'The Fata Morgana',
  'The Fools’ Errand', 'The Wild Goose Chase', 'The Snipe Hunt', 'The Will-o’-the-Wisp', 'The Jack-o’-Lantern',
  'The Lantern Light', 'The Flicker', 'The Glimmer', 'The Glow', 'The Gleam', 'The Glint', 'The Shimmer', 'The Sparkle',
  'The Twinkle', 'The Glitter', 'The Lustre', 'The Sheen', 'The Polish', 'The Buff', 'The Shine', 'The Mirror Finish',
  'The Patina', 'The Tarnish', 'The Verdigris', 'The Rust', 'The Corrosion', 'The Oxidation', 'The Weathered Look',
  'The Worn Path', 'The Beaten Track', 'The Well-Trodden', 'The Beaten Path', 'The Familiar Ground', 'The Known',
  'The Unknown', 'The Uncharted', 'The Unexplored', 'The Undiscovered', 'The Untouched', 'The Virgin Vein',
  'The First Light', 'The Last Light', 'The Dying Light', 'The Dim Light', 'The Faint Glow', 'The Distant Gleam',
  'The Far Below', 'The Way Down', 'The Only Way is Down', 'The Bottom Line', 'The End of the Line', 'The Last Stop',
  'The Terminal', 'The Destination', 'The Journey', 'The Odyssey', 'The Quest', 'The Crusade', 'The Pilgrimage',
  'The Expedition', 'The Voyage', 'The Trek', 'The Hike', 'The Climb', 'The Descent', 'The Fall', 'The Plunge',
  'The Dive', 'The Drop', 'The Tumble', 'The Spiral', 'The Whirlpool', 'The Vortex', 'The Maelstrom', 'The Tempest',
  'The Gale', 'The Zephyr', 'The Breeze', 'The Draft', 'The Current', 'The Tide', 'The Flow', 'The Stream',
  'The River of Gold', 'The River Styx', 'The Lethe', 'The Underworld River', 'The Ferryman', 'The Toll',
  'The Crossing', 'The Passage', 'The Gate', 'The Door', 'The Threshold', 'The Portal', 'The Wormhole', 'The Shortcut',
  'The Long Way Round', 'The Scenic Route', 'The Detour', 'The Side Quest', 'The Main Quest', 'The Endgame',
  'The Post-Game', 'The Victory Lap', 'The Home Stretch', 'The Final Stretch', 'The Last Hurrah', 'The Swan Song',
  'The Grand Finale', 'The Encore', 'The Afterglow', 'The Quiet After', 'The Calm Before', 'The Eye of the Storm',
  'The Still Point', 'The Turning Point', 'The Point of No Return', 'The Pointy End', 'The Sharp End', 'The Shallow Abyss',
  'The Shallow End', 'The Middle Ground', 'The Common Ground', 'The High Ground', 'The Moral High Ground',
  'The Underdog', 'The Dark Horse', 'The Comeback Kid', 'The Late Bloomer', 'The Slow Burn', 'The Overnight Success',
  'The Ten-Year Overnight', 'The Grind Never Stops', 'The Daily Grind', 'The Weekly Grind', 'The Perpetual Grind',
  'The Infinite Grind', 'The Endless Grind', 'The Eternal Grind', 'The Sisyphean Task', 'The Rolling Boulder',
  'The Rock and the Hard Place', 'The Hammer and the Anvil', 'The Sword and the Stone', 'The Pick and the Pan',
  'The Lantern and the Lamp', 'The Map and the Compass', 'The Spade and the Shovel', 'The Cart and the Mule',
  'The Gold and the Glitter', 'The Smoke and the Mirrors', 'The Blood and the Guts', 'The Flesh and the Bone',
  'The Tooth and the Claw', 'The Cloak and the Dagger', 'The Lock and the Key', 'The Chain and the Ball',
  'The Rope and the Pulley', 'The Wheel and the Axle', 'The Lever and the Fulcrum', 'The Incline and the Decline',
  'The Ascent and the Descent', 'The Rise and the Fall', 'The Boom and the Bust', 'The Feast and the Famine',
  'The Give and the Take', 'The Push and the Pull', 'The Rock and the Roll', 'The Shake and the Bake',
  'The Cut and the Thrust', 'The Slash and the Burn', 'The Hit and the Run', 'The Stop and the Drop',
  'The Lock and the Load', 'The Fire and the Forget', 'The Point and the Click', 'The Click and the Clack',
  'The Tick and the Tock', 'The Clickety-Clack', 'The Clickity-Clack', 'The Click-Click-Boom', 'The Clickbait',
  'The Clicker’s Regret', 'The Carpal Tunnel', 'The Wrist of Steel', 'The Finger of Fate', 'The Hand of the King',
  'The Fist of the North Star', 'The Right Hand Man', 'The Left-Handed Compliment', 'The Underhanded Move',
  'The Overhand Swing', 'The Backhanded Compliment', 'The Roundhouse Kick', 'The Haymaker', 'The Uppercut',
  'The One-Two Punch', 'The Knockout Blow', 'The Below-the-Belt Blow', 'The Cheap Shot', 'The Sucker Punch',
  'The Windmill Haymaker', 'The Sunday Punch', 'The Lucky Punch', 'The Rabbit Punch', 'The Hook', 'The Jab', 'The Cross',
  'The Feint', 'The Parry', 'The Riposte', 'The Counter', 'The Clinch', 'The Grapple', 'The Throw', 'The Slam',
  'The Piledriver', 'The Body Slam', 'The Stone Cold Stunner', 'The Tombstone', 'The Chokeslam', 'The Powerbomb',
  'The Moonsault', 'The 450 Splash', 'The Hurricanrana', 'The Frankensteiner', 'The Tope Suicida', 'The Diving Headbutt',
  'The Frog Splash', 'The Five-Star', 'The Shooting Star', 'The Phoenix Splash', 'The Burning Hammer', 'The V-Trigger',
  'The Rainmaker', 'The One-Winged Angel', 'The Destino', 'The Blade Runner', 'The Lariat', 'The Clothesline',
  'The Big Boot', 'The Superkick', 'The Sweet Chin Music', 'The Stunner', 'The Cutter', 'The Diamond Cutter',
  'The RKO', 'The Pedigree', 'The F5', 'The AA', 'The Spear', 'The Spinebuster', 'The Powerbomb', 'The Choke Slam',
  'The Sharpshooter', 'The Figure Four', 'The Ankle Lock', 'The Crossface', 'The Yes Lock', 'The Walls of Jericho',
  'The Liontamer', 'The Boston Crab', 'The Figure-Eight', 'The Texas Cloverleaf', 'The Scorpion Deathlock',
  'The Camel Clutch', 'The Full Nelson', 'The Half Nelson', 'The Sleeper Hold', 'The Rear Naked Choke',
  'The Guillotine', 'The Triangle', 'The Armbar', 'The Kimura', 'The Heel Hook', 'The Toe Hold', 'The Knee Bar',
  'The Straight Ankle', 'The Twister', 'The Gogo', 'The Omoplata', 'The Barata', 'The Banana Split', 'The Calf Slicer',
  'The Crank', 'The Neck Crank', 'The Twister', 'The Can Opener', 'The Pillory', 'The Crucifix', 'The Omoplata',
  'The Gogoplata', 'The Mount', 'The Side Control', 'The Full Mount', 'The Back Mount', 'The North-South',
  'The Turtle', 'The Guard', 'The Half Guard', 'The Butterfly Guard', 'The Spider Guard', 'The Rubber Guard',
  'The De La Riva', 'The X-Guard', 'The Knee Shield', 'The Z-Guard', 'The Deep Half', 'The Lockdown', 'The Electric Chair',
  'The Twister Side', 'The Truck', 'The Banana Split', 'The Cradle', 'The Spladle', 'The Guillotine Choke',
  'The D’Arce', 'The Anaconda', 'The Japanese Necktie', 'The Brabo', 'The Von Flue', 'The Peruvian Necktie',
  'The Loop Choke', 'The Baseball Bat', 'The Ninja Choke', 'The Ezekiel', 'The Clock Choke', 'The Bow and Arrow',
  'The Kata Gatame', 'The Arm Triangle', 'The North-South Choke', 'The Paper Cutter', 'The Buggy Choke',
  'The Gogo Clinch', 'The Head and Arm', 'The Scarf Hold', 'The Kesa Gatame', 'The Kuzure Kesa', 'The Kata Gatame',
  'The Side Choke', 'The Mounted Triangle', 'The Mounted Guillotine', 'The Mounted Armbar', 'The S-Mount',
  'The Gift Wrap', 'The Crucifix', 'The Backpack', 'The Seatbelt', 'The RNC', 'The Short Choke', 'The Long Choke',
  'The Deep Choke', 'The Shallow Choke', 'The Windpipe Crusher', 'The Carotid Crusher', 'The Sleep Inducer',
  'The Dream Weaver', 'The Night Night', 'The Goodnight Kiss', 'The Bedtime Story', 'The Lullaby', 'The Lights Out',
  'The Fade to Black', 'The Long Sleep', 'The Big Sleep', 'The Eternal Slumber', 'The Final Nap', 'The Dirt Nap',
  'The Six-Foot Nap', 'The Restless Nap', 'The Uninterrupted Nap', 'The Power Nap', 'The Cat Nap', 'The Siesta',
  'The Forty Winks', 'The Beauty Sleep', 'The Deep Sleep', 'The REM Cycle', 'The Lucid Dream', 'The Nightmare',
  'The Wet Dream', 'The Pipe Dream', 'The Fever Dream', 'The Daydream', 'The Reverie', 'The Trance', 'The Fugue',
  'The Coma', 'The Stupor', 'The Daze', 'The Haze', 'The Fog', 'The Mist', 'The Smog', 'The Soot', 'The Ash',
  'The Cinder', 'The Ember', 'The Spark', 'The Flame', 'The Blaze', 'The Inferno', 'The Conflagration', 'The Pyre',
  'The Bonfire', 'The Campfire', 'The Hearth', 'The Forge', 'The Furnace', 'The Kiln', 'The Smelter', 'The Crucible',
  'The Foundry', 'The Bloomery', 'The Blast Furnace', 'The Bessemer', 'The Open Hearth', 'The Electric Arc',
  'The Induction', 'The Anneal', 'The Quench', 'The Temper', 'The Hardening', 'The Case Hardening', 'The Carburizing',
  'The Nitriding', 'The Cyaniding', 'The Boriding', 'The Quenching', 'The Tempering', 'The Annealing', 'The Normalizing',
  'The Stress Relief', 'The Aging', 'The Precipitation', 'The Grain Growth', 'The Recrystallization', 'The Work Hardening',
  'The Cold Working', 'The Hot Working', 'The Forging', 'The Rolling', 'The Extrusion', 'The Drawing', 'The Stamping',
  'The Machining', 'The Milling', 'The Turning', 'The Grinding', 'The Polishing', 'The Lapping', 'The Honing',
  'The Buffing', 'The Finishing', 'The Plating', 'The Electroplating', 'The Galvanizing', 'The Anodizing', 'The Passivation',
  'The Bluing', 'The Parkerizing', 'The Phosphating', 'The Powder Coating', 'The Painting', 'The Enameling',
  'The Gilding', 'The Silvering', 'The Tinning', 'The Coppersmithing', 'The Silversmithing', 'The Goldsmithing',
  'The Blacksmithing', 'The Whitesmithing', 'The Tinsmithing', 'The Locksmithing', 'The Gunsmithing', 'The Swordsmithing',
  'The Knife Making', 'The Blade Smithing', 'The Damascening', 'The Pattern Welding', 'The Mokume Gane', 'The Inlay',
  'The Overlay', 'The Cloisonné', 'The Champlevé', 'The Repoussé', 'The Chasing', 'The Engraving', 'The Etching',
  'The Intaglio', 'The Cameo', 'The Relief', 'The Bas-Relief', 'The High Relief', 'The Sculpture', 'The Casting',
  'The Lost Wax', 'The Sand Casting', 'The Investment Casting', 'The Die Casting', 'The Centrifugal Casting',
  'The Continuous Casting', 'The Ingot', 'The Billet', 'The Bloom', 'The Slab', 'The Plate', 'The Sheet', 'The Strip',
  'The Foil', 'The Wire', 'The Rod', 'The Bar', 'The Beam', 'The Girder', 'The Rail', 'The Track', 'The Spike',
  'The Nail', 'The Screw', 'The Bolt', 'The Rivet', 'The Pin', 'The Cotter', 'The Split Pin', 'The Taper Pin',
  'The Dowel', 'The Peg', 'The Wedge', 'The Key', 'The Spline', 'The Broach', 'The Reamer', 'The Tap', 'The Die',
  'The Wrench', 'The Spanner', 'The Socket', 'The Ratchet', 'The Breaker Bar', 'The Torque Wrench', 'The Impact Wrench',
  'The Drill', 'The Hammer Drill', 'The Jackhammer', 'The Chipping Hammer', 'The Rivet Gun', 'The Nail Gun',
  'The Staple Gun', 'The Glue Gun', 'The Caulk Gun', 'The Grease Gun', 'The Paint Gun', 'The Spray Gun', 'The Sandblaster',
  'The Power Washer', 'The Pressure Washer', 'The Steam Cleaner', 'The Angle Grinder', 'The Bench Grinder', 'The Belt Sander',
  'The Orbital Sander', 'The Disc Sander', 'The Drum Sander', 'The Planer', 'The Jointer', 'The Table Saw', 'The Band Saw',
  'The Circular Saw', 'The Jigsaw', 'The Scroll Saw', 'The Reciprocating Saw', 'The Chainsaw', 'The Pole Saw',
  'The Miter Saw', 'The Chop Saw', 'The Radial Arm Saw', 'The Panel Saw', 'The Track Saw', 'The Plunge Saw',
  'The Router', 'The Shaper', 'The Lathe', 'The Mill', 'The Drill Press', 'The Arbor Press', 'The Hydraulic Press',
  'The Forging Press', 'The Punch Press', 'The Stamping Press', 'The Brake Press', 'The Shear', 'The Guillotine Shear',
  'The Nibbler', 'The Notcher', 'The Punch', 'The Die', 'The Mandrel', 'The Chuck', 'The Collet', 'The Arbor',
  'The Spindle', 'The Quill', 'The Headstock', 'The Tailstock', 'The Carriage', 'The Cross Slide', 'The Compound Slide',
  'The Tool Post', 'The Apron', 'The Leadscrew', 'The Feed Rod', 'The Half Nut', 'The Change Gear', 'The Back Gear',
  'The Bull Gear', 'The Cone Pulley', 'The Step Pulley', 'The V-Belt', 'The Flat Belt', 'The Timing Belt', 'The Chain Drive',
  'The Gear Drive', 'The Worm Drive', 'The Bevel Gear', 'The Helical Gear', 'The Spur Gear', 'The Rack and Pinion',
  'The Planetary Gear', 'The Differential', 'The Transmission', 'The Gearbox', 'The Clutch', 'The Torque Converter',
  'The Flywheel', 'The Crankshaft', 'The Camshaft', 'The Piston', 'The Cylinder', 'The Head', 'The Block', 'The Sump',
  'The Oil Pan', 'The Crankcase', 'The Intake', 'The Exhaust', 'The Manifold', 'The Carburetor', 'The Fuel Injection',
  'The Turbocharger', 'The Supercharger', 'The Intercooler', 'The Radiator', 'The Water Pump', 'The Thermostat',
  'The Alternator', 'The Starter Motor', 'The Distributor', 'The Ignition Coil', 'The Spark Plug', 'The Glow Plug',
  'The Fuel Pump', 'The Fuel Filter', 'The Oil Filter', 'The Air Filter', 'The Cabin Filter', 'The Catalytic Converter',
  'The Muffler', 'The Resonator', 'The Exhaust Pipe', 'The Tailpipe', 'The Downpipe', 'The Header', 'The Manifold',
  'The Downpipe', 'The Turbo', 'The Wastegate', 'The Blowoff Valve', 'The Bypass Valve', 'The Intercooler Piping',
  'The Charge Pipe', 'The Cold Air Intake', 'The Short Ram', 'The Long Tube', 'The Cat-Back', 'The Axle-Back',
  'The Straight Pipe', 'The Side Pipe', 'The Lake Pipe', 'The Zoomie', 'The Stack', 'The Chimney', 'The Flue',
  'The Smoke Stack', 'The Smokestack', 'The Exhaust Stack', 'The Cooling Tower', 'The Hyperboloid', 'The Chimney Pot',
  'The Cowl', 'The Cap', 'The Crown', 'The Corbel', 'The Dentil', 'The Frieze', 'The Cornice', 'The Pediment',
  'The Entablature', 'The Architrave', 'The Capital', 'The Column', 'The Pillar', 'The Pilaster', 'The Buttress',
  'The Flying Buttress', 'The Arch', 'The Vault', 'The Dome', 'The Cupola', 'The Lantern', 'The Skylight', 'The Oculus',
  'The Rose Window', 'The Stained Glass', 'The Tracery', 'The Mullion', 'The Transom', 'The Sash', 'The Casement',
  'The Awning', 'The Canopy', 'The Portico', 'The Colonnade', 'The Arcade', 'The Loggia', 'The Veranda', 'The Porch',
  'The Deck', 'The Patio', 'The Terrace', 'The Balcony', 'The Mezzanine', 'The Gallery', 'The Atrium', 'The Courtyard',
  'The Cloister', 'The Quad', 'The Green', 'The Common', 'The Square', 'The Plaza', 'The Esplanade', 'The Promenade',
  'The Boulevard', 'The Avenue', 'The Street', 'The Lane', 'The Alley', 'The Cul-de-Sac', 'The Dead End',
  'The Crossroads', 'The Intersection', 'The Junction', 'The Fork', 'The Branch', 'The Bough', 'The Trunk', 'The Root',
  'The Taproot', 'The Fibrous Root', 'The Hair Root', 'The Rhizome', 'The Tuber', 'The Bulb', 'The Corm', 'The Runner',
  'The Stolon', 'The Sucker', 'The Cutting', 'The Graft', 'The Scion', 'The Rootstock', 'The Sapling', 'The Seedling',
  'The Sprout', 'The Shoot', 'The Twig', 'The Stem', 'The Stalk', 'The Trunk', 'The Bark', 'The Cambium', 'The Sapwood',
  'The Heartwood', 'The Pith', 'The Knot', 'The Burr', 'The Gall', 'The Burl', 'The Crook', 'The Bend', 'The Sweep',
  'The Grain', 'The Figure', 'The Flame', 'The Quilt', 'The Bee’s Wing', 'The Curl', 'The Burl', 'The Spalt',
  'The Rot', 'The Decay', 'The Compost', 'The Humus', 'The Loam', 'The Silt', 'The Clay', 'The Sand', 'The Gravel',
  'The Pebble', 'The Cobble', 'The Boulder', 'The Outcrop', 'The Escarpment', 'The Cliff', 'The Bluff', 'The Crag',
  'The Tor', 'The Peak', 'The Summit', 'The Pinnacle', 'The Apex', 'The Zenith', 'The Acme', 'The Crest', 'The Crown',
  'The Top', 'The Upper Reaches', 'The High Places', 'The Heights', 'The Overlook', 'The Vista', 'The Panorama',
  'The View', 'The Sight', 'The Gaze', 'The Stare', 'The Glare', 'The Squint', 'The Peer', 'The Peek', 'The Glimpse',
  'The Lookout', 'The Watchtower', 'The Beacon', 'The Signal Fire', 'The Lighthouse', 'The Lightkeeper', 'The Keeper',
  'The Warden', 'The Custodian', 'The Caretaker', 'The Steward', 'The Guardian', 'The Sentinel', 'The Watchman',
  'The Lookout', 'The Vigil', 'The Wake', 'The All-Nighter', 'The Night Shift', 'The Early Bird', 'The Worm Getter',
  'The First Light', 'The Dawn Patrol', 'The Sunrise Shift', 'The Daybreak', 'The Morning Glory', 'The Noon Tide',
  'The High Noon', 'The Witching Hour', 'The Midnight Oil', 'The Small Hours', 'The Wee Hours', 'The Dead of Night',
  'The Crack of Dawn', 'The First Watch', 'The Middle Watch', 'The Morning Watch', 'The Dog Watch', 'The Evening Watch',
  'The Night Watch', 'The Graveyard Shift', 'The Swing Shift', 'The Split Shift', 'The Double Shift', 'The Triple Shift',
  'The Overtime', 'The Time and a Half', 'The Double Time', 'The Triple Time', 'The Holiday Pay', 'The Hazard Pay',
  'The Danger Money', 'The Combat Pay', 'The Bounty', 'The Ransom', 'The Reward', 'The Prize', 'The Trophy', 'The Medal',
  'The Ribbon', 'The Badge', 'The Insignia', 'The Crest', 'The Coat of Arms', 'The Standard', 'The Banner', 'The Flag',
  'The Pennant', 'The Streamer', 'The Colours', 'The Battle Flag', 'The War Banner', 'The Standard Bearer', 'The Vexillum',
  'The Gonfalon', 'The Ensign', 'The Jack', 'The Burgee', 'The Pennon', 'The Guidon', 'The Oriflamme', 'The Labarum',
  'The Banner of War', 'The Bloody Flag', 'The Skull and Crossbones', 'The Jolly Roger', 'The Black Flag', 'The White Flag',
  'The Truce', 'The Parley', 'The Surrender', 'The Capitulation', 'The Ceasefire', 'The Armistice', 'The Peace Treaty',
  'The War Trophy', 'The Spoils of War', 'The Plunder', 'The Loot', 'The Booty', 'The Swag', 'The Haul', 'The Take',
  'The Score', 'The Jackpot', 'The Windfall', 'The Bonanza', 'The Motherlode', 'The Big One', 'The Grand Prize',
  'The First Prize', 'The Second Prize', 'The Consolation Prize', 'The Participation Trophy', 'The Runner-Up',
  'The Bronze', 'The Silver', 'The Gold', 'The Platinum', 'The Diamond', 'The Grand Slam', 'The Triple Crown',
  'The Championship', 'The World Title', 'The Belt', 'The Gold Belt', 'The Diamond Belt', 'The Hall of Fame',
  'The Ring of Honor', 'The Walk of Fame', 'The Star on the Walk', 'The Handprint', 'The Autograph', 'The Signed Glove',
  'The Game-Worn Jersey', 'The Winning Goal', 'The Buzzer Beater', 'The Walk-Off', 'The Last-Second Shot',
  'The Overtime Winner', 'The Sudden Death', 'The Golden Goal', 'The Hat Trick', 'The Four-Goal Game', 'The Five-Goal Game',
  'The Perfect Game', 'The No-Hitter', 'The Shutout', 'The Clean Sheet', 'The Goose Egg', 'The Donut', 'The Bagel',
  'The Pancake', 'The Waffle', 'The French Toast', 'The Omelette', 'The Scramble', 'The Over Easy', 'The Sunny Side Up',
  'The Hard Boiled', 'The Soft Boiled', 'The Poached', 'The Fried', 'The Scrambled', 'The Deviled', 'The Pickled',
  'The Smoked', 'The Cured', 'The Salted', 'The Brined', 'The Fermented', 'The Distilled', 'The Brewed', 'The Steeped',
  'The Aged', 'The Cellared', 'The Vintage', 'The Reserve', 'The Small Batch', 'The Single Barrel', 'The Cask Strength',
  'The Barrel Proof', 'The Navy Strength', 'The Overproof', 'The Top Shelf', 'The Well Drink', 'The House Pour',
  'The Call Drink', 'The Premium Pour', 'The Bottom Shelf', 'The Nightcap', 'The Last Call', 'The Happy Hour',
  'The Golden Hour', 'The Blue Hour', 'The Witching Hour', 'The Midnight Hour', 'The Final Hour', 'The Eleventh Hour',
  'The Ninth Inning', 'The Bottom of the Ninth', 'The Two-Minute Warning', 'The Four-Minute Mile', 'The Photo Finish',
  'The Neck and Neck', 'The Nose to Nose', 'The Wire to Wire', 'The From Start to Finish', 'The Gate to Wire',
  'The Start to Finish', 'The Cradle to Grave', 'The Womb to Tomb', 'The Dust to Dust', 'The Ashes to Ashes',
  'The Alpha to Omega', 'The A to Z', 'The Beginning to End', 'The First to Last', 'The Head to Toe', 'The Top to Bottom',
  'The Stem to Stern', 'The Bow to Stern', 'The Port to Starboard', 'The Fore to Aft', 'The Side to Side', 'The End to End',
  'The Up and Down', 'The Back and Forth', 'The To and Fro', 'The Here and There', 'The Now and Then', 'The Then and Now',
  'The Sooner or Later', 'The Sooner the Better', 'The Better Late Than Never', 'The Never Say Never', 'The Never Again',
  'The Once in a Lifetime', 'The Once Upon a Time', 'The Long Ago', 'The Far Away', 'The Way Back When', 'The Good Old Days',
  'The Days of Yore', 'The Times of Old', 'The Ancient Times', 'The Olden Days', 'The Bygone Era', 'The Forgotten Age',
  'The Lost World', 'The Lost City', 'The Lost Mine', 'The Lost Treasure', 'The Lost Gold', 'The Lost Souls',
  'The Lost Cause', 'The Lost Art', 'The Lost Chord', 'The Lost Weekend', 'The Lost and Found', 'The Found and Lost',
  'The Finders Keepers', 'The Losers Weepers', 'The Early Bird', 'The Second Mouse', 'The Worm', 'The Cheese',
  'The Mousetrap', 'The Rat Race', 'The Paper Chase', 'The Wild Goose', 'The Red Herring', 'The Smoke Screen',
  'The Mirror Maze', 'The House of Mirrors', 'The Funhouse', 'The Carnival', 'The Fair', 'The Circus', 'The Big Top',
  'The Sideshow', 'The Freak Show', 'The Main Event', 'The Main Attraction', 'The Headliner', 'The Opening Act',
  'The Warm-Up Act', 'The Encore', 'The Curtain Call', 'The Standing Ovation', 'The Rave Review', 'The Five-Star Review',
  'The Rotten Tomato', 'The Fresh Tomato', 'The Certified Fresh', 'The Cult Classic', 'The Box Office Hit', 'The Blockbuster',
  'The Sleeper Hit', 'The Flop', 'The Bomb', 'The Critic’s Darling', 'The Fan Favorite', 'The Audience Award',
  'The People’s Choice', 'The Jury Prize', 'The Grand Prix', 'The Palme d’Or', 'The Oscar', 'The Golden Globe',
  'The Emmy', 'The Grammy', 'The Tony', 'The Pulitzer', 'The Nobel', 'The Field Medal', 'The Turing Award', 'The EGOT',
  'The Triple Crown', 'The Grand Slam', 'The Perfect Score', 'The Full Marks', 'The Straight A’s', 'The Honor Roll',
  'The Dean’s List', 'The Valedictorian', 'The Salutatorian', 'The Summa Cum Laude', 'The Magna Cum Laude', 'The Cum Laude',
  'The Honor Society', 'The Phi Beta Kappa', 'The Mensa', 'The Genius', 'The Prodigy', 'The Wunderkind', 'The Savant',
  'The Polymath', 'The Renaissance Man', 'The Jack of All Trades', 'The Master of One', 'The Specialist', 'The Generalist',
  'The Expert', 'The Virtuoso', 'The Maestro', 'The Conductor', 'The Composer', 'The Virtuoso', 'The Maestro', 'The Diva',
  'The Prima Donna', 'The Leading Lady', 'The Leading Man', 'The Star', 'The Superstar', 'The Megastar', 'The Legend',
  'The Icon', 'The Idol', 'The Hero', 'The Champion', 'The Victor', 'The Winner', 'The Conqueror', 'The Overcomer',
  'The Triumph', 'The Glory', 'The Fame', 'The Fortune', 'The Riches', 'The Wealth', 'The Treasure', 'The Gold',
  'The Silver', 'The Bronze', 'The Platinum', 'The Diamond', 'The Gem', 'The Jewel', 'The Prize', 'The Reward',
  'The Bounty', 'The Booty', 'The Haul', 'The Take', 'The Score', 'The Jackpot', 'The Windfall', 'The Bonanza',
  'The Motherlode', 'The Big One', 'The Grand Prize', 'The Ultimate Prize', 'The Final Reward', 'The End Reward',
  'The End Goal', 'The Goal', 'The Target', 'The Mark', 'The Bullseye', 'The Center', 'The Core', 'The Heart',
  'The Soul', 'The Essence', 'The Crux', 'The Kernel', 'The Seed', 'The Root', 'The Source', 'The Origin', 'The Beginning',
  'The Start', 'The End', 'The Middle', 'The Beginning of the End', 'The End of the Beginning', 'The Middle of the Road',
  'The Road Less Traveled', 'The High Road', 'The Low Road', 'The Middle Path', 'The Straight and Narrow',
  'The Primrose Path', 'The Garden Path', 'The Warpath', 'The Footpath', 'The Bridle Path', 'The Towpath', 'The Cycle Path',
  'The Bike Path', 'The Walkway', 'The Boardwalk', 'The Esplanade', 'The Promenade', 'The Pier', 'The Dock', 'The Jetty',
  'The Quay', 'The Wharf', 'The Harbor', 'The Port', 'The Marina', 'The Anchorage', 'The Mooring', 'The Berth', 'The Slip',
  'The Dry Dock', 'The Shipyard', 'The Boatyard', 'The Dockyard', 'The Navy Yard', 'The Arsenal', 'The Armory',
  'The Depot', 'The Storehouse', 'The Warehouse', 'The Granary', 'The Silo', 'The Barn', 'The Stable', 'The Livery',
  'The Corral', 'The Paddock', 'The Pasture', 'The Meadow', 'The Field', 'The Prairie', 'The Plain', 'The Steppe',
  'The Savannah', 'The Tundra', 'The Taiga', 'The Forest', 'The Woods', 'The Grove', 'The Thicket', 'The Copse',
  'The Spinney', 'The Covert', 'The Brake', 'The Fen', 'The Marsh', 'The Bog', 'The Swamp', 'The Mire', 'The Quagmire',
  'The Morass', 'The Slough', 'The Bayou', 'The Everglades', 'The Wetland', 'The Floodplain', 'The Delta', 'The Estuary',
  'The Sound', 'The Strait', 'The Channel', 'The Fjord', 'The Inlet', 'The Cove', 'The Bay', 'The Gulf', 'The Bight',
  'The Lagoon', 'The Atoll', 'The Reef', 'The Shoal', 'The Sandbar', 'The Spit', 'The Isthmus', 'The Peninsula',
  'The Cape', 'The Headland', 'The Promontory', 'The Point', 'The Bluff', 'The Cliff', 'The Crag', 'The Precipice',
  'The Ledge', 'The Shelf', 'The Bench', 'The Terrace', 'The Plateau', 'The Mesa', 'The Butte', 'The Pinnacle',
  'The Spire', 'The Steeple', 'The Tower', 'The Keep', 'The Citadel', 'The Fortress', 'The Stronghold', 'The Bastion',
  'The Bulwark', 'The Rampart', 'The Parapet', 'The Battlement', 'The Crenellation', 'The Machicolation', 'The Moat',
  'The Drawbridge', 'The Portcullis', 'The Gatehouse', 'The Barbican', 'The Outer Ward', 'The Inner Ward', 'The Bailey',
  'The Keep', 'The Donjon', 'The Dungeon', 'The Oubliette', 'The Cell', 'The Cage', 'The Pit', 'The Hole', 'The Mine',
  'The Quarry', 'The Pit Mine', 'The Open Pit', 'The Shaft Mine', 'The Drift Mine', 'The Slope Mine', 'The Adit',
  'The Winze', 'The Raise', 'The Stope', 'The Gallery', 'The Tunnel', 'The Drift', 'The Crosscut', 'The Face',
  'The Breast', 'The Longwall', 'The Room and Pillar', 'The Block Caving', 'The Sublevel Caving', 'The Cut and Fill',
  'The Shrinkage Stoping', 'The Open Stoping', 'The Bench Mining', 'The Glory Hole', 'The Tailings', 'The Spoil',
  'The Overburden', 'The Waste Rock', 'The Gangue', 'The Concentrate', 'The Slag', 'The Dross', 'The Matt', 'The Bullion',
  'The Ingot', 'The Dore', 'The Nugget', 'The Flake', 'The Dust', 'The Powder', 'The Fine', 'The Coarse', 'The Medium',
  'The Grade', 'The Ore Body', 'The Vein', 'The Lode', 'The Seam', 'The Reef', 'The Banket', 'The Placer', 'The Alluvium',
  'The Eluvium', 'The Colluvium', 'The Bedrock', 'The Country Rock', 'The Host Rock', 'The Wall Rock', 'The Footwall',
  'The Hanging Wall', 'The Fault', 'The Fissure', 'The Joint', 'The Fracture', 'The Cleavage', 'The Foliation',
  'The Schistosity', 'The Gneissosity', 'The Bedding Plane', 'The Stratification', 'The Lamination', 'The Banding',
  'The Inclusion', 'The Xenolith', 'The Phenocryst', 'The Matrix', 'The Cement', 'The Grain', 'The Crystal', 'The Amygdule',
  'The Vug', 'The Geode', 'The Nodule', 'The Concretion', 'The Druse', 'The Druzy', 'The Cluster', 'The Rosette',
  'The Sunburst', 'The Spray', 'The Fan', 'The Bow', 'The Sheaf', 'The Bundle', 'The Tuft', 'The Clump', 'The Mass',
  'The Lode', 'The Pocket', 'The Bonanza', 'The Jackpot', 'The Big Find', 'The Discovery', 'The Unearthing', 'The Find',
  'The Treasure', 'The Hoard', 'The Stash', 'The Cache', 'The Vault', 'The Safe', 'The Strongbox', 'The Coffer', 'The Chest',
  'The Trunk', 'The Suitcase', 'The Satchel', 'The Rucksack', 'The Knapsack', 'The Pack', 'The Pouch', 'The Purse',
  'The Wallet', 'The Coin Purse', 'The Money Belt', 'The Fanny Pack', 'The Bum Bag', 'The Man Bag', 'The Murse',
  'The Handbag', 'The Clutch', 'The Tote', 'The Duffel', 'The Holdall', 'The Carry-On', 'The Suitcase', 'The Trunk',
  'The Sea Chest', 'The Steamer Trunk', 'The Footlocker', 'The Ammo Crate', 'The Toolbox', 'The Tackle Box', 'The Jewelry Box',
  'The Music Box', 'The Pandora’s Box', 'The Box of Wonders', 'The Box of Tricks', 'The Bag of Tricks', 'The Hat Trick',
  'The Rabbit in the Hat', 'The Sleeve Trick', 'The Card Trick', 'The Vanishing Act', 'The Disappearing Act',
  'The Prestige', 'The Illusion', 'The Sleight of Hand', 'The Misdirection', 'The Smoke and Mirrors', 'The Bait and Switch',
  'The Shell Game', 'The Three-Card Monte', 'The Find the Lady', 'The Confidence Trick', 'The Long Con', 'The Short Con',
  'The Grift', 'The Hustle', 'The Scam', 'The Swindle', 'The Flimflam', 'The Bamboozle', 'The Hoodwink', 'The Hornswoggle',
  'The Shenanigans', 'The Tomfoolery', 'The Skullduggery', 'The Monkey Business', 'The Funny Business', 'The Funny Money',
  'The Counterfeit', 'The Forged', 'The Fake', 'The Phony', 'The Knockoff', 'The Imitation', 'The Replica', 'The Copy',
  'The Duplicate', 'The Clone', 'The Doppelganger', 'The Lookalike', 'The Dead Ringer', 'The Spitting Image',
  'The Chip off the Old Block', 'The Apple of My Eye', 'The Salt of the Earth', 'The Cream of the Crop', 'The Pick of the Litter',
  'The Top of the Heap', 'The Best of the Best', 'The Cream of the Cream', 'The Pick of the Picks', 'The Chosen',
  'The Anointed', 'The Elect', 'The Select', 'The Elite', 'The Best', 'The Greatest', 'The Finest', 'The First Class',
  'The Top Shelf', 'The Upper Crust', 'The High Society', 'The Jet Set', 'The Glitterati', 'The Beautiful People',
  'The In Crowd', 'The A-List', 'The Movers and Shakers', 'The Bigwigs', 'The Big Shots', 'The Heavy Hitters',
  'The Power Players', 'The Kings', 'The Queens', 'The Rulers', 'The Sovereigns', 'The Monarchs', 'The Emperors',
  'The Czars', 'The Tsars', 'The Pharaohs', 'The Sultans', 'The Caliphs', 'The Shahs', 'The Khans', 'The Caesars',
  'The Augustuses', 'The Imperators', 'The Autocrats', 'The Dictators', 'The Tyrants', 'The Overlords', 'The Masters',
  'The Commanders', 'The Chiefs', 'The Chieftains', 'The Warlords', 'The Generals', 'The Admirals', 'The Field Marshals',
  'The Grand Marshals', 'The Supreme Leaders', 'The Great Leaders', 'The Visionaries', 'The Pioneers', 'The Trailblazers',
  'The Explorers', 'The Adventurers', 'The Voyagers', 'The Wanderers', 'The Nomads', 'The Drifters', 'The Hobos',
  'The Vagabonds', 'The Vagrants', 'The Transients', 'The Itinerants', 'The Gypsies', 'The Roamers', 'The Ramblers',
  'The Rovers', 'The Wayfarers', 'The Pilgrims', 'The Seekers', 'The Searchers', 'The Finders', 'The Keepers',
  'The Guardians', 'The Protectors', 'The Defenders', 'The Shield', 'The Wall', 'The Bulwark', 'The Rampart', 'The Bastion',
  'The Fortress', 'The Citadel', 'The Keep', 'The Tower', 'The Spire', 'The Beacon', 'The Lighthouse', 'The Lantern',
  'The Lamp', 'The Light', 'The Glow', 'The Glimmer', 'The Gleam', 'The Spark', 'The Flame', 'The Fire', 'The Blaze',
  'The Inferno', 'The Pyre', 'The Furnace', 'The Forge', 'The Anvil', 'The Hammer', 'The Pick', 'The Pickaxe', 'The Shovel',
  'The Spade', 'The Trowel', 'The Hoe', 'The Mattock', 'The Adze', 'The Axe', 'The Hatchet', 'The Saw', 'The Chisel',
  'The Gouge', 'The Drill', 'The Auger', 'The Gimlet', 'The Bradawl', 'The Awl', 'The Punch', 'The Awl', 'The Needle',
  'The Pin', 'The Staple', 'The Nail', 'The Tack', 'The Brad', 'The Spike', 'The Screw', 'The Bolt', 'The Rivet',
  'The Cotter', 'The Key', 'The Wedge', 'The Shim', 'The Splint', 'The Brace', 'The Strut', 'The Prop', 'The Stanchion',
  'The Post', 'The Pillar', 'The Column', 'The Beam', 'The Girder', 'The Truss', 'The Lintel', 'The Sill', 'The Header',
  'The Footer', 'The Foundation', 'The Footing', 'The Bedrock', 'The Ground', 'The Earth', 'The Soil', 'The Dirt',
  'The Mud', 'The Clay', 'The Loam', 'The Silt', 'The Sand', 'The Gravel', 'The Rock', 'The Stone', 'The Pebble',
  'The Cobble', 'The Boulder', 'The Crag', 'The Cliff', 'The Bluff', 'The Escarpment', 'The Scarp', 'The Slope',
  'The Incline', 'The Grade', 'The Pitch', 'The Fall', 'The Descent', 'The Drop', 'The Plunge', 'The Dive', 'The Leap',
  'The Jump', 'The Hop', 'The Skip', 'The Bound', 'The Vault', 'The Spring', 'The Launch', 'The Takeoff', 'The Liftoff',
  'The Ascent', 'The Climb', 'The Rise', 'The Summit', 'The Peak', 'The Top', 'The Crown', 'The Apex', 'The Pinnacle',
  'The Zenith', 'The Acme', 'The High Point', 'The Climax', 'The Crescendo', 'The Peak', 'The Apex', 'The Summit',
  'The Top of the World', 'The Roof of the World', 'The Highest Point', 'The Pinnacle of Achievement', 'The Peak Performance',
  'The Apex Predator', 'The Top Dog', 'The Big Cheese', 'The Head Honcho', 'The Kingpin', 'The Big Kahuna', 'The Big Enchilada',
  'The Head Cheese', 'The Main Man', 'The Top Banana', 'The Top Brass', 'The Big Cheese', 'The Head Cheese', 'The Big Wheel',
  'The Big Fish', 'The Big Gun', 'The Big Shot', 'The Big Wig', 'The Big Deal', 'The Real Deal', 'The Real McCoy',
  'The Genuine Article', 'The Real Thing', 'The Best Thing', 'The Next Big Thing', 'The Latest Thing', 'The New Thing',
  'The Old Thing', 'The Same Old Thing', 'The Whole Thing', 'The Everything', 'The All', 'The Whole Shebang', 'The Whole Nine Yards',
  'The Full Monty', 'The Works', 'The Whole Enchilada', 'The Whole Kit and Kaboodle', 'The Whole Ball of Wax',
  'The Whole Shooting Match', 'The Whole Megillah', 'The Full Package', 'The Complete Set', 'The Full House',
  'The Royal Flush', 'The Straight Flush', 'The Four of a Kind', 'The Full Boat', 'The Flush', 'The Straight', 'The Three of a Kind',
  'The Two Pair', 'The Pair', 'The High Card', 'The Low Card', 'The Wild Card', 'The Trump Card', 'The Ace in the Hole',
  'The Ace up the Sleeve', 'The Hole Card', 'The Joker', 'The Wildcard', 'The Unknown Quantity', 'The X-Factor',
  'The Dark Horse', 'The Underdog', 'The Long Shot', 'The Outside Bet', 'The Hail Mary', 'The Last Resort', 'The Last Ditch',
  'The Final Gambit', 'The Desperate Measure', 'The Do-or-Die', 'The All-or-Nothing', 'The Winner-Take-All', 'The Zero-Sum',
  'The Sink or Swim', 'The Do or Die', 'The Make or Break', 'The Boom or Bust', 'The Feat or Famine', 'The High Stakes',
  'The No Limits', 'The All In', 'The Betting the Farm', 'The Going for Broke', 'The Burning the Ships', 'The Crossing the Rubicon',
  'The Point of No Return', 'The Moment of Truth', 'The Zero Hour', 'The H-Hour', 'The D-Day', 'The Judgment Day',
  'The Reckoning', 'The Showdown', 'The Standoff', 'The Duel', 'The Face-Off', 'The Match', 'The Contest', 'The Competition',
  'The Tournament', 'The Championship', 'The Finals', 'The Semifinals', 'The Quarterfinals', 'The Playoffs', 'The Season',
  'The Series', 'The Sweep', 'The Upset', 'The Cinderella Story', 'The Underdog Story', 'The Comeback', 'The Miracle',
  'The Miracle on Ice', 'The Impossible Dream', 'The Dream Come True', 'The Dream Team', 'The Super Team', 'The Dynasty',
  'The Reign', 'The Era', 'The Golden Age', 'The Silver Age', 'The Bronze Age', 'The Iron Age', 'The Stone Age',
  'The Copper Age', 'The Tin Age', 'The Mithril Age', 'The Starsteel Age', 'The Obsidian Age', 'The Void Age',
  'The Age of Gold', 'The Age of Wonders', 'The Age of Heroes', 'The Age of Legends', 'The Age of Myth', 'The Age of Fable',
  'The Age of Reason', 'The Age of Enlightenment', 'The Age of Discovery', 'The Age of Exploration', 'The Age of Industry',
  'The Age of Steam', 'The Age of Iron', 'The Age of Steel', 'The Age of Information', 'The Age of the Geek',
  'The Age of the Nerd', 'The Age of the Clicker', 'The Age of the Grind', 'The Age of the Mine', 'The Age of the Deep',
  'The Age of the Dark', 'The Age of the Light', 'The Age of the Flame', 'The Age of the Forge', 'The Age of the Anvil',
  'The Age of the Hammer', 'The Age of the Pick', 'The Age of the Shovel', 'The Age of the Spade', 'The Age of the Digger',
  'Gotta Dig ’Em All', 'Completionist’s Curse', 'Cabinet of Curiosities', 'Show and Tell', 'The Full Set', 'Mint in Box', 'Mostly Complete', 'Shelf Life', 'Checklist Cleared', 'One of Each, Please',
];

/** The name for the `index`-th achievement: the `index`-th name, wrapping only past the list's end. */
function funkyName(index: number): string {
  return NAMES[index % NAMES.length] ?? `Achievement ${index}`;
}

/** What happened, for the feats to judge: each is offered right after the counters it concerns moved. */
export type FeatEvent =
  | { kind: 'runEnd'; run: MapRun; result: RunResult }
  | { kind: 'kill'; run: MapRun; monster: MonsterState }
  | { kind: 'click'; paused: boolean }
  | { kind: 'metre'; depth: number }
  | { kind: 'sell'; item: Item }
  | { kind: 'salvage'; item: Item }
  | { kind: 'rename'; name: string };

/**
 * A single deed (a feat, or a hidden one shown as "???" until earned). `test` only reads: it never draws from `state.rng`
 * or any other stream and never changes the state, so a feat can neither shift a seeded world nor be earned twice.
 */
export interface FeatDef {
  id: string; family: string; kind: 'feat' | 'hidden'; name: string; desc: string;
  on: FeatEvent['kind'];
  test: (state: GameState, event: FeatEvent) => boolean;
}

// --------------------------------------------------------------------------------------------------------------------
// Feats. Each is one deed judged from the event it waits for, never from a counter, and each predicate only reads the
// state and the event. Most come in tiers, one per gate (5, 10, … 100): a gate feat asks for that gate itself, the rest
// for a map of that tier or higher, so one clear high up also counts for every tier below it. Every clear feat asks for
// a run that ended cleared, so dying or leaving never counts, however it went. Names are hand-written, one per tier.
// --------------------------------------------------------------------------------------------------------------------

/** A feat family as the tab groups it: its label and its icon. */
interface FeatFamilyDef { family: string; label: string; icon: IconGlyphId }

type RunEnd = Extract<FeatEvent, { kind: 'runEnd' }>;

/** The highest gate the tiered feats reach; the gates go on past it, the feats do not. */
const TOP_FEAT_GATE = 100;
const GATE_TIERS: readonly number[] = Array.from({ length: TOP_FEAT_GATE / GATE_EVERY }, (_, i) => (i + 1) * GATE_EVERY);
/** The gate pairs by their upper tier (10, 20, … 100): each pair holds one physical and one elemental wall. */
const GATE_PAIRS: readonly number[] = GATE_TIERS.filter((_, i) => i % 2 === 1);
/**
 * The depths an old pickaxe is carried to: no pickaxe worn at any metre of the run (the high-water mark, which never
 * falls) may be above a thousandth of the depth in item level, so taking the pickaxe off for the last metre earns nothing.
 */
const OLD_PICK_DEPTHS: readonly number[] = [1000, 2500, 5000, 10000, 15000, 20000, 25000, 50000, 75000, 100000];
const oldPickLevel = (depth: number): number => Math.floor(depth / 1000);
/** The seconds a boss rush allows from the boss room's start: 2 up to tier 25, one more each 25 tiers above. */
const bossRushSeconds = (tier: number): number => 2 + Math.floor((tier - 1) / 25);
const CHAMPION_PACKS: readonly number[] = [4, 5, 6, 7];

/** A run that ended cleared: dying or leaving never counts as a clear. */
const clearedRun = (e: FeatEvent): e is RunEnd => e.kind === 'runEnd' && e.result.outcome === 'cleared';
const clearedAtLeast = (e: FeatEvent, tier: number): e is RunEnd => clearedRun(e) && e.run.map.tier >= tier;

// The lowest life of a run as a share of max life, worked out once per event however many feats ask.
const lifeShares = new WeakMap<FeatEvent, number>();
function lifeShare(state: GameState, e: RunEnd): number {
  let share = lifeShares.get(e);
  if (share === undefined) {
    share = e.run.minLife / deriveBattleStats(state).maxLife;
    lifeShares.set(e, share);
  }
  return share;
}

// A cleared map killed every champion of its layout: their count and the distinct mods they carried, once per event.
const packs = new WeakMap<FeatEvent, { champions: number; mods: number }>();
function championsOf(state: GameState, e: RunEnd): { champions: number; mods: number } {
  let pack = packs.get(e);
  if (pack === undefined) {
    const champions = dungeonLayout(state.seed, e.run.map).rooms.flat().filter((m) => m.rank === 'champion');
    pack = { champions: champions.length, mods: new Set(champions.flatMap((m) => m.mods)).size };
    packs.set(e, pack);
  }
  return pack;
}

/** The build handicaps the clear feats ask for, as the state stands: read when a run starts and again when it ends. */
export function runHandicaps(state: GameState): RunHandicaps {
  const gear = BATTLE_SLOTS.map((slot) => state.equipped.battle[slot]);
  return {
    emptySlot: gear.some((item) => item === undefined),
    plainGear: gear.every((item) => item?.rarity === 'normal'),
    noBattleGear: gear.every((item) => item === undefined),
    noPassives: state.passives.allocated.length === 0,
  };
}

/** A clear of tier `tier` or higher whose run began with the handicap and still has it at the end. */
const clearedWith = (state: GameState, e: FeatEvent, tier: number, handicap: keyof RunHandicaps): e is RunEnd =>
  clearedAtLeast(e, tier) && e.run.startedWith[handicap] && runHandicaps(state)[handicap];

const FEAT_FAMILIES = {
  gateFirstTry: { family: 'feat.gateFirstTry', label: 'First-Try Gates', icon: 'vanguard' },
  physicalWall: { family: 'feat.physicalWall', label: 'Physical Walls', icon: 'bulwark' },
  elementalWall: { family: 'feat.elementalWall', label: 'Elemental Walls', icon: 'soulWarden' },
  gateComposed: { family: 'feat.gateComposed', label: 'Composed Gates', icon: 'careful' },
  clutch: { family: 'feat.clutch', label: 'Clutch Clears', icon: 'heart' },
  flawless: { family: 'feat.flawless', label: 'Flawless Clears', icon: 'sureFooting' },
  bossRush: { family: 'feat.bossRush', label: 'Boss Rush', icon: 'berserker' },
  emptySlot: { family: 'feat.emptySlot', label: 'Missing Pieces', icon: 'allOrNothing' },
  plainGear: { family: 'feat.plainGear', label: 'Plain Gear', icon: 'steadyHands' },
  fullyModded: { family: 'feat.fullyModded', label: 'Fully Modded', icon: 'worldAtlas' },
  underlevel: { family: 'feat.underlevel', label: 'Punching Up', icon: 'gladiator' },
  unskilled: { family: 'feat.unskilled', label: 'No Passives', icon: 'passivePoints' },
  championPack: { family: 'feat.championPack', label: 'Champion Packs', icon: 'reckoner' },
  oldPick: { family: 'feat.oldPick', label: 'Old Pickaxe', icon: 'deepMiner' },
  secret: { family: 'secret', label: 'Secrets', icon: 'thirdEye' },
} as const satisfies Record<string, FeatFamilyDef>;

/** One feat per tier of `def`, its id `<family>.<tier>`, named in tier order. */
function tiered(
  def: FeatFamilyDef, tiers: readonly number[], names: readonly string[], on: FeatEvent['kind'],
  desc: (tier: number) => string, test: (tier: number, state: GameState, e: FeatEvent) => boolean,
): FeatDef[] {
  return tiers.map((tier, i) => ({
    id: `${def.family}.${tier}`, family: def.family, kind: 'feat', name: names[i] ?? '', desc: desc(tier), on,
    test: (state, e) => test(tier, state, e),
  }));
}

/** A hidden achievement: shown as "???" until earned. */
function secret(slug: string, name: string, desc: string, on: FeatEvent['kind'], test: FeatDef['test']): FeatDef {
  return { id: `secret.${slug}`, family: FEAT_FAMILIES.secret.family, kind: 'hidden', name, desc, on, test };
}

const killedChampionWith = (e: FeatEvent, a: ChampionMod, b: ChampionMod): boolean =>
  e.kind === 'kill' && e.monster.rank === 'champion' && e.monster.mods.includes(a) && e.monster.mods.includes(b);
const renamedTo = (e: FeatEvent, name: string): boolean => e.kind === 'rename' && e.name.trim().toLowerCase() === name;
/** A legendary sold or salvaged (each secret waits only for its own event kind). */
const soldLegendary = (e: FeatEvent): boolean =>
  (e.kind === 'sell' || e.kind === 'salvage') && isGear(e.item) && e.item.rarity === 'legendary';

/** Every feat and hidden achievement. */
const FEATS: readonly FeatDef[] = [
  ...tiered(FEAT_FAMILIES.gateFirstTry, GATE_TIERS, [
    'Knock Knock', 'Beginner’s Luck', 'First Time’s the Charm', 'No Second Takes', 'One and Done', 'Got It in One',
    'Hole in One', 'Ace of Gates', 'Clean Break', 'Sight Unseen', 'Right First Time', 'Cold Open', 'Walk-In',
    'No Rehearsal', 'Opening Night', 'Unrehearsed', 'Flawless Debut', 'Natural Talent', 'One-Take Wonder',
    'First Impressions',
  ], 'runEnd', (t) => `Clear the tier ${t} gate on your first attempt at it.`,
  (t, state, e) => clearedRun(e) && e.run.map.tier === t && state.stats.gatesFirstTry.includes(t)),

  ...tiered(FEAT_FAMILIES.physicalWall, GATE_PAIRS, [
    'Brick by Brick', 'Stonewalled', 'Wrecking Ball', 'Battering Ram', 'Tear Down This Wall', 'Siege Engine',
    'Through the Wall', 'Hard Knocks', 'Wallbreaker', 'Another Brick Gone',
  ], 'runEnd', (t) => `Clear whichever of the tier ${t - GATE_EVERY} and tier ${t} gates has the physical wall.`,
  (t, state, e) => clearedRun(e) && (e.run.map.tier === t || e.run.map.tier === t - GATE_EVERY)
    && gateWall(state.seed, e.run.map.tier) === 'physical'),

  ...tiered(FEAT_FAMILIES.elementalWall, GATE_PAIRS, [
    'Weather the Storm', 'Fire Walk', 'Cold Shoulder', 'Lightning Rod', 'Grounded', 'Insulated',
    'Elemental, My Dear', 'Storm Chaser', 'Eye of the Hurricane', 'Force of Nature',
  ], 'runEnd', (t) => `Clear whichever of the tier ${t - GATE_EVERY} and tier ${t} gates has the elemental wall.`,
  (t, state, e) => clearedRun(e) && (e.run.map.tier === t || e.run.map.tier === t - GATE_EVERY)
    && gateWall(state.seed, e.run.map.tier) === 'elemental'),

  ...tiered(FEAT_FAMILIES.gateComposed, GATE_TIERS, [
    'Cool Customer', 'Calm and Collected', 'Keep Calm and Dig On', 'Composure', 'Steady Nerves', 'Ice in the Veins',
    'Unflappable', 'Poker Face', 'Half Full', 'Sang-Froid', 'Stiff Upper Lip', 'Unbothered', 'Easy Does It',
    'Zen Garden', 'Measured Response', 'Nerves of Steel', 'Grace Under Fire', 'Cool as a Cucumber', 'Serenity Now',
    'Not Even Sweating',
  ], 'runEnd', (t) => `Clear the tier ${t} gate without dropping below half your life.`,
  (t, state, e) => clearedRun(e) && e.run.map.tier === t && lifeShare(state, e) >= 0.5),

  ...tiered(FEAT_FAMILIES.clutch, GATE_TIERS, [
    'Clutch', 'By the Skin of Your Teeth', 'Close Shave', 'Nail-Biter', 'Hanging On', 'White Knuckles',
    'Down to the Wire', 'Last Legs', 'Living Dangerously', 'Narrow Escape', 'On a Knife’s Edge', 'Barely Standing',
    'Running on Fumes', 'Cheating Death', 'Near-Death Experience', 'Knocking on Death’s Door', 'Not Today',
    'Just a Flesh Wound', 'Tis But a Scratch', 'Still Standing',
  ], 'runEnd', (t) => `Clear a map of tier ${t} or higher after dropping below 10% of your life.`,
  (t, state, e) => clearedAtLeast(e, t) && lifeShare(state, e) < 0.1),

  ...tiered(FEAT_FAMILIES.flawless, GATE_TIERS, [
    'Untouchable', 'Not a Hair Out of Place', 'Barely a Scratch', 'Clean Hands', 'Pristine', 'Spotless',
    'Mint Condition', 'Showroom Shine', 'Textbook', 'Picture Perfect', 'Unscathed', 'Teflon Miner', 'Bulletproof',
    'Float Like a Butterfly', 'Dodge This', 'Can’t Touch This', 'Ghost Run', 'Immaculate', 'Without a Trace',
    'Perfectionist',
  ], 'runEnd', (t) => `Clear a map of tier ${t} or higher without dropping below 90% of your life.`,
  (t, state, e) => clearedAtLeast(e, t) && lifeShare(state, e) >= 0.9),

  ...tiered(FEAT_FAMILIES.bossRush, GATE_TIERS, [
    'Boss Rush', 'Speed Dating', 'Hostile Takeover', 'Pink Slip', 'You’re Fired', 'Quick Draw', 'Blink and Miss It',
    'Express Delivery', 'Short Notice', 'Layoffs', 'Early Retirement', 'Downsized', 'Corporate Restructuring',
    'Severance Package', 'Board Meeting', 'Coup d’État', 'Regime Change', 'Executive Decision', 'Lightning Round',
    'Headhunter',
  ], 'runEnd', (t) => `Clear a map of tier ${t} or higher with its boss room won within ${bossRushSeconds(t)} seconds.`,
  (t, _state, e) => clearedAtLeast(e, t) && e.run.bossSinceS !== undefined
    && e.run.elapsedS - e.run.bossSinceS <= bossRushSeconds(t)),

  ...tiered(FEAT_FAMILIES.emptySlot, GATE_TIERS, [
    'Something Missing', 'Travelling Light', 'Odd Sock', 'One Glove Short', 'Minimalist', 'Less is More',
    'Half-Dressed', 'Bare Essentials', 'Spare Slot', 'Underdressed', 'Wardrobe Malfunction', 'Forgot Something',
    'Packed Light', 'Missing Link', 'Hole in the Plan', 'Gap Year', 'Empty-Handed', 'Who Needs Rings',
    'Capsule Wardrobe', 'Ultralight',
  ], 'runEnd', (t) => `Clear a map of tier ${t} or higher with a battle gear slot left empty from start to finish.`,
  (t, state, e) => clearedWith(state, e, t, 'emptySlot')),

  ...tiered(FEAT_FAMILIES.plainGear, GATE_TIERS, [
    'Plain Jane', 'Off the Rack', 'No Frills', 'Vanilla', 'Basic Training', 'Generic Brand', 'Bargain Bin',
    'Hand-Me-Downs', 'Standard Issue', 'Plain and Simple', 'Unremarkable', 'Charity Shop Chic', 'Common Sense',
    'Utilitarian', 'Ordinary Joe', 'No Name Brand', 'Factory Settings', 'Stock Parts', 'Unenchanted',
    'Humble Means',
  ], 'runEnd', (t) => `Clear a map of tier ${t} or higher with normal-rarity gear in every battle slot from start to finish.`,
  (t, state, e) => clearedWith(state, e, t, 'plainGear')),

  ...tiered(FEAT_FAMILIES.fullyModded, GATE_TIERS, [
    'Glutton for Punishment', 'Maxed Out', 'All the Trimmings', 'Hard Mode', 'Extra Spicy', 'Hot Sauce',
    'Ghost Pepper', 'Carolina Reaper', 'Everything Bagel', 'Kitchen Sink', 'Deluxe Edition', 'Loaded Fries',
    'Supersized', 'Masochist', 'Nightmare Mode', 'Ironman Mode', 'Hell Week', 'The Works, Twice', 'Nothing Left to Add',
    'Fully Loaded',
  ], 'runEnd', (t) => `Clear a map of tier ${t} or higher carrying all ${MAP_MOD_KINDS.length} kinds of modifier.`,
  (t, _state, e) => clearedAtLeast(e, t) && MAP_MOD_KINDS.every((kind) => e.run.map.mods.some((m) => m.kind === kind))),

  ...tiered(FEAT_FAMILIES.underlevel, GATE_TIERS, [
    'Punching Up', 'David and Goliath', 'Small but Mighty', 'Precocious', 'Child Prodigy', 'Ahead of the Curve',
    'Skipping Grades', 'Overachiever', 'Too Young for This', 'Fast Learner', 'Early Bloomer', 'Wise Beyond Your Years',
    'Little Big Miner', 'Fun-Sized', 'Out of Your League', 'Above Your Station', 'Giant Slayer', 'Overreach',
    'Bantamweight', 'The Kid Has Talent',
  ], 'runEnd', (t) => `Clear a map of tier ${t} or higher while below level ${t}.`,
  (t, state, e) => clearedAtLeast(e, t) && state.level < t),

  ...tiered(FEAT_FAMILIES.unskilled, GATE_TIERS, [
    'Unskilled Labour', 'Raw Talent', 'Self-Taught', 'Unschooled', 'No Tricks', 'Hold My Points', 'Saving for Later',
    'Points Hoarder', 'Natural Ability', 'Blank Slate', 'Tabula Rasa', 'Untrained', 'Street Smarts', 'Just Muscle',
    'Who Needs Skills', 'No Talent Required', 'Doing It the Hard Way', 'Bare Bones', 'Purist', 'Do It Yourself',
  ], 'runEnd', (t) => `Clear a map of tier ${t} or higher with no passive skill allocated from start to finish.`,
  (t, state, e) => clearedWith(state, e, t, 'noPassives')),

  ...tiered(FEAT_FAMILIES.championPack, CHAMPION_PACKS, ['Pack Hunter', 'Champion Sweep', 'Rogues’ Gallery', 'Seven Samurai'],
    'runEnd', (n) => `Clear a map holding ${n} or more champions.`,
    (n, state, e) => clearedRun(e) && championsOf(state, e).champions >= n),
  {
    id: `${FEAT_FAMILIES.championPack.family}.allMods`, family: FEAT_FAMILIES.championPack.family, kind: 'feat',
    name: 'Mod Squad', desc: `Clear a map whose champions carry all ${CHAMPION_MODS.length} champion mods between them.`,
    on: 'runEnd', test: (state, e) => clearedRun(e) && championsOf(state, e).mods >= CHAMPION_MODS.length,
  },

  ...tiered(FEAT_FAMILIES.oldPick, OLD_PICK_DEPTHS, [
    'Old Faithful', 'Trusty Rusty', 'If It Ain’t Broke', 'Vintage Tools', 'Grandpa’s Pickaxe', 'Heirloom',
    'Sentimental Value', 'Antiques Roadshow', 'Museum Piece', 'Relic of the Deep',
  ], 'metre', (d) => `Reach ${commas(d)} metres with no pickaxe above item level ${oldPickLevel(d)}.`,
  (d, state, e) => e.kind === 'metre' && e.depth >= d && state.pickaxeHighWater <= oldPickLevel(d)),

  // The secrets: harmless jokes, each a surprise. None asks for a regret, a deleted save or time away past the cap.
  secret('hello', 'Is This Thing On?', 'Click the miner 100 times while the game is paused.', 'click',
    (state, e) => e.kind === 'click' && e.paused && state.stats.clicksPaused >= 100),
  secret('stillThere', 'Are You Still There?', 'Click the miner 1,000 times while the game is paused.', 'click',
    (state, e) => e.kind === 'click' && e.paused && state.stats.clicksPaused >= 1000),
  secret('luckySevens', 'Lucky Sevens', 'Reach a depth of 7,777 metres.', 'metre', (_state, e) => e.kind === 'metre' && e.depth >= 7777),
  secret('over9000', 'It’s Over Nine Thousand', 'Reach a depth of 9,001 metres.', 'metre',
    (_state, e) => e.kind === 'metre' && e.depth >= 9001),
  secret('inTheDark', 'Who Turned Off the Lights?', 'Dig past 2,500 metres with no lamp.', 'metre',
    (state, e) => e.kind === 'metre' && e.depth >= 2500 && state.equipped.mining.lamp === undefined),
  secret('bareHands', 'Look, No Pickaxe', 'Dig past 1,000 metres with no pickaxe.', 'metre',
    (state, e) => e.kind === 'metre' && e.depth >= 1000 && state.equipped.mining.pickaxe === undefined),
  secret('handsOff', 'Hands-Off Management', 'Reach 1,000 metres without ever clicking the miner.', 'metre',
    (state, e) => e.kind === 'metre' && e.depth >= 1000 && state.stats.clicks === 0),
  secret('sellLegendary', 'Legend for Sale', 'Sell a legendary item.', 'sell', (_state, e) => soldLegendary(e)),
  secret('salvageLegendary', 'Sacrilege', 'Salvage a legendary item.', 'salvage', (_state, e) => soldLegendary(e)),
  secret('sellMap', 'Real Estate Agent', 'Sell a map.', 'sell', (_state, e) => e.kind === 'sell' && e.item.type === 'map'),
  secret('garageSale', 'Garage Sale', 'Sell a piece of item level 1 gear.', 'sell',
    (_state, e) => e.kind === 'sell' && isGear(e.item) && e.item.ilvl === 1),
  secret('sunburntVampire', 'Sunburnt Vampire', 'Kill a champion that is both vampiric and fire-touched.', 'kill',
    (_state, e) => killedChampionWith(e, 'vampiric', 'fireTouched')),
  secret('toughNut', 'Tough Nut to Crack', 'Kill a champion that is both armored and thick-skinned.', 'kill',
    (_state, e) => killedChampionWith(e, 'armored', 'thickSkinned')),
  secret('fastAndFurious', 'Fast and Furious', 'Kill a champion that is both swift and brutal.', 'kill',
    (_state, e) => killedChampionWith(e, 'swift', 'brutal')),
  secret('kraken', 'Release the Kraken', 'Clear a map after Kraken Leather saved you from a killing blow.', 'runEnd',
    (_state, e) => clearedRun(e) && e.run.saved === true),
  // A tier-1 map cannot kill a level-50 miner even naked, so the humbling death is any map 50 tiers below the level.
  secret('humbled', 'Humble Pie', 'Die in a map while your level is at least 50 above its tier.', 'runEnd',
    (state, e) => e.kind === 'runEnd' && e.result.outcome === 'died' && state.level >= e.run.map.tier + 50),
  secret('bully', 'Picking on the Little Ones', `Clear a tier 1 map at level ${LEVEL_CAP}.`, 'runEnd',
    (state, e) => clearedRun(e) && e.run.map.tier === 1 && state.level >= LEVEL_CAP),
  secret('soClose', 'So Close, Yet So Far', 'Die in a boss room with the boss below 10% of its life.', 'runEnd',
    (_state, e) => e.kind === 'runEnd' && e.result.outcome === 'died' && e.run.room === e.run.bossRoom
      && e.run.queue.some((m) => m.rank === 'boss' && m.life < 0.1 * m.maxLife)),
  secret('wrongDoor', 'Wrong Door', 'Leave a map before killing a single monster in it.', 'runEnd',
    (_state, e) => e.kind === 'runEnd' && e.result.outcome === 'left' && e.run.room === 1 && e.run.gained.xp === 0),
  secret('tenthTime', 'Tenth Time Lucky', 'Clear a gate on your tenth attempt at it or later.', 'runEnd',
    (_state, e) => clearedRun(e) && e.run.attempt >= 10),
  secret('headMeetWall', 'Head, Meet Wall', 'Take on the same gate 25 times.', 'runEnd',
    (_state, e) => e.kind === 'runEnd' && e.run.attempt >= 25),
  secret('naked', 'Naked and Unafraid', 'Clear a map of tier 5 or higher with no battle gear at all, start to finish.', 'runEnd',
    (state, e) => clearedWith(state, e, 5, 'noBattleGear')),
  secret('speedBump', 'Speed Bump', 'Die in the first room of a gate.', 'runEnd',
    (_state, e) => e.kind === 'runEnd' && e.result.outcome === 'died' && isGateTier(e.run.map.tier) && e.run.room === 1),
  secret('growthSpurt', 'Growth Spurt', 'Clear a map, gaining 10 levels in it.', 'runEnd',
    (_state, e) => clearedRun(e) && e.run.gained.levels >= 10),
  secret('asleep', 'Asleep at the Wheel', 'Die in a map while the game is paused.', 'runEnd',
    (state, e) => e.kind === 'runEnd' && e.result.outcome === 'died' && state.paused),
  secret('goldenMiner', 'Self-Titled', 'Name your miner Golden Miner.', 'rename', (_state, e) => renamedTo(e, 'golden miner')),
  secret('steve', 'Wrong Game', 'Name your miner Steve.', 'rename', (_state, e) => renamedTo(e, 'steve')),
  secret('sisyphus', 'One Must Imagine Him Happy', 'Name your miner Sisyphus.', 'rename', (_state, e) => renamedTo(e, 'sisyphus')),
];

/** The full table: the generated ladders and collections (families × thresholds, each with a unique funky name and `<family>.<value>` id), then the feats and secrets. */
export const ACHIEVEMENTS: readonly AchievementDef[] = (() => {
  const out: AchievementDef[] = [];
  let index = 0;
  for (const def of ALL_DEFS) {
    for (const value of def.thresholds) {
      out.push({
        id: `${def.family}.${value}`,
        family: def.family,
        kind: def.size === undefined ? 'ladder' : 'collection',
        value,
        name: funkyName(index),
        desc: def.desc(value),
      });
      index += 1;
    }
  }
  for (const feat of FEATS) out.push({ id: feat.id, family: feat.family, kind: feat.kind, value: 1, name: feat.name, desc: feat.desc });
  return out;
})();

export const ACHIEVEMENT_IDS: ReadonlySet<string> = new Set(ACHIEVEMENTS.map((a) => a.id));

/** Every achievement by its `<family>.<value>` id, built once for the store's earned-diff lookups. */
export const ACHIEVEMENT_BY_ID: ReadonlyMap<string, AchievementDef> = new Map(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

/**
 * One icon glyph per family, so a toast (or the tab) shows the family's own pixel icon. Families with a natural
 * stat/structural glyph reuse it; the rest use the handful of family glyphs added to `skillIcons`.
 */
export const FAMILY_ICONS: Readonly<Record<string, IconGlyphId>> = {
  depth: 'startingDepth',
  dig: 'digPower',
  clicks: 'ticksPerClick',
  handMined: 'digPower',
  autoMined: 'autoTickRate',
  gold: 'goldYield',
  goldSpent: 'goldYield',
  diamonds: 'diamondYield',
  diamondsSpent: 'diamondYield',
  soulsEarned: 'soulFind',
  soulsSpent: 'soulFind',
  gems: 'gemFind',
  chests: 'chestFind',
  maps: 'mapFind',
  mapsFound: 'mapFind',
  mapsLost: 'mapFind',
  kills: 'damage',
  champions: 'skull',
  bosses: 'skull',
  deaths: 'heart',
  levels: 'xpFind',
  levelsGained: 'xpFind',
  ascensions: 'minerReborn',
  craft: 'anvil',
  merchant: 'flask',
  itemsKept: 'chestFind',
  itemsSold: 'sellBonus',
  itemsSalvaged: 'salvageYield',
  oresTraded: 'oreFind',
  legendaries: 'star',
  sockets: 'gemStack',
  timePlayed: 'autoTickRate',
  timeAway: 'offlineCap',
  ...Object.fromEntries(MATERIALS.map((material): [string, IconGlyphId] => [`ore.${material}`, 'oreFind'])),
  'collection.legendaries': 'star',
  ...Object.fromEntries(LEGENDARY_TIERS.map((tier): [string, IconGlyphId] => [`collection.legendaryTier${tier}`, 'star'])),
  'collection.runes': 'gemStack',
  'collection.championMods': 'skull',
  'collection.specials': 'cartographer',
  'collection.gems': 'gemFind',
  'collection.dungeons': 'mapFind',
  ...Object.fromEntries(GEM_GRADES.map((grade): [string, IconGlyphId] => [`collection.gemGrade.${grade}`, 'gemFind'])),
  ...Object.fromEntries(Object.values(FEAT_FAMILIES).map((def): [string, IconGlyphId] => [def.family, def.icon])),
};

/** The icon glyph an achievement's toast and tab row share. */
export function achievementIcon(def: AchievementDef): IconGlyphId {
  const icon = FAMILY_ICONS[def.family];
  if (icon === undefined) throw new Error(`no icon for achievement family ${def.family}`);
  return icon;
}

const BY_FAMILY: ReadonlyMap<string, readonly AchievementDef[]> = (() => {
  const map = new Map<string, AchievementDef[]>();
  for (const a of ACHIEVEMENTS) {
    const list = map.get(a.family);
    if (list === undefined) map.set(a.family, [a]);
    else list.push(a);
  }
  return map;
})();

export const FAMILY_LABELS: Readonly<Record<string, string>> = Object.fromEntries([
  ...ALL_DEFS.map((def) => [def.family, def.label]),
  ...Object.values(FEAT_FAMILIES).map((def) => [def.family, def.label]),
]);

/** The permanent counters the achievements read: everything that must survive ascension lives in `state.stats`. */
function familyValue(state: GameState, family: string): number {
  switch (family) {
    case 'depth': return state.deepest;
    case 'dig': return state.stats.metresDug;
    case 'clicks': return state.stats.clicks;
    case 'handMined': return state.stats.metresDugByClick;
    case 'autoMined': return state.stats.metresDugAuto;
    case 'gold': return state.stats.goldFound + state.stats.goldFromSales;
    case 'goldSpent': return state.stats.goldSpent;
    case 'diamonds': return state.stats.diamondsFound;
    case 'diamondsSpent': return state.stats.diamondsSpent;
    case 'soulsEarned': return state.stats.soulsEarned;
    case 'soulsSpent': return state.stats.soulsSpent;
    case 'gems': return state.stats.gems;
    case 'chests': return state.stats.chestsOpened;
    case 'maps': return state.stats.mapsCleared;
    case 'mapsFound': return state.stats.mapsFound;
    case 'mapsLost': return state.stats.mapsLost;
    case 'kills': return state.stats.monstersKilled;
    case 'champions': return state.stats.championKills;
    case 'bosses': return state.stats.bossKills;
    case 'deaths': return state.stats.deaths;
    case 'levels': return state.level;
    case 'levelsGained': return state.stats.levelsGained;
    case 'ascensions': return state.lifetime.ascensions;
    case 'craft': return state.stats.itemsCrafted;
    case 'merchant': return state.stats.itemsBought;
    case 'itemsKept': return state.stats.itemsKept;
    case 'itemsSold': return state.stats.itemsSold;
    case 'itemsSalvaged': return state.stats.itemsSalvaged;
    case 'oresTraded': return MATERIALS.reduce((n, m) => n + state.stats.oresTraded[m], 0);
    case 'legendaries': return state.stats.legendaries;
    case 'sockets': return state.stats.gemsSocketed;
    case 'timePlayed': return Math.floor(state.stats.timePlayedMs / 3_600_000);
    case 'timeAway': return Math.floor(state.stats.timeAwayMs / 3_600_000);
    default: {
      const size = SIZE_OF.get(family);
      if (size !== undefined) return size(state);
      return family.startsWith('ore.') ? (state.stats.oresFound[family.slice(4) as Material] ?? 0) : 0;
    }
  }
}

/**
 * Marks every achievement of `family` (or of every family, when omitted) whose condition now holds. Each one is marked
 * once and never again, and the check only reads monotonic counters, so it stays cheap and idempotent.
 */
export function checkAchievements(state: GameState, family?: string): void {
  const list = family === undefined ? ACHIEVEMENTS : BY_FAMILY.get(family);
  if (list === undefined) return;
  const earned = state.achievements.earned;
  const earnedSet = new Set(earned);
  for (const a of list) {
    if (earnedSet.has(a.id)) continue;
    if (familyValue(state, a.family) >= a.value) {
      earned.push(a.id);
      earnedSet.add(a.id);
    }
  }
}

/** Notes a legendary received, dropped or bought in the lifetime set and, when it is a new one, marks the legendary collections. */
export function recordLegendary(state: GameState, uniqueId: string | undefined): void {
  if (uniqueId === undefined || !addToSet(state.stats.legendariesFound, uniqueId)) return;
  checkAchievements(state, 'collection.legendaries');
  for (const tier of LEGENDARY_TIERS) checkAchievements(state, `collection.legendaryTier${tier}`);
}

// The feats the engine judges, grouped by the event they wait for. Tests may swap the list; nothing else does.
function groupByEvent(feats: readonly FeatDef[]): ReadonlyMap<FeatEvent['kind'], readonly FeatDef[]> {
  const map = new Map<FeatEvent['kind'], FeatDef[]>();
  for (const feat of feats) {
    const list = map.get(feat.on);
    if (list === undefined) map.set(feat.on, [feat]);
    else list.push(feat);
  }
  return map;
}

let featsByEvent = groupByEvent(FEATS);

/** Test-only: judges `feats` instead of the real list; `null` puts the real list back. */
export function registerFeatsForTest(feats: readonly FeatDef[] | null): void {
  featsByEvent = groupByEvent(feats ?? FEATS);
}

/** Earns every feat waiting for this kind of event whose test now passes. Each is earned once, and nothing here draws a random number. */
export function checkFeats(state: GameState, event: FeatEvent): void {
  const feats = featsByEvent.get(event.kind);
  if (feats === undefined) return;
  const earned = state.achievements.earned;
  const earnedSet = new Set(earned);
  for (const feat of feats) {
    if (earnedSet.has(feat.id) || !feat.test(state, event)) continue;
    earned.push(feat.id);
    earnedSet.add(feat.id);
  }
}

/** Drops earned ids the list no longer has, so a retired achievement never survives into a save that must validate. */
export function pruneEarned(state: { achievements: { earned: string[] } }): void {
  state.achievements.earned = state.achievements.earned.filter((id) => ACHIEVEMENT_IDS.has(id));
}

/** How many achievements are earned. */
export function earnedCount(state: GameState): number {
  return state.achievements.earned.length;
}

/** The global multiplier: 1 + ACHIEVEMENT_BOOST × earned. */
export function achievementBoost(state: GameState): number {
  return 1 + ACHIEVEMENT_BOOST * earnedCount(state);
}
