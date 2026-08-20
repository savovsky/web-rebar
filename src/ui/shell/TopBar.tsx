// Thin menu bar (§B.2). Product name + project name + the File menu (M2:
// IFC import/export entry points) and the Edit menu (M1: undo/redo/delete
// entry points for mouse-first users) — the View menu arrives with view
// options.
import { useAppSelector } from '@/stores/hooks';
import { EditMenu } from './EditMenu';
import { FileMenu } from './FileMenu';

export function TopBar() {
  const projectName = useAppSelector((state) => state.project.metadata.name);
  return (
    <header className='flex h-topbar items-center gap-panel border-b border-border bg-panel px-panel'>
      <span className='text-sm font-semibold text-foreground'>web-rebar</span>
      <FileMenu />
      <EditMenu />
      <span className='text-xs text-muted-foreground'>{projectName}</span>
    </header>
  );
}
