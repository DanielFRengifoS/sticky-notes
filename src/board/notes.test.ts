import { describe, expect, it } from 'vitest';

import {
  MAX_NOTE_TEXT_LENGTH,
  initialNotesState,
  notesReducer,
  type Note,
  type NotesState,
} from './notes';
import type { NoteRect } from './geometry';

function makeNote(
  id: string,
  text = '',
  rect: NoteRect = { x: 0, y: 0, width: 160, height: 120 },
): Note {
  return { id, rect, text };
}

function twoNotes(): NotesState {
  return { notes: [makeNote('a'), makeNote('b', 'keep')] };
}

describe('notesReducer', () => {
  it('ignores a rect commit that matches the current rect', () => {
    const state = twoNotes();
    expect(
      notesReducer(state, {
        type: 'noteRectCommitted',
        noteId: 'a',
        rect: { x: 0, y: 0, width: 160, height: 120 },
      }),
    ).toBe(state);
  });

  it('ignores bringing the frontmost note to the front', () => {
    const state = twoNotes();
    expect(
      notesReducer(state, { type: 'noteBroughtToFront', noteId: 'b' }),
    ).toBe(state);
  });

  it('replaces only the committed note and keeps the other reference', () => {
    const a = makeNote('a', 'old');
    const b = makeNote('b', 'keep');
    const state: NotesState = { notes: [a, b] };

    const next = notesReducer(state, {
      type: 'noteRectCommitted',
      noteId: 'a',
      rect: { x: 10, y: 20, width: 200, height: 150 },
    });

    expect(next).not.toBe(state);
    expect(next.notes[0]).not.toBe(a);
    expect(next.notes[0]?.rect).toEqual({
      x: 10,
      y: 20,
      width: 200,
      height: 150,
    });
    expect(next.notes[1]).toBe(b);
  });

  it('truncates text at the maximum length', () => {
    const state: NotesState = { notes: [makeNote('a')] };

    const next = notesReducer(state, {
      type: 'noteTextChanged',
      noteId: 'a',
      text: 'x'.repeat(MAX_NOTE_TEXT_LENGTH + 10),
    });

    expect(next.notes[0]?.text).toHaveLength(MAX_NOTE_TEXT_LENGTH);
  });

  it('hydrates, adds, reorders, and removes while preserving unaffected references', () => {
    const a = makeNote('a');
    const b = makeNote('b');
    const c = makeNote('c');

    const hydrated = notesReducer(initialNotesState, {
      type: 'notesHydrated',
      notes: [a, b],
    });
    expect(hydrated.notes).toEqual([a, b]);

    const added = notesReducer(hydrated, { type: 'noteAdded', note: c });
    expect(added.notes.map((note) => note.id)).toEqual(['a', 'b', 'c']);

    const fronted = notesReducer(added, {
      type: 'noteBroughtToFront',
      noteId: 'a',
    });
    expect(fronted.notes.map((note) => note.id)).toEqual(['b', 'c', 'a']);
    expect(fronted.notes[0]).toBe(b);

    const removed = notesReducer(fronted, { type: 'noteRemoved', noteId: 'c' });
    expect(removed.notes.map((note) => note.id)).toEqual(['b', 'a']);
  });
});
