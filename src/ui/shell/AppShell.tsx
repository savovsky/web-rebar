// App shell layout (§B.2): top bar, left tool palette, central viewport,
// right tabbed panel, bottom status bar. The dockable 2D section view floats
// bottom-right inside the viewport area (renders only when a section is active).
import { SidePanel } from '@/ui/panels/SidePanel';
import { SectionView } from '@/ui/section-view/SectionView';
import { Toolbar } from '@/ui/toolbar/Toolbar';
import { useToolShortcuts } from '@/ui/toolbar/use-tool-shortcuts';
import { Viewport3D } from '@/ui/viewport/Viewport3D';
import { StatusBar } from './StatusBar';
import { TopBar } from './TopBar';

export function AppShell() {
  useToolShortcuts();
  return (
    <div className='flex h-full flex-col bg-background text-foreground'>
      <TopBar />
      <div className='flex min-h-0 flex-1'>
        <Toolbar />
        <main className='relative min-w-0 flex-1 bg-viewport'>
          <Viewport3D />
          <SectionView />
        </main>
        <SidePanel />
      </div>
      <StatusBar />
    </div>
  );
}
