import { expect, it } from 'vitest';
import { navTabs } from '../../src/ui/navView';

it('the Nav shows Run first while a map runs, then Mine, Inventory, Skills, Ascend, Merchant, Log and Achievements', () => {
  const running = navTabs(true);
  expect(running.map((t) => t.label)).toEqual(['Run', 'Mine', 'Inventory', 'Skills', 'Ascend', 'Merchant', 'Log', 'Achievements']);
  expect(running.map((t) => t.view)).toEqual(['run', 'mine', 'inventory', 'skills', 'ascend', 'merchant', 'log', 'achievements']);
  const idle = navTabs(false);
  expect(idle).toHaveLength(7);
  expect(idle.map((t) => t.view)).toEqual(['mine', 'inventory', 'skills', 'ascend', 'merchant', 'log', 'achievements']);
});
