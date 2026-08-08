// App shell layout (§B.2): top bar, left tool palette, central viewport,
// right tabbed panel, bottom status bar. The dockable 2D section view mounts
// inside the viewport area in T10.
import { SidePanel } from '@/ui/panels/SidePanel';
import { Toolbar } from '@/ui/toolbar/Toolbar';
import { useToolShortcuts } from '@/ui/toolbar/use-tool-shortcuts';
import { ViewportPlaceholder } from '@/ui/viewport/ViewportPlaceholder';
import { StatusBar } from './StatusBar';
import { TopBar } from './TopBar';

export function AppShell() {
  useToolShortcuts();
  return (
    <div className='flex h-full flex-col bg-background text-foreground'>
      <TopBar />
      <div className='flex min-h-0 flex-1'>
        <Toolbar />
        <main className='min-w-0 flex-1 bg-viewport'>
          <ViewportPlaceholder />
        </main>
        <SidePanel />
      </div>
      <StatusBar />
    </div>
  );
}
