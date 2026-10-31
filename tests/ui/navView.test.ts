import { expect, it } from 'vitest';
import { navTabs } from '../../src/ui/navView';

it('the Nav shows Run first while a map runs, then Mine, Battle, Inventory, Skills, Ascend, Merchant, Log, Achievements and Stats', () => {
  const running = navTabs(true);
  expect(running.map((t) => t.label)).toEqual(['Run', 'Mine', 'Battle', 'Inventory', 'Skills', 'Ascend', 'Merchant', 'Log', 'Achievements', 'Stats']);
  expect(running.map((t) => t.view)).toEqual(['run', 'mine', 'battle', 'inventory', 'skills', 'ascend', 'merchant', 'log', 'achievements', 'stats']);
  const idle = navTabs(false);
  expect(idle).toHaveLength(9);
  expect(idle.map((t) => t.view)).toEqual(['mine', 'battle', 'inventory', 'skills', 'ascend', 'merchant', 'log', 'achievements', 'stats']);
});
