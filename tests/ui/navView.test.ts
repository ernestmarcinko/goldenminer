import { expect, it } from 'vitest';
import { navTabs } from '../../src/ui/navView';

it('the Nav shows Run first while a map runs, then Mine, Inventory, Merchant and Log', () => {
  const running = navTabs(true);
  expect(running.map((t) => t.label)).toEqual(['Run', 'Mine', 'Inventory', 'Merchant', 'Log']);
  expect(running.map((t) => t.view)).toEqual(['run', 'mine', 'inventory', 'merchant', 'log']);
  const idle = navTabs(false);
  expect(idle).toHaveLength(4);
  expect(idle.map((t) => t.view)).toEqual(['mine', 'inventory', 'merchant', 'log']);
});
