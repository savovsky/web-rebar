// Properties-tab content while the Place Bar Group tool is active (§B.4,
// M3 T4): the group's placement rule — cover, Ø, spacing, edge distances,
// orientation — with catalog defaults, editable BEFORE commit; edits hit the
// transient params store, so the live viewport preview regenerates at frame
// rate and the next commit uses them. Dumb component (rules 1/2): it renders
// the store and writes patches; all rule math stays in src/engine/.
import { useState } from 'react';
import { DEFAULT_DIAMETERS } from '@/data/catalog/steel';
import { setBarGroupParams, useBarGroupParams } from '../viewport/bar-group-params';

const FIELD_CLASS =
  'w-full rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring';
const LABEL_CLASS = 'flex items-center justify-between gap-2';

interface ParamNumberFieldProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}

/** mm number field: local text while typing, commits a valid number on
 *  Enter/blur; the render-time adjustment pattern resyncs the text when the
 *  store value changes externally (no effect, no cascading render). */
function ParamNumberField({ label, value, onCommit }: ParamNumberFieldProps) {
  const [draft, setDraft] = useState<{ base: number; text: string }>({ base: value, text: String(value) });
  if (draft.base !== value) setDraft({ base: value, text: String(value) });
  const commit = () => {
    const parsed = Number(draft.text);
    if (Number.isFinite(parsed)) onCommit(parsed);
    else setDraft({ base: value, text: String(value) });
  };
  return (
    <label className={LABEL_CLASS}>
      <span>{label}</span>
      <input
        className={FIELD_CLASS}
        inputMode='decimal'
        value={draft.text}
        onChange={(event) => setDraft({ base: value, text: event.target.value })}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit();
        }}
      />
    </label>
  );
}

export function BarGroupParamsPanel() {
  const params = useBarGroupParams();
  return (
    <section aria-label='Bar group rule' className='space-y-1.5'>
      <h2 className='font-medium text-foreground'>Bar group rule</h2>
      <label className={LABEL_CLASS}>
        <span>Diameter</span>
        <select
          className={FIELD_CLASS}
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
      <label className={LABEL_CLASS}>
        <span>Orientation</span>
        <select
          className={FIELD_CLASS}
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
        onCommit={(coverMm) => setBarGroupParams({ coverMm })}
      />
      <ParamNumberField
        label='Spacing (mm)'
        value={params.spacingMm}
        onCommit={(spacingMm) => setBarGroupParams({ spacingMm })}
      />
      <ParamNumberField
        label='Edge start (mm)'
        value={params.edgeDistanceStartMm}
        onCommit={(edgeDistanceStartMm) => setBarGroupParams({ edgeDistanceStartMm })}
      />
      <ParamNumberField
        label='Edge end (mm)'
        value={params.edgeDistanceEndMm}
        onCommit={(edgeDistanceEndMm) => setBarGroupParams({ edgeDistanceEndMm })}
      />
      <p className='pt-1'>Applies to the next placement — the live preview follows.</p>
    </section>
  );
}
