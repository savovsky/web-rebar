/** True when a keyboard event originates from a text-entry element — global
 *  shortcut/confirm handlers must ignore those so typing in inputs stays safe. */
export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  );
}
