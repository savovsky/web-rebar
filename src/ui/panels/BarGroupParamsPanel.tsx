// Properties-tab content while the Place Bar Group tool is active (§B.4,
// M3 T4): the group's placement rule — cover, Ø, spacing, edge distances,
// orientation — with catalog defaults, editable BEFORE commit; edits hit the
// transient params store, so the live viewport preview regenerates at frame
// rate and the next commit uses them. Dumb component (rules 1/2): it renders
// the store and writes patches; all rule math stays in src/engine/. The
// field primitives are shared with the selected-group panel
// (param-fields.tsx, M3 T5).
import { DEFAULT_DIAMETERS } from '@/data/catalog/steel';
import { setBarGroupParams, useBarGroupParams } from '../viewport/bar-group-params';
import { PARAM_FIELD_CLASS, PARAM_LABEL_CLASS, ParamNumberField } from './param-fields';

export function BarGroupParamsPanel() {
  const params = useBarGroupParams();
  return (
    <section aria-label='Bar group rule' className='space-y-1.5'>
      <h2 className='font-medium text-foreground'>Bar group rule</h2>
      <label className={PARAM_LABEL_CLASS}>
        <span>Diameter</span>
        <select
          className={PARAM_FIELD_CLASS}
          value={params.diameterMm}
          onChange={(event) => setBarGroupParams({ diameterMm: Number(event.target.value) })}
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
          value={params.orientation}
          onChange={(event) =>
            setBarGroupParams({ orientation: event.target.value as 'horizontal' | 'vertical' })
          }
        >
          <option value='vertical'>Vertical bars</option>
          <option value='horizontal'>Horizontal bars</option>
        </select>
      </label>
      <ParamNumberField
        label='Cover (mm)'
        value={params.coverMm}
        onCommit={(coverMm) => {
          setBarGroupParams({ coverMm });
          return true; // transient pre-commit params accept any value — the command validates
        }}
      />
      <ParamNumberField
        label='Spacing (mm)'
        value={params.spacingMm}
        onCommit={(spacingMm) => {
          setBarGroupParams({ spacingMm });
          return true;
        }}
      />
      <ParamNumberField
        label='Edge start (mm)'
        value={params.edgeDistanceStartMm}
        onCommit={(edgeDistanceStartMm) => {
          setBarGroupParams({ edgeDistanceStartMm });
          return true;
        }}
      />
      <ParamNumberField
        label='Edge end (mm)'
        value={params.edgeDistanceEndMm}
        onCommit={(edgeDistanceEndMm) => {
          setBarGroupParams({ edgeDistanceEndMm });
          return true;
        }}
      />
      <p className='pt-1'>Applies to the next placement — the live preview follows.</p>
    </section>
  );
}
