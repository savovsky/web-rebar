// "Backgrounds" section of the Building tab (§B.2 reserves this panel; M2 T6):
// the imported reference documents (M2 plan Q3) with a visibility toggle and
// remove. Dumb component (rules 1/2): both actions dispatch the T5 §N
// commands — no store mutation, no logic beyond rendering. Both mutations are
// ordinary project-model edits, so both are undoable (§E).
import { shallowEqual } from 'react-redux';
import { removeReferenceDocument, setReferenceDocumentVisibility } from '@/commands';
import { useAppDispatch, useAppSelector } from '@/stores/hooks';

const REMOVE_BUTTON_CLASS =
  'ml-auto rounded-sm px-1 text-muted-foreground hover:bg-accent hover:text-danger ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export function BackgroundsSection() {
  const dispatch = useAppDispatch();
  const documents = useAppSelector((state) => Object.values(state.project.referenceDocuments), shallowEqual);
  if (documents.length === 0) return null;
  return (
    <section aria-label='Backgrounds' className='mt-2 border-t border-border pt-2'>
      <h2 className='mb-1 font-medium text-foreground'>Backgrounds</h2>
      <ul className='space-y-1'>
        {documents.map((document) => (
          <li key={document.id} className='flex items-center gap-1'>
            <input
              type='checkbox'
              checked={document.visible}
              aria-label={`Toggle visibility of ${document.name}`}
              onChange={() =>
                dispatch(
                  setReferenceDocumentVisibility({ documentId: document.id, visible: !document.visible }),
                )
              }
              className='accent-primary'
            />
            <span className='truncate text-foreground' title={document.name}>
              {document.name}
            </span>
            <span className='font-mono'>
              {document.content === 'solids' ? document.solids.length : document.primitives.length}
            </span>
            <button
              type='button'
              aria-label={`Remove ${document.name}`}
              onClick={() => dispatch(removeReferenceDocument({ documentId: document.id }))}
              className={REMOVE_BUTTON_CLASS}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
