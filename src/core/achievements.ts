import { MATERIAL_LABELS } from './itemData';
import { MATERIALS, type Material } from './items';
import type { IconGlyphId } from './skillIcons';
import type { GameState } from './types';

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
}

/** Whole numbers with thousands separators, for the generated descriptions. */
const commas = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// --------------------------------------------------------------------------------------------------------------------
// Threshold design.
//
// Every family runs from a first achievement reachable in the first few minutes of play to a last one that sits near the
// top of what a dedicated year of play produces. Between them the values climb in the classic 1–2–5 series (1, 2, 5, 10,
// 20, 50, …) so each step feels earned but never grinds. A handful of families get a bespoke ladder because their range
// is naturally small (levels end at 100, legendaries at a handful, deaths are rare), and a few exotic values — 33, 67,
// 666, 1234, 123456, 1337, 8760 — are salted in as cookie-clicker-style milestones.
//
// The caps are read off the game's own numbers, not invented:
//  • The reference run reaches level 100 at about day 10 and depth ~16,000 m. Digging slows as hardness climbs
//    (10 + 0.13·m), so a year of hardcore play at near-max dig power settles around 100,000 m — the depth ladder's cap.
//    (The absolute theoretical ceiling, assuming dig power 5000 and 10 auto-ticks/s from the very first second with no
//    hazards, integrates to ~985,000 m in a year; that ideal is unreachable in practice, so it is not a target.)
//  • Total depth is the lifetime sum across every ascension, so it ends a clean order of magnitude higher, at a million.
//  • Gold's veins pay 200 + 110·tier, so a year of deep digging and selling lands in the hundreds of millions; 1 billion
//    is the capstone.
//  • Time played/away cap at 8760 hours — exactly one year of non-stop play.
// --------------------------------------------------------------------------------------------------------------------

const FAMILY_DEFS: readonly FamilyDef[] = [
  { family: 'depth', label: 'Maximum Depth',
    thresholds: [10, 25, 42, 50, 100, 250, 500, 1000, 1337, 2500, 5000, 10000, 25000, 50000, 100000],
    desc: (n) => `Reach a depth of ${commas(n)} metres.` },
  { family: 'dig', label: 'Total Depth',
    thresholds: [100, 250, 500, 666, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 123456, 250000, 500000, 1000000],
    desc: (n) => `Dig ${commas(n)} metres over your lifetime.` },
  { family: 'clicks', label: 'Clicks',
    thresholds: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000],
    desc: (n) => `Click ${commas(n)} times over your lifetime.` },
  { family: 'handMined', label: 'Hand Mined',
    thresholds: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000],
    desc: (n) => `Dig ${commas(n)} metres by hand over your lifetime.` },
  { family: 'autoMined', label: 'Auto Mined',
    thresholds: [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000],
    desc: (n) => `Dig ${commas(n)} metres automatically over your lifetime.` },

  { family: 'gold', label: 'Gold',
    thresholds: [
      1000, 2500, 5000, 10000, 25000, 50000, 100000, 123456, 250000, 500000, 666666, 1000000,
      2500000, 5000000, 10000000, 25000000, 50000000, 100000000, 250000000, 500000000, 1000000000,
    ],
    desc: (n) => `Earn ${commas(n)} Gold over your lifetime.` },
  { family: 'goldSpent', label: 'Gold Spent',
    thresholds: [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000, 5000000, 10000000],
    desc: (n) => `Spend ${commas(n)} Gold over your lifetime.` },

  { family: 'diamonds', label: 'Diamonds',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000],
    desc: (n) => `Earn ${commas(n)} Diamonds over your lifetime.` },
  { family: 'diamondsSpent', label: 'Diamonds Spent',
    thresholds: [1, 2, 5, 10, 20, 50, 100, 250, 500, 1000],
    desc: (n) => `Spend ${commas(n)} Diamonds over your lifetime.` },

  { family: 'soulsEarned', label: 'Souls Earned',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000],
    desc: (n) => `Earn ${commas(n)} Souls over your lifetime.` },
  { family: 'soulsSpent', label: 'Souls Spent',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000],
    desc: (n) => `Spend ${commas(n)} Souls over your lifetime.` },

  { family: 'gems', label: 'Gems',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    desc: (n) => `Find ${commas(n)} gems over your lifetime.` },
  { family: 'chests', label: 'Chests',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    desc: (n) => `Open ${commas(n)} chests over your lifetime.` },
  { family: 'maps', label: 'Maps Cleared',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000],
    desc: (n) => `Clear ${commas(n)} maps over your lifetime.` },
  { family: 'mapsFound', label: 'Maps Found',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    desc: (n) => `Find ${commas(n)} maps over your lifetime.` },
  { family: 'mapsLost', label: 'Maps Lost',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500],
    desc: (n) => `Lose ${commas(n)} maps over your lifetime.` },

  { family: 'kills', label: 'Kills',
    thresholds: [10, 25, 50, 100, 250, 500, 666, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000],
    desc: (n) => `Kill ${commas(n)} monsters over your lifetime.` },
  { family: 'champions', label: 'Champions',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    desc: (n) => `Kill ${commas(n)} champion monsters over your lifetime.` },
  { family: 'bosses', label: 'Bosses',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
    desc: (n) => `Kill ${commas(n)} bosses over your lifetime.` },
  { family: 'deaths', label: 'Deaths',
    thresholds: [1, 2, 5, 10, 25, 50, 100],
    desc: (n) => `Die ${commas(n)} times over your lifetime.` },

  { family: 'levels', label: 'Levels',
    thresholds: [2, 3, 5, 10, 15, 20, 25, 30, 33, 40, 45, 50, 55, 60, 67, 70, 75, 80, 85, 90, 95, 100],
    desc: (n) => `Reach level ${commas(n)}.` },
  { family: 'levelsGained', label: 'Levels Gained',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000],
    desc: (n) => `Gain ${commas(n)} levels over your lifetime.` },
  { family: 'ascensions', label: 'Ascensions',
    thresholds: [1, 2, 3, 5, 10, 15, 20, 30, 40, 50],
    desc: (n) => `Ascend ${commas(n)} times.` },

  { family: 'craft', label: 'Crafting',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000],
    desc: (n) => `Craft ${commas(n)} items over your lifetime.` },
  { family: 'merchant', label: 'Merchant',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000],
    desc: (n) => `Buy ${commas(n)} items from the merchant over your lifetime.` },
  { family: 'itemsKept', label: 'Items Kept',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    desc: (n) => `Keep ${commas(n)} items over your lifetime.` },
  { family: 'itemsSold', label: 'Items Sold',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    desc: (n) => `Sell ${commas(n)} items over your lifetime.` },
  { family: 'itemsSalvaged', label: 'Items Salvaged',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    desc: (n) => `Salvage ${commas(n)} items over your lifetime.` },
  { family: 'oresTraded', label: 'Ores Traded',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    desc: (n) => `Trade ${commas(n)} ores at the Refiner over your lifetime.` },

  { family: 'legendaries', label: 'Legendaries',
    thresholds: [1, 2, 3, 5, 10, 15, 20],
    desc: (n) => `Own ${commas(n)} legendary items.` },
  { family: 'sockets', label: 'Sockets',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500],
    desc: (n) => `Socket ${commas(n)} gems into gear over your lifetime.` },

  { family: 'timePlayed', label: 'Time Played',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 8760],
    desc: (n) => `Play for ${commas(n)} hours.` },
  { family: 'timeAway', label: 'Time Away',
    thresholds: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 8760],
    desc: (n) => `Spend ${commas(n)} hours away from the mine.` },
];

