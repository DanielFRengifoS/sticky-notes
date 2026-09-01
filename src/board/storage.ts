import type { NoteRect } from './geometry';
import type { Note } from './notes';

export const STORAGE_KEY = 'sticky-notes-ts:document';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidRect(value: unknown): value is NoteRect {
  return (
    isRecord(value) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height)
  );
}

function parseNote(value: unknown): Note | null {
  if (!isRecord(value)) return null;

  const { id, rect, text } = value;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isValidRect(rect)) return null;
  if (typeof text !== 'string') return null;

  return {
    id,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    text,
  };
}

export function parsePersistedNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return [];

  const notes: Note[] = [];
  for (const entry of value) {
    const note = parseNote(entry);
    if (note !== null) notes.push(note);
  }
  return notes;
}

export function loadNotes(storage: Storage): Note[] {
  // getItem itself throws when the browser blocks storage, and a value written
  // during a crash will not parse
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    return parsePersistedNotes(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveNotes(storage: Storage, notes: Note[]): void {
  // a full quota throws here; dropping the save beats taking the board down
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch {
    return;
  }
}
