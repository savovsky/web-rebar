// Thin menu bar (§B.2). M0: product name + project name only —
// File/Edit/View menus arrive with persistence and edit commands (M1+).
import { useAppSelector } from '@/stores/hooks';

export function TopBar() {
  const projectName = useAppSelector((state) => state.project.metadata.name);
  return (
    <header className='flex h-topbar items-center gap-panel border-b border-border bg-panel px-panel'>
      <span className='text-sm font-semibold text-foreground'>web-rebar</span>
      <span className='text-xs text-muted-foreground'>{projectName}</span>
    </header>
  );
}
