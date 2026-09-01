import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { initialNotesState, notesReducer, type NoteId } from './notes';
import { clampRect, type NoteRect, type Size } from './geometry';
import { loadNotes, saveNotes } from './storage';
import { NoteCard } from './NoteCard';
import { useBoardGestures, type BoardTool } from './useBoardGestures';
import './Board.css';

type BoardPhase = 'measuring' | 'ready';

export function Board() {
  const [state, dispatch] = useReducer(notesReducer, initialNotesState);
  const [phase, setPhase] = useState<BoardPhase>('measuring');
  const [selectedId, setSelectedId] = useState<NoteId | null>(null);
  const [focusNoteId, setFocusNoteId] = useState<NoteId | null>(null);
  const [tool, setTool] = useState<BoardTool>('select');

  const boardSurfaceRef = useRef<HTMLDivElement>(null);
  const trashRef = useRef<HTMLDivElement>(null);

  // StrictMode runs the hydrate effect twice; without this gate the second pass reloads
  // storage and throws away edits made after the first
  const hydratedRef = useRef(false);

  useLayoutEffect(() => {
    if (hydratedRef.current) return;
    const surface = boardSurfaceRef.current;
    if (surface === null) return;
    const rect = surface.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    hydratedRef.current = true;

    const boardSize: Size = { width: rect.width, height: rect.height };
    const stored = loadNotes(window.localStorage);
    const normalized = stored.map((note) => ({
      ...note,
      rect: clampRect(note.rect, boardSize),
    }));
    dispatch({ type: 'notesHydrated', notes: normalized });
    setPhase('ready');
  }, []);

  useEffect(() => {
    if (phase !== 'ready') return;
    const timer = window.setTimeout(() => {
      saveNotes(window.localStorage, state.notes);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [phase, state.notes]);

  // handlers reaching NoteCard are memoized because it is memo'd; the ones the gesture
  // hook takes are plain, since it reads its params through a ref
  const handleTextChange = useCallback((noteId: NoteId, text: string) => {
    dispatch({ type: 'noteTextChanged', noteId, text });
  }, []);

  const handleNoteInteraction = useCallback((noteId: NoteId) => {
    setSelectedId(noteId);
    dispatch({ type: 'noteBroughtToFront', noteId });
  }, []);

  function handleCommitRect(noteId: NoteId, rect: NoteRect) {
    dispatch({ type: 'noteRectCommitted', noteId, rect });
  }

  function handleCreateNote(rect: NoteRect) {
    const id = crypto.randomUUID();
    dispatch({ type: 'noteAdded', note: { id, rect, text: '' } });
    setSelectedId(id);
    setFocusNoteId(id);
    setTool('select');
  }

  function handleToggleCreate() {
    setTool((current) => (current === 'create' ? 'select' : 'create'));
  }

  function handleDisarmCreateTool() {
    setTool('select');
  }

  function handleRemoveNote(noteId: NoteId) {
    dispatch({ type: 'noteRemoved', noteId });
    setSelectedId((current) => (current === noteId ? null : current));
    setFocusNoteId((current) => (current === noteId ? null : current));
  }

  const handleNoteFocused = useCallback((noteId: NoteId) => {
    setFocusNoteId((prev) => (prev === noteId ? null : prev));
  }, []);

  const {
    onBoardPointerDown,
    onHeaderPointerDown,
    onResizePointerDown,
    onBoardPointerMove,
    onBoardPointerUp,
    onBoardPointerCancel,
    onBoardLostPointerCapture,
    activeNotePreview,
    creationPreview,
    trashActive,
    gestureActive,
  } = useBoardGestures({
    boardSurfaceRef,
    trashRef,
    tool,
    getNoteRect: (id: NoteId) => state.notes.find((n) => n.id === id)?.rect,
    onInteractionStart: handleNoteInteraction,
    onCommitRect: handleCommitRect,
    onCreateNote: handleCreateNote,
    onRemoveNote: handleRemoveNote,
    onDisarmCreateTool: handleDisarmCreateTool,
  });

  function handleSurfacePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (phase !== 'ready') return;
    onBoardPointerDown(event);
    if (
      tool === 'select' &&
      event.target === event.currentTarget &&
      event.isPrimary &&
      event.button === 0
    ) {
      setSelectedId(null);
    }
  }

  return (
    <div className="board">
      <div className="toolbar">
        <button
          type="button"
          className="toolbarButton"
          aria-pressed={tool === 'create'}
          onClick={handleToggleCreate}
        >
          {tool === 'create' ? 'Drag on the board to create' : 'New note'}
        </button>
      </div>

      <div className="boardFrame">
        <div
          ref={boardSurfaceRef}
          className="boardSurface"
          data-gesture-active={gestureActive}
          data-tool={tool}
          onPointerDown={handleSurfacePointerDown}
          onPointerMove={onBoardPointerMove}
          onPointerUp={onBoardPointerUp}
          onPointerCancel={onBoardPointerCancel}
          onLostPointerCapture={onBoardLostPointerCapture}
        >
          {phase === 'ready' ? (
            <>
              {state.notes.length === 0 ? (
                <p className="emptyState">
                  Click "New note", then drag on the board to add one.
                </p>
              ) : null}

              {state.notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  previewRect={
                    activeNotePreview?.noteId === note.id
                      ? activeNotePreview.rect
                      : null
                  }
                  selected={selectedId === note.id}
                  shouldFocus={focusNoteId === note.id}
                  onTextChange={handleTextChange}
                  onNoteInteraction={handleNoteInteraction}
                  onHeaderPointerDown={onHeaderPointerDown}
                  onResizePointerDown={onResizePointerDown}
                  onFocused={handleNoteFocused}
                />
              ))}
            </>
          ) : null}

          {creationPreview ? (
            <div
              className="creationPreview"
              aria-hidden="true"
              style={{
                left: creationPreview.x,
                top: creationPreview.y,
                width: creationPreview.width,
                height: creationPreview.height,
              }}
            />
          ) : null}

          <div className="trashZone" ref={trashRef} data-active={trashActive}>
            <span className="trashIcon" aria-hidden="true">
              🗑
            </span>
            <span className="trashLabel">
              {trashActive ? 'Release to delete' : 'Trash'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
