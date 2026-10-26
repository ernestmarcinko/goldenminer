export type View = 'mine' | 'inventory' | 'skills' | 'ascend' | 'merchant' | 'log' | 'achievements' | 'run';

/** The Nav's tabs: the Run tab comes first while a map runs. */
export function navTabs(running: boolean): { view: View; label: string }[] {
  const tabs: { view: View; label: string }[] = [
    { view: 'mine', label: 'Mine' },
    { view: 'inventory', label: 'Inventory' },
    { view: 'skills', label: 'Skills' },
    { view: 'ascend', label: 'Ascend' },
    { view: 'merchant', label: 'Merchant' },
    { view: 'log', label: 'Log' },
    { view: 'achievements', label: 'Achievements' },
  ];
  return running ? [{ view: 'run', label: 'Run' }, ...tabs] : tabs;
}
