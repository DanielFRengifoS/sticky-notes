import { describe, expect, it } from 'vitest';

import {
  createRectFromDrag,
  hasReachedCreateThreshold,
  moveRect,
  pointInside,
  resizeRect,
  type Size,
} from './geometry';

const board: Size = { width: 1000, height: 800 };

describe('geometry', () => {
  it('creates a rectangle from a down-right drag', () => {
    expect(
      createRectFromDrag({ x: 100, y: 100 }, { x: 400, y: 300 }, board),
    ).toEqual({
      x: 100,
      y: 100,
      width: 300,
      height: 200,
    });
  });

  it('creates a rectangle from an up-left drag', () => {
    expect(
      createRectFromDrag({ x: 500, y: 400 }, { x: 300, y: 250 }, board),
    ).toEqual({
      x: 300,
      y: 250,
      width: 200,
      height: 150,
    });
  });

  it('ignores drags under the threshold', () => {
    expect(hasReachedCreateThreshold({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(
      false,
    );
    expect(hasReachedCreateThreshold({ x: 0, y: 0 }, { x: 6, y: 0 })).toBe(
      true,
    );
  });

  it('grows to min size, or the whole board when thats smaller', () => {
    const smallBoard: Size = { width: 100, height: 80 };
    expect(
      createRectFromDrag({ x: 0, y: 0 }, { x: 50, y: 40 }, smallBoard),
    ).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 80,
    });
  });

  it('moves a note by the pointer delta', () => {
    const initial = { x: 100, y: 100, width: 160, height: 120 };
    expect(moveRect(initial, { x: 0, y: 0 }, { x: 50, y: 30 }, board)).toEqual({
      x: 150,
      y: 130,
      width: 160,
      height: 120,
    });
  });

  it('clamps move to the board', () => {
    expect(
      moveRect(
        { x: 900, y: 700, width: 160, height: 120 },
        { x: 0, y: 0 },
        { x: 500, y: 500 },
        board,
      ),
    ).toEqual({ x: 840, y: 680, width: 160, height: 120 });

    expect(
      moveRect(
        { x: 100, y: 100, width: 160, height: 120 },
        { x: 0, y: 0 },
        { x: -500, y: -500 },
        board,
      ),
    ).toEqual({ x: 0, y: 0, width: 160, height: 120 });
  });

  it('refuses to resize a note below its minimum size', () => {
    expect(
      resizeRect(
        { x: 100, y: 100, width: 160, height: 120 },
        { x: 0, y: 0 },
        { x: -50, y: -50 },
        board,
      ),
    ).toEqual({ x: 100, y: 100, width: 160, height: 120 });
  });

  it('stops a resize at the board edge', () => {
    expect(
      resizeRect(
        { x: 100, y: 100, width: 160, height: 120 },
        { x: 0, y: 0 },
        { x: 10000, y: 10000 },
        board,
      ),
    ).toEqual({ x: 100, y: 100, width: 900, height: 700 });
  });

  it('treats the trash edge as outside the trash', () => {
    const trash = { x: 100, y: 100, width: 100, height: 100 };
    expect(pointInside({ x: 100, y: 150 }, trash)).toBe(false);
    expect(pointInside({ x: 200, y: 150 }, trash)).toBe(false);
    expect(pointInside({ x: 150, y: 150 }, trash)).toBe(true);
  });
});
