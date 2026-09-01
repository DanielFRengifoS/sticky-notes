export interface ClientPoint {
  clientX: number;
  clientY: number;
}

export interface BoardPoint {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface NoteRect extends BoardPoint, Size {}

export interface BoardBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

const MIN_NOTE_WIDTH = 160;
const MIN_NOTE_HEIGHT = 120;
const MIN_CREATE_DRAG_DISTANCE = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function availableSize(boardSize: Size): Size {
  return {
    width: Math.max(0, Math.floor(boardSize.width)),
    height: Math.max(0, Math.floor(boardSize.height)),
  };
}

export function toBoardPoint(
  point: ClientPoint,
  bounds: BoardBounds,
): BoardPoint {
  return {
    x: point.clientX - bounds.left,
    y: point.clientY - bounds.top,
  };
}

export function hasReachedCreateThreshold(
  origin: BoardPoint,
  current: BoardPoint,
): boolean {
  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  return Math.hypot(dx, dy) >= MIN_CREATE_DRAG_DISTANCE;
}

export function clampRect(rect: NoteRect, boardSize: Size): NoteRect {
  const { width: availableWidth, height: availableHeight } =
    availableSize(boardSize);
  const minWidth = Math.min(MIN_NOTE_WIDTH, availableWidth);
  const minHeight = Math.min(MIN_NOTE_HEIGHT, availableHeight);
  const width = clamp(Math.round(rect.width), minWidth, availableWidth);
  const height = clamp(Math.round(rect.height), minHeight, availableHeight);
  const x = clamp(Math.round(rect.x), 0, availableWidth - width);
  const y = clamp(Math.round(rect.y), 0, availableHeight - height);
  return { x, y, width, height };
}

export function createRectFromDrag(
  origin: BoardPoint,
  current: BoardPoint,
  boardSize: Size,
): NoteRect {
  const minWidth = Math.min(MIN_NOTE_WIDTH, boardSize.width);
  const minHeight = Math.min(MIN_NOTE_HEIGHT, boardSize.height);
  const width = Math.max(Math.abs(current.x - origin.x), minWidth);
  const height = Math.max(Math.abs(current.y - origin.y), minHeight);
  const x = current.x >= origin.x ? origin.x : origin.x - width;
  const y = current.y >= origin.y ? origin.y : origin.y - height;
  return clampRect({ x, y, width, height }, boardSize);
}

export function moveRect(
  initialRect: NoteRect,
  pointerOrigin: BoardPoint,
  currentPointer: BoardPoint,
  boardSize: Size,
): NoteRect {
  const dx = currentPointer.x - pointerOrigin.x;
  const dy = currentPointer.y - pointerOrigin.y;
  return clampRect(
    {
      x: initialRect.x + dx,
      y: initialRect.y + dy,
      width: initialRect.width,
      height: initialRect.height,
    },
    boardSize,
  );
}

export function resizeRect(
  initialRect: NoteRect,
  pointerOrigin: BoardPoint,
  currentPointer: BoardPoint,
  boardSize: Size,
): NoteRect {
  const { width: availableWidth, height: availableHeight } =
    availableSize(boardSize);
  // x and y have to be clamped before the maxima are derived from them, otherwise a
  // note whose stored origin sits outside the board can be resized past the edge
  const x = clamp(Math.round(initialRect.x), 0, availableWidth);
  const y = clamp(Math.round(initialRect.y), 0, availableHeight);
  const maxWidth = availableWidth - x;
  const maxHeight = availableHeight - y;
  const minWidth = Math.min(MIN_NOTE_WIDTH, maxWidth);
  const minHeight = Math.min(MIN_NOTE_HEIGHT, maxHeight);
  const dx = currentPointer.x - pointerOrigin.x;
  const dy = currentPointer.y - pointerOrigin.y;
  const width = clamp(Math.round(initialRect.width + dx), minWidth, maxWidth);
  const height = clamp(
    Math.round(initialRect.height + dy),
    minHeight,
    maxHeight,
  );
  return { x, y, width, height };
}

// strict on all four sides on purpose: a pointer resting exactly on the trash border
// should not delete the note it is carrying
export function pointInside(p: BoardPoint, r: NoteRect): boolean {
  return p.x > r.x && p.x < r.x + r.width && p.y > r.y && p.y < r.y + r.height;
}
