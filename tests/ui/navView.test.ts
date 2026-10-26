import { expect, it } from 'vitest';
import { navTabs } from '../../src/ui/navView';

it('the Nav shows Run first while a map runs, then Mine, Inventory, Skills, Ascend, Merchant and Log', () => {
  const running = navTabs(true);
  expect(running.map((t) => t.label)).toEqual(['Run', 'Mine', 'Inventory', 'Skills', 'Ascend', 'Merchant', 'Log']);
  expect(running.map((t) => t.view)).toEqual(['run', 'mine', 'inventory', 'skills', 'ascend', 'merchant', 'log']);
  const idle = navTabs(false);
  expect(idle).toHaveLength(6);
  expect(idle.map((t) => t.view)).toEqual(['mine', 'inventory', 'skills', 'ascend', 'merchant', 'log']);
});
