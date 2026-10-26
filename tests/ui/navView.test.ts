import { expect, it } from 'vitest';
import { navTabs } from '../../src/ui/navView';

it('the Nav shows Run first while a map runs, then Mine, Inventory, Skills, Merchant and Log', () => {
  const running = navTabs(true);
  expect(running.map((t) => t.label)).toEqual(['Run', 'Mine', 'Inventory', 'Skills', 'Merchant', 'Log']);
  expect(running.map((t) => t.view)).toEqual(['run', 'mine', 'inventory', 'skills', 'merchant', 'log']);
  const idle = navTabs(false);
  expect(idle).toHaveLength(5);
  expect(idle.map((t) => t.view)).toEqual(['mine', 'inventory', 'skills', 'merchant', 'log']);
});
