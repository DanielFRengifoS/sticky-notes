import { describe, expect, it } from 'vitest';

import {
  STORAGE_KEY,
  loadNotes,
  parsePersistedNotes,
  saveNotes,
} from './storage';
import type { Note } from './notes';

function fakeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  } as unknown as Storage;
}

const throwingStorage = {
  getItem() {
    throw new Error('storage unavailable');
  },
  setItem() {
    throw new Error('storage unavailable');
  },
} as unknown as Storage;

function rawNote(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'note-1',
    rect: { x: 10, y: 20, width: 160, height: 120 },
    text: 'hello',
    ...overrides,
  };
}

describe('storage', () => {
  it('returns no notes for a payload that is not an array', () => {
    expect(parsePersistedNotes(null)).toEqual([]);
    expect(parsePersistedNotes(42)).toEqual([]);
    expect(parsePersistedNotes({ notes: [] })).toEqual([]);
  });

  it('skips malformed entries and keeps their valid siblings', () => {
    const notes = parsePersistedNotes([
      rawNote({ id: '' }),
      rawNote({ id: 7 }),
      rawNote({ rect: undefined }),
      rawNote({ rect: { x: 0, y: 20, width: '160', height: 120 } }),
      rawNote({ text: 123 }),
      'garbage',
      null,
      rawNote(),
    ]);

    expect(notes).toEqual([
      {
        id: 'note-1',
        rect: { x: 10, y: 20, width: 160, height: 120 },
        text: 'hello',
      },
    ]);
  });

  it('drops fields it does not know about', () => {
    const notes = parsePersistedNotes([rawNote({ color: 'red' })]);

    expect(notes[0]).toEqual({
      id: 'note-1',
      rect: { x: 10, y: 20, width: 160, height: 120 },
      text: 'hello',
    });
  });

  it('round-trips notes through save and load', () => {
    const storage = fakeStorage();
    const notes: Note[] = [
      { id: 'a', rect: { x: 1, y: 2, width: 160, height: 120 }, text: 'hi' },
    ];

    saveNotes(storage, notes);

    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify(notes));
    expect(loadNotes(storage)).toEqual(notes);
  });

  it('loads no notes from empty or broken storage', () => {
    expect(loadNotes(fakeStorage())).toEqual([]);
    expect(loadNotes(fakeStorage({ [STORAGE_KEY]: '{ broken' }))).toEqual([]);
  });

  it('tolerates storage read and write failures', () => {
    expect(loadNotes(throwingStorage)).toEqual([]);
    expect(() => saveNotes(throwingStorage, [])).not.toThrow();
  });
});
