// Properties-tab content for a SELECTED placement group (§B.5, M3 T5 — the
// T4-recorded author direction: when the whole group is selected, the panel
// re-opens the rule params for editing). Every field commit dispatches the
// §N updatePlacementGroup command → the group's bars regenerate live (one
// undo level per edit). A rejection (the T3 CommandError doorway) surfaces
// as a status hint and the field reverts to the stored value. Dumb component
// (rules 1/2): patch assembly + dispatch only; all rule math and validation
// live in src/engine/ and src/commands/.
import { CommandError, updatePlacementGroup } from '@/commands';
import type { PlacementGroupPatch } from '@/commands';
import { DEFAULT_DIAMETERS } from '@/data/catalog/steel';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';
import { setCursorHint } from '@/stores/ui-slice';
import { surfaceClashReport } from '@/ui/clash-surfacing';
import { PARAM_FIELD_CLASS, PARAM_LABEL_CLASS, ParamNumberField } from './param-fields';

export function PlacementGroupPanel({ groupId }: { groupId: string }) {
  const dispatch = useAppDispatch();
  const group = useAppSelector((state) => state.project.placementGroups[groupId]);
  if (!group) {
    return <p>The selected group no longer exists.</p>;
  }

  /** One field edit = ONE updatePlacementGroup dispatch (one undo level);
   *  false → the field reverts (the stored rule did not change). Q8 (M3 T6):
   *  the regenerate's exact clash report surfaces as a warning — the edit
   *  already committed (§K.4 non-blocking). */
  const commitPatch = (patch: PlacementGroupPatch): boolean => {
    try {
      const result = dispatch(updatePlacementGroup({ groupId, patch }));
      surfaceClashReport(dispatch, result.clashes);
      return true;
    } catch (error) {
      if (!(error instanceof CommandError)) throw error;
      dispatch(setCursorHint(error.message));
      return false;
    }
  };

  return (
    <section aria-label='Selected bar group' className='space-y-1.5'>
      <h2 className='font-medium text-foreground'>
        Bar group · mark {group.barMark} · {group.bars.length} bars
      </h2>
      <label className={PARAM_LABEL_CLASS}>
        <span>Diameter</span>
        <select
          className={PARAM_FIELD_CLASS}
          value={group.barDiameter}
          onChange={(event) => commitPatch({ barDiameter: Number(event.target.value) })}
        >
          {DEFAULT_DIAMETERS.map((diameter) => (
            <option key={diameter} value={diameter}>
              Ø{diameter}
            </option>
          ))}
        </select>
      </label>
      <label className={PARAM_LABEL_CLASS}>
        <span>Orientation</span>
        <select
          className={PARAM_FIELD_CLASS}
          value={group.orientation}
          onChange={(event) => commitPatch({ orientation: event.target.value as 'horizontal' | 'vertical' })}
        >
          <option value='vertical'>Vertical bars</option>
          <option value='horizontal'>Horizontal bars</option>
        </select>
      </label>
      <ParamNumberField
        label='Cover (mm)'
        value={group.coverDistance}
        onCommit={(coverDistance) => commitPatch({ coverDistance })}
      />
      <ParamNumberField
        label='Spacing (mm)'
        value={group.barSpacing}
        onCommit={(barSpacing) => commitPatch({ barSpacing })}
      />
      <ParamNumberField
        label='Edge start (mm)'
        value={group.edgeDistanceStart}
        onCommit={(edgeDistanceStart) => commitPatch({ edgeDistanceStart })}
      />
      <ParamNumberField
        label='Edge end (mm)'
        value={group.edgeDistanceEnd}
        onCommit={(edgeDistanceEnd) => commitPatch({ edgeDistanceEnd })}
      />
      <p className='pt-1'>Edits regenerate the group's bars immediately (one undo step each).</p>
    </section>
  );
}
