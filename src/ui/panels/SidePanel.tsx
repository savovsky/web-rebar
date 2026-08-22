// Right tabbed panel (§B.2): "Building" (storeys/elements — counts only in M0,
// plus the M2 T6 Backgrounds section for imported reference documents) and
// "Properties" (context-sensitive, populated by selection from T7 onward).
import { Content, List, Root, Trigger } from '@radix-ui/react-tabs';
import { useAppSelector } from '@/stores/hooks';
import { BackgroundsSection } from './BackgroundsSection';
import { BarGroupParamsPanel } from './BarGroupParamsPanel';
import { PlacementGroupPanel } from './PlacementGroupPanel';

const TRIGGER_CLASS =
  'flex-1 border-b-2 border-transparent px-panel py-1.5 text-xs text-muted-foreground ' +
  'transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring';

export function SidePanel() {
  const elementCount = useAppSelector((state) => Object.keys(state.project.elements).length);
  const barCount = useAppSelector((state) => Object.keys(state.project.reinforcement).length);
  const isGroupTool = useAppSelector((state) => state.ui.activeTool === 'placeBarGroup');
  // A selected placement group re-opens its rule params here (§B.5, M3 T5 —
  // double-click a group bar selects it). Exactly one group at a time edits.
  const selectedGroupIds = useAppSelector((state) => state.ui.selection.placementGroupIds);
  let propertiesContent = <p>Select an element to edit its properties.</p>;
  if (isGroupTool) propertiesContent = <BarGroupParamsPanel />;
  else if (selectedGroupIds.length === 1)
    propertiesContent = <PlacementGroupPanel groupId={selectedGroupIds[0]} />;
  // Sections are deliberately NOT counted here (author call, T10 review) —
  // they are view definitions, not building content; the 3D wireframe volume
  // is their presence.
  const isEmpty = elementCount === 0 && barCount === 0;
  return (
    <Root defaultValue='building' className='flex w-panel-right flex-col border-l border-border bg-panel'>
      <List aria-label='Project panels' className='flex shrink-0 border-b border-border'>
        <Trigger value='building' className={TRIGGER_CLASS}>
          Building
        </Trigger>
        <Trigger value='properties' className={TRIGGER_CLASS}>
          Properties
        </Trigger>
      </List>
      <Content value='building' className='flex-1 overflow-auto p-panel text-xs text-muted-foreground'>
        {isEmpty ? (
          <p>
            Empty project — press <kbd className='font-mono text-foreground'>W</kbd> to place a wall.
          </p>
        ) : (
          <dl className='space-y-1'>
            <div className='flex justify-between'>
              <dt>Elements</dt>
              <dd className='font-mono text-foreground'>{elementCount}</dd>
            </div>
            <div className='flex justify-between'>
              <dt>Bars</dt>
              <dd className='font-mono text-foreground'>{barCount}</dd>
            </div>
          </dl>
        )}
        <BackgroundsSection />
      </Content>
      <Content value='properties' className='flex-1 overflow-auto p-panel text-xs text-muted-foreground'>
        {propertiesContent}
      </Content>
    </Root>
  );
}
