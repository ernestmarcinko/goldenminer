export type View = 'mine' | 'inventory' | 'merchant' | 'log' | 'run';

/** The Nav's tabs: the Run tab comes first while a map runs. */
export function navTabs(running: boolean): { view: View; label: string }[] {
  const tabs: { view: View; label: string }[] = [
    { view: 'mine', label: 'Mine' },
    { view: 'inventory', label: 'Inventory' },
    { view: 'merchant', label: 'Merchant' },
    { view: 'log', label: 'Log' },
  ];
  return running ? [{ view: 'run', label: 'Run' }, ...tabs] : tabs;
}
