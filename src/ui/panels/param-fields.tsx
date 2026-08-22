// Shared Properties-panel field primitives (M3 T5 extraction — the
// BarGroupParamsPanel field components, reused by the PlacementGroupPanel).
// Token-only styling (rule 6); dumb components (rule 2).
import { useState } from 'react';

export const PARAM_FIELD_CLASS =
  'w-full rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring';
export const PARAM_LABEL_CLASS = 'flex items-center justify-between gap-2';

export interface ParamNumberFieldProps {
  label: string;
  value: number;
  /** Returns true when the value was accepted; on false the field reverts to
   *  the stored value (e.g. a rejected updatePlacementGroup edit). */
  onCommit: (value: number) => boolean;
}

/** mm number field: local text while typing, commits a valid number on
 *  Enter/blur; the render-time adjustment pattern resyncs the text when the
 *  store value changes externally (no effect, no cascading render). */
export function ParamNumberField({ label, value, onCommit }: ParamNumberFieldProps) {
  const [draft, setDraft] = useState<{ base: number; text: string }>({ base: value, text: String(value) });
  if (draft.base !== value) setDraft({ base: value, text: String(value) });
  const revert = () => setDraft({ base: value, text: String(value) });
  const commit = () => {
    const parsed = Number(draft.text);
    if (!Number.isFinite(parsed) || !onCommit(parsed)) revert();
  };
  return (
    <label className={PARAM_LABEL_CLASS}>
      <span>{label}</span>
      <input
        className={PARAM_FIELD_CLASS}
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