// Each ore's cap follows how deep it first appears and how heavily it is weighted: copper is everywhere, void crystal
// only turns up past 1000 m and one at a time. The ladder is the same 1–2–5 series, shortened for the rarer ores.
const ORE_CAPS: Readonly<Record<Material, number>> = {
  copper: 100_000, tin: 50_000, iron: 25_000, silver: 10_000,
  mithril: 5_000, starsteel: 2_500, obsidian: 1_000, voidCrystal: 500,
};

/** The 1–2–5 series within `min`..`max`, always including both ends. */
function oreSeries(max: number): number[] {
  const out: number[] = [];
  for (const v of [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000]) {
    if (v <= max) out.push(v);
  }
  if (out[out.length - 1] !== max) out.push(max);
  return out;
}

const ORE_DEFS: readonly FamilyDef[] = MATERIALS.map((material) => {
  const label = MATERIAL_LABELS[material];
  return {
    family: `ore.${material}`,
    label,
    thresholds: oreSeries(ORE_CAPS[material]),
    desc: (n: number) => `Find ${commas(n)} ${label.toLowerCase()} over your lifetime.`,
  };
});

const ALL_DEFS: readonly FamilyDef[] = [...FAMILY_DEFS, ...ORE_DEFS];

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
  'The Haymaker', 'The Sunday Punch', 'The Lucky Punch', 'The Rabbit Punch', 'The Hook', 'The Jab', 'The Cross',
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
];

/** The name for the `index`-th achievement: the `index`-th name, wrapping only past the list's end. */
function funkyName(index: number): string {
  return NAMES[index % NAMES.length] ?? `Achievement ${index}`;
}

/** The full generated table: families × thresholds, each with a unique funky name and `<family>.<value>` id. */
export const ACHIEVEMENTS: readonly AchievementDef[] = (() => {
  const out: AchievementDef[] = [];
  let index = 0;
  for (const def of ALL_DEFS) {
    for (const value of def.thresholds) {
      out.push({
        id: `${def.family}.${value}`,
        family: def.family,
        kind: 'ladder',
        value,
        name: funkyName(index),
        desc: def.desc(value),
      });
      index += 1;
    }
  }
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

export const FAMILY_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  ALL_DEFS.map((def) => [def.family, def.label]),
);

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
    default: return family.startsWith('ore.') ? (state.stats.oresFound[family.slice(4) as Material] ?? 0) : 0;
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
