import type { NoteRect } from './geometry';

export type NoteId = string;

export interface Note {
  id: NoteId;
  rect: NoteRect;
  text: string;
}

export interface NotesState {
  notes: Note[];
}

export const MAX_NOTE_TEXT_LENGTH = 5000;

export type NotesAction =
  | { type: 'notesHydrated'; notes: Note[] }
  | { type: 'noteAdded'; note: Note }
  | { type: 'noteRectCommitted'; noteId: NoteId; rect: NoteRect }
  | { type: 'noteTextChanged'; noteId: NoteId; text: string }
  | { type: 'noteBroughtToFront'; noteId: NoteId }
  | { type: 'noteRemoved'; noteId: NoteId };

export const initialNotesState: NotesState = { notes: [] };

function rectsEqual(a: NoteRect, b: NoteRect): boolean {
  return (
    a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
  );
}

export function notesReducer(
  state: NotesState,
  action: NotesAction,
): NotesState {
  switch (action.type) {
    case 'notesHydrated':
      return { notes: action.notes };

    case 'noteAdded':
      return { notes: [...state.notes, action.note] };

    case 'noteRectCommitted': {
      const target = state.notes.find((note) => note.id === action.noteId);
      // cards are memoised on the note object, and pressing a note without dragging
      // commits the rect it already has
      if (target !== undefined && rectsEqual(target.rect, action.rect)) {
        return state;
      }
      return {
        notes: state.notes.map((note) =>
          note.id === action.noteId ? { ...note, rect: action.rect } : note,
        ),
      };
    }

    case 'noteTextChanged': {
      const text = action.text.slice(0, MAX_NOTE_TEXT_LENGTH);
      return {
        notes: state.notes.map((note) =>
          note.id === action.noteId ? { ...note, text } : note,
        ),
      };
    }

    case 'noteBroughtToFront': {
      const target = state.notes.find((note) => note.id === action.noteId);
      if (target === undefined || state.notes.at(-1) === target) return state;
      return {
        notes: [
          ...state.notes.filter((note) => note.id !== action.noteId),
          target,
        ],
      };
    }

    case 'noteRemoved':
      return { notes: state.notes.filter((note) => note.id !== action.noteId) };

    default:
      return state;
  }
}
