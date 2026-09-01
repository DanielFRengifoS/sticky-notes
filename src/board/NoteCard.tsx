import { memo, useLayoutEffect, useRef, type PointerEvent } from 'react';
import type { NoteRect } from './geometry';
import type { Note, NoteId } from './notes';

interface NoteCardProps {
  note: Note;
  previewRect: NoteRect | null;
  selected: boolean;
  shouldFocus: boolean;
  onTextChange: (noteId: NoteId, text: string) => void;
  onNoteInteraction: (noteId: NoteId) => void;
  onHeaderPointerDown: (
    noteId: NoteId,
    event: PointerEvent<HTMLDivElement>,
  ) => void;
  onResizePointerDown: (
    noteId: NoteId,
    event: PointerEvent<HTMLDivElement>,
  ) => void;
  onFocused: (noteId: NoteId) => void;
}

function NoteCardComponent({
  note,
  previewRect,
  selected,
  shouldFocus,
  onTextChange,
  onNoteInteraction,
  onHeaderPointerDown,
  onResizePointerDown,
  onFocused,
}: NoteCardProps) {
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const rect = previewRect ?? note.rect;

  useLayoutEffect(() => {
    if (!shouldFocus) return;
    editorRef.current?.focus();
    onFocused(note.id);
  }, [shouldFocus, note.id, onFocused]);

  return (
    <div
      className="noteCard"
      data-selected={selected}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    >
      <div
        className="noteHeader"
        onPointerDown={(event) => onHeaderPointerDown(note.id, event)}
      />

      <textarea
        ref={editorRef}
        className="noteEditor"
        aria-label="Note text"
        value={note.text}
        onChange={(event) => onTextChange(note.id, event.target.value)}
        onPointerDown={(event) => {
          onNoteInteraction(note.id);
          event.stopPropagation();
        }}
        onFocus={() => onNoteInteraction(note.id)}
      />

      <div
        className="resizeHandle"
        aria-hidden="true"
        onPointerDown={(event) => onResizePointerDown(note.id, event)}
      />
    </div>
  );
}

export const NoteCard = memo(NoteCardComponent);
